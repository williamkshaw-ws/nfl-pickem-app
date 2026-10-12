import { NextResponse } from "next/server";
import { requireVerifiedUser, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { verifyLeaguePassword, hashLeaguePassword } from "@/lib/league-password";
import { enforceRateLimit, getClientIp, peekRateLimit, recordFailure, clearRateLimit } from "@/lib/rate-limit";

const FAIL_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const caller = await requireVerifiedUser(request);
    const ip = getClientIp(request);

    // Overall request throttles (per account and per IP) to stop code/password guessing
    enforceRateLimit(`join-user:${caller.uid}`, 15, 10 * 60 * 1000, "Too many join attempts. Please wait a few minutes.");
    enforceRateLimit(`join-ip:${ip}`, 40, 10 * 60 * 1000, "Too many join attempts. Please wait a few minutes.");

    const body = await request.json();
    const { code, password } = body;

    if (!code || typeof code !== "string" || !/^[A-Za-z0-9_-]{3,20}$/.test(code.trim())) {
      throw new HttpError(400, "Please provide a valid league code");
    }

    const cleanCode = code.trim();

    // Lock out repeated wrong passwords per account+league
    const failKey = `join-fail:${caller.uid}:${cleanCode}`;
    if (peekRateLimit(failKey, 5, FAIL_WINDOW_MS)) {
      throw new HttpError(429, "Too many incorrect passwords. Try again in 15 minutes.");
    }

    const db = adminDb();

    const leagueDoc = await db.collection("leagues").doc(cleanCode).get();
    if (!leagueDoc.exists) {
      throw new HttpError(404, "League not found. Please check the code.");
    }

    const leagueData = leagueDoc.data()!;

    if (Array.isArray(leagueData.bannedUserIds) && leagueData.bannedUserIds.includes(caller.uid)) {
      throw new HttpError(403, "You have been removed and banned from this league by the commissioner.");
    }

    const requiredPassword = leagueData.settings?.leaguePassword;

    // Check league password if one is required
    if (requiredPassword && typeof requiredPassword === "string" && requiredPassword.trim() !== "") {
      const providedPassword = typeof password === "string" ? password : "";
      const { ok, needsUpgrade } = verifyLeaguePassword(providedPassword, requiredPassword);
      if (!ok) {
        recordFailure(failKey);
        throw new HttpError(403, "Incorrect league password");
      }
      clearRateLimit(failKey);

      // Transparently upgrade legacy plaintext passwords to a salted hash
      if (needsUpgrade) {
        await db
          .collection("leagues")
          .doc(cleanCode)
          .update({ "settings.leaguePassword": hashLeaguePassword(providedPassword) })
          .catch((e) => console.warn("League password upgrade warning:", e));
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
