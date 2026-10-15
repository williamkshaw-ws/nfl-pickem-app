import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-auth";
import {
  simulatePlayoffOutcomes,
  calculateBracketScore,
  SimulationResults,
  BracketPicks,
  BracketParticipant,
} from "@/lib/playoff-bracket";

const PLAYOFFS_DOC_ID = "nfl_playoffs_2025";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "simulate";
    const db = adminDb();

    let results: SimulationResults = {};
    let isSimulated = false;
    let simulatedAt: string | null = null;

    if (action === "simulate") {
      results = simulatePlayoffOutcomes();
      isSimulated = true;
      simulatedAt = new Date().toISOString();
    }

    // Save simulation state
    await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).set(
      {
        results,
        isSimulated,
        simulatedAt,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Recompute scores for all participant entries
    const entriesSnapshot = await db.collection("bracket_entries").get();
    const batch = db.batch();
    const updatedLeaderboard: BracketParticipant[] = [];

    entriesSnapshot.forEach((doc) => {
      const data = doc.data();
      const picks: BracketPicks = data.picks || {};
      const { score } = calculateBracketScore(picks, results);

      batch.update(doc.ref, { score });

      updatedLeaderboard.push({
        id: doc.id,
        userId: data.userId || doc.id,
        userName: data.userName || "Anonymous",
        userAvatar: data.userAvatar || "bg-emerald-600",
        picks,
        score,
        superBowlWinner: picks.super_bowl || "",
        updatedAt: data.updatedAt || "",
      });
    });

    if (!entriesSnapshot.empty) {
      await batch.commit();
    }

    // Sort leaderboard by score descending
    updatedLeaderboard.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      action,
      results,
      isSimulated,
      simulatedAt,
      leaderboard: updatedLeaderboard,
    });
  } catch (err: unknown) {
    console.error("Error running bracket simulation:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run simulation" },
      { status: 500 }
    );
  }
}
