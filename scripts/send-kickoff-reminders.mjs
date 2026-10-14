import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

// Load .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  }
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!privateKey || !projectId || !clientEmail) {
  console.error('Error: Missing Firebase Admin environment credentials.');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });
}

const db = getFirestore();
const resend = new Resend(process.env.RESEND_API_KEY);

function getLeagueData() {
  const dbPath = path.resolve(process.cwd(), 'data', 'league.json');
  if (fs.existsSync(dbPath)) {
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function detectCurrentWeek(gamesByWeek) {
  const now = new Date();
  for (let week = 1; week <= 18; week++) {
    const games = gamesByWeek[week];
    if (!games || games.length === 0) continue;
    const sorted = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastGame = sorted[sorted.length - 1];
    const firstGame = sorted[0];
    const gameDay = new Date(firstGame.date);
    const startOfWeekWindow = new Date(gameDay.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endOfWeekWindow = new Date(new Date(lastGame.date).getTime() + 24 * 60 * 60 * 1000);
    if (now >= startOfWeekWindow && now <= endOfWeekWindow) {
      return week;
    }
  }
  for (let week = 1; week <= 18; week++) {
    const games = gamesByWeek[week];
    if (!games) continue;
    const hasUpcoming = games.some(g => new Date(g.date) > now);
    if (hasUpcoming) return week;
  }
  return 6;
}

export async function runKickoffReminders({
  dryRun = false,
  force = false,
  targetWeek = null,
  filterEmail = null,
} = {}) {
  const leagueData = getLeagueData();
  const gamesByWeek = leagueData.gamesByWeek || {};
  const activeWeek = targetWeek || detectCurrentWeek(gamesByWeek);
  const weekGames = gamesByWeek[activeWeek] || [];
  const totalGames = weekGames.length;

  console.log(`\n======================================================`);
  console.log(`🏈 POCKETPICKS™ KICKOFF REMINDER DISPATCHER`);
  console.log(`======================================================`);
  console.log(`Target Week : Week ${activeWeek} (${totalGames} total games)`);
  console.log(`Mode        : ${dryRun ? 'DRY-RUN (Simulate only)' : 'LIVE DISPATCH'}`);
  console.log(`Force Send  : ${force ? 'YES (Bypassing deduplication)' : 'NO'}`);
  if (filterEmail) console.log(`Filter Email: ${filterEmail}`);
  console.log(`------------------------------------------------------\n`);

  // Query users with emailNotifications: true
  const usersSnap = await db.collection('users').where('emailNotifications', '==', true).get();
  console.log(`Found ${usersSnap.size} user(s) with email notifications enabled in Firestore.`);

  let eligibleCount = 0;
  let sentCount = 0;
  let skippedCount = 0;

  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pocketpicks.app';
  if (baseUrl.includes('localhost')) baseUrl = 'https://pocketpicks.app';
  baseUrl = baseUrl.replace(/\/+$/, '');

  for (const userDoc of usersSnap.docs) {
    const u = userDoc.data();
    const userId = userDoc.id;
    const email = u.email?.trim();
    const name = u.name?.trim() || 'Player';

    if (!email || !email.includes('@')) continue;
    if (filterEmail && email.toLowerCase() !== filterEmail.toLowerCase()) continue;

    // Check leagues
    const memSnap = await db.collection('memberships').where('userId', '==', userId).get();
    if (memSnap.empty) continue;

    const missingLeagues = [];

    for (const memDoc of memSnap.docs) {
      const leagueId = memDoc.data().leagueId;
      if (!leagueId) continue;

      const leagueSnap = await db.collection('leagues').doc(leagueId).get();
      const leagueData = leagueSnap.exists ? leagueSnap.data() : {};
      const leagueName = leagueData?.name || leagueData?.settings?.leagueName || `League ${leagueId}`;

      const pickDocId = `${leagueId}_${userId}_${activeWeek}`;
      const pickSnap = await db.collection('picks').doc(pickDocId).get();
      const pickData = pickSnap.exists ? pickSnap.data() : null;
      const picksMap = pickData?.picks || {};

      const validPicksCount = Object.keys(picksMap).filter(
        (gid) => !!picksMap[gid] && picksMap[gid] !== 'HIDDEN'
      ).length;

      if (totalGames > 0 && validPicksCount < totalGames) {
        missingLeagues.push({
          leagueId,
          leagueName,
          validPicksCount,
          totalGames,
        });
      }
    }

    if (missingLeagues.length === 0) {
      console.log(`✅ [${name}] (${email}): All picks already submitted. No reminder needed.`);
      continue;
    }

    eligibleCount++;
    console.log(`\n⚠️  [${name}] (${email}) has unsubmitted picks in ${missingLeagues.length} league(s):`);
    missingLeagues.forEach(l => {
      console.log(`   - ${l.leagueName}: ${l.validPicksCount}/${l.totalGames} picks made`);
    });

    const logDocId = `${userId}_week_${activeWeek}`;
    const logRef = db.collection('reminderLogs').doc(logDocId);

    if (!force) {
      const logSnap = await logRef.get();
      if (logSnap.exists) {
        console.log(`   ⏩ SKIPPED: Already sent reminder for Week ${activeWeek} on ${logSnap.data().sentAt}`);
        skippedCount++;
        continue;
      }
    }

    if (dryRun) {
      console.log(`   🔍 DRY RUN: Would send kickoff reminder email to ${email}`);
      continue;
    }

    // Send real email via Resend
    const firstLeagueId = missingLeagues[0].leagueId;
    const actionUrl = `${baseUrl}/league/${firstLeagueId}?tab=picks`;

    const leagueListHtml = missingLeagues
      .map(
        (l) =>
          `<li style="margin-bottom: 8px; color: #334155; font-size: 15px;">
            <strong>${l.leagueName}</strong>: 
            <span style="color: #ea580c; font-weight: 700;">${l.validPicksCount} of ${l.totalGames} picks made</span>
          </li>`
      )
      .join('');

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
              Hey ${name},
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
        from: 'PocketPicks <noreply@pocketpicks.app>',
        to: email,
        subject: `🏈 Week ${activeWeek} Picks Reminder: Kickoff in 2 hours!`,
        html: emailHtml,
      });

      if (emailRes.error) {
        console.error(`   ❌ Failed to send to ${email}:`, emailRes.error.message);
      } else {
        sentCount++;
        console.log(`   🚀 SENT successfully to ${email}! Resend ID: ${emailRes.data?.id}`);
        await logRef.set({
          userId,
          email,
          week: activeWeek,
          sentAt: new Date().toISOString(),
          resendId: emailRes.data?.id || null,
          missingLeagues: missingLeagues.map(l => l.leagueName),
        });
      }
    } catch (err) {
      console.error(`   ❌ Exception sending to ${email}:`, err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Summary:`);
  console.log(`- Eligible with pending picks: ${eligibleCount}`);
  console.log(`- Reminders sent            : ${sentCount}`);
  console.log(`- Skipped (already sent)    : ${skippedCount}`);
  console.log(`======================================================\n`);
}

// CLI entrypoint
if (process.argv[1]?.endsWith('send-kickoff-reminders.mjs')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  let targetWeek = null;
  const weekIdx = args.indexOf('--week');
  if (weekIdx !== -1 && args[weekIdx + 1]) {
    targetWeek = parseInt(args[weekIdx + 1], 10);
  }
  let filterEmail = null;
  const emailIdx = args.indexOf('--to');
  if (emailIdx !== -1 && args[emailIdx + 1]) {
    filterEmail = args[emailIdx + 1];
  }

  runKickoffReminders({ dryRun, force, targetWeek, filterEmail })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
