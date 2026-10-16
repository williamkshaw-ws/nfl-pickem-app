import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { validateAndSanitizeBoard, generateOwnerKey } from "@/lib/squares-validation";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

function generatePoolId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let result = "sb-";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    // Rate limit: max 20 pool creates per minute per IP
    const ip = getClientIp(request);
    try {
      enforceRateLimit(`squares_create:${ip}`, 20, 60_000, "Too many pools created. Please wait a minute.");
    } catch (rateErr: unknown) {
      const msg = rateErr instanceof Error ? rateErr.message : "Rate limit exceeded";
      return NextResponse.json({ error: msg }, { status: 429 });
    }

    // Authentication: Only authenticated users can create or publish a squares pool
    let caller;
    try {
      caller = await requireUser(request);
    } catch (authErr: unknown) {
      const msg = authErr instanceof HttpError ? authErr.message : "Authentication required";
      return NextResponse.json(
        { error: msg === "Not signed in" ? "Please log in to create or publish a squares pool" : msg },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const { board: rawBoard, requestedId, creatorName: clientCreatorName } = body || {};

    if (!rawBoard) {
      return NextResponse.json({ error: "Missing board payload" }, { status: 400 });
    }

    let board;
    try {
      board = validateAndSanitizeBoard(rawBoard);
    } catch (valErr: unknown) {
      const msg = valErr instanceof Error ? valErr.message : "Invalid board data";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const db = adminDb();
    let poolId = (requestedId && typeof requestedId === "string" ? requestedId.trim().toLowerCase() : "").replace(/[^a-z0-9_-]/g, "");
    if (!poolId) {
      poolId = generatePoolId();
    }

    const poolRef = db.collection("squares_pools").doc(poolId);
    const existing = await poolRef.get();

    // If auto-generating and collisions occur, retry once
    if (existing.exists && !requestedId) {
      poolId = generatePoolId();
    }

    const existingData = existing.exists ? existing.data() : null;

    // Authorization check if pool already exists
    let ownerKey = existingData?.ownerKey || "";
    if (existingData) {
      // If pool already has a creatorUserId, ensure caller matches
      if (existingData.creatorUserId && existingData.creatorUserId !== caller.uid) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner who created this board can modify it" },
          { status: 403 }
        );
      }

      // If legacy pool missing creatorUserId, check legacy ownerKey
      if (!existingData.creatorUserId && existingData.ownerKey) {
        const headerKey = request.headers.get("x-owner-key") || "";
        const bodyKey = typeof body?.ownerKey === "string" ? body.ownerKey : "";
        const providedKey = (headerKey || bodyKey).trim();

        if (!providedKey || providedKey !== existingData.ownerKey) {
          return NextResponse.json(
            { error: "Unauthorized: only the commissioner can modify this board" },
            { status: 403 }
          );
        }
      }
    } else {
      // New pool gets a fresh ownerKey for backward compatibility
      ownerKey = generateOwnerKey();
    }

    // Resolve creator's display name from client body, Firestore user profile, or email
    let creatorName = typeof clientCreatorName === "string" ? clientCreatorName.trim() : "";
    if (!creatorName) {
      try {
        const userDoc = await db.collection("users").doc(caller.uid).get();
        if (userDoc.exists) {
          const u = userDoc.data();
          creatorName = u?.name || u?.username || "";
        }
      } catch {
        // Fallback to email
      }
    }
    if (!creatorName) {
      creatorName = caller.email ? caller.email.split("@")[0] : "Commissioner";
    }

    const now = new Date().toISOString();
    const joinCode = existingData?.joinCode || poolId.replace(/^sb-/, "").toUpperCase();

    await db.collection("squares_pools").doc(poolId).set(
      {
        id: poolId,
        joinCode,
        board,
        creatorUserId: existingData?.creatorUserId || caller.uid,
        creatorEmail: existingData?.creatorEmail || caller.email || "",
        creatorName: existingData?.creatorName || creatorName,
        ownerKey,
        updatedAt: now,
        createdAt: existingData?.createdAt || now,
      },
      { merge: true }
    );

    // Save commissioner membership for the creator
    const creatorUid = existingData?.creatorUserId || caller.uid;
    const membershipId = `${creatorUid}_${poolId}`;
    await db.collection("squares_memberships").doc(membershipId).set(
      {
        userId: creatorUid,
        userEmail: caller.email || "",
        poolId,
        joinCode,
        poolTitle: board.title || "Super Bowl Squares",
        topTeam: board.topTeam || "Team 1",
        leftTeam: board.leftTeam || "Team 2",
        role: "commissioner",
        joinedAt: existingData?.createdAt || now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      id: poolId,
      joinCode,
      creatorUserId: existingData?.creatorUserId || caller.uid,
      creatorName: existingData?.creatorName || creatorName,
      ownerKey,
      board,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error creating/saving squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to save pool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`squares_list:${ip}`, 60, 60_000);
    const caller = await requireUser(request);

    const db = adminDb();

    // 1. Fetch pools created by the user
    const createdSnap = await db
      .collection("squares_pools")
      .where("creatorUserId", "==", caller.uid)
      .get();

    // 2. Fetch all pool memberships for the user (both commissioner and joined member)
    const memberSnap = await db
      .collection("squares_memberships")
      .where("userId", "==", caller.uid)
      .get();

    const poolsMap = new Map<string, {
      id: string;
      joinCode: string;
      title: string;
      topTeam: string;
      leftTeam: string;
      costPerSquare: number;
      totalClaimed: number;
      role: "commissioner" | "member";
      createdAt?: string;
      updatedAt?: string;
    }>();

    // Process created pools first
    for (const doc of createdSnap.docs) {
      const data = doc.data();
      const board = data.board || {};
      const poolId = doc.id;
      const joinCode = data.joinCode || poolId.replace(/^sb-/, "").toUpperCase();
      poolsMap.set(poolId, {
        id: poolId,
        joinCode,
        title: board.title || "Super Bowl Squares",
        topTeam: board.topTeam || "Team 1",
        leftTeam: board.leftTeam || "Team 2",
        costPerSquare: typeof board.costPerSquare === "number" ? board.costPerSquare : 0,
        totalClaimed: board.grid ? Object.keys(board.grid).length : 0,
        role: "commissioner",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    }

    // Process memberships (includes joined boards)
    const missingPoolIds: string[] = [];
    for (const doc of memberSnap.docs) {
      const data = doc.data();
      const poolId = data.poolId;
      if (!poolId) continue;

      if (!poolsMap.has(poolId)) {
        missingPoolIds.push(poolId);
      } else {
        // Already have it from createdSnap, verify role is commissioner
        const existing = poolsMap.get(poolId)!;
        if (data.role === "commissioner") {
          existing.role = "commissioner";
        }
      }
    }

    // Fetch details for joined pools not created by caller
    if (missingPoolIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < missingPoolIds.length; i += 10) {
        chunks.push(missingPoolIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const docRefs = chunk.map((id) => db.collection("squares_pools").doc(id));
        const snapshots = await db.getAll(...docRefs);

        for (const doc of snapshots) {
          if (!doc.exists) continue;
          const data = doc.data()!;
          const board = data.board || {};
          const poolId = doc.id;
          const joinCode = data.joinCode || poolId.replace(/^sb-/, "").toUpperCase();
          const isCreator = data.creatorUserId === caller.uid;

          poolsMap.set(poolId, {
            id: poolId,
            joinCode,
            title: board.title || "Super Bowl Squares",
            topTeam: board.topTeam || "Team 1",
            leftTeam: board.leftTeam || "Team 2",
            costPerSquare: typeof board.costPerSquare === "number" ? board.costPerSquare : 0,
            totalClaimed: board.grid ? Object.keys(board.grid).length : 0,
            role: isCreator ? "commissioner" : "member",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        }
      }
    }

    const pools = Array.from(poolsMap.values());
    pools.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    return NextResponse.json({ success: true, pools });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error fetching user squares pools:", err);
    const msg = err instanceof Error ? err.message : "Failed to load pools";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

