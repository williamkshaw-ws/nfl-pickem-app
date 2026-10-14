import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireUser, requireCommissioner, adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPayoutConfig } from "@/lib/payouts";
import { buildDuesReminderEmail } from "@/lib/dues-email";

/**
 * Commissioner-only: email every unpaid member (excluding the commissioner) a dark-mode
 * dues reminder with a one-tap Venmo link.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) {
      throw new HttpError(404, "League not found");
    }
    await requireCommissioner(leagueId, caller.uid);

    // Prevent accidental spam: at most 3 nudges per league per 6 hours
    enforceRateLimit(
      `league-dues-nudge:${leagueId}`,
      3,
      6 * 60 * 60 * 1000,
      "You've already sent a few nudges recently. Please wait a few hours before sending another."
    );

    if (!process.env.RESEND_API_KEY) {
      throw new HttpError(503, "Email delivery is not configured");
    }

    const db = adminDb();
    const leagueSnap = await db.collection("leagues").doc(leagueId).get();
    if (!leagueSnap.exists) throw new HttpError(404, "League not found");
    const league = leagueSnap.data() || {};
    const settings = league.settings || {};
    const leagueName: string = league.name || settings.leagueName || "Your League";

    const cfg = getPayoutConfig(settings);
    if (cfg.duesPerPlayer <= 0) {
      throw new HttpError(400, "Set up your league fees before sending dues reminders");
    }

    const memSnap = await db.collection("memberships").where("leagueId", "==", leagueId).get();
    const unpaidIds = memSnap.docs
      .map((d) => d.data())
      .filter((m) => m.userId && m.paid !== true && m.userId !== league.commissionerId)
      .map((m) => m.userId as string);

    if (unpaidIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0, skipped: 0, failed: 0, message: "Everyone has paid!" });
    }

    const userRefs = [caller.uid, ...unpaidIds].map((id) => db.collection("users").doc(id));
    const userDocs = await db.getAll(...userRefs);
    const userById = new Map(userDocs.filter((d) => d.exists).map((d) => [d.id, d.data() || {}]));

    const commissioner = userById.get(caller.uid) || {};
    const commissionerName: string = commissioner.name?.trim() || "your commissioner";
    const commissionerEmail: string | undefined =
      typeof commissioner.email === "string" && commissioner.email.includes("@") ? commissioner.email : undefined;

    const resend = new Resend(process.env.RESEND_API_KEY);
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const uid of unpaidIds) {
      const u = userById.get(uid);
      const email = typeof u?.email === "string" ? u.email.trim() : "";
      if (!email || !email.includes("@")) {
        skipped++;
        continue;
      }

      const { subject, html } = buildDuesReminderEmail({
        recipientName: u?.name?.trim() || "Player",
        leagueName,
        leagueId,
        commissionerName,
        cfg,
        venmoHandle: settings.venmoHandle || "",
      });

      try {
        const res = await resend.emails.send({
          from: "PocketPicks <noreply@pocketpicks.app>",
          to: email,
          subject,
          html,
          ...(commissionerEmail ? { replyTo: commissionerEmail } : {}),
        });
        if (res.error) {
          console.error("Dues nudge delivery error:", res.error);
          failed++;
        } else {
          sent++;
        }
      } catch (sendErr) {
        console.error("Dues nudge exception:", sendErr);
        failed++;
      }
    }

    await db
      .collection("leagues")
      .doc(leagueId)
      .update({ lastDuesNudgeAt: new Date().toISOString() })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      message:
        `Dues reminder sent to ${sent} member${sent === 1 ? "" : "s"}` +
        (skipped ? ` (${skipped} without an email on file)` : "") +
        (failed ? ` — ${failed} failed to send` : ""),
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
