import { NextResponse } from "next/server";
import {
  requireUser,
  requireMember,
  requireCommissioner,
  adminDb,
  errorResponse,
  isGameLocked,
  HttpError,
} from "@/lib/server-auth";
import { getDatabase, syncWeekFromEspn, detectCurrentWeek } from "@/lib/storage";
import { hashLeaguePassword } from "@/lib/league-password";
import { calculateWeeklyResults, calculateSeasonStandings, calculateSurvivorStatus } from "@/lib/scoring";
import { normalizeVenmoHandle } from "@/lib/payouts";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

// Throttle automatic ESPN sync on page load to at most once every 60 seconds per week
const lastAutoSyncByWeek: Record<number, number> = {};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`league_get:${ip}`, 120, 60_000);

    const { id: leagueId } = await params;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) {
      throw new HttpError(404, "League not found");
    }

    const authHeader = request.headers.get("authorization") || "";
    let caller: { uid: string; email?: string; emailVerified?: boolean } = {
      uid: "guest",
      email: "",
      emailVerified: false,
    };
    let league: any = null;
    let isCommissioner = false;

    if (authHeader.startsWith("Bearer ")) {
      try {
        const authedCaller = await requireUser(request);
        const memberData = await requireMember(leagueId, authedCaller.uid);
        caller = authedCaller;
        league = memberData.league;
        isCommissioner = memberData.isCommissioner;
      } catch {
        // If auth fails or user is not a member, fall back to guest read-only view
      }
    }

    if (!league) {
      const db = adminDb();
      const leagueSnap = await db.collection("leagues").doc(leagueId).get();
      if (!leagueSnap.exists) throw new HttpError(404, "League not found");
      league = leagueSnap.data()!;
      isCommissioner = false;
    }

    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week");

    const jsonDb = getDatabase();
    const gamesByWeek = jsonDb.gamesByWeek;
    const detectedWeek = detectCurrentWeek(gamesByWeek);

    const rawSettings = league.settings || {};
    // Always default to the detected current NFL week (rolling over every Tuesday)
    const effectiveCurrentWeek = detectedWeek;

    // Keep Firestore settings.currentWeek synced with the Tuesday-detected week
    if (caller.uid !== "guest" && detectedWeek !== (rawSettings.currentWeek || 1)) {
      adminDb().collection("leagues").doc(leagueId).update({
        "settings.currentWeek": detectedWeek,
      }).catch((err) => console.warn("Auto-update currentWeek warning:", err));
    }

    const settings = {
      leagueName: league.name || rawSettings.leagueName || "Untitled League",
      seasonYear: rawSettings.seasonYear || 2026,
      currentWeek: effectiveCurrentWeek,
      lockPolicy: rawSettings.lockPolicy || "game",
      tiebreakerRuleSummary: rawSettings.tiebreakerRuleSummary || "Closest to total points",
      eliminatorEnabled: rawSettings.eliminatorEnabled !== false,
      pickemEnabled: rawSettings.pickemEnabled !== false,
      commissionerId: league.commissionerId,
      // Never expose the actual league password to clients; only flag if one is set
      hasPassword: !!rawSettings.leaguePassword,
      entryFee: typeof rawSettings.entryFee === "number" ? rawSettings.entryFee : 0,
      weeklyFee: typeof rawSettings.weeklyFee === "number" ? rawSettings.weeklyFee : 0,
      seasonFee: typeof rawSettings.seasonFee === "number" ? rawSettings.seasonFee : 0,
      survivorFee: typeof rawSettings.survivorFee === "number" ? rawSettings.survivorFee : 0,
      weeklyStartWeek: typeof rawSettings.weeklyStartWeek === "number" ? rawSettings.weeklyStartWeek : 1,
      venmoHandle: typeof rawSettings.venmoHandle === "string" ? rawSettings.venmoHandle : "",
    };

    const activeWeek = weekParam ? parseInt(weekParam, 10) : settings.currentWeek;
    const now = Date.now();

    // Check if ESPN sync is needed
    const currentWeekGames = gamesByWeek[activeWeek] || [];
    const hasLiveGames = currentWeekGames.some((g: any) => 
      g.status?.state === "in" || 
      (!g.status?.completed && now >= new Date(g.date).getTime() && now <= new Date(g.date).getTime() + 4.5 * 3600 * 1000)
    );
    const hasPendingGames = currentWeekGames.some((g: any) => !g.status?.completed);
    const syncThrottle = hasLiveGames ? 20_000 : hasPendingGames ? 60_000 : 300_000;

    if (!lastAutoSyncByWeek[activeWeek] || now - lastAutoSyncByWeek[activeWeek] > syncThrottle) {
      lastAutoSyncByWeek[activeWeek] = now;
      if (hasLiveGames) {
        // Await fresh sync during live games so the response delivers the latest scores immediately
        try {
          const syncRes = await syncWeekFromEspn(activeWeek, settings.seasonYear || 2026);
          if (syncRes.synced && syncRes.games) {
            gamesByWeek[activeWeek] = syncRes.games;
          }
        } catch (syncErr) {
          console.warn("ESPN sync warning:", syncErr);
        }
      } else {
        syncWeekFromEspn(activeWeek, settings.seasonYear || 2026)
          .then(() => {
            if (activeWeek > 1 && !lastAutoSyncByWeek[activeWeek - 1]) {
              syncWeekFromEspn(activeWeek - 1, settings.seasonYear || 2026).catch(() => {});
            }
          })
          .catch((syncErr) => {
            console.warn("Background ESPN sync warning:", syncErr);
          });
      }
    }

    const db = adminDb();

    // Fetch memberships and picks in parallel
    const [memSnap, picksSnap] = await Promise.all([
      db.collection("memberships").where("leagueId", "==", leagueId).get(),
      db.collection("picks").where("leagueId", "==", leagueId).get(),
    ]);

    const userIds = memSnap.docs.map((doc) => doc.data().userId).filter(Boolean);

    // Fetch user profiles in parallel batches of 30
    const userChunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += 30) {
      userChunks.push(userIds.slice(i, i + 30));
    }

    const userSnaps = await Promise.all(
      userChunks.map((chunk) =>
        db.collection("users").where("id", "in", chunk).get()
      )
    );

    const users: any[] = [];
    userSnaps.forEach((userSnap) => {
      userSnap.docs.forEach((doc) => {
        const u = doc.data();
        users.push({
          id: u.id,
          name: u.name || "Unknown",
          username: u.username || "",
          avatarColor: u.avatarColor || "bg-emerald-600",
        });
      });
    });

    const rawAllPicks: any[] = picksSnap.docs.map((doc) => doc.data());

    const availableWeeks = Array.from({ length: 18 }, (_, i) => i + 1);

    const gamesForWeek = gamesByWeek[activeWeek] || [];

    // Tiebreaker game for active week
    const tbGame =
      gamesForWeek.find((g: any) => g.isTiebreakerGame) ||
      [...gamesForWeek].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const tbLocked = tbGame ? isGameLocked(tbGame, gamesForWeek, settings.lockPolicy, now) : false;

    // Mask picks for unlocked games and tiebreakers so other players cannot spy before kickoff
    const allPicks = rawAllPicks.map((p) => {
      if (p.userId === caller.uid) return p;
      if (isCommissioner) return p;

      const gamesForThisWeek = gamesByWeek[p.week] || [];

      // If all games in a past week are already completed/locked, return full record
      const allThisWeekLocked =
        gamesForThisWeek.length > 0 &&
        gamesForThisWeek.every((g: any) => isGameLocked(g, gamesForThisWeek, settings.lockPolicy, now));
      if (p.week < settings.currentWeek && allThisWeekLocked) {
        return p;
      }

      const maskedPicks: Record<string, string> = {};
      if (p.picks && typeof p.picks === "object") {
        for (const [gameId, pickedTeamId] of Object.entries(p.picks)) {
          if (!pickedTeamId) continue;
          const game = gamesForThisWeek.find((g: any) => g.id === gameId);
          if (game && isGameLocked(game, gamesForThisWeek, settings.lockPolicy, now)) {
            maskedPicks[gameId] = pickedTeamId as string;
          } else {
            maskedPicks[gameId] = "HIDDEN";
          }
        }
      }

      const thisTbGame =
        gamesForThisWeek.find((g: any) => g.isTiebreakerGame) ||
        [...gamesForThisWeek].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const thisTbLocked = thisTbGame ? isGameLocked(thisTbGame, gamesForThisWeek, settings.lockPolicy, now) : false;
      const maskedTb = thisTbLocked
        ? p.tiebreaker
        : p.tiebreaker
        ? { isHidden: true, totalScore: 0, homeScore: 0, awayScore: 0 }
        : undefined;

      let maskedElim: string | undefined = undefined;
      if (p.eliminatorPick) {
        const elimGame = gamesForThisWeek.find(
          (g: any) => g.homeTeam.id === p.eliminatorPick || g.awayTeam.id === p.eliminatorPick
        );
        if (elimGame && isGameLocked(elimGame, gamesForThisWeek, settings.lockPolicy, now)) {
          maskedElim = p.eliminatorPick;
        } else {
          maskedElim = "HIDDEN";
        }
      }

      return {
        ...p,
        picks: maskedPicks,
        tiebreaker: maskedTb,
        eliminatorPick: maskedElim,
      };
    });

    const isSeasonOver =
      settings.currentWeek > 18 ||
      (settings.currentWeek === 18 && gamesByWeek[18]?.every((g: any) => g.status.completed));

    // Calculate weekly results and standings using raw picks for accurate scoring
    const weeklyResults = calculateWeeklyResults(
      gamesForWeek,
      users,
      rawAllPicks,
      activeWeek
    );

    // Sanitize weekly results so other players' tiebreakers are not revealed before kickoff
    const sanitizedWeeklyResults = weeklyResults.map((r) => {
      if (r.userId === caller.uid || isCommissioner || tbLocked) {
        return r;
      }
      return {
        ...r,
        tiebreaker: undefined,
        tiebreakerExplanation: undefined,
      };
    });
    const seasonStandings = calculateSeasonStandings(gamesByWeek, users, rawAllPicks);

    // Calculate Eliminator / Survivor pool status
    const eliminatorStatus = settings.eliminatorEnabled
      ? calculateSurvivorStatus(
          gamesByWeek,
          users,
          rawAllPicks,
          settings.currentWeek,
          Math.max(activeWeek, settings.currentWeek),
          settings.lockPolicy,
          caller.uid,
          now
        )
      : [];

    const activeUserPicks = rawAllPicks.find(
      (p) => p.userId === caller.uid && p.week === activeWeek
    );

    let overrideLogs: any[] = [];
    const paidMembers: Record<string, boolean> = {};
    const callerMembership = memSnap.docs.find((d) => d.data().userId === caller.uid)?.data();
    const currentUserPaid = callerMembership?.paid === true;

    if (isCommissioner) {
      memSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId) {
          paidMembers[d.userId] = d.paid === true;
        }
      });

      try {
        const logsSnap = await db
          .collection("leagues")
          .doc(leagueId)
          .collection("overrideLogs")
          .orderBy("timestamp", "desc")
          .limit(25)
          .get();
        overrideLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (logErr) {
        console.warn("Error fetching override logs:", logErr);
      }
    }

    const isGuest = caller.uid === "guest";

    return NextResponse.json({
      settings: isGuest ? { ...settings, venmoHandle: "" } : settings,
      users,
      gamesByWeek,
      activeWeek,
      currentUserId: caller.uid,
      allPicks,
      activeUserPicks,
      weeklyResults: sanitizedWeeklyResults,
      seasonStandings,
      eliminatorStatus,
      availableWeeks,
      isSeasonOver,
      isCommissioner,
      isGuest,
      overrideLogs,
      paidMembers: isCommissioner ? paidMembers : undefined,
      payoutRecords: isCommissioner ? league.payoutRecords || {} : undefined,
      currentUserPaid: isGuest ? undefined : currentUserPaid,
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json();
    const db = adminDb();
    const leagueRef = db.collection("leagues").doc(leagueId);

    const docSnap = await leagueRef.get();
    if (!docSnap.exists) throw new HttpError(404, "League not found");

    const currentSettings = docSnap.data()?.settings || {};

    // Whitelist only allowed fields to prevent arbitrary writes
    const allowedFields = [
      "leagueName",
      "seasonYear",
      "currentWeek",
      "lockPolicy",
      "tiebreakerRuleSummary",
      "pickemEnabled",
      "eliminatorEnabled",
      "leaguePassword",
      "entryFee",
      "weeklyFee",
      "seasonFee",
      "survivorFee",
      "weeklyStartWeek",
      "venmoHandle",
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (!(key in body)) continue;
      const value = body[key];
      switch (key) {
        case "leagueName": {
          if (typeof value !== "string" || !value.trim() || value.trim().length > 50) {
            throw new HttpError(400, "League name must be 1-50 characters");
          }
          sanitizedUpdates[key] = value.trim();
          break;
        }
        case "seasonYear": {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 2020 || n > 2100) throw new HttpError(400, "Invalid season year");
          sanitizedUpdates[key] = n;
          break;
        }
        case "currentWeek": {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 1 || n > 18) throw new HttpError(400, "Week must be 1-18");
          sanitizedUpdates[key] = n;
          break;
        }
        case "lockPolicy": {
          if (value !== "game" && value !== "day" && value !== "week") {
            throw new HttpError(400, "Invalid lock policy");
          }
          sanitizedUpdates[key] = value;
          break;
        }
        case "tiebreakerRuleSummary": {
          if (typeof value !== "string" || value.length > 200) {
            throw new HttpError(400, "Tiebreaker summary must be 200 characters or fewer");
          }
          sanitizedUpdates[key] = value.trim();
          break;
        }
        case "pickemEnabled":
        case "eliminatorEnabled": {
          if (typeof value !== "boolean") throw new HttpError(400, `${key} must be true or false`);
          sanitizedUpdates[key] = value;
          break;
        }
        case "leaguePassword": {
          if (typeof value !== "string" || value.trim().length > 64) {
            throw new HttpError(400, "League password must be 64 characters or fewer");
          }
          // Never store plaintext; empty string clears the password
          sanitizedUpdates[key] = hashLeaguePassword(value);
          break;
        }
        case "entryFee": {
          const n = Number(value);
          if (isNaN(n) || n < 0 || n > 100000) {
            throw new HttpError(400, "Entry fee must be a valid number between $0 and $100,000");
          }
          sanitizedUpdates[key] = Math.round(n);
          break;
        }
        case "weeklyFee":
        case "seasonFee":
        case "survivorFee": {
          const n = Number(value);
          if (!isFinite(n) || n < 0 || n > 10000) {
            throw new HttpError(400, "Fees must be between $0 and $10,000");
          }
          sanitizedUpdates[key] = Math.round(n * 100) / 100;
          break;
        }
        case "weeklyStartWeek": {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 1 || n > 18) throw new HttpError(400, "Start week must be 1-18");
          sanitizedUpdates[key] = n;
          break;
        }
        case "venmoHandle": {
          const handle = normalizeVenmoHandle(value);
          if (handle === null) {
            throw new HttpError(400, "Venmo username must be 3-30 letters, numbers, - or _");
          }
          sanitizedUpdates[key] = handle;
          break;
        }
      }
    }

    const newSettings = { ...currentSettings, ...sanitizedUpdates };
    const updatedName = newSettings.leagueName || docSnap.data()?.name;
    await leagueRef.update({
      settings: newSettings,
      name: updatedName,
    });

    if (
      sanitizedUpdates.leagueName &&
      sanitizedUpdates.leagueName !== currentSettings.leagueName
    ) {
      const memSnap = await db
        .collection("memberships")
        .where("leagueId", "==", leagueId)
        .get();
      if (!memSnap.empty) {
        const batch = db.batch();
        memSnap.docs.forEach((mDoc) => {
          batch.update(mDoc.ref, { leagueName: sanitizedUpdates.leagueName });
        });
        await batch.commit().catch(() => {});
      }
    }

    const publicSettings = { ...newSettings };
    delete (publicSettings as any).leaguePassword;
    return NextResponse.json({ success: true, settings: { ...publicSettings, hasPassword: !!newSettings.leaguePassword } });
  } catch (err: any) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    await requireCommissioner(leagueId, caller.uid);

    const db = adminDb();

    // Delete the league
    await db.collection("leagues").doc(leagueId).delete();

    // Delete all memberships for this league
    const memSnap = await db.collection("memberships").where("leagueId", "==", leagueId).get();
    const batch = db.batch();
    memSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete all picks for this league
    const picksSnap = await db.collection("picks").where("leagueId", "==", leagueId).get();
    picksSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}
