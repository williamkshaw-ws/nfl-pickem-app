import type { Game } from "@/types/nfl";

/**
 * Determines whether picks for a given game are locked under the league's lock policy.
 */
export function isGameLockedClient(
  game: Game,
  weekGames: Game[],
  lockPolicy: "week" | "day" | "game" | string = "game",
  now: number = Date.now()
): boolean {
  if (
    game.status?.completed ||
    game.status?.state === "in" ||
    now >= new Date(game.date).getTime()
  ) {
    return true;
  }

  if (lockPolicy === "week") {
    const firstGameOfWeek = Math.min(...weekGames.map((g) => new Date(g.date).getTime()));
    return now >= firstGameOfWeek;
  }

  if (lockPolicy === "day") {
    const gameDateStr = new Date(game.date).toDateString();
    const firstGameOfDay = Math.min(
      ...weekGames
        .filter((g) => new Date(g.date).toDateString() === gameDateStr)
        .map((g) => new Date(g.date).getTime())
    );
    return now >= firstGameOfDay;
  }

  return false;
}
