import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractBracketCode } from "@/lib/playoff-bracket";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_leave:${caller.uid}`, 30, 60_000);

    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const db = adminDb();
    const batch = db.batch();

    batch.delete(db.collection("bracket_memberships").doc(`${caller.uid}_${cleanId}`));

    // Also query memberships where userId == caller.uid and poolId == cleanId
    const qSnap = await db
      .collection("bracket_memberships")
      .where("userId", "==", caller.uid)
      .where("poolId", "==", cleanId)
      .get();

    for (const doc of qSnap.docs) {
      batch.delete(doc.ref);
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: "Left bracket pool successfully" });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error leaving bracket pool:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to leave bracket pool" },
      { status: 500 }
    );
  }
}
