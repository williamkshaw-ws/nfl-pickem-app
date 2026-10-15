import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import {
  BracketPicks,
  BracketParticipant,
  SimulationResults,
  calculateBracketScore,
} from "@/lib/playoff-bracket";

const PLAYOFFS_DOC_ID = "nfl_playoffs_2025";

export async function GET(request: Request) {
  try {
    const db = adminDb();

    // 1. Fetch simulation / game outcomes
    const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
    const stateData = stateDoc.exists ? stateDoc.data() : null;
    const results: SimulationResults = stateData?.results || {};
    const isSimulated: boolean = !!stateData?.isSimulated;
    const simulatedAt: string | undefined = stateData?.simulatedAt;

    // 2. Fetch all participant brackets for the leaderboard
    const entriesSnapshot = await db.collection("bracket_entries").get();
    const participants: BracketParticipant[] = [];

    entriesSnapshot.forEach((doc) => {
      const data = doc.data();
      const picks: BracketPicks = data.picks || {};
      const { score } = calculateBracketScore(picks, results);

      participants.push({
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

    // Sort leaderboard by score descending
    participants.sort((a, b) => b.score - a.score);

    // 3. Check if user is signed in to return their picks
    let currentUserEntry: BracketParticipant | null = null;
    try {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const caller = await requireUser(request);
        const userDoc = await db.collection("bracket_entries").doc(caller.uid).get();
        if (userDoc.exists) {
          const d = userDoc.data()!;
          const picks: BracketPicks = d.picks || {};
          const { score } = calculateBracketScore(picks, results);
          currentUserEntry = {
            id: caller.uid,
            userId: caller.uid,
            userName: d.userName || "You",
            userAvatar: d.userAvatar || "bg-emerald-600",
            picks,
            score,
            superBowlWinner: picks.super_bowl || "",
            updatedAt: d.updatedAt || "",
          };
        }
      }
    } catch {
      // Optional authentication on GET; unauthenticated users can still view public bracket & leaderboard
    }

    return NextResponse.json({
      success: true,
      results,
      isSimulated,
      simulatedAt,
      leaderboard: participants,
      currentUserEntry,
    });
  } catch (err: unknown) {
    console.error("Error fetching bracket data:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load bracket data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const body = await request.json().catch(() => null);
    const { picks, userName, userAvatar } = body || {};

    if (!picks || typeof picks !== "object") {
      return NextResponse.json({ error: "Invalid picks payload" }, { status: 400 });
    }

    const db = adminDb();

    // Fetch current playoff simulation outcomes to compute score
    const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
    const stateData = stateDoc.exists ? stateDoc.data() : null;
    const results: SimulationResults = stateData?.results || {};

    const { score } = calculateBracketScore(picks, results);

    const now = new Date().toISOString();
    const entryData: BracketParticipant = {
      id: caller.uid,
      userId: caller.uid,
      userName: userName?.trim() || "PocketPicks Fan",
      userAvatar: userAvatar || "bg-emerald-600",
      picks,
      score,
      superBowlWinner: picks.super_bowl || "",
      updatedAt: now,
    };

    await db.collection("bracket_entries").doc(caller.uid).set(entryData, { merge: true });

    return NextResponse.json({
      success: true,
      entry: entryData,
      score,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error saving bracket picks:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save picks" },
      { status: 500 }
    );
  }
}
