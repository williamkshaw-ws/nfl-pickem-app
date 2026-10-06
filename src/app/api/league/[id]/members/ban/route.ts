import { NextResponse } from "next/server";
import { requireUser, requireCommissioner, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      throw new HttpError(400, "User ID is required");
    }

    if (userId === caller.uid) {
      throw new HttpError(400, "Commissioner cannot ban themselves");
    }

    const db = adminDb();

    // 1. Disable user in Firebase Auth so their email cannot be used to log in
    try {
      await adminAuth.updateUser(userId, { disabled: true });
      await adminAuth.revokeRefreshTokens(userId);
    } catch (authErr: any) {
      console.warn("Firebase Auth disable warning:", authErr);
    }

    // 2. Mark user document as banned in Firestore
    await db.collection("users").doc(userId).set({
      banned: true,
      bannedAt: new Date().toISOString(),
      bannedBy: caller.uid,
    }, { merge: true }).catch(() => {});

    // 3. Remove membership from this league
    const membershipId = `${leagueId}_${userId}`;
    const memRef = db.collection("memberships").doc(membershipId);
    await memRef.delete().catch(() => {});

    // 4. Delete user's picks in this league
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

    return NextResponse.json({ success: true, banned: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}
