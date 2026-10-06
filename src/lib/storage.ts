import fs from "fs";
import path from "path";
import { Game, LeagueSettings, User, UserPicks } from "@/types/nfl";
import { fetchEspnWeekGames, getFallbackWeekGames } from "./espn";

export interface DatabaseSchema {
  settings: LeagueSettings;
  users: User[];
  picks: UserPicks[];
  gamesByWeek: Record<number, Game[]>;
  currentActiveUserId: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "league.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Builds realistic seed data with multiple completed weeks to demonstrate
 * weekly winners, 3-tier tiebreaker decisions, and season cumulative standings!
 */
export function generateSeedData(): DatabaseSchema {
  const users: User[] = [
    {
      id: "user-1",
      name: "William (You)",
      avatarColor: "bg-emerald-600",
      isAdmin: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-2",
      name: "Sarah Jenkins",
      avatarColor: "bg-indigo-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-3",
      name: "Marcus 'Big Mike'",
      avatarColor: "bg-amber-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-4",
      name: "Coach Tom",
      avatarColor: "bg-rose-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-5",
      name: "Elena Rostova",
      avatarColor: "bg-cyan-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-6",
      name: "Alex 'The Oracle'",
      avatarColor: "bg-purple-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-7",
      name: "David Chen",
      avatarColor: "bg-blue-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-8",
      name: "Rachel P.",
      avatarColor: "bg-pink-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-9",
      name: "James Football",
      avatarColor: "bg-orange-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-10",
      name: "Lisa Wong",
      avatarColor: "bg-teal-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-11",
      name: "Chris 'Clutch'",
      avatarColor: "bg-fuchsia-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-12",
      name: "Aisha M.",
      avatarColor: "bg-violet-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-13",
      name: "Tyler Gridiron",
      avatarColor: "bg-lime-600",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-14",
      name: "Sonia G.",
      avatarColor: "bg-emerald-700",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-15",
      name: "Brian 'The Brain'",
      avatarColor: "bg-slate-600",
      createdAt: new Date().toISOString(),
    },
  ];

  // Week 1 completed games
  const week1Fallback = getFallbackWeekGames(1, 2026);
  const week1Games: Game[] = week1Fallback.games.map((g, idx) => {
    const homeScore = 20 + ((idx * 3 + 4) % 17);
    const awayScore = 17 + ((idx * 5 + 2) % 14);
    const winnerId = homeScore > awayScore ? g.homeTeam.id : g.awayTeam.id;
    return {
      ...g,
      homeScore,
      awayScore,
      winnerTeamId: winnerId,
      status: {
        state: "post",
        completed: true,
        detail: "Final",
        shortDetail: "Final",
      },
    };
  });

  // Week 2 completed games
  const week2Fallback = getFallbackWeekGames(2, 2026);
  const week2Games: Game[] = week2Fallback.games.map((g, idx) => {
    const homeScore = 24 + ((idx * 4 + 1) % 13);
    const awayScore = 21 + ((idx * 2 + 5) % 15);
    const winnerId = homeScore > awayScore ? g.homeTeam.id : g.awayTeam.id;
    return {
      ...g,
      homeScore,
      awayScore,
      winnerTeamId: winnerId,
      status: {
        state: "post",
        completed: true,
        detail: "Final",
        shortDetail: "Final",
      },
    };
  });

  // Week 3 completed games - engineered tiebreaker battle!
  // In Week 3, Sarah and William both got 6 picks right!
  // Tiebreaker game: Saints vs Falcons
  const week3Fallback = getFallbackWeekGames(3, 2026);
  const week3Games: Game[] = week3Fallback.games.map((g, idx) => {
    const homeScore = idx === 0 ? 26 : 28 + (idx % 7);
    const awayScore = idx === 0 ? 13 : 20 + (idx % 6);
    const winnerId = homeScore > awayScore ? g.homeTeam.id : g.awayTeam.id;
    return {
      ...g,
      homeScore,
      awayScore,
      winnerTeamId: winnerId,
      status: {
        state: "post",
        completed: true,
        detail: "Final",
        shortDetail: "Final",
      },
    };
  });

  // Week 4 (Current active week) - Thursday night game finished; Sunday & Monday games scheduled!
  const week4Fallback = getFallbackWeekGames(4, 2026);
  const week4Games: Game[] = week4Fallback.games.map((g, idx) => {
    if (idx === 0) {
      // Thursday Night Football: PIT @ CLE
      return {
        ...g,
        homeScore: 24,
        awayScore: 21,
        winnerTeamId: g.homeTeam.id, // CLE Browns
        status: {
          state: "post",
          completed: true,
          detail: "Final",
          shortDetail: "Final",
        },
      };
    }
    return {
      ...g,
      homeScore: undefined,
      awayScore: undefined,
      winnerTeamId: undefined,
      status: {
        state: "pre",
        completed: false,
        detail: "Scheduled",
        shortDetail: "Scheduled",
      },
    };
  });

  const gamesByWeek: Record<number, Game[]> = {
    1: week1Games,
    2: week2Games,
    3: week3Games,
    4: week4Games,
  };

  // Seed picks for past weeks so standings look authentic immediately
  const picks: UserPicks[] = [];

  // Helper to generate simulated picks
  const generateSimulatedPicks = (
    userId: string,
    week: number,
    games: Game[],
    targetAccuracy: number,
    tiebreakerHome: number,
    tiebreakerAway: number
  ) => {
    const userPicksObj: Record<string, string> = {};
    games.forEach((game, idx) => {
      const isCorrect = (idx + userId.length) % 10 < targetAccuracy * 10;
      if (isCorrect && game.winnerTeamId) {
        userPicksObj[game.id] = game.winnerTeamId;
      } else {
        // pick opposite
        userPicksObj[game.id] =
          game.homeTeam.id === game.winnerTeamId
            ? game.awayTeam.id
            : game.homeTeam.id;
      }
    });

    picks.push({
      userId,
      week,
      picks: userPicksObj,
      tiebreaker: {
        homeScore: tiebreakerHome,
        awayScore: tiebreakerAway,
        totalScore: tiebreakerHome + tiebreakerAway,
      },
      submittedAt: new Date(Date.now() - (5 - week) * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - (5 - week) * 86400000).toISOString(),
    });
  };

  // Week 1 picks
  generateSimulatedPicks("user-1", 1, week1Games, 0.75, 27, 20); // 6/8
  generateSimulatedPicks("user-2", 1, week1Games, 0.88, 24, 21); // 7/8 (Sarah won W1)
  generateSimulatedPicks("user-3", 1, week1Games, 0.50, 31, 24);
  generateSimulatedPicks("user-4", 1, week1Games, 0.62, 20, 17);
  generateSimulatedPicks("user-5", 1, week1Games, 0.62, 28, 23);

  // Week 2 picks
  generateSimulatedPicks("user-1", 2, week2Games, 0.62, 24, 21);
  generateSimulatedPicks("user-2", 2, week2Games, 0.50, 20, 14);
  generateSimulatedPicks("user-3", 2, week2Games, 0.88, 30, 27); // Big Mike won W2
  generateSimulatedPicks("user-4", 2, week2Games, 0.62, 23, 20);
  generateSimulatedPicks("user-5", 2, week2Games, 0.75, 26, 21);

  // Week 3 picks (Classic 3-tier Tiebreaker showpiece!)
  // In Week 3, Sarah and William both tie with 12 picks correct out of 16!
  // Tiebreaker game: Chiefs (Home: 26) vs Saints (Away: 13), Total = 39.
  // William: 27-14 (Total 41). Total diff = 2. Home diff = 1. Away diff = 1.
  // Sarah: 24-17 (Total 41). Total diff = 2. Home diff = 2. Away diff = 4.
  // William wins on Tier 2!
  const user1W3Picks: Record<string, string> = {};
  const user2W3Picks: Record<string, string> = {};
  week3Games.forEach((g, idx) => {
    if (idx < 12 && g.winnerTeamId) {
      user1W3Picks[g.id] = g.winnerTeamId;
      user2W3Picks[g.id] = g.winnerTeamId;
    } else {
      user1W3Picks[g.id] =
        g.homeTeam.id === g.winnerTeamId ? g.awayTeam.id : g.homeTeam.id;
      user2W3Picks[g.id] =
        g.homeTeam.id === g.winnerTeamId ? g.awayTeam.id : g.homeTeam.id;
    }
  });

  picks.push({
    userId: "user-1",
    week: 3,
    picks: user1W3Picks,
    tiebreaker: {
      homeScore: 27,
      awayScore: 14,
      totalScore: 41,
    },
    submittedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  });

  picks.push({
    userId: "user-2",
    week: 3,
    picks: user2W3Picks,
    tiebreaker: {
      homeScore: 24,
      awayScore: 17,
      totalScore: 41,
    },
    submittedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  });

  generateSimulatedPicks("user-3", 3, week3Games, 0.50, 34, 21);
  generateSimulatedPicks("user-4", 3, week3Games, 0.50, 20, 10);
  generateSimulatedPicks("user-5", 3, week3Games, 0.62, 28, 24);

  // Week 4: Sample picks from Sarah and Mike covering all 16 games
  const user2W4Picks: Record<string, string> = {};
  const user3W4Picks: Record<string, string> = {};
  week4Games.forEach((g, idx) => {
    user2W4Picks[g.id] = idx % 2 === 0 ? g.homeTeam.id : g.awayTeam.id;
    user3W4Picks[g.id] = idx % 3 === 0 ? g.awayTeam.id : g.homeTeam.id;
  });

  picks.push({
    userId: "user-2",
    week: 4,
    picks: user2W4Picks,
    tiebreaker: {
      homeScore: 27,
      awayScore: 20,
      totalScore: 47,
    },
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  picks.push({
    userId: "user-3",
    week: 4,
    picks: user3W4Picks,
    tiebreaker: {
      homeScore: 31,
      awayScore: 28,
      totalScore: 59,
    },
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    settings: {
      leagueName: "Gridiron Clash League",
      seasonYear: 2026,
      currentWeek: 4,
      lockPolicy: "game", // Default false for smooth testing
      tiebreakerRuleSummary:
        "1. Combined Total Points -> 2. Closest to Home Score -> 3. Closest to Away Score",
    },
    users,
    picks,
    gamesByWeek,
    currentActiveUserId: "user-1",
  };
}

export function getDatabase(): DatabaseSchema {
  ensureDirectoryExists();
  if (!fs.existsSync(DB_PATH)) {
    const seed = generateSeedData();
    saveDatabase(seed);
    return seed;
  }

  try {
    const content = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(content) as DatabaseSchema;
  } catch (err) {
    console.error("Failed to read database, regenerating seed:", err);
    const seed = generateSeedData();
    saveDatabase(seed);
    return seed;
  }
}

export function saveDatabase(data: DatabaseSchema): void {
  ensureDirectoryExists();
  const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, DB_PATH);
}

export async function syncWeekFromEspn(
  weekNumber: number,
  seasonYear: number = 2026
): Promise<{ games: Game[]; synced: boolean }> {
  const db = getDatabase();
  const espnResult = await fetchEspnWeekGames(weekNumber, seasonYear);

  // Only persist real ESPN data. If ESPN was unreachable we got mock games
  // (all "Scheduled"), and saving them would wipe out existing final scores.
  if (espnResult.source === "espn" && espnResult.games.length > 0) {
    db.gamesByWeek[weekNumber] = espnResult.games;
    saveDatabase(db);
    return { games: espnResult.games, synced: true };
  }

  return { games: db.gamesByWeek[weekNumber] || [], synced: false };
}

/**
 * Automatically detects the current NFL week by finding the first week
 * that has games currently live or scheduled in the future.
 * 
 * Once Tuesday arrives and all games of the previous week are concluded,
 * it automatically advances to the upcoming week (e.g. Week 5).
 */
export function detectCurrentWeek(gamesByWeek: Record<number, Game[]>): number {
  const now = Date.now();

  for (let w = 1; w <= 18; w++) {
    const games = gamesByWeek[w] || [];
    if (games.length === 0) continue;

    // 1. If any game in this week is currently in progress, this is the active week
    const hasLiveGame = games.some((g) => g.status.state === "in");
    if (hasLiveGame) return w;

    // 2. If all games in this week are completed, this week is over
    const allCompleted = games.every((g) => g.status.completed);
    if (allCompleted) {
      continue;
    }

    // 3. If every game in this week started in the past (> 8 hours ago),
    // this week is concluded even if scores are awaiting final wrap-up
    const allInPast = games.every((g) => {
      const gameTime = new Date(g.date).getTime();
      return !isNaN(gameTime) && gameTime + 8 * 60 * 60 * 1000 < now;
    });

    if (allInPast) {
      continue;
    }

    // This week has upcoming future games scheduled, so it is the active week!
    return w;
  }

  return 1;
}
