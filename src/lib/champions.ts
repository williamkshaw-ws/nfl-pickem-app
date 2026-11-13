import { PastSeasonChampion } from "@/types/nfl";

export interface PlayerChampionshipInfo {
  titles: PastSeasonChampion[];
  isReigning: boolean;
}

/**
 * Matches a league member against `pastChampions` by userId first,
 * falling back to case-insensitive userName for pre-account or legacy entries.
 */
export function getPlayerChampionships(
  pastChampions: PastSeasonChampion[] | undefined,
  userId: string,
  userName: string
): PlayerChampionshipInfo {
  if (!pastChampions || pastChampions.length === 0) {
    return { titles: [], isReigning: false };
  }

  const latestYear = Math.max(...pastChampions.map((c) => c.seasonYear));
  const normalizedName = userName.trim().toLowerCase();

  const titles = pastChampions
    .filter((c) => {
      if (c.userId && userId) return c.userId === userId;
      return c.userName.trim().toLowerCase() === normalizedName;
    })
    .sort((a, b) => a.seasonYear - b.seasonYear);

  const isReigning = titles.some((t) => t.seasonYear === latestYear);

  return { titles, isReigning };
}
