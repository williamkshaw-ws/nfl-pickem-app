import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  BracketPicks,
  BracketParticipant,
  SimulationResults,
  TiebreakerPrediction,
  rankBracketParticipants,
  generateSampleParticipants,
} from "@/lib/playoff-bracket";

const PLAYOFFS_DOC_ID = "nfl_playoffs_2025";
const DEFAULT_LOCK_TIME = "2026-01-10T21:30:00.000Z"; // Saturday Jan 10, 4:30 PM EST

export async function GET(request: Request) {
  try {
    const db = adminDb();

    // 1. Fetch simulation & lock state
    const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
    const stateData = stateDoc.exists ? stateDoc.data() : null;
    const results: SimulationResults = stateData?.results || {};
    const isSimulated: boolean = !!stateData?.isSimulated;
    const simulatedAt: string | undefined = stateData?.simulatedAt;
    const isLocked: boolean = stateData?.isLocked ?? false;
    const lockTime: string = stateData?.lockTime || DEFAULT_LOCK_TIME;

    // 2. Fetch all participant brackets for the leaderboard
    const entriesSnapshot = await db.collection("bracket_entries").get();
    const rawParticipants: BracketParticipant[] = [];

    entriesSnapshot.forEach((doc) => {
      const data = doc.data();
      const picks: BracketPicks = data.picks || {};
      const tiebreaker: TiebreakerPrediction | undefined = data.tiebreaker;

      rawParticipants.push({
        id: doc.id,
        userId: data.userId || doc.id,
        userName: data.userName || "Anonymous",
        userAvatar: data.userAvatar || "bg-emerald-600",
        picks,
        tiebreaker,
        score: data.score || 0,
        superBowlWinner: picks.super_bowl || "",
        updatedAt: data.updatedAt || "",
        isSample: !!data.isSample,
      });
    });

    // Rank participants using the 3-tier tiebreaker
    const leaderboard = rankBracketParticipants(rawParticipants, results);

    // 3. Check if user is signed in to return their picks
    let currentUserEntry: BracketParticipant | null = null;
    try {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const caller = await requireUser(request);
        const userDoc = await db.collection("bracket_entries").doc(caller.uid).get();
        if (userDoc.exists) {
          const d = userDoc.data()!;
          const userPicks: BracketPicks = d.picks || {};
          const userTiebreaker: TiebreakerPrediction | undefined = d.tiebreaker;

          currentUserEntry = {
            id: caller.uid,
            userId: caller.uid,
            userName: d.userName || "You",
            userAvatar: d.userAvatar || "bg-emerald-600",
            picks: userPicks,
            tiebreaker: userTiebreaker,
            score: d.score || 0,
            superBowlWinner: userPicks.super_bowl || "",
            updatedAt: d.updatedAt || "",
          };
        }
      }
    } catch {
      // Optional authentication on GET
    }

    return NextResponse.json({
      success: true,
      results,
      isSimulated,
      simulatedAt,
      isLocked,
      lockTime,
      leaderboard,
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
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_post:${ip}`, 60, 60_000, "Too many requests. Please wait a moment.");

    const caller = await requireUser(request);
    const body = await request.json().catch(() => null);
    const db = adminDb();

    // ACTION: Seed sample competitors for testing
    if (body?.action === "seed") {
      const sampleParticipants = generateSampleParticipants();
      const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
      const results: SimulationResults = stateDoc.exists ? stateDoc.data()?.results || {} : {};

      const batch = db.batch();
      for (const p of sampleParticipants) {
        batch.set(db.collection("bracket_entries").doc(p.id), p, { merge: true });
      }
      await batch.commit();

      const allEntriesSnap = await db.collection("bracket_entries").get();
      const list: BracketParticipant[] = [];
      allEntriesSnap.forEach((doc) => list.push(doc.data() as BracketParticipant));
      const ranked = rankBracketParticipants(list, results);

      return NextResponse.json({
        success: true,
        message: "Sample competitors added",
        leaderboard: ranked,
      });
    }

    // ACTION: Clear sample competitors
    if (body?.action === "clear_samples") {
      const entriesSnap = await db.collection("bracket_entries").where("isSample", "==", true).get();
      const batch = db.batch();
      entriesSnap.forEach((doc) => batch.delete(doc.ref));
      if (!entriesSnap.empty) {
        await batch.commit();
      }

      const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
      const results: SimulationResults = stateDoc.exists ? stateDoc.data()?.results || {} : {};

      const remainingSnap = await db.collection("bracket_entries").get();
      const list: BracketParticipant[] = [];
      remainingSnap.forEach((doc) => list.push(doc.data() as BracketParticipant));
      const ranked = rankBracketParticipants(list, results);

      return NextResponse.json({
        success: true,
        message: "Sample competitors cleared",
        leaderboard: ranked,
      });
    }

    // ACTION: Toggle lock
    if (body?.action === "toggle_lock") {
      const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
      const currentLocked = stateDoc.exists ? !!stateDoc.data()?.isLocked : false;
      const nextLocked = body.isLocked !== undefined ? !!body.isLocked : !currentLocked;

      await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).set(
        { isLocked: nextLocked, updatedAt: new Date().toISOString() },
        { merge: true }
      );

      return NextResponse.json({ success: true, isLocked: nextLocked });
    }

    // STANDARD ACTION: Save authenticated user picks & tiebreaker
    const { picks, tiebreaker, userName, userAvatar } = body || {};

    if (!picks || typeof picks !== "object") {
      return NextResponse.json({ error: "Invalid picks payload" }, { status: 400 });
    }

    // Check if bracket is locked
    const stateDoc = await db.collection("bracket_state").doc(PLAYOFFS_DOC_ID).get();
    const stateData = stateDoc.exists ? stateDoc.data() : null;
    const isLocked = stateData?.isLocked ?? false;
    if (isLocked) {
      return NextResponse.json({ error: "Brackets are locked. Picks cannot be changed." }, { status: 403 });
    }

    const results: SimulationResults = stateData?.results || {};

    // Validate tiebreaker if provided
    let cleanTiebreaker: TiebreakerPrediction | undefined = undefined;
    if (tiebreaker && typeof tiebreaker.homeScore === "number" && typeof tiebreaker.awayScore === "number") {
      const h = Math.max(0, Math.min(99, Math.round(tiebreaker.homeScore)));
      const a = Math.max(0, Math.min(99, Math.round(tiebreaker.awayScore)));
      cleanTiebreaker = {
        homeScore: h,
        awayScore: a,
        totalScore: h + a,
      };
    }

    const now = new Date().toISOString();
    const entryData: BracketParticipant = {
      id: caller.uid,
      userId: caller.uid,
      userName: userName?.trim() || "PocketPicks Fan",
      userAvatar: userAvatar || "bg-emerald-600",
      picks,
      tiebreaker: cleanTiebreaker,
      score: 0,
      superBowlWinner: picks.super_bowl || "",
      updatedAt: now,
    };

    await db.collection("bracket_entries").doc(caller.uid).set(entryData, { merge: true });

    // Fetch and re-rank leaderboard
    const allEntriesSnap = await db.collection("bracket_entries").get();
    const list: BracketParticipant[] = [];
    allEntriesSnap.forEach((doc) => list.push(doc.data() as BracketParticipant));
    const ranked = rankBracketParticipants(list, results);

    return NextResponse.json({
      success: true,
      entry: entryData,
      leaderboard: ranked,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error in bracket POST route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process request" },
      { status: 500 }
    );
  }
}
