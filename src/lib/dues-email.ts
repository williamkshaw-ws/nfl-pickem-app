import { formatMoney, buildVenmoPayUrl, type PayoutConfig } from "@/lib/payouts";

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c: string) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]
  );
}

export function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes("localhost")) return envUrl.replace(/\/+$/, "");
  return "https://pocketpicks.app";
}

/** Dark-mode dues reminder email, matching the kickoff reminder styling. */
export function buildDuesReminderEmail({
  recipientName,
  leagueName,
  leagueId,
  commissionerName,
  cfg,
  venmoHandle,
}: {
  recipientName: string;
  leagueName: string;
  leagueId: string;
  commissionerName: string;
  cfg: PayoutConfig;
  venmoHandle: string;
}): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const leagueUrl = `${baseUrl}/league/${encodeURIComponent(leagueId)}`;
  const amount = formatMoney(cfg.duesPerPlayer);
  const venmoUrl = venmoHandle
    ? buildVenmoPayUrl(venmoHandle, cfg.duesPerPlayer, `PocketPicks dues - ${leagueName}`)
    : "";

  const rows: string[] = [];
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">${escapeHtml(label)}</td>
      <td style="padding: 8px 0; color: #ffffff; font-size: 14px; font-weight: 800; text-align: right;">${escapeHtml(value)}</td>
    </tr>`;

  if (cfg.isLegacyFlatFee) {
    rows.push(row("League entry", amount));
  } else {
    if (cfg.weeklyActive)
      rows.push(row(`Weekly prize (${formatMoney(cfg.weeklyFee)} × ${cfg.weeksCount} wks)`, formatMoney(cfg.weeklyFee * cfg.weeksCount)));
    if (cfg.seasonActive) rows.push(row("Season overall prize", formatMoney(cfg.seasonFee)));
    if (cfg.survivorActive) rows.push(row("Survivor prize", formatMoney(cfg.survivorFee)));
  }

  const payButton = venmoUrl
    ? `<a href="${escapeHtml(venmoUrl)}" style="display: inline-block; background-color: #008cff; color: #ffffff; font-size: 16px; font-weight: 900; text-decoration: none; padding: 15px 34px; border-radius: 12px; box-shadow: 0 4px 18px rgba(0, 140, 255, 0.35); border: 1px solid #3ba6ff;">
         Pay ${escapeHtml(amount)} with Venmo &rarr;
       </a>
       <p style="color: #64748b; font-size: 12px; margin: 12px 0 0;">Paying <strong style="color: #94a3b8;">@${escapeHtml(venmoHandle)}</strong></p>`
    : `<a href="${escapeHtml(leagueUrl)}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 16px; font-weight: 900; text-decoration: none; padding: 15px 34px; border-radius: 12px; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4); border: 1px solid #10b981;">
         Open League &rarr;
       </a>
       <p style="color: #64748b; font-size: 12px; margin: 12px 0 0;">Reach out to ${escapeHtml(commissionerName)} for payment details.</p>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
      <title>League Dues Reminder</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; margin: 0; padding: 24px 12px; color: #f8fafc;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #0f172a; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">

        <!-- Header Banner -->
        <div style="background-color: #020617; padding: 32px 24px 26px; text-align: center; border-bottom: 2px solid #10b981;">
          <div style="display: inline-block; background-color: rgba(6, 78, 59, 0.7); border: 1px solid #10b981; border-radius: 20px; padding: 5px 16px; margin-bottom: 14px;">
            <span style="color: #34d399; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase;">League Dues Reminder</span>
          </div>
          <h1 style="color: #ffffff; font-size: 26px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.5px;">
            Your ${escapeHtml(amount)} buy-in is due 💸
          </h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; font-weight: 500;">
            ${escapeHtml(leagueName)}
          </p>
        </div>

        <!-- Body Content -->
        <div style="padding: 30px 24px; background-color: #0f172a;">
          <p style="color: #f8fafc; font-size: 17px; font-weight: 800; margin-top: 0; margin-bottom: 12px;">
            Hey ${escapeHtml(recipientName)},
          </p>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 22px;">
            Friendly nudge from ${escapeHtml(commissionerName)} — our records show your league dues for
            <strong style="color: #ffffff;">${escapeHtml(leagueName)}</strong> haven't been received yet.
          </p>

          <!-- Dues Breakdown Box -->
          <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 14px 20px; margin-bottom: 26px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              ${rows.join("")}
              <tr>
                <td style="padding: 12px 0 4px; border-top: 1px solid #334155; color: #34d399; font-size: 15px; font-weight: 900;">Total due</td>
                <td style="padding: 12px 0 4px; border-top: 1px solid #334155; color: #34d399; font-size: 18px; font-weight: 900; text-align: right;">${escapeHtml(amount)}</td>
              </tr>
            </table>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 32px 0 16px;">
            ${payButton}
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0; text-align: center;">
            Already paid? Just reply to this email and let ${escapeHtml(commissionerName)} know.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #090d16; padding: 20px 24px; text-align: center; border-top: 1px solid #1e293b;">
          <p style="color: #64748b; font-size: 11px; margin: 0 0 6px 0; line-height: 1.5;">
            You received this email because your league commissioner sent a dues reminder.
            PocketPicks does not collect or distribute league funds.
          </p>
          <p style="color: #475569; font-size: 11px; margin: 0;">
            &copy; ${new Date().getFullYear()} PocketPicks™ • <a href="${escapeHtml(baseUrl)}" style="color: #10b981; text-decoration: none; font-weight: 600;">pocketpicks.app</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  return {
    subject: `💸 ${leagueName}: ${amount} league dues reminder`,
    html,
  };
}

