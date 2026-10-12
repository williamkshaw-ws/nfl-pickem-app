import { NextResponse } from "next/server";
import {
  requireUser,
  requireMember,
  errorResponse,
  HttpError,
} from "@/lib/server-auth";
import { syncWeekFromEspn } from "@/lib/storage";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    const { league } = await requireMember(leagueId, caller.uid);

    // Any member may refresh scores, so cap how often it can hit ESPN / write data
    enforceRateLimit(`sync-user:${caller.uid}`, 6, 60 * 1000, "Refreshing too fast. Please wait a moment.");
    enforceRateLimit(`sync-league:${leagueId}`, 4, 30 * 1000, "Scores were just refreshed. Please wait a few seconds.");

    const body = await request.json().catch(() => ({}));
    const targetWeek = Number(body.week) || league.settings?.currentWeek || 1;
    const seasonYear = league.settings?.seasonYear || 2026;

    if (targetWeek < 1 || targetWeek > 18) {
      throw new HttpError(400, "Invalid week number (must be 1-18)");
    }

    const result = await syncWeekFromEspn(targetWeek, seasonYear);

    return NextResponse.json({
      success: true,
      synced: result.synced,
      message: result.synced
        ? `Successfully synced latest Week ${targetWeek} scores from ESPN!`
        : `ESPN API reached: no newer live updates for Week ${targetWeek}. Current scores are up to date.`,
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
