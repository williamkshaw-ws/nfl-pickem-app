import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-auth";
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

    const body = await request.json().catch(() => null);
    const { board: rawBoard, requestedId } = body || {};

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
    let ownerKey = "";
    if (existingData?.ownerKey) {
      const headerKey = request.headers.get("x-owner-key") || "";
      const bodyKey = typeof body?.ownerKey === "string" ? body.ownerKey : "";
      const providedKey = (headerKey || bodyKey).trim();

      if (!providedKey || providedKey !== existingData.ownerKey) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can modify this board" },
          { status: 403 }
        );
      }
      ownerKey = existingData.ownerKey;
    } else {
      // New pool (or legacy pool missing key) gets a fresh ownerKey
      ownerKey = generateOwnerKey();
    }

    const now = new Date().toISOString();
    await db.collection("squares_pools").doc(poolId).set(
      {
        id: poolId,
        board,
        ownerKey,
        updatedAt: now,
        createdAt: existingData?.createdAt || now,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: poolId, ownerKey, board });
  } catch (err: unknown) {
    console.error("Error creating/saving squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to save pool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
