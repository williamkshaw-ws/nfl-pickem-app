import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { requireUser, requireCommissioner, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { PAYOUT_KEY_REGEX } from "@/lib/payouts";

/**
 * Commissioner-only: mark a prize (weekly / season / survivor) as paid out or not.
 * Stored on the league doc under `payoutRecords.<key>` and only ever returned to the commissioner.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`league-payout-toggle:${caller.uid}`, 60, 5 * 60 * 1000, "Too many requests. Please slow down.");

    const { id: leagueId } = await params;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) {
      throw new HttpError(404, "League not found");
    }
    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json().catch(() => ({}));
    const { key, paidOut } = body || {};

    if (typeof key !== "string" || !PAYOUT_KEY_REGEX.test(key)) {
      throw new HttpError(400, "Invalid payout key");
    }
    if (typeof paidOut !== "boolean") {
      throw new HttpError(400, "paidOut must be true or false");
    }

    const nowIso = new Date().toISOString();
    const record = { paidOut, paidAt: paidOut ? nowIso : null, updatedBy: caller.uid };

    await adminDb()
      .collection("leagues")
      .doc(leagueId)
      .update(new FieldPath("payoutRecords", key), record);

    return NextResponse.json({ success: true, key, record });
  } catch (err: any) {
    return errorResponse(err);
  }
}
