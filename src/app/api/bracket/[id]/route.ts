import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  extractBracketCode,
  rankBracketParticipants,
  calculateBracketScore,
  BracketParticipant,
  BracketPool,
  BracketPicks,
  TiebreakerPrediction,
} from "@/lib/playoff-bracket";

const DEFAULT_LOCK_TIME = "2026-01-10T21:30:00.000Z";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const db = adminDb();
    let caller: { uid: string; email?: string } | null = null;
    try {
      caller = await requireUser(request);
    } catch {
      // Optional auth on GET
    }

    let poolDoc = await db.collection("bracket_pools").doc(cleanId).get();
    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanId)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        poolDoc = qSnap.docs[0];
      }
    }

    if (!poolDoc.exists) {
      return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
    }

    const poolData = poolDoc.data() as BracketPool;
    const poolId = poolDoc.id;
    const results = poolData.results || {};
    const isOwner = caller ? caller.uid === poolData.creatorUserId : false;

    // Fetch all memberships
    const membersSnap = await db
      .collection("bracket_memberships")
      .where("poolId", "==", poolId)
      .get();

    // Batch fetch user profiles for real name and avatar
    const userIds = Array.from(
      new Set(membersSnap.docs.map((d) => d.data().userId).filter(Boolean))
    );
    const userMap = new Map<string, { name?: string; username?: string; avatarColor?: string }>();
    if (userIds.length > 0) {
      const userDocs = await Promise.all(
        userIds.map((uid) => db.collection("users").doc(uid).get().catch(() => null))
      );
      userDocs.forEach((uDoc) => {
        if (uDoc && uDoc.exists) {
          const u = uDoc.data();
          userMap.set(uDoc.id, {
            name: u?.name,
            username: u?.username,
            avatarColor: u?.avatarColor,
          });
        }
      });
    }

    const rawParticipants: BracketParticipant[] = [];
    let currentUserEntry: BracketParticipant | null = null;
    let userRole: "commissioner" | "member" | "viewer" = "viewer";

    membersSnap.forEach((doc) => {
      const d = doc.data();
      const uProfile = userMap.get(d.userId);
      const resolvedName = uProfile?.name || uProfile?.username || d.userName || "Participant";
      const resolvedAvatar = uProfile?.avatarColor || d.userAvatar || "bg-emerald-600";
      const p: BracketParticipant = {
        id: d.userId || doc.id,
        userId: d.userId || doc.id,
        userName: resolvedName,
        userAvatar: resolvedAvatar,
        picks: d.picks || {},
        tiebreaker: d.tiebreaker || undefined,
        score: d.score || 0,
        superBowlWinner: d.picks?.super_bowl || "",
        updatedAt: d.updatedAt || "",
      };
      rawParticipants.push(p);

      if (caller && d.userId === caller.uid) {
        currentUserEntry = p;
        userRole = d.role === "commissioner" || isOwner ? "commissioner" : "member";
      }
    });

    if (caller && isOwner && userRole === "viewer") {
      userRole = "commissioner";
    }

    const leaderboard = rankBracketParticipants(rawParticipants, results);

    return NextResponse.json({
      success: true,
      pool: {
        id: poolId,
        joinCode: poolData.joinCode || poolId,
        name: poolData.name || "Playoff Bracket Challenge",
        creatorUserId: poolData.creatorUserId,
        creatorName: poolData.creatorName,
        isLocked: !!poolData.isLocked,
        lockTime: poolData.lockTime || DEFAULT_LOCK_TIME,
        results,
        isSimulated: !!poolData.isSimulated,
        simulatedAt: poolData.simulatedAt || null,
      },
      leaderboard,
      currentUserEntry,
      isOwner,
      role: userRole,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error in bracket [id] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load pool" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const db = adminDb();

    let poolRef = db.collection("bracket_pools").doc(cleanId);
    let poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanId)
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
    const isOwner = caller.uid === poolData.creatorUserId;

    // ACTION: Toggle lock (Commissioner only)
    if (body?.action === "toggle_lock") {
      if (!isOwner) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can lock or unlock this bracket" },
          { status: 403 }
        );
      }
      const nextLocked = body.isLocked !== undefined ? !!body.isLocked : !poolData.isLocked;
      await poolRef.set({ isLocked: nextLocked, updatedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ success: true, isLocked: nextLocked });
    }

    // ACTION: Rename pool (Commissioner only)
    if (body?.action === "rename") {
      if (!isOwner) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can rename this bracket" },
          { status: 403 }
        );
      }
      const newName = typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 60)
        : poolData.name;
      await poolRef.set({ name: newName, updatedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ success: true, name: newName });
    }

    // ACTION: Save picks & tiebreaker
    const { picks, tiebreaker, userName, userAvatar } = body || {};
    if (!picks || typeof picks !== "object") {
      return NextResponse.json({ error: "Missing picks payload" }, { status: 400 });
    }

    // Check lock status
    if (poolData.isLocked) {
      return NextResponse.json(
        { error: "This bracket is locked. Picks cannot be changed." },
        { status: 403 }
      );
    }

    const results = poolData.results || {};

    // Validate tiebreaker if provided
    let cleanTiebreaker: TiebreakerPrediction | null = null;
    if (tiebreaker && typeof tiebreaker.homeScore === "number" && typeof tiebreaker.awayScore === "number") {
      const h = Math.max(0, Math.min(99, Math.round(tiebreaker.homeScore)));
      const a = Math.max(0, Math.min(99, Math.round(tiebreaker.awayScore)));
      cleanTiebreaker = {
        homeScore: h,
        awayScore: a,
        totalScore: h + a,
      };
    }

    // Calculate score
    const scoreResult = calculateBracketScore(picks as BracketPicks, results, cleanTiebreaker || undefined);
    const now = new Date().toISOString();

    let finalUserName = userName?.trim();
    let finalUserAvatar = userAvatar;
    if (!finalUserName || !finalUserAvatar) {
      try {
        const uDoc = await db.collection("users").doc(caller.uid).get();
        if (uDoc.exists) {
          const u = uDoc.data();
          if (!finalUserName) finalUserName = u?.name || u?.username;
          if (!finalUserAvatar) finalUserAvatar = u?.avatarColor;
        }
      } catch {}
    }
    if (!finalUserName) finalUserName = caller.email?.split("@")[0] || "Participant";
    if (!finalUserAvatar) finalUserAvatar = "bg-emerald-600";

    const membershipId = `${caller.uid}_${poolId}`;
    const memRef = db.collection("bracket_memberships").doc(membershipId);

    await memRef.set(
      {
        userId: caller.uid,
        userEmail: caller.email || "",
        userName: finalUserName,
        userAvatar: finalUserAvatar,
        poolId,
        joinCode: poolData.joinCode || poolId,
        poolName: poolData.name,
        role: isOwner ? "commissioner" : "member",
        picks,
        tiebreaker: cleanTiebreaker,
        score: scoreResult.score,
        superBowlWinner: picks.super_bowl || "",
        updatedAt: now,
      },
      { merge: true }
    );

    // Fetch and re-rank leaderboard
    const membersSnap = await db
      .collection("bracket_memberships")
      .where("poolId", "==", poolId)
      .get();

    const userIds = Array.from(
      new Set(membersSnap.docs.map((d) => d.data().userId).filter(Boolean))
    );
    const userMap = new Map<string, { name?: string; username?: string; avatarColor?: string }>();
    if (userIds.length > 0) {
      const userDocs = await Promise.all(
        userIds.map((uid) => db.collection("users").doc(uid).get().catch(() => null))
      );
      userDocs.forEach((uDoc) => {
        if (uDoc && uDoc.exists) {
          const u = uDoc.data();
          userMap.set(uDoc.id, {
            name: u?.name,
            username: u?.username,
            avatarColor: u?.avatarColor,
          });
        }
      });
    }

    const rawParticipants: BracketParticipant[] = [];
    membersSnap.forEach((doc) => {
      const d = doc.data();
      const uProfile = userMap.get(d.userId);
      const resolvedName = uProfile?.name || uProfile?.username || d.userName || "Participant";
      const resolvedAvatar = uProfile?.avatarColor || d.userAvatar || "bg-emerald-600";
      rawParticipants.push({
        id: d.userId || doc.id,
        userId: d.userId || doc.id,
        userName: resolvedName,
        userAvatar: resolvedAvatar,
        picks: d.picks || {},
        tiebreaker: d.tiebreaker || undefined,
        score: d.score || 0,
        superBowlWinner: d.picks?.super_bowl || "",
        updatedAt: d.updatedAt || "",
      });
    });

    const rankedLeaderboard = rankBracketParticipants(rawParticipants, results);

    return NextResponse.json({
      success: true,
      entry: {
        id: caller.uid,
        userId: caller.uid,
        userName: finalUserName,
        picks,
        tiebreaker: cleanTiebreaker,
        score: scoreResult.score,
        superBowlWinner: picks.super_bowl || "",
        updatedAt: now,
      },
      leaderboard: rankedLeaderboard,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error updating bracket [id]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update bracket" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_delete:${caller.uid}`, 20, 60_000);

    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const db = adminDb();
    let poolRef = db.collection("bracket_pools").doc(cleanId);
    let poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanId)
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

    // Verify caller is the commissioner
    if (poolData.creatorUserId !== caller.uid) {
      return NextResponse.json(
        { error: "Unauthorized: only the commissioner who created this bracket can delete it" },
        { status: 403 }
      );
    }

    // 1. Delete the bracket pool
    await poolRef.delete();

    // 2. Delete all memberships in this pool
    const memSnap = await db
      .collection("bracket_memberships")
      .where("poolId", "==", poolId)
      .get();

    const batch = db.batch();
    for (const memDoc of memSnap.docs) {
      batch.delete(memDoc.ref);
    }
    batch.delete(db.collection("bracket_memberships").doc(`${caller.uid}_${poolId}`));
    await batch.commit();

    return NextResponse.json({ success: true, message: "Bracket pool permanently deleted" });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error deleting bracket pool:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete bracket pool" },
      { status: 500 }
    );
  }
}
