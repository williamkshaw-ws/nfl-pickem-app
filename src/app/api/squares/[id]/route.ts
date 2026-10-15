import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const poolId = (id || "").toLowerCase().trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    const db = adminDb();
    const docSnap = await db.collection("squares_pools").doc(poolId).get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const data = docSnap.data();
    return NextResponse.json({
      success: true,
      id: poolId,
      board: data?.board || data,
      updatedAt: data?.updatedAt,
    });
  } catch (err: any) {
    console.error("Error fetching squares pool:", err);
    return NextResponse.json({ error: err.message || "Failed to load pool" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const poolId = (id || "").toLowerCase().trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    const body = await request.json();
    const { board } = body || {};
    if (!board) {
      return NextResponse.json({ error: "Missing board payload" }, { status: 400 });
    }

    const db = adminDb();
    const now = new Date().toISOString();
    await db.collection("squares_pools").doc(poolId).set(
      {
        id: poolId,
        board,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: poolId });
  } catch (err: any) {
    console.error("Error updating squares pool:", err);
    return NextResponse.json({ error: err.message || "Failed to update pool" }, { status: 500 });
  }
}
