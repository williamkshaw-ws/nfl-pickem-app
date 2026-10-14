import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  requireVerifiedUser,
  requireMember,
  adminDb,
  errorResponse,
  isGameLocked,
  HttpError,
} from "@/lib/server-auth";
import { getDatabase } from "@/lib/storage";
import { calculateSurvivorStatus } from "@/lib/scoring";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireVerifiedUser(request);
    const { id: leagueId } = await params;
    const { league, isCommissioner } = await requireMember(leagueId, caller.uid);

    const body = await request.json();
    const { userId, week, picks, tiebreaker, eliminatorPick } = body;

    const targetWeek = Number(week);
    if (!targetWeek || targetWeek < 1 || targetWeek > 18) {
      throw new HttpError(400, "Invalid week number (must be 1-18)");
    }

    const targetUserId = userId && typeof userId === "string" ? userId : caller.uid;

    // Only the commissioner can submit picks on behalf of another user
    if (targetUserId !== caller.uid && !isCommissioner) {
      throw new HttpError(403, "You can only submit picks for your own account");
    }

    const db = adminDb();
    const pickDocId = `${leagueId}_${targetUserId}_${targetWeek}`;
    const pickRef = db.collection("picks").doc(pickDocId);
    const existingSnap = await pickRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    const existingPicksMap = existingData?.picks || {};
    const existingElimPick = existingData?.eliminatorPick;

    const jsonDb = getDatabase();
    const currentWeek = league.settings?.currentWeek || jsonDb.settings?.currentWeek || 1;
    const weekGames = jsonDb.gamesByWeek[targetWeek] || [];
    const lockPolicy = league.settings?.lockPolicy || "game";
    const now = Date.now();

    // If caller is commissioner and requesting override (or acting on behalf of another user), allow override
    const isOverride = isCommissioner && (body.isOverride === true || targetUserId !== caller.uid);

    if (eliminatorPick !== undefined && eliminatorPick !== null && typeof eliminatorPick !== "string") {
      throw new HttpError(400, "Invalid survivor pick");
    }

    // Sanitize incoming picks: must be a plain object of string gameId -> string teamId,
    // restricted to real games of this week (prevents storing arbitrary junk/huge payloads).
    const validGameIds = new Set<string>(weekGames.map((g: any) => String(g.id)));
    const safePicks: Record<string, string> = {};
    if (picks && typeof picks === "object" && !Array.isArray(picks)) {
      const entries = Object.entries(picks);
      if (entries.length > 64) {
        throw new HttpError(400, "Too many picks submitted");
      }
      for (const [gameId, pickedTeamId] of entries) {
        if (typeof pickedTeamId !== "string" || pickedTeamId.length > 20) continue;
        if (validGameIds.size > 0 && !validGameIds.has(gameId)) continue;
        safePicks[gameId] = pickedTeamId;
      }
    }

    // 1. Validate pick'em locks per-game (resilient to locked games in batch submissions)
    const lockedIgnoredGames: string[] = [];
    const finalPicksToSave: Record<string, string> = { ...existingPicksMap };

    for (const [gameId, pickedTeamId] of Object.entries(safePicks)) {
      const game = weekGames.find((g: any) => g.id === gameId);
      if (!game) continue;

      // Verify the picked team actually plays in this game
      if (pickedTeamId !== game.homeTeam.id && pickedTeamId !== game.awayTeam.id) {
        throw new HttpError(400, "Invalid team selection");
      }

      const locked = isGameLocked(game, weekGames, lockPolicy, now);

      // If game is locked and the pick changed, and not commissioner override:
      // Don't fail the entire submission! Keep the existing pick and record as locked
      if (!isOverride && locked) {
        if (pickedTeamId !== existingPicksMap[gameId]) {
          const matchLabel = `${game.awayTeam.abbreviation || game.awayTeam.name} @ ${game.homeTeam.abbreviation || game.homeTeam.name}`;
          lockedIgnoredGames.push(matchLabel);
          continue; // Preserve existing pick, don't overwrite with late pick
        }
      }

      finalPicksToSave[gameId] = pickedTeamId;
    }

    // 2. Validate survivor pick
    let survivorPickToSave = eliminatorPick;
    let survivorLockedIgnored = false;

    if (eliminatorPick && typeof eliminatorPick === "string" && eliminatorPick !== existingElimPick) {
      if (!isOverride) {
        // Enforce that eliminated players cannot make survivor picks in subsequent weeks
        const allLeaguePicksSnap = await db
          .collection("picks")
          .where("leagueId", "==", leagueId)
          .get();
        const allLeagueMembersSnap = await db
          .collection("memberships")
          .where("leagueId", "==", leagueId)
          .get();

        const memberUsers = allLeagueMembersSnap.docs.map((d) => ({ id: d.data().userId }));
        const rawPicks = allLeaguePicksSnap.docs.map((d) => d.data());

        const statuses = calculateSurvivorStatus(
          jsonDb.gamesByWeek,
          memberUsers,
          rawPicks,
          currentWeek,
          Math.max(targetWeek, currentWeek),
          lockPolicy,
          caller.uid,
          now
        );

        const myStatus = statuses.find((s) => s.userId === targetUserId);
        if (
          myStatus &&
          myStatus.status === "Eliminated" &&
          (myStatus.eliminatedWeek === undefined || myStatus.eliminatedWeek < targetWeek)
        ) {
          throw new HttpError(
            400,
            "You have been eliminated from the survivor pool and can no longer make survivor picks."
          );
        }
      }

      const elimGame = weekGames.find(
        (g: any) => g.homeTeam.id === eliminatorPick || g.awayTeam.id === eliminatorPick
      );
      if (!elimGame) {
        throw new HttpError(400, "Selected survivor team does not play this week");
      }
      if (!isOverride && isGameLocked(elimGame, weekGames, lockPolicy, now)) {
        if (Object.keys(safePicks).length === 0) {
          throw new HttpError(400, "Game is already locked for this survivor pick");
        } else {
          survivorLockedIgnored = true;
          survivorPickToSave = existingElimPick;
          const matchLabel = `${elimGame.awayTeam.abbreviation || elimGame.awayTeam.name} @ ${elimGame.homeTeam.abbreviation || elimGame.homeTeam.name}`;
          lockedIgnoredGames.push(`Survivor (${matchLabel})`);
        }
      }

      // Verify team hasn't been used in previous weeks (enforced for regular players only)
      if (!isOverride && !survivorLockedIgnored) {
        const allUserPicksSnap = await db
          .collection("picks")
          .where("leagueId", "==", leagueId)
          .where("userId", "==", targetUserId)
          .get();

        for (const doc of allUserPicksSnap.docs) {
          const p = doc.data();
          if (p.week !== targetWeek && p.eliminatorPick === eliminatorPick) {
            throw new HttpError(400, "You have already used this team in a previous week");
          }
        }
      }
    }

    // Clearing a survivor pick after its game has locked is not allowed
    if ((eliminatorPick === null || eliminatorPick === "") && existingElimPick && !isOverride) {
      const existingElimGame = weekGames.find(
        (g: any) => g.homeTeam.id === existingElimPick || g.awayTeam.id === existingElimPick
      );
      if (existingElimGame && isGameLocked(existingElimGame, weekGames, lockPolicy, now)) {
        if (Object.keys(safePicks).length === 0) {
          throw new HttpError(400, "Your survivor pick is locked and can't be removed");
        } else {
          survivorPickToSave = existingElimPick;
        }
      }
    }

    const savedAtIso = new Date().toISOString();

    const pickData: any = {
      id: pickDocId,
      leagueId,
      userId: targetUserId,
      week: targetWeek,
      picks: finalPicksToSave,
      updatedAt: savedAtIso,
    };

    if (tiebreaker && typeof tiebreaker === "object") {
      pickData.tiebreaker = {
        homeScore: Math.max(0, Number(tiebreaker.homeScore) || 0),
        awayScore: Math.max(0, Number(tiebreaker.awayScore) || 0),
        totalScore:
          Math.max(0, Number(tiebreaker.homeScore) || 0) +
          Math.max(0, Number(tiebreaker.awayScore) || 0),
      };
    }

    if (survivorPickToSave) {
      pickData.eliminatorPick = survivorPickToSave;
    } else if (survivorPickToSave === null || survivorPickToSave === "") {
      pickData.eliminatorPick = FieldValue.delete();
    }

    await pickRef.set(pickData, { merge: true });

    // 3. Log commissioner override audit record if applicable
    if (isOverride) {
      try {
        await db.collection("leagues").doc(leagueId).collection("overrideLogs").add({
          commissionerId: caller.uid,
          targetUserId,
          week: targetWeek,
          timestamp: savedAtIso,
          previousPicks: existingPicksMap,
          newPicks: finalPicksToSave,
          previousEliminatorPick: existingElimPick || null,
          newEliminatorPick: survivorPickToSave || null,
          reason: body.overrideReason || "Commissioner Kickoff Override",
        });
      } catch (logErr) {
        console.warn("Failed to write commissioner override log:", logErr);
      }
    }

    return NextResponse.json({
      success: true,
      pick: pickData,
      savedAt: savedAtIso,
      lockedIgnored: lockedIgnoredGames,
      message:
        lockedIgnoredGames.length > 0
          ? `Picks saved! (Note: ${lockedIgnoredGames.join(", ")} already locked and remained unchanged)`
          : "Picks saved successfully!",
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
