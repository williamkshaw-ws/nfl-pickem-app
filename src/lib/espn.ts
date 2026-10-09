import { Game, Team, GameStatus, GameOdds } from "@/types/nfl";

interface ESPNTeamData {
  id: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName?: string;
  logo?: string;
  color?: string;
  alternateColor?: string;
}

interface ESPNCompetitor {
  id: string;
  homeAway: "home" | "away";
  winner?: boolean;
  score?: string;
  team: ESPNTeamData;
  records?: Array<{ summary: string; type?: string }>;
}

interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  week?: { number: number };
  season?: { year: number; type: number };
  competitions: Array<{
    id: string;
    date: string;
    competitors: ESPNCompetitor[];
    status: {
      clock: number;
      displayClock: string;
      period: number;
      type: {
        id: string;
        name: string;
        state: "pre" | "in" | "post";
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
    };
    odds?: Array<{
      details?: string;
      overUnder?: number;
      spread?: number;
    }>;
  }>;
}

interface ESPNResponse {
  leagues?: Array<{
    season?: { year: number; type: number };
  }>;
  week?: { number: number };
  events: ESPNEvent[];
}

export async function fetchEspnWeekGames(
  weekNumber?: number,
  seasonYear: number = 2026
): Promise<{ week: number; season: number; games: Game[]; source: "espn" | "fallback" }> {
  try {
    const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
    const params = new URLSearchParams();
    params.set("seasontype", "2"); // Regular season
    if (weekNumber !== undefined) {
      params.set("week", weekNumber.toString());
      params.set("dates", seasonYear.toString());
    }

    const fullUrl = `${url}?${params.toString()}`;
    const res = await fetch(fullUrl, {
      next: { revalidate: 15 }, // Cache for 15 seconds to ensure near real-time live scores
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}: ${res.statusText}`);
    }

    const data: ESPNResponse = await res.json();
    const resolvedWeek = weekNumber || data.week?.number || 4;
    const resolvedSeason = seasonYear || data.leagues?.[0]?.season?.year || 2026;

    const games: Game[] = (data.events || []).map((event) => {
      const comp = event.competitions?.[0];
      const homeComp = comp?.competitors.find((c) => c.homeAway === "home");
      const awayComp = comp?.competitors.find((c) => c.homeAway === "away");

      const homeTeam: Team = {
        id: homeComp?.team.id || "0",
        name: homeComp?.team.name || "Home Team",
        abbreviation: homeComp?.team.abbreviation || "HOM",
        displayName: homeComp?.team.displayName || "Home Team",
        shortDisplayName:
          homeComp?.team.shortDisplayName || homeComp?.team.name || "Home",
        logo:
          homeComp?.team.logo ||
          `https://a.espncdn.com/i/teamlogos/nfl/500/${homeComp?.team.abbreviation?.toLowerCase()}.png`,
        color: homeComp?.team.color ? `#${homeComp.team.color}` : "#1e293b",
        record: homeComp?.records?.[0]?.summary || "",
      };

      const awayTeam: Team = {
        id: awayComp?.team.id || "1",
        name: awayComp?.team.name || "Away Team",
        abbreviation: awayComp?.team.abbreviation || "AWY",
        displayName: awayComp?.team.displayName || "Away Team",
        shortDisplayName:
          awayComp?.team.shortDisplayName || awayComp?.team.name || "Away",
        logo:
          awayComp?.team.logo ||
          `https://a.espncdn.com/i/teamlogos/nfl/500/${awayComp?.team.abbreviation?.toLowerCase()}.png`,
        color: awayComp?.team.color ? `#${awayComp.team.color}` : "#334155",
        record: awayComp?.records?.[0]?.summary || "",
      };

      const rawStatus = comp?.status;
      const status: GameStatus = {
        state: rawStatus?.type.state || "pre",
        detail: rawStatus?.type.detail || "Scheduled",
        shortDetail: rawStatus?.type.shortDetail || "",
        completed: Boolean(rawStatus?.type.completed),
        clock: rawStatus?.displayClock,
        period: rawStatus?.period,
      };

      const homeScore = homeComp?.score ? parseInt(homeComp.score, 10) : undefined;
      const awayScore = awayComp?.score ? parseInt(awayComp.score, 10) : undefined;

      let winnerTeamId: string | undefined = undefined;
      if (status.completed && homeScore !== undefined && awayScore !== undefined) {
        if (homeScore > awayScore) {
          winnerTeamId = homeTeam.id;
        } else if (awayScore > homeScore) {
          winnerTeamId = awayTeam.id;
        }
      }

      const odds: GameOdds | undefined = comp?.odds?.[0]
        ? {
            details: comp.odds[0].details,
            overUnder: comp.odds[0].overUnder,
            spread: comp.odds[0].spread,
          }
        : undefined;

      return {
        id: event.id,
        week: resolvedWeek,
        season: resolvedSeason,
        seasonType: 2,
        date: event.date,
        name: event.name,
        shortName: event.shortName,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        winnerTeamId,
        status,
        odds,
        isTiebreakerGame: false,
      };
    });

    // Sort games chronologically: Thursday first, ending with Monday at the bottom
    games.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Mark the latest game (Monday Night Football) as the tiebreaker game
    if (games.length > 0) {
      games[games.length - 1].isTiebreakerGame = true;
    }

    return {
      week: resolvedWeek,
      season: resolvedSeason,
      games,
      source: "espn",
    };
  } catch (error) {
    console.error("Error fetching ESPN data, falling back to mock:", error);
    return { ...getFallbackWeekGames(weekNumber || 5, seasonYear), source: "fallback" };
  }
}

