import { NextResponse } from "next/server";
import { processKickoffReminders } from "@/lib/kickoff-reminders";
import { requireAdminSession, timingSafeStringEqual } from "@/lib/admin-auth";

async function isAuthorized(req: Request): Promise<boolean> {
  // 1. Dedicated cron secret via Authorization header only (never query string,
  //    which leaks into proxy/access logs). Require a reasonably long secret.
  const cronSecret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : "";

  if (cronSecret.length >= 24 && bearerToken && timingSafeStringEqual(bearerToken, cronSecret)) {
    return true;
  }

  // 2. Valid, unexpired admin portal session
  try {
    await requireAdminSession(req);
    return true;
  } catch {
    return false;
  }
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
          error: "Unauthorized",
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
        error: "Failed to process kickoff reminders",
      },
      { status: 500 }
    );
  }
}
