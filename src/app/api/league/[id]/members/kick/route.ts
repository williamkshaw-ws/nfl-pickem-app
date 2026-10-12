import { NextResponse } from "next/server";
import { requireUser, requireCommissioner, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`league-kick:${caller.uid}`, 10, 10 * 60 * 1000, "Too many kick requests. Please wait a few minutes.");

    const { id: leagueId } = await params;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) {
      throw new HttpError(404, "League not found");
    }

    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json();
    const { userId } = body || {};

    if (!userId || typeof userId !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(userId)) {
      throw new HttpError(400, "Valid user ID is required");
    }

    if (userId === caller.uid) {
      throw new HttpError(400, "Commissioner cannot kick themselves from the league");
    }

    const db = adminDb();

    // 1. Delete membership for this league
    const membershipId = `${leagueId}_${userId}`;
    const memRef = db.collection("memberships").doc(membershipId);
    const memSnap = await memRef.get();

    if (!memSnap.exists) {
      throw new HttpError(404, "User is not a member of this league");
    }

    await memRef.delete();

    // 2. Delete user's picks in this league
    const picksSnap = await db
      .collection("picks")
      .where("leagueId", "==", leagueId)
      .where("userId", "==", userId)
      .get();

    if (!picksSnap.empty) {
      const batch = db.batch();
      picksSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return NextResponse.json({ success: true, kicked: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}
