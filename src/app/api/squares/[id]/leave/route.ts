import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);
    enforceRateLimit(`squares_leave:${caller.uid}`, 30, 60_000);

    const { id } = await params;
    const poolId = (id || "").trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    const db = adminDb();
    const upperId = poolId.toUpperCase();
    const lowerId = poolId.toLowerCase();
    const rawJoin = poolId.replace(/^sb-/, "").toUpperCase();

    const batch = db.batch();
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${poolId}`));
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${upperId}`));
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${lowerId}`));
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${rawJoin}`));
    if (!poolId.startsWith("sb-")) {
      batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_sb-${lowerId}`));
    }

    // Also query memberships where userId matches caller
    const qSnap = await db
      .collection("squares_memberships")
      .where("userId", "==", caller.uid)
      .where("poolId", "in", [poolId, upperId, lowerId, rawJoin, `sb-${lowerId}`])
      .get();

    for (const doc of qSnap.docs) {
      batch.delete(doc.ref);
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: "Left board successfully" });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error leaving squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to leave board";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
