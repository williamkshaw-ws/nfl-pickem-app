import { NextResponse } from "next/server";
import { processKickoffReminders } from "@/lib/kickoff-reminders";
import { cookies } from "next/headers";
import crypto from "crypto";

function isValidSecret(providedSecret: string | null): boolean {
  if (!providedSecret) return false;
  
  // Check against CRON_SECRET or ADMIN_PASSWORD or ADMIN_SESSION_SECRET
  const expectedSecrets = [
    process.env.CRON_SECRET,
    process.env.ADMIN_SESSION_SECRET,
    process.env.ADMIN_PASSWORD,
  ].filter(Boolean) as string[];

  for (const expected of expectedSecrets) {
    if (providedSecret === expected) return true;
  }
  return false;
}

async function isAuthorized(req: Request): Promise<boolean> {
  // 1. Check Bearer token or query param 'secret'
  const authHeader = req.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : null;

  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");

  if (isValidSecret(bearerToken) || isValidSecret(querySecret)) {
    return true;
  }

  // 2. Check admin session cookie (from /users admin portal)
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin_session")?.value;
    const adminSecret = process.env.ADMIN_SESSION_SECRET;

    if (sessionToken && adminSecret) {
      const [hmacPart] = sessionToken.split(":");
      const expectedHmac = crypto.createHmac("sha256", adminSecret).update("admin_authenticated").digest("hex");
      if (hmacPart === expectedHmac) {
        return true;
      }
    }
  } catch {
    // Ignore cookie errors
  }

  return false;
}

export async function GET(req: Request) {
  return handleReminders(req);
}

export async function POST(req: Request) {
  return handleReminders(req);
}

async function handleReminders(req: Request) {
  try {
    const authorized = await isAuthorized(req);
    if (!authorized) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please provide Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>",
        },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const force = url.searchParams.get("force") === "true";
    const weekParam = url.searchParams.get("week");
    const targetWeek = weekParam ? parseInt(weekParam, 10) : null;

    const result = await processKickoffReminders({
      dryRun,
      force,
      targetWeek,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Error running kickoff reminders:", err);
    return NextResponse.json(
      {
        error: err.message || "Failed to process kickoff reminders",
      },
      { status: 500 }
    );
  }
}