/**
 * High quality fallback NFL games with real team details, logos, records, and odds
 * in case of network interruption or offline testing.
 */
export function getFallbackWeekGames(
  week: number,
  season: number = 2026
): { week: number; season: number; games: Game[] } {
  const sampleMatchups = [
    {
      id: `w${week}-g1`,
      home: { id: "5", name: "Browns", abbr: "CLE", full: "Cleveland Browns", color: "#311D00", record: "2-2" },
      away: { id: "23", name: "Steelers", abbr: "PIT", full: "Pittsburgh Steelers", color: "#FFB612", record: "2-2" },
      spread: "CLE -1.5",
      total: 41.5,
      date: "2026-10-02T00:15:00Z", // Thursday Night Football
    },
    {
      id: `w${week}-g2`,
      home: { id: "28", name: "Commanders", abbr: "WSH", full: "Washington Commanders", color: "#5A1414", record: "2-1" },
      away: { id: "11", name: "Colts", abbr: "IND", full: "Indianapolis Colts", color: "#002C5F", record: "1-2" },
      spread: "WSH -3.0",
      total: 44.5,
      date: "2026-10-04T13:30:00Z", // London Game (9:30 AM ET)
    },
    {
      id: `w${week}-g3`,
      home: { id: "2", name: "Bills", abbr: "BUF", full: "Buffalo Bills", color: "#00338D", record: "3-0" },
      away: { id: "17", name: "Patriots", abbr: "NE", full: "New England Patriots", color: "#002244", record: "1-2" },
      spread: "BUF -7.5",
      total: 43.0,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g4`,
      home: { id: "3", name: "Bears", abbr: "CHI", full: "Chicago Bears", color: "#0B162A", record: "2-1" },
      away: { id: "20", name: "Jets", abbr: "NYJ", full: "New York Jets", color: "#125740", record: "1-2" },
      spread: "CHI -2.5",
      total: 39.5,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g5`,
      home: { id: "4", name: "Bengals", abbr: "CIN", full: "Cincinnati Bengals", color: "#FB4F14", record: "1-2" },
      away: { id: "30", name: "Jaguars", abbr: "JAX", full: "Jacksonville Jaguars", color: "#006778", record: "1-2" },
      spread: "CIN -4.0",
      total: 47.0,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g6`,
      home: { id: "19", name: "Giants", abbr: "NYG", full: "New York Giants", color: "#0B2265", record: "2-1" },
      away: { id: "22", name: "Cardinals", abbr: "ARI", full: "Arizona Cardinals", color: "#97233F", record: "1-2" },
      spread: "NYG -1.5",
      total: 42.0,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g7`,
      home: { id: "21", name: "Eagles", abbr: "PHI", full: "Philadelphia Eagles", color: "#004C54", record: "2-1" },
      away: { id: "14", name: "Rams", abbr: "LAR", full: "Los Angeles Rams", color: "#003594", record: "1-2" },
      spread: "PHI -3.5",
      total: 45.0,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g8`,
      home: { id: "27", name: "Buccaneers", abbr: "TB", full: "Tampa Bay Buccaneers", color: "#D3BC8D", record: "1-2" },
      away: { id: "9", name: "Packers", abbr: "GB", full: "Green Bay Packers", color: "#203731", record: "2-1" },
      spread: "GB -2.5",
      total: 46.5,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g9`,
      home: { id: "33", name: "Ravens", abbr: "BAL", full: "Baltimore Ravens", color: "#241773", record: "2-1" },
      away: { id: "10", name: "Titans", abbr: "TEN", full: "Tennessee Titans", color: "#0C2340", record: "0-3" },
      spread: "BAL -6.5",
      total: 41.0,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g10`,
      home: { id: "34", name: "Texans", abbr: "HOU", full: "Houston Texans", color: "#03202F", record: "1-2" },
      away: { id: "6", name: "Cowboys", abbr: "DAL", full: "Dallas Cowboys", color: "#003594", record: "2-1" },
      spread: "DAL -1.5",
      total: 46.5,
      date: "2026-10-04T17:00:00Z",
    },
    {
      id: `w${week}-g11`,
      home: { id: "16", name: "Vikings", abbr: "MIN", full: "Minnesota Vikings", color: "#4F2683", record: "3-0" },
      away: { id: "15", name: "Dolphins", abbr: "MIA", full: "Miami Dolphins", color: "#008E97", record: "1-2" },
      spread: "MIN -3.5",
      total: 42.5,
      date: "2026-10-04T20:05:00Z",
    },
    {
      id: `w${week}-g12`,
      home: { id: "13", name: "Raiders", abbr: "LV", full: "Las Vegas Raiders", color: "#000000", record: "2-1" },
      away: { id: "12", name: "Chiefs", abbr: "KC", full: "Kansas City Chiefs", color: "#E31837", record: "3-0" },
      spread: "KC -4.5",
      total: 44.0,
      date: "2026-10-04T20:25:00Z",
    },
    {
      id: `w${week}-g13`,
      home: { id: "25", name: "49ers", abbr: "SF", full: "San Francisco 49ers", color: "#AA0000", record: "2-1" },
      away: { id: "7", name: "Broncos", abbr: "DEN", full: "Denver Broncos", color: "#FB4F14", record: "1-2" },
      spread: "SF -6.5",
      total: 40.5,
      date: "2026-10-04T20:25:00Z",
    },
    {
      id: `w${week}-g14`,
      home: { id: "26", name: "Seahawks", abbr: "SEA", full: "Seattle Seahawks", color: "#002244", record: "2-1" },
      away: { id: "24", name: "Chargers", abbr: "LAC", full: "Los Angeles Chargers", color: "#0080C6", record: "1-2" },
      spread: "SEA -2.5",
      total: 43.5,
      date: "2026-10-04T20:25:00Z",
    },
    {
      id: `w${week}-g15`,
      home: { id: "29", name: "Panthers", abbr: "CAR", full: "Carolina Panthers", color: "#0085CA", record: "1-2" },
      away: { id: "8", name: "Lions", abbr: "DET", full: "Detroit Lions", color: "#0076B6", record: "2-1" },
      spread: "DET -5.5",
      total: 48.0,
      date: "2026-10-05T00:20:00Z", // Sunday Night Football
    },
    {
      id: `w${week}-g16`,
      home: { id: "18", name: "Saints", abbr: "NO", full: "New Orleans Saints", color: "#D3BC8D", record: "1-2" },
      away: { id: "1", name: "Falcons", abbr: "ATL", full: "Atlanta Falcons", color: "#A71930", record: "1-2" },
      spread: "NO -2.0",
      total: 43.0,
      date: "2026-10-06T00:15:00Z", // Monday Night Football / Tiebreaker Game!
      isTiebreaker: true,
    },
  ];

  const games: Game[] = sampleMatchups.map((m) => {
    return {
      id: m.id,
      week,
      season,
      seasonType: 2,
      date: m.date,
      name: `${m.away.full} at ${m.home.full}`,
      shortName: `${m.away.abbr} @ ${m.home.abbr}`,
      homeTeam: {
        id: m.home.id,
        name: m.home.name,
        abbreviation: m.home.abbr,
        displayName: m.home.full,
        shortDisplayName: m.home.name,
        logo: `https://a.espncdn.com/i/teamlogos/nfl/500/${m.home.abbr.toLowerCase()}.png`,
        color: m.home.color,
        record: m.home.record,
      },
      awayTeam: {
        id: m.away.id,
        name: m.away.name,
        abbreviation: m.away.abbr,
        displayName: m.away.full,
        shortDisplayName: m.away.name,
        logo: `https://a.espncdn.com/i/teamlogos/nfl/500/${m.away.abbr.toLowerCase()}.png`,
        color: m.away.color,
        record: m.away.record,
      },
      status: {
        state: "pre",
        completed: false,
        detail: "Scheduled",
        shortDetail: "Scheduled",
      },
      odds: {
        details: m.spread,
        overUnder: m.total,
      },
      isTiebreakerGame: Boolean(m.isTiebreaker),
    };
  });

  // Sort games chronologically: Thursday first, ending with Monday at the bottom
  games.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Mark the last game (Monday Night Football) as the tiebreaker game
  games.forEach((g) => {
    g.isTiebreakerGame = false;
  });
  if (games.length > 0) {
    games[games.length - 1].isTiebreakerGame = true;
  }

  return {
    week,
    season,
    games,
  };
}
