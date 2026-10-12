import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { requireVerifiedUser, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { hashLeaguePassword } from "@/lib/league-password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDatabase, detectCurrentWeek } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const caller = await requireVerifiedUser(request);
    enforceRateLimit(`create-league:${caller.uid}`, 5, 60 * 60 * 1000, "You are creating leagues too quickly. Please try again later.");
    const body = await request.json();
    const { name, leagueFormat, leaguePassword } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      throw new HttpError(400, "League name is required");
    }
    const cleanName = name.trim().slice(0, 50);

    const format = leagueFormat === "survivor" || leagueFormat === "pickem" || leagueFormat === "both"
      ? leagueFormat
      : "both";

    const rawPassword = typeof leaguePassword === "string" ? leaguePassword.trim() : "";
    if (rawPassword.length > 64) {
      throw new HttpError(400, "League password must be 64 characters or fewer");
    }
    const password = hashLeaguePassword(rawPassword);

    const db = adminDb();

    // Generate a 5-digit code without collision
    let leagueId = "";
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const candidate = randomInt(10000, 100000).toString();
      const existing = await db.collection("leagues").doc(candidate).get();
      if (!existing.exists) {
        leagueId = candidate;
        break;
      }
    }

    if (!leagueId) {
      throw new HttpError(500, "Failed to generate a unique league code. Please try again.");
    }

    const now = new Date().toISOString();
    const batch = db.batch();

    const activeWeekDetected = detectCurrentWeek(getDatabase().gamesByWeek);

    const leagueRef = db.collection("leagues").doc(leagueId);
    batch.create(leagueRef, {
      id: leagueId,
      name: cleanName,
      commissionerId: caller.uid,
      createdAt: now,
      settings: {
        leagueName: cleanName,
        seasonYear: 2026,
        currentWeek: activeWeekDetected,
        lockPolicy: "game",
        tiebreakerRuleSummary: "Closest to total points",
        pickemEnabled: format === "pickem" || format === "both",
        eliminatorEnabled: format === "survivor" || format === "both",
        leaguePassword: password,
      },
    });

    const membershipRef = db.collection("memberships").doc(`${leagueId}_${caller.uid}`);
    batch.set(membershipRef, {
      id: `${leagueId}_${caller.uid}`,
      leagueId,
      leagueName: cleanName,
      userId: caller.uid,
      role: "commissioner",
      joinedAt: now,
    });

    await batch.commit();

    return NextResponse.json({ success: true, leagueId });
  } catch (err: any) {
    return errorResponse(err);
  }
}
