import { NextResponse } from "next/server";
import {
  requireUser,
  requireCommissioner,
  adminDb,
  errorResponse,
  HttpError,
} from "@/lib/server-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json();
    const { newCommissionerId } = body || {};

    if (!newCommissionerId || typeof newCommissionerId !== "string") {
      throw new HttpError(400, "New commissioner user ID is required");
    }

    if (newCommissionerId === caller.uid) {
      throw new HttpError(400, "You are already the commissioner");
    }

    const db = adminDb();

    // Verify new commissioner is an active member of this league
    const newMemberRef = db.collection("memberships").doc(`${leagueId}_${newCommissionerId}`);
    const newMemberSnap = await newMemberRef.get();
    if (!newMemberSnap.exists) {
      throw new HttpError(404, "Selected user is not a member of this league");
    }

    // Check that target user is not banned
    const targetUserSnap = await db.collection("users").doc(newCommissionerId).get();
    if (targetUserSnap.exists && targetUserSnap.data()?.banned) {
      throw new HttpError(400, "Cannot transfer commissioner role to a banned user");
    }

    const callerMemberRef = db.collection("memberships").doc(`${leagueId}_${caller.uid}`);
    const leagueRef = db.collection("leagues").doc(leagueId);

    const batch = db.batch();
    // 1. Update league commissionerId
    batch.update(leagueRef, {
      commissionerId: newCommissionerId,
    });
    // 2. Demote caller membership to member
    batch.update(callerMemberRef, {
      role: "member",
    });
    // 3. Promote target membership to commissioner
    batch.update(newMemberRef, {
      role: "commissioner",
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: "Commissioner role successfully transferred",
      newCommissionerId,
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
