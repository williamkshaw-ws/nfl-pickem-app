import { NextResponse } from "next/server";
import { resolveTeamAbbr, isTeamMatch } from "@/lib/nfl-teams";

interface CompetitorParsed {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logo: string;
  score: number;
  linescores: number[];
  homeAway: "home" | "away";
}

interface ParsedGame {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: {
    state: "pre" | "in" | "post";
    detail: string;
    shortDetail: string;
    completed: boolean;
    period: number;
    clock: string;
  };
  homeTeam: CompetitorParsed;
  awayTeam: CompetitorParsed;
}

function parseCompetitor(comp: any): CompetitorParsed {
  const linescores: number[] = Array.isArray(comp?.linescores)
    ? comp.linescores.map((l: any) => (typeof l?.value === "number" ? l.value : parseInt(l?.displayValue || "0", 10) || 0))
    : [];

  const rawScore = comp?.score;
  const score = typeof rawScore === "number" ? rawScore : parseInt(rawScore || "0", 10) || 0;
  const abbr = comp?.team?.abbreviation || resolveTeamAbbr(comp?.team?.name) || "NFL";

  return {
    id: comp?.team?.id || "",
    name: comp?.team?.name || comp?.team?.displayName || "Team",
    displayName: comp?.team?.displayName || comp?.team?.name || "Team",
    abbreviation: abbr,
    logo:
      comp?.team?.logo ||
      `https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/${abbr}.svg`,
    score,
    linescores,
    homeAway: comp?.homeAway || "home",
  };
}

