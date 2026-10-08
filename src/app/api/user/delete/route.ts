import { NextResponse } from "next/server";
import {
  requireUser,
  adminDb,
  errorResponse,
  reassignLeagueCommissioner,
} from "@/lib/server-auth";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const db = adminDb();
    const userId = caller.uid;

    // 1. If user is commissioner of any leagues, reassign to next member or delete empty league
    const commishLeaguesSnap = await db
      .collection("leagues")
      .where("commissionerId", "==", userId)
      .get();

    for (const leagueDoc of commishLeaguesSnap.docs) {
      await reassignLeagueCommissioner(db, leagueDoc.id, userId);
    }

    // 2. Delete user from Firebase Auth
    try {
      await adminAuth.deleteUser(userId);
    } catch (authErr: any) {
      console.warn("Firebase Auth delete warning:", authErr);
    }

    // 3. Delete user document from Firestore
    await db.collection("users").doc(userId).delete().catch(() => {});

    // 4. Delete all league memberships for this user
    const memSnap = await db
      .collection("memberships")
      .where("userId", "==", userId)
      .get();

    if (!memSnap.empty) {
      const batch = db.batch();
      memSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit().catch(() => {});
    }

    // 5. Delete all picks submitted by this user
    const picksSnap = await db
      .collection("picks")
      .where("userId", "==", userId)
      .get();

    if (!picksSnap.empty) {
      const batch = db.batch();
      picksSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit().catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Account permanently deleted.",
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
