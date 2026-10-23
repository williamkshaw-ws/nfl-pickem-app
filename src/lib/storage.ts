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
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore on read-only serverless filesystems
  }
}

/**
 * Default empty database schema used when initializing the local ESPN schedule cache.
 */
export function generateSeedData(): DatabaseSchema {
  return {
    settings: {
      leagueName: "PocketPicks League",
      seasonYear: 2026,
      currentWeek: 1,
      lockPolicy: "game",
      tiebreakerRuleSummary:
        "1. Combined Total Points -> 2. Closest to Home Score -> 3. Closest to Away Score",
    },
    users: [],
    picks: [],
    gamesByWeek: {
      1: getFallbackWeekGames(1, 2026).games,
    },
    currentActiveUserId: "",
  };
}

let _cachedDb: DatabaseSchema | null = null;
let _cachedDbMtime = 0;

export function getDatabase(): DatabaseSchema {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(DB_PATH)) {
      if (_cachedDb) return _cachedDb;
      const seed = generateSeedData();
      saveDatabase(seed);
      return seed;
    }

    const stat = fs.statSync(DB_PATH);
    if (_cachedDb && stat.mtimeMs <= _cachedDbMtime) {
      return _cachedDb;
    }
    const content = fs.readFileSync(DB_PATH, "utf-8");
    _cachedDb = JSON.parse(content) as DatabaseSchema;
    _cachedDbMtime = stat.mtimeMs;
    return _cachedDb;
  } catch (err) {
    if (_cachedDb) return _cachedDb;
    console.warn("Falling back to in-memory database cache:", err);
    const seed = generateSeedData();
    _cachedDb = seed;
    _cachedDbMtime = Date.now();
    return seed;
  }
}

export function saveDatabase(data: DatabaseSchema): void {
  _cachedDb = data;
  _cachedDbMtime = Date.now();
  try {
    ensureDirectoryExists();
    const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, DB_PATH);
  } catch {
    // Ignore disk write failures on read-only serverless environments; in-memory _cachedDb remains updated
  }
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
 * Automatically detects the current NFL week.
 * Each NFL week runs through Monday Night Football and rolls over to the
 * next week starting on Tuesday morning (2:00 AM ET / 06:00 UTC).
 */
export function detectCurrentWeek(gamesByWeek: Record<number, Game[]>): number {
  const now = Date.now();
  // Week 1 Monday Night Football concludes Monday Sep 14, 2026 night;
  // Tuesday Sep 15, 2026 at 2:00 AM ET (06:00 UTC) starts Week 2.
  const week1TuesdayRollover = new Date("2026-09-15T06:00:00Z").getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  for (let w = 1; w <= 18; w++) {
    const calendarTuesdayRollover = week1TuesdayRollover + (w - 1) * oneWeekMs;
    const games = gamesByWeek[w] || [];

    // 1. If any game in this week is currently live, this is the active week
    if (games.some((g) => g.status?.state === "in")) {
      return w;
    }

    // 2. Determine the Tuesday rollover timestamp for week w
    let rolloverTime = calendarTuesdayRollover;
    const realGames = games.filter((g) => g.id && !/^w\d+-g\d+$/.test(g.id));
    if (realGames.length > 0) {
      const latestKickoff = Math.max(
        ...realGames.map((g) => new Date(g.date).getTime()).filter((t) => !isNaN(t))
      );
      if (Number.isFinite(latestKickoff)) {
        // Ensure rollover is at least 5 hours after the final game kicks off (Tuesday morning ET)
        rolloverTime = Math.max(calendarTuesdayRollover, latestKickoff + 5 * 60 * 60 * 1000);
      }
    }

    // If we have not yet reached Tuesday morning after week w's games, week w is current
    if (now < rolloverTime) {
      return w;
    }
  }

  return 18;
}
