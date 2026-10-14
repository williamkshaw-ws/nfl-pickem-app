import { adminDb } from "@/lib/server-auth";
import { Resend } from "resend";
import { getDatabase, detectCurrentWeek } from "@/lib/storage";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
}

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
          `<li style="margin-bottom: 8px; color: #cbd5e1; font-size: 15px;">
            <strong style="color: #ffffff;">${escapeHtml(l.leagueName)}</strong>: 
            <span style="color: #fb923c; font-weight: 700;">${l.validPicksCount} of ${l.totalGames} picks made</span>
          </li>`
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
        <title>Week ${activeWeek} Picks Reminder</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; margin: 0; padding: 24px 12px; color: #f8fafc;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <div style="background-color: #020617; padding: 32px 24px 26px; text-align: center; border-bottom: 2px solid #10b981;">
            <div style="display: inline-block; background-color: rgba(6, 78, 59, 0.7); border: 1px solid #10b981; border-radius: 20px; padding: 5px 16px; margin-bottom: 14px;">
              <span style="color: #34d399; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase;">Kickoff Deadline Reminder</span>
            </div>
            <h1 style="color: #ffffff; font-size: 26px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.5px;">
              Lock In Your Week ${activeWeek} Picks! 🏈
            </h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0; font-weight: 500;">
              Thursday Night Football kicks off in approximately 2 hours.
            </p>
          </div>

          <!-- Body Content -->
          <div style="padding: 30px 24px; background-color: #0f172a;">
            <p style="color: #f8fafc; font-size: 17px; font-weight: 800; margin-top: 0; margin-bottom: 12px;">
              Hey ${escapeHtml(recipient.name)},
            </p>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 22px;">
              Don't leave points on the table! You still have pending picks for Week ${activeWeek} in the following league(s):
            </p>

            <!-- Missing Leagues Box -->
            <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 18px 20px; margin-bottom: 26px;">
              <ul style="margin: 0; padding-left: 20px;">
                ${leagueListHtml}
              </ul>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin: 32px 0 16px;">
              <a href="${actionUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 16px; font-weight: 900; text-decoration: none; padding: 15px 34px; border-radius: 12px; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4); border: 1px solid #10b981;">
                Make My Week ${activeWeek} Picks &rarr;
              </a>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0; text-align: center;">
              Remember: games lock as soon as kickoff begins.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #090d16; padding: 20px 24px; text-align: center; border-top: 1px solid #1e293b;">
            <p style="color: #64748b; font-size: 11px; margin: 0 0 6px 0; line-height: 1.5;">
              You received this email because you turned on <strong>Thursday Kickoff Reminder</strong> in your PocketPicks account settings.
            </p>
            <p style="color: #475569; font-size: 11px; margin: 0;">
              &copy; ${new Date().getFullYear()} PocketPicks™ • <a href="${baseUrl}" style="color: #10b981; text-decoration: none; font-weight: 600;">pocketpicks.app</a>
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
