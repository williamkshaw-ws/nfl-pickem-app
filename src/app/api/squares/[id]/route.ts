import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-auth";
import { validateAndSanitizeBoard, generateOwnerKey } from "@/lib/squares-validation";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

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

    // NEVER leak the ownerKey in public GET responses
    const rawBoard = data?.board || data;
    let safeBoard;
    try {
      safeBoard = validateAndSanitizeBoard(rawBoard);
    } catch {
      safeBoard = rawBoard;
    }

    return NextResponse.json({
      success: true,
      id: poolId,
      board: safeBoard,
      updatedAt: data?.updatedAt,
    });
  } catch (err: unknown) {
    console.error("Error fetching squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to load pool";
    return NextResponse.json({ error: msg }, { status: 500 });
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

    // Rate limit: max 120 updates per minute per IP
    const ip = getClientIp(request);
    try {
      enforceRateLimit(`squares_update:${ip}`, 120, 60_000, "Too many updates. Please wait a moment.");
    } catch (rateErr: unknown) {
      const msg = rateErr instanceof Error ? rateErr.message : "Rate limit exceeded";
      return NextResponse.json({ error: msg }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { board: rawBoard } = body || {};
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
    const poolRef = db.collection("squares_pools").doc(poolId);
    const docSnap = await poolRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const docData = docSnap.data();

    // Authorization: Verify owner key
    if (docData?.ownerKey) {
      const headerKey = request.headers.get("x-owner-key") || "";
      const bodyKey = typeof body?.ownerKey === "string" ? body.ownerKey : "";
      const providedKey = (headerKey || bodyKey).trim();

      if (!providedKey || providedKey !== docData.ownerKey) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can edit this board" },
          { status: 403 }
        );
      }
    } else {
      // Legacy pool created before ownerKey protection: generate one now
      const newKey = generateOwnerKey();
      await poolRef.set({ ownerKey: newKey }, { merge: true });
    }

    const now = new Date().toISOString();
    await poolRef.set(
      {
        id: poolId,
        board,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: poolId });
  } catch (err: unknown) {
    console.error("Error updating squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to update pool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
