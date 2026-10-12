import { NextResponse } from "next/server";
import {
  requireUser,
  adminDb,
  errorResponse,
  HttpError,
  reassignLeagueCommissioner,
} from "@/lib/server-auth";
import { adminAuth } from "@/lib/firebase-admin";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`del-ip:${ip}`, 5, 15 * 60 * 1000, "Too many deletion requests. Please wait.");

    const caller = await requireUser(request);
    enforceRateLimit(`del-user:${caller.uid}`, 3, 15 * 60 * 1000, "Too many deletion attempts.");

    // Require recent re-authentication (within 5 minutes) to protect against stale/stolen tokens
    if (caller.authTime && (Date.now() / 1000) - caller.authTime > 300) {
      throw new HttpError(
        401,
        "Recent authentication required. Please re-enter your password to delete your account."
      );
    }

    const db = adminDb();
    const userId = caller.uid;

    // Get user doc to clean up username reservation
    const userDocSnap = await db.collection("users").doc(userId).get();
    const username = userDocSnap.data()?.username;

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

    // 3. Delete user document and username reservation from Firestore
    if (username) {
      await db.collection("usernames").doc(username).delete().catch(() => {});
    }
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