function parseEvent(event: any): ParsedGame | null {
  const comp = event?.competitions?.[0];
  if (!comp) return null;

  const rawHome = comp.competitors?.find((c: any) => c.homeAway === "home");
  const rawAway = comp.competitors?.find((c: any) => c.homeAway === "away");
  if (!rawHome || !rawAway) return null;

  const rawStatus = comp.status;
  const status = {
    state: (rawStatus?.type?.state || "pre") as "pre" | "in" | "post",
    detail: rawStatus?.type?.detail || "Scheduled",
    shortDetail: rawStatus?.type?.shortDetail || "",
    completed: Boolean(rawStatus?.type?.completed),
    period: typeof rawStatus?.period === "number" ? rawStatus.period : 0,
    clock: rawStatus?.displayClock || "0:00",
  };

  return {
    id: event.id,
    name: event.name || `${rawAway.team?.name} at ${rawHome.team?.name}`,
    shortName: event.shortName || `${rawAway.team?.abbreviation} @ ${rawHome.team?.abbreviation}`,
    date: event.date,
    status,
    homeTeam: parseCompetitor(rawHome),
    awayTeam: parseCompetitor(rawAway),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const topTeamQuery = searchParams.get("top") || "";
    const leftTeamQuery = searchParams.get("left") || "";
    const requestedGameId = searchParams.get("gameId") || "";

    // 1. Fetch current scoreboard from ESPN
    let events: any[] = [];
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", {
        next: { revalidate: 15 },
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        events = data.events || [];
      }
    } catch (e) {
      console.error("Failed to fetch ESPN current scoreboard:", e);
    }

    // 2. If no events or looking for Super Bowl / Postseason
    if (events.length === 0) {
      try {
        const resPost = await fetch(
          "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=3&week=5",
          { next: { revalidate: 60 } }
        );
        if (resPost.ok) {
          const postData = await resPost.json();
          events = postData.events || [];
        }
      } catch (e) {
        console.error("Failed to fetch ESPN postseason scoreboard:", e);
      }
    }

    const parsedGames: ParsedGame[] = events
      .map(parseEvent)
      .filter((g): g is ParsedGame => g !== null);

    // 3. Find matching game
    let matched: ParsedGame | undefined;

    if (requestedGameId) {
      matched = parsedGames.find((g) => g.id === requestedGameId);
    }

    if (!matched && topTeamQuery && leftTeamQuery) {
      // Direct head-to-head matchup
      matched = parsedGames.find(
        (g) =>
          (isTeamMatch(g.homeTeam.displayName, topTeamQuery) && isTeamMatch(g.awayTeam.displayName, leftTeamQuery)) ||
          (isTeamMatch(g.awayTeam.displayName, topTeamQuery) && isTeamMatch(g.homeTeam.displayName, leftTeamQuery)) ||
          (isTeamMatch(g.homeTeam.abbreviation, topTeamQuery) && isTeamMatch(g.awayTeam.abbreviation, leftTeamQuery)) ||
          (isTeamMatch(g.awayTeam.abbreviation, topTeamQuery) && isTeamMatch(g.homeTeam.abbreviation, leftTeamQuery))
      );
    }

    // If still no direct head-to-head match, see if either team is playing in a game
    let singleTeamMatched: ParsedGame | undefined;
    if (!matched && (topTeamQuery || leftTeamQuery)) {
      singleTeamMatched = parsedGames.find(
        (g) =>
          isTeamMatch(g.homeTeam.displayName, topTeamQuery) ||
          isTeamMatch(g.awayTeam.displayName, topTeamQuery) ||
          isTeamMatch(g.homeTeam.displayName, leftTeamQuery) ||
          isTeamMatch(g.awayTeam.displayName, leftTeamQuery)
      );
    }

    // 4. If matched, construct response with top vs left mappings and quarter cumulative scores
    let gamePayload: any = null;
    const gameToProcess = matched;

    if (gameToProcess) {
      const g = gameToProcess;
      const isTopHome =
        isTeamMatch(g.homeTeam.displayName, topTeamQuery) ||
        isTeamMatch(g.homeTeam.abbreviation, topTeamQuery);

      const topCompetitor = isTopHome ? g.homeTeam : g.awayTeam;
      const leftCompetitor = isTopHome ? g.awayTeam : g.homeTeam;

      // Quarter 1 calculation
      const hasQ1Ended =
        (g.status.period > 1 || g.status.completed) &&
        topCompetitor.linescores.length >= 1 &&
        leftCompetitor.linescores.length >= 1;
      const q1Top = hasQ1Ended ? topCompetitor.linescores[0] : null;
      const q1Left = hasQ1Ended ? leftCompetitor.linescores[0] : null;

      // Quarter 2 (Halftime) calculation: cumulative end of 2nd Q
      const hasQ2Ended =
        (g.status.period > 2 ||
          g.status.detail.toLowerCase().includes("half") ||
          g.status.completed) &&
        topCompetitor.linescores.length >= 2 &&
        leftCompetitor.linescores.length >= 2;
      const q2Top = hasQ2Ended
        ? topCompetitor.linescores[0] + topCompetitor.linescores[1]
        : null;
      const q2Left = hasQ2Ended
        ? leftCompetitor.linescores[0] + leftCompetitor.linescores[1]
        : null;

      // Quarter 3 calculation: cumulative end of 3rd Q
      const hasQ3Ended =
        (g.status.period > 3 || g.status.completed) &&
        topCompetitor.linescores.length >= 3 &&
        leftCompetitor.linescores.length >= 3;
      const q3Top = hasQ3Ended
        ? topCompetitor.linescores[0] + topCompetitor.linescores[1] + topCompetitor.linescores[2]
        : null;
      const q3Left = hasQ3Ended
        ? leftCompetitor.linescores[0] + leftCompetitor.linescores[1] + leftCompetitor.linescores[2]
        : null;

      // Final Score calculation
      const hasFinalEnded = g.status.completed || g.status.state === "post";
      const finalTop = hasFinalEnded ? topCompetitor.score : null;
      const finalLeft = hasFinalEnded ? leftCompetitor.score : null;

      gamePayload = {
        id: g.id,
        name: g.name,
        shortName: g.shortName,
        date: g.date,
        status: g.status,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        topTeam: {
          name: topCompetitor.displayName,
          abbreviation: topCompetitor.abbreviation,
          score: topCompetitor.score,
          linescores: topCompetitor.linescores,
          isHome: isTopHome,
        },
        leftTeam: {
          name: leftCompetitor.displayName,
          abbreviation: leftCompetitor.abbreviation,
          score: leftCompetitor.score,
          linescores: leftCompetitor.linescores,
          isHome: !isTopHome,
        },
        quarters: {
          q1: {
            top: q1Top,
            left: q1Left,
            completed: hasQ1Ended,
          },
          q2: {
            top: q2Top,
            left: q2Left,
            completed: hasQ2Ended,
          },
          q3: {
            top: q3Top,
            left: q3Left,
            completed: hasQ3Ended,
          },
          final: {
            top: finalTop,
            left: finalLeft,
            completed: hasFinalEnded,
          },
        },
      };
    }

    const availableGames = parsedGames.map((g) => ({
      id: g.id,
      name: g.name,
      shortName: g.shortName,
      status: g.status.shortDetail || g.status.detail,
      state: g.status.state,
      homeTeam: g.homeTeam.displayName,
      homeAbbr: g.homeTeam.abbreviation,
      homeScore: g.homeTeam.score,
      awayTeam: g.awayTeam.displayName,
      awayAbbr: g.awayTeam.abbreviation,
      awayScore: g.awayTeam.score,
      date: g.date,
    }));

    return NextResponse.json({
      success: true,
      gameFound: Boolean(gamePayload),
      matchedGame: gamePayload,
      suggestedGame: singleTeamMatched ? {
        id: singleTeamMatched.id,
        name: singleTeamMatched.name,
        shortName: singleTeamMatched.shortName,
        status: singleTeamMatched.status.detail,
        homeTeam: singleTeamMatched.homeTeam.displayName,
        awayTeam: singleTeamMatched.awayTeam.displayName,
      } : null,
      availableGames,
    });
  } catch (err: any) {
    console.error("Live score API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch live score" },
      { status: 500 }
    );
  }
}
