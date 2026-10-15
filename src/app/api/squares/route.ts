import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-auth";

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
    const body = await request.json();
    const { board, requestedId } = body || {};

    if (!board) {
      return NextResponse.json({ error: "Missing board payload" }, { status: 400 });
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

    const now = new Date().toISOString();
    await db.collection("squares_pools").doc(poolId).set(
      {
        id: poolId,
        board,
        updatedAt: now,
        createdAt: existing.exists ? (existing.data()?.createdAt || now) : now,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: poolId, board });
  } catch (err: any) {
    console.error("Error creating/saving squares pool:", err);
    return NextResponse.json({ error: err.message || "Failed to save pool" }, { status: 500 });
  }
}
