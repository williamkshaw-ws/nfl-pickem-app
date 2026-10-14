import { NextResponse } from "next/server";
import { requireUser, requireCommissioner, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`league-paid-toggle:${caller.uid}`, 60, 5 * 60 * 1000, "Too many requests. Please slow down.");

    const { id: leagueId } = await params;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) {
      throw new HttpError(404, "League not found");
    }

    // Verify caller is the commissioner
    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json();
    const { userId, paid } = body || {};

    if (!userId || typeof userId !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(userId)) {
      throw new HttpError(400, "Valid target user ID is required");
    }

    const isPaid = Boolean(paid);
    const db = adminDb();

    // Check membership document
    const membershipId = `${leagueId}_${userId}`;
    const memRef = db.collection("memberships").doc(membershipId);
    const memSnap = await memRef.get();

    if (!memSnap.exists) {
      throw new HttpError(404, "User is not a member of this league");
    }

    const nowIso = new Date().toISOString();
    await memRef.set(
      {
        paid: isPaid,
        paidAt: isPaid ? nowIso : null,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      userId,
      paid: isPaid,
      paidAt: isPaid ? nowIso : null,
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
