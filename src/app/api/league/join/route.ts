import { NextResponse } from "next/server";
import { requireUser, adminDb, errorResponse, HttpError } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const body = await request.json();
    const { code, password } = body;

    if (!code || typeof code !== "string" || !/^\d{5}$/.test(code.trim())) {
      throw new HttpError(400, "Please provide a valid 5-digit league code");
    }

    const cleanCode = code.trim();
    const db = adminDb();

    const leagueDoc = await db.collection("leagues").doc(cleanCode).get();
    if (!leagueDoc.exists) {
      throw new HttpError(404, "League not found. Please check the code.");
    }

    const leagueData = leagueDoc.data()!;
    const requiredPassword = leagueData.settings?.leaguePassword;

    // Check league password if one is required
    if (requiredPassword && typeof requiredPassword === "string" && requiredPassword.trim() !== "") {
      const providedPassword = typeof password === "string" ? password.trim() : "";
      if (providedPassword !== requiredPassword.trim()) {
        throw new HttpError(403, "Incorrect league password");
      }
    }

    const membershipId = `${cleanCode}_${caller.uid}`;
    const membershipRef = db.collection("memberships").doc(membershipId);
    const existingMembership = await membershipRef.get();

    if (!existingMembership.exists) {
      const isCommissioner = leagueData.commissionerId === caller.uid;
      await membershipRef.set({
        id: membershipId,
        leagueId: cleanCode,
        leagueName: leagueData.name || leagueData.settings?.leagueName || "League",
        userId: caller.uid,
        role: isCommissioner ? "commissioner" : "member",
        joinedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, leagueId: cleanCode });
  } catch (err: any) {
    return errorResponse(err);
  }
}
