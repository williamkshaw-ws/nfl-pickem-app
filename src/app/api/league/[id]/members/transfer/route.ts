import { NextResponse } from "next/server";
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
    enforceRateLimit(`league-transfer:${caller.uid}`, 5, 10 * 60 * 1000, "Too many role transfer attempts. Please wait a few minutes.");

    const { id: leagueId } = await params;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) {
      throw new HttpError(404, "League not found");
    }

    await requireCommissioner(leagueId, caller.uid);

    const body = await request.json();
    const { newCommissionerId } = body || {};

    if (!newCommissionerId || typeof newCommissionerId !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(newCommissionerId)) {
      throw new HttpError(400, "Valid new commissioner user ID is required");
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

    // Check that target user is not banned globally or in this league
    const [targetUserSnap, leagueDocSnap] = await Promise.all([
      db.collection("users").doc(newCommissionerId).get(),
      db.collection("leagues").doc(leagueId).get(),
    ]);

    if (targetUserSnap.exists && targetUserSnap.data()?.banned) {
      throw new HttpError(400, "Cannot transfer commissioner role to a banned user");
    }

    const leagueBanned = Array.isArray(leagueDocSnap.data()?.bannedUserIds)
      ? (leagueDocSnap.data()?.bannedUserIds as string[])
      : [];
    if (leagueBanned.includes(newCommissionerId)) {
      throw new HttpError(400, "Cannot transfer commissioner role to a user banned from this league");
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
