import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  simulatePlayoffOutcomes,
  rankBracketParticipants,
  calculateBracketScore,
  extractBracketCode,
  SimulationResults,
  BracketParticipant,
  BracketPool,
} from "@/lib/playoff-bracket";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_simulate:${ip}`, 30, 60_000, "Too many simulation requests. Please slow down.");

    const caller = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const rawPoolId = body?.poolId;
    const cleanPoolId = rawPoolId ? extractBracketCode(rawPoolId) : null;

    if (!cleanPoolId) {
      return NextResponse.json({ error: "Missing or invalid pool ID for simulation" }, { status: 400 });
    }

    const action = body.action || "simulate";
    const db = adminDb();

    let poolRef = db.collection("bracket_pools").doc(cleanPoolId);
    let poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanPoolId)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        poolDoc = qSnap.docs[0];
        poolRef = poolDoc.ref;
      }
    }

    if (!poolDoc.exists) {
      return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
    }

    const poolData = poolDoc.data() as BracketPool;
    const poolId = poolDoc.id;

    // Verify caller is commissioner
    if (poolData.creatorUserId !== caller.uid) {
      return NextResponse.json(
        { error: "Unauthorized: only the commissioner can simulate game outcomes" },
        { status: 403 }
      );
    }

    let results: SimulationResults = {};
    let isSimulated = false;
    let isLocked = false;
    let simulatedAt: string | null = null;

    if (action === "simulate") {
      results = simulatePlayoffOutcomes();
      isSimulated = true;
      isLocked = true; // Lock bracket when simulation outcomes are active
      simulatedAt = new Date().toISOString();
    } else if (action === "reset") {
      isSimulated = false;
      isLocked = false; // Unlock bracket when resetting to unplayed state
      simulatedAt = null;
    }

    // Save simulation state to the pool
    await poolRef.set(
      {
        results,
        isSimulated,
        isLocked,
        simulatedAt,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Fetch all members in this pool
    const entriesSnapshot = await db
      .collection("bracket_memberships")
      .where("poolId", "==", poolId)
      .get();

    const rawParticipants: BracketParticipant[] = [];

    entriesSnapshot.forEach((doc) => {
      const data = doc.data();
      const scoreRes = calculateBracketScore(data.picks || {}, results, data.tiebreaker || undefined);
      rawParticipants.push({
        id: data.userId || doc.id,
        userId: data.userId || doc.id,
        userName: data.userName || "Participant",
        userAvatar: data.userAvatar || "bg-emerald-600",
        picks: data.picks || {},
        tiebreaker: data.tiebreaker || undefined,
        score: scoreRes.score,
        superBowlWinner: data.picks?.super_bowl || "",
        updatedAt: data.updatedAt || "",
      });
    });

    // Rank participants with 3-tier tiebreaker
    const rankedLeaderboard = rankBracketParticipants(rawParticipants, results);

    // Update scores in database batch
    const batch = db.batch();
    for (const p of rankedLeaderboard) {
      batch.update(db.collection("bracket_memberships").doc(`${p.userId}_${poolId}`), {
        score: p.score,
      });
    }

    if (!entriesSnapshot.empty) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      action,
      results,
      isSimulated,
      isLocked,
      simulatedAt,
      leaderboard: rankedLeaderboard,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error running bracket simulation:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run simulation" },
      { status: 500 }
    );
  }
}
