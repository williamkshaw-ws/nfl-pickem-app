import { NextResponse } from "next/server";
import { requireUser, adminDb, errorResponse, HttpError } from "@/lib/server-auth";

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
    const isCommissioner = membershipData.role === "commissioner";

    if (isCommissioner) {
      // Check total member count
      const allMembersSnap = await db.collection("memberships").where("leagueId", "==", leagueId).get();
      if (allMembersSnap.size > 1) {
        throw new HttpError(
          400,
          "As the commissioner, you cannot leave while other members are in the league. You can delete the league in the Commissioner Control Room."
        );
      }

      // If sole member and commissioner, deleting league
      await db.collection("leagues").doc(leagueId).delete();
      await membershipRef.delete();

      const picksSnap = await db.collection("picks").where("leagueId", "==", leagueId).get();
      const batch = db.batch();
      picksSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      return NextResponse.json({ success: true, deletedLeague: true });
    }

    // Regular member leaving
    await membershipRef.delete();

    // Remove user's picks for this league
    const picksSnap = await db
      .collection("picks")
      .where("leagueId", "==", leagueId)
      .where("userId", "==", caller.uid)
      .get();
    
    if (!picksSnap.empty) {
      const batch = db.batch();
      picksSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return NextResponse.json({ success: true, leftLeague: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}
