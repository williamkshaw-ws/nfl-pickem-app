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
import { calculateWeeklyResults, calculateSeasonStandings } from "@/lib/scoring";

// Throttle automatic ESPN sync on page load to at most once every 60 seconds per week
const lastAutoSyncByWeek: Record<number, number> = {};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    const { league, isCommissioner } = await requireMember(leagueId, caller.uid);

    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week");

    const jsonDb = getDatabase();
    const gamesByWeek = jsonDb.gamesByWeek;
    const detectedWeek = detectCurrentWeek(gamesByWeek);

    const rawSettings = league.settings || {};
    // Automatically advance to the detected current NFL week as weeks complete
    const effectiveCurrentWeek = Math.max(detectedWeek, rawSettings.currentWeek || 1);

    // If the week has naturally rolled forward, update Firestore settings in background
    if (detectedWeek > (rawSettings.currentWeek || 1)) {
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
    let eliminatorStatus: any[] = [];
    if (settings.eliminatorEnabled) {
      const limit = Math.max(activeWeek, settings.currentWeek);

      // Pre-compute picks and outcomes for each user and week
      const userPicksByWeek: Record<string, Record<number, any>> = {};
      const userResultByWeek: Record<string, Record<number, "won" | "lost" | "pending">> = {};

      for (const u of users) {
        userPicksByWeek[u.id] = {};
        userResultByWeek[u.id] = {};

        for (let w = 1; w <= limit; w++) {
          const userPick = rawAllPicks.find((p) => p.userId === u.id && p.week === w);
          const elimPick = userPick?.eliminatorPick;
          const gamesForW = gamesByWeek[w] || [];

          if (elimPick) {
            const game = gamesForW.find(
              (g: any) => g.homeTeam.id === elimPick || g.awayTeam.id === elimPick
            );

            let won = false;
            let lost = false;
            if (game && game.status.completed) {
              const homeScore = game.homeScore || 0;
              const awayScore = game.awayScore || 0;
              if (elimPick === game.homeTeam.id && homeScore > awayScore) won = true;
              else if (elimPick === game.awayTeam.id && awayScore > homeScore) won = true;
              else lost = true;
            }

            const pickedTeam = game
              ? game.homeTeam.id === elimPick
                ? game.homeTeam
                : game.awayTeam
              : undefined;

            // Only reveal pick to other players once that game is locked/started
            const isPickLocked = game ? isGameLocked(game, gamesForW, settings.lockPolicy, now) : false;
            const hideToCaller = u.id !== caller.uid && !isPickLocked;

            const res: "won" | "lost" | "pending" = won ? "won" : lost ? "lost" : "pending";
            userResultByWeek[u.id][w] = res;

            userPicksByWeek[u.id][w] = {
              teamId: hideToCaller ? "HIDDEN" : elimPick,
              abbreviation: hideToCaller ? "Hidden" : pickedTeam?.abbreviation || elimPick,
              logo: hideToCaller ? undefined : pickedTeam?.logo,
              result: res,
            };
          } else {
            // User did not make an eliminator pick for week w
            const isWeekPast = w < settings.currentWeek;
            const isWeekComplete = gamesForW.length > 0 && gamesForW.every((g: any) => g.status?.completed);
            const isWeekFullyLocked = gamesForW.length > 0 && gamesForW.every((g: any) => isGameLocked(g, gamesForW, settings.lockPolicy, now));

            if (isWeekPast || isWeekComplete || isWeekFullyLocked) {
              userResultByWeek[u.id][w] = "lost";
            } else {
              userResultByWeek[u.id][w] = "pending";
            }
          }
        }
      }

      // Track active survivors week by week
      let activeSurvivors = users.map((u) => u.id);
      const eliminatedWeekByUser: Record<string, number> = {};

      for (let w = 1; w <= limit; w++) {
        // Only evaluate weeks where at least one person in the league made a survivor pick
        const weekHadSurvivorPicks = rawAllPicks.some((p) => p.week === w && !!p.eliminatorPick);
        if (!weekHadSurvivorPicks) continue;

        // If at most one survivor remains, pool has concluded
        if (activeSurvivors.length <= 1) break;

        const winners: string[] = [];
        const inProgress: string[] = [];
        const losers: string[] = [];

        for (const uid of activeSurvivors) {
          const res = userResultByWeek[uid][w];
          if (res === "won") winners.push(uid);
          else if (res === "pending") inProgress.push(uid);
          else losers.push(uid);
        }

        if (inProgress.length > 0) {
          // Week is still in progress for active survivors
          if (winners.length > 0) {
            // At least one survivor has already won; players who lost cannot be saved by mutual wipeout
            for (const uid of losers) {
              eliminatedWeekByUser[uid] = w;
            }
            activeSurvivors = activeSurvivors.filter((uid) => !losers.includes(uid));
          }
          // If winners.length === 0, wait until games finish (could be mutual wipeout)
        } else {
          // All games finished for active survivors in week w
          if (winners.length > 0) {
            // Regular elimination: losers are eliminated, winners survive
            for (const uid of losers) {
              eliminatedWeekByUser[uid] = w;
            }
            activeSurvivors = winners;
          } else {
            // MUTUAL WIPEOUT!
            // Everyone remaining was eliminated with no winners.
            // Under the resurrection rule, all active survivors stay alive and advance to next week.
          }
        }
      }

      eliminatorStatus = users.map((u) => {
        const isAlive = activeSurvivors.includes(u.id);
        return {
          userId: u.id,
          status: isAlive ? "Alive" : "Eliminated",
          eliminatedWeek: isAlive ? undefined : eliminatedWeekByUser[u.id],
          picksByWeek: userPicksByWeek[u.id] || {},
        };
      });
    }

    const activeUserPicks = rawAllPicks.find(
      (p) => p.userId === caller.uid && p.week === activeWeek
    );

    return NextResponse.json({
      settings,
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
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) {
        sanitizedUpdates[key] = body[key];
      }
    }

    const newSettings = { ...currentSettings, ...sanitizedUpdates };
    await leagueRef.update({
      settings: newSettings,
      name: newSettings.leagueName || docSnap.data()?.name,
    });

    return NextResponse.json({ success: true, settings: newSettings });
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
