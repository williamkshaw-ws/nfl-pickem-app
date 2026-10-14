import { adminDb } from "@/lib/server-auth";
import { Resend } from "resend";
import { getDatabase, detectCurrentWeek } from "@/lib/storage";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ReminderRecipient {
  userId: string;
  email: string;
  name: string;
  missingLeagues: Array<{
    leagueId: string;
    leagueName: string;
    validPicksCount: number;
    totalGames: number;
  }>;
}

export interface ReminderResult {
  success: boolean;
  activeWeek: number;
  kickoffDate: string | null;
  dryRun: boolean;
  totalEligibleUsers: number;
  remindersSent: number;
  recipients: Array<{
    userId: string;
    email: string;
    name: string;
    missingLeagues: string[];
    resendId?: string;
    status: "sent" | "skipped_already_sent" | "dry_run" | "error";
    error?: string;
  }>;
}

export async function processKickoffReminders({
  dryRun = false,
  force = false,
  targetWeek = null,
}: {
  dryRun?: boolean;
  force?: boolean;
  targetWeek?: number | null;
} = {}): Promise<ReminderResult> {
  const db = adminDb();
  const jsonDb = getDatabase();
  const gamesByWeek = jsonDb.gamesByWeek || {};

  // 1. Determine active week
  const detectedWeek = detectCurrentWeek(gamesByWeek);
  const activeWeek = targetWeek && targetWeek >= 1 && targetWeek <= 18 ? targetWeek : detectedWeek;

  const weekGames = gamesByWeek[activeWeek] || [];
  const totalGames = weekGames.length;

  // Find first kickoff (typically Thursday Night Football)
  const sortedGames = [...weekGames].sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const firstGame = sortedGames[0];
  const kickoffDate = firstGame ? new Date(firstGame.date).toISOString() : null;

  // 2. Query all users who have enabled emailNotifications
  const usersSnap = await db
    .collection("users")
    .where("emailNotifications", "==", true)
    .get();

  const recipientsToProcess: ReminderRecipient[] = [];

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const email = userData.email?.trim();
    const name = userData.name?.trim() || "Player";

    if (!email || !email.includes("@")) continue;

    // Find all memberships for this user
    const memSnap = await db
      .collection("memberships")
      .where("userId", "==", userId)
      .get();

    if (memSnap.empty) continue;

    const missingLeagues: ReminderRecipient["missingLeagues"] = [];

    for (const memDoc of memSnap.docs) {
      const leagueId = memDoc.data().leagueId;
      if (!leagueId) continue;

      // Get league details
      const leagueSnap = await db.collection("leagues").doc(leagueId).get();
      if (!leagueSnap.exists) continue;
      const leagueData = leagueSnap.data() || {};
      const leagueName = leagueData.name || leagueData.settings?.leagueName || `League ${leagueId}`;

      // Check if user submitted picks for this week
      const pickDocId = `${leagueId}_${userId}_${activeWeek}`;
      const pickSnap = await db.collection("picks").doc(pickDocId).get();
      const pickData = pickSnap.exists ? pickSnap.data() : null;
      const picksMap = pickData?.picks || {};

      const validPicksCount = Object.keys(picksMap).filter(
        (gid) => !!picksMap[gid] && picksMap[gid] !== "HIDDEN"
      ).length;

      // If user hasn't made all picks (or has made 0 picks)
      if (totalGames > 0 && validPicksCount < totalGames) {
        missingLeagues.push({
          leagueId,
          leagueName,
          validPicksCount,
          totalGames,
        });
      }
    }

    if (missingLeagues.length > 0) {
      recipientsToProcess.push({
        userId,
        email,
        name,
        missingLeagues,
      });
    }
  }

  // 3. Send emails
  const results: ReminderResult["recipients"] = [];
  let sentCount = 0;

  let baseUrl = "https://pocketpicks.app";
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  for (const recipient of recipientsToProcess) {
    const logDocId = `${recipient.userId}_week_${activeWeek}`;
    const logRef = db.collection("reminderLogs").doc(logDocId);

    if (!force) {
      const logSnap = await logRef.get();
      if (logSnap.exists) {
        results.push({
          userId: recipient.userId,
          email: recipient.email,
          name: recipient.name,
          missingLeagues: recipient.missingLeagues.map((l) => l.leagueName),
          status: "skipped_already_sent",
        });
        continue;
      }
    }

    if (dryRun) {
      results.push({
        userId: recipient.userId,
        email: recipient.email,
        name: recipient.name,
        missingLeagues: recipient.missingLeagues.map((l) => l.leagueName),
        status: "dry_run",
      });
      continue;
    }

    // Compose HTML email
    const firstLeagueId = recipient.missingLeagues[0].leagueId;
    const actionUrl = `${baseUrl}/league/${firstLeagueId}?tab=picks`;

    const leagueListHtml = recipient.missingLeagues
      .map(
        (l) =>
          `<li style="margin-bottom: 8px; color: #334155; font-size: 15px;">
            <strong>${l.leagueName}</strong>: 
            <span style="color: #ea580c; font-weight: 700;">${l.validPicksCount} of ${l.totalGames} picks made</span>
          </li>`
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Week ${activeWeek} Picks Reminder</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1329; margin: 0; padding: 24px 12px;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
          
          <!-- Header Banner -->
          <div style="background-color: #020617; padding: 28px 24px; text-align: center; border-bottom: 3px solid #10b981;">
            <div style="display: inline-block; background-color: #064e3b; border: 1px solid #10b981; border-radius: 20px; padding: 4px 14px; margin-bottom: 12px;">
              <span style="color: #34d399; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase;">Kickoff Deadline Reminder</span>
            </div>
            <h1 style="color: #ffffff; font-size: 26px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">
              Lock In Your Week ${activeWeek} Picks! 🏈
            </h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              Thursday Night Football kicks off in approximately 2 hours.
            </p>
          </div>

          <!-- Body Content -->
          <div style="padding: 28px 24px;">
            <p style="color: #0f172a; font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">
              Hey ${recipient.name},
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
              Don't leave points on the table! You still have pending picks for Week ${activeWeek} in the following league(s):
            </p>

            <!-- Missing Leagues Box -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px;">
              <ul style="margin: 0; padding-left: 20px;">
                ${leagueListHtml}
              </ul>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 16px; font-weight: 900; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(5,150,105,0.35);">
                Make My Week ${activeWeek} Picks &rarr;
              </a>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0; text-align: center;">
              Remember: games lock as soon as kickoff begins.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 11px; margin: 0 0 6px 0;">
              You received this email because you turned on <strong>Thursday Kickoff Reminder</strong> in your PocketPicks account settings.
            </p>
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              &copy; ${new Date().getFullYear()} PocketPicks™ • <a href="${baseUrl}" style="color: #059669; text-decoration: none; font-weight: 600;">pocketpicks.app</a>
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    try {
      const emailRes = await resend.emails.send({
        from: "PocketPicks <noreply@pocketpicks.app>",
        to: recipient.email,
        subject: `🏈 Week ${activeWeek} Picks Reminder: Kickoff in 2 hours!`,
        html: emailHtml,
      });

      if (emailRes.error) {
        console.error("Resend delivery error for", recipient.email, emailRes.error);
        results.push({
          userId: recipient.userId,
          email: recipient.email,
          name: recipient.name,
          missingLeagues: recipient.missingLeagues.map((l) => l.leagueName),
          status: "error",
          error: emailRes.error.message,
        });
      } else {
        sentCount++;
        // Record log to prevent double-sending
        await logRef.set({
          userId: recipient.userId,
          email: recipient.email,
          week: activeWeek,
          sentAt: new Date().toISOString(),
          resendId: emailRes.data?.id || null,
          missingLeagues: recipient.missingLeagues.map((l) => l.leagueName),
        });

        results.push({
          userId: recipient.userId,
          email: recipient.email,
          name: recipient.name,
          missingLeagues: recipient.missingLeagues.map((l) => l.leagueName),
          resendId: emailRes.data?.id,
          status: "sent",
        });
      }
    } catch (err: any) {
      console.error("Resend exception for", recipient.email, err);
      results.push({
        userId: recipient.userId,
        email: recipient.email,
        name: recipient.name,
        missingLeagues: recipient.missingLeagues.map((l) => l.leagueName),
        status: "error",
        error: err.message,
      });
    }
  }

  return {
    success: true,
    activeWeek,
    kickoffDate,
    dryRun,
    totalEligibleUsers: recipientsToProcess.length,
    remindersSent: sentCount,
    recipients: results,
  };
}
