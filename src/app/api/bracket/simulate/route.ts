import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  simulatePlayoffOutcomes,
  rankBracketParticipants,
  SimulationResults,
  BracketParticipant,
} from "@/lib/playoff-bracket";

const PLAYOFFS_DOC_ID = "nfl_playoffs_2025";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_simulate:${ip}`, 30, 60_000, "Too many simulation requests. Please slow down.");

    await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = body.action || "simulate";
    const db = adminDb();

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

    // Save simulation and lock state
    await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).set(
      {
        results,
        isSimulated,
        isLocked,
        simulatedAt,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Fetch all participant entries
    const entriesSnapshot = await db.collection("bracket_entries").get();
    const rawParticipants: BracketParticipant[] = [];

    entriesSnapshot.forEach((doc) => {
      const data = doc.data();
      rawParticipants.push({
        id: doc.id,
        userId: data.userId || doc.id,
        userName: data.userName || "Anonymous",
        userAvatar: data.userAvatar || "bg-emerald-600",
        picks: data.picks || {},
        tiebreaker: data.tiebreaker,
        score: 0,
        superBowlWinner: data.picks?.super_bowl || "",
        updatedAt: data.updatedAt || "",
        isSample: !!data.isSample,
      });
    });

    // Rank participants with 3-tier tiebreaker
    const rankedLeaderboard = rankBracketParticipants(rawParticipants, results);

    // Update scores in database batch
    const batch = db.batch();
    for (const p of rankedLeaderboard) {
      batch.update(db.collection("bracket_entries").doc(p.id), {
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
