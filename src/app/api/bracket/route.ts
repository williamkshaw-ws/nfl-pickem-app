import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  generateBracketPoolId,
  extractBracketCode,
  BracketPool,
  UserBracketPool,
  DEFAULT_ROUND_POINTS,
} from "@/lib/playoff-bracket";
import { loadBracketPoolPayload, DEFAULT_BRACKET_LOCK_TIME } from "@/lib/bracket-server";

const DEFAULT_LOCK_TIME = DEFAULT_BRACKET_LOCK_TIME;

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_get:${ip}`, 120, 60_000);

    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get("id");
    const cleanId = rawId ? extractBracketCode(rawId) : null;

    const db = adminDb();
    let caller: { uid: string; email?: string } | null = null;
    try {
      caller = await requireUser(request);
    } catch {
      // Optional authentication on GET
    }

    // 1. If cleanId is provided, fetch pool and its participants
    if (cleanId) {
      const payload = await loadBracketPoolPayload(db, cleanId, caller);
      if (!payload) {
        return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
      }

      // Fetch user's pools list if authenticated
      const userPools: UserBracketPool[] = [];
      if (caller) {
        const userMemSnap = await db
          .collection("bracket_memberships")
          .where("userId", "==", caller.uid)
          .get();

        const seenPoolIds = new Set<string>();
        userMemSnap.forEach((doc) => {
          const d = doc.data();
          if (d.poolId && !seenPoolIds.has(d.poolId)) {
            seenPoolIds.add(d.poolId);
            userPools.push({
              id: d.poolId,
              joinCode: d.joinCode || d.poolId,
              name: d.poolName || "Playoff Bracket",
              role: d.role || "member",
            });
          }
        });
      }

      return NextResponse.json({
        success: true,
        ...payload,
        userPools,
      });
    }

    // 2. No specific pool requested -> return user's pools list
    const userPools: UserBracketPool[] = [];
    if (caller) {
      const userMemSnap = await db
        .collection("bracket_memberships")
        .where("userId", "==", caller.uid)
        .get();

      userMemSnap.forEach((doc) => {
        const d = doc.data();
        userPools.push({
          id: d.poolId,
          joinCode: d.joinCode || d.poolId,
          name: d.poolName || "Playoff Bracket",
          role: d.role || "member",
        });
      });
    }

    return NextResponse.json({
      success: true,
      userPools,
      defaultPoolId: userPools.length > 0 ? userPools[0].id : null,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error in bracket GET route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load bracket data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_create:${ip}`, 20, 60_000, "Too many pools created. Please wait a moment.");

    const caller = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const poolName = typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : "Playoff Bracket Challenge";

    const db = adminDb();

    // Generate unique 5-char pool ID
    let poolId = generateBracketPoolId();
    let collisionCheck = await db.collection("bracket_pools").doc(poolId).get();
    let attempts = 0;
    while (collisionCheck.exists && attempts < 5) {
      poolId = generateBracketPoolId();
      collisionCheck = await db.collection("bracket_pools").doc(poolId).get();
      attempts++;
    }

    const now = new Date().toISOString();
    let creatorName = "";
    let userAvatar = "bg-emerald-600";
    try {
      const userDoc = await db.collection("users").doc(caller.uid).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        creatorName = u?.name || u?.username || "";
        userAvatar = u?.avatarColor || userAvatar;
      }
    } catch {}
    if (!creatorName) {
      creatorName = caller.email?.split("@")[0] || "Commissioner";
    }

    const newPool: BracketPool = {
      id: poolId,
      joinCode: poolId,
      name: poolName,
      creatorUserId: caller.uid,
      creatorName,
      creatorEmail: caller.email || "",
      isLocked: false,
      lockTime: DEFAULT_LOCK_TIME,
      results: {},
      isSimulated: false,
      simulatedAt: null,
      roundPoints: DEFAULT_ROUND_POINTS,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Create pool document
    await db.collection("bracket_pools").doc(poolId).set(newPool);

    // 2. Create commissioner membership
    const membershipId = `${caller.uid}_${poolId}`;
    await db.collection("bracket_memberships").doc(membershipId).set({
      userId: caller.uid,
      userEmail: caller.email || "",
      userName: creatorName,
      userAvatar,
      poolId,
      joinCode: poolId,
      poolName,
      role: "commissioner",
      picks: {},
      tiebreaker: null,
      score: 0,
      superBowlWinner: "",
      joinedAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      poolId,
      joinCode: poolId,
      name: poolName,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error creating bracket pool:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create bracket pool" },
      { status: 500 }
    );
  }
}
