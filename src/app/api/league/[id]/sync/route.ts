import { NextResponse } from "next/server";
import {
  requireUser,
  requireCommissioner,
  errorResponse,
  HttpError,
} from "@/lib/server-auth";
import { syncWeekFromEspn } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const { id: leagueId } = await params;
    const { league } = await requireCommissioner(leagueId, caller.uid);

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
