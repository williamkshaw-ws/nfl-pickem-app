import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  requireUser,
  requireMember,
  adminDb,
  errorResponse,
  isGameLocked,
  HttpError,
} from "@/lib/server-auth";
import { getDatabase } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
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
    const weekGames = jsonDb.gamesByWeek[targetWeek] || [];
    const lockPolicy = league.settings?.lockPolicy || "game";
    const now = Date.now();

    // If caller is commissioner and requesting override (or acting on behalf of another user), allow override
    const isOverride = isCommissioner && (body.isOverride === true || targetUserId !== caller.uid);

    // 1. Validate pick'em locks
    if (picks && typeof picks === "object") {
      for (const [gameId, pickedTeamId] of Object.entries(picks)) {
        const game = weekGames.find((g: any) => g.id === gameId);
        if (!game) continue;

        // If game is locked and the pick changed, reject (unless commissioner override)
        if (!isOverride && isGameLocked(game, weekGames, lockPolicy, now)) {
          if (pickedTeamId !== existingPicksMap[gameId]) {
            throw new HttpError(
              400,
              `Picks for ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} are locked`
            );
          }
        }

        // Verify the picked team actually plays in this game
        if (pickedTeamId !== game.homeTeam.id && pickedTeamId !== game.awayTeam.id) {
          throw new HttpError(400, "Invalid team selection");
        }
      }
    }

    // 2. Validate survivor pick
    if (eliminatorPick && typeof eliminatorPick === "string" && eliminatorPick !== existingElimPick) {
      const elimGame = weekGames.find(
        (g: any) => g.homeTeam.id === eliminatorPick || g.awayTeam.id === eliminatorPick
      );
      if (!elimGame) {
        throw new HttpError(400, "Selected survivor team does not play this week");
      }
      if (!isOverride && isGameLocked(elimGame, weekGames, lockPolicy, now)) {
        throw new HttpError(400, "Game is already locked for this survivor pick");
      }

      // Verify team hasn't been used in previous weeks (enforced for regular players only)
      if (!isOverride) {
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

    const pickData: any = {
      id: pickDocId,
      leagueId,
      userId: targetUserId,
      week: targetWeek,
      picks: picks || {},
      updatedAt: new Date().toISOString(),
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

    if (eliminatorPick) {
      pickData.eliminatorPick = eliminatorPick;
    } else if (eliminatorPick === null || eliminatorPick === "") {
      pickData.eliminatorPick = FieldValue.delete();
    }

    await pickRef.set(pickData, { merge: true });

    return NextResponse.json({ success: true, pick: pickData });
  } catch (err: any) {
    return errorResponse(err);
  }
}
