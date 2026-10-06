import { NextResponse } from "next/server";
import {
  requireUser,
  adminDb,
  errorResponse,
  HttpError,
  reassignLeagueCommissioner,
} from "@/lib/server-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;

    const db = adminDb();
    const membershipId = `${leagueId}_${caller.uid}`;
    const membershipRef = db.collection("memberships").doc(membershipId);
    const memSnap = await membershipRef.get();

    if (!memSnap.exists) {
      throw new HttpError(404, "You are not a member of this league");
    }

    const membershipData = memSnap.data()!;

    // Check if the caller is the commissioner
    const leagueDoc = await db.collection("leagues").doc(leagueId).get();
    const isCommissioner =
      membershipData.role === "commissioner" ||
      (leagueDoc.exists && leagueDoc.data()?.commissionerId === caller.uid);

    let leagueDeleted = false;

    if (isCommissioner) {
      // Reassign commissioner to the next oldest active member in the league
      const result = await reassignLeagueCommissioner(db, leagueId, caller.uid);
      leagueDeleted = result.leagueDeleted;
    }

    // Delete the leaving member's membership document
    await membershipRef.delete().catch(() => {});

    // Remove user's picks for this league
    const picksSnap = await db
      .collection("picks")
      .where("leagueId", "==", leagueId)
      .where("userId", "==", caller.uid)
      .get();

    if (!picksSnap.empty) {
      const batch = db.batch();
      picksSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit().catch(() => {});
    }

    return NextResponse.json({
      success: true,
      leftLeague: true,
      deletedLeague: leagueDeleted,
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
