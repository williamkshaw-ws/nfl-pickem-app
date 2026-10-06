import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { adminAuth } from "@/lib/firebase-admin";
import {
  adminDb,
  errorResponse,
  HttpError,
  reassignLeagueCommissioner,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    await requireAdminSession(request);

    const body = await request.json();
    const { userId, action } = body || {};

    if (!userId || typeof userId !== "string") {
      throw new HttpError(400, "User ID is required");
    }

    if (!action || !["ban", "unban", "delete"].includes(action)) {
      throw new HttpError(
        400,
        "Invalid action. Supported actions: 'ban', 'unban', 'delete'"
      );
    }

    const db = adminDb();

    if (action === "ban") {
      // 1. If this user is commissioner of any leagues, reassign commissioner to the next member
      const commishLeaguesSnap = await db
        .collection("leagues")
        .where("commissionerId", "==", userId)
        .get();

      for (const leagueDoc of commishLeaguesSnap.docs) {
        await reassignLeagueCommissioner(db, leagueDoc.id, userId);

        // Remove the banned user from this league
        await db
          .collection("memberships")
          .doc(`${leagueDoc.id}_${userId}`)
          .delete()
          .catch(() => {});

        const leaguePicksSnap = await db
          .collection("picks")
          .where("leagueId", "==", leagueDoc.id)
          .where("userId", "==", userId)
          .get();

        if (!leaguePicksSnap.empty) {
          const batch = db.batch();
          leaguePicksSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit().catch(() => {});
        }
      }

      // 2. Disable user in Firebase Auth so they cannot sign in
      try {
        await adminAuth.updateUser(userId, { disabled: true });
        await adminAuth.revokeRefreshTokens(userId);
      } catch (authErr: any) {
        console.warn("Firebase Auth disable warning:", authErr);
      }

      // 3. Mark banned in Firestore
      await db.collection("users").doc(userId).set(
        {
          banned: true,
          bannedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        message:
          "User account banned. Any commissioner roles were transferred to the next member.",
      });
    }

    if (action === "unban") {
      // 1. Re-enable user in Firebase Auth
      try {
        await adminAuth.updateUser(userId, { disabled: false });
      } catch (authErr: any) {
        console.warn("Firebase Auth enable warning:", authErr);
      }

      // 2. Unban in Firestore
      await db.collection("users").doc(userId).set(
        {
          banned: false,
          unbannedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        message: "User account unbanned",
      });
    }

    if (action === "delete") {
      // 1. If user is commissioner of any leagues, reassign commissioner to the next member
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

      // 3. Delete user profile in Firestore
      await db.collection("users").doc(userId).delete().catch(() => {});

      // 4. Delete all remaining league memberships for this user
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
        message:
          "User permanently deleted. Any commissioner roles were transferred to the next member.",
      });
    }

    throw new HttpError(400, "Unhandled action");
  } catch (err) {
    return errorResponse(err);
  }
}
