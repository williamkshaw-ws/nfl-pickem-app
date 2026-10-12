import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  requireUser,
  requireCommissioner,
  adminDb,
  errorResponse,
  HttpError,
} from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`league-ban:${caller.uid}`, 10, 10 * 60 * 1000, "Too many ban requests. Please wait a few minutes.");

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
      throw new HttpError(400, "Commissioner cannot ban themselves");
    }

    const db = adminDb();
    const batch = db.batch();

    // 1. Add user to the league's banned list so they cannot rejoin
    const leagueRef = db.collection("leagues").doc(leagueId);
    batch.update(leagueRef, {
      bannedUserIds: FieldValue.arrayUnion(userId),
    });

    // 2. Remove membership from this league
    const membershipId = `${leagueId}_${userId}`;
    const memRef = db.collection("memberships").doc(membershipId);
    batch.delete(memRef);

    // 3. Delete user's picks in this league
    const picksSnap = await db
      .collection("picks")
      .where("leagueId", "==", leagueId)
      .where("userId", "==", userId)
      .get();

    picksSnap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    return NextResponse.json({ success: true, banned: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}
