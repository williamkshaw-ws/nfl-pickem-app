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
    await db.collection("squares_pools").doc(poolId).set(
      {
        id: poolId,
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

    return NextResponse.json({
      success: true,
      id: poolId,
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
    const snap = await db
      .collection("squares_pools")
      .where("creatorUserId", "==", caller.uid)
      .get();

    const pools = snap.docs.map((doc) => {
      const data = doc.data();
      const board = data.board || {};
      return {
        id: doc.id,
        title: board.title || "Super Bowl Squares",
        topTeam: board.topTeam || "Team 1",
        leftTeam: board.leftTeam || "Team 2",
        costPerSquare: typeof board.costPerSquare === "number" ? board.costPerSquare : 0,
        totalClaimed: board.grid ? Object.keys(board.grid).length : 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

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

