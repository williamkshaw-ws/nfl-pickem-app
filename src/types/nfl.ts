export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  logo: string;
  color?: string;
  alternateColor?: string;
  record?: string;
}

export type GameStatusState = "pre" | "in" | "post";

export interface GameStatus {
  state: GameStatusState; // "pre" = scheduled, "in" = in progress, "post" = finished
  detail: string;         // e.g. "Final", "Q3 4:15", "Sun, 1:00 PM"
  shortDetail: string;
  completed: boolean;
  clock?: string;
  period?: number;
}

export interface GameOdds {
  details?: string;       // e.g. "KC -3.5"
  overUnder?: number;     // e.g. 46.5
  spread?: number;
}

export interface Game {
  id: string;
  week: number;
  season: number;
  seasonType: number;     // 2 = regular season
  date: string;           // ISO timestamp
  name: string;           // "Kansas City Chiefs at Baltimore Ravens"
  shortName: string;      // "KC @ BAL"
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;  // ID of the winning team if game finished
  status: GameStatus;
  odds?: GameOdds;
  isTiebreakerGame?: boolean;
}

export interface TiebreakerPrediction {
  homeScore: number;
  awayScore: number;
  totalScore: number;     // homeScore + awayScore
}

export interface UserPicks {
  userId: string;
  week: number;
  picks: Record<string, string>; // gameId -> selectedTeamId
  tiebreaker?: TiebreakerPrediction;
  eliminatorPick?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  isAdmin?: boolean;
  createdAt: string;
}

export interface TiebreakerStats {
  predictedHome: number;
  predictedAway: number;
  predictedTotal: number;
  actualHome?: number;
  actualAway?: number;
  actualTotal?: number;
  tier1TotalDiff?: number; // |predictedTotal - actualTotal|
  tier2HomeDiff?: number;  // |predictedHome - actualHome|
  tier3AwayDiff?: number;  // |predictedAway - actualAway|
}

export interface WeeklyPlayerResult {
  userId: string;
  userName: string;
  avatarColor: string;
  correctPicks: number;
  totalGames: number;
  winPercentage: number;
  tiebreaker?: TiebreakerStats;
  rank: number;
  isWeeklyWinner: boolean;
  tiebreakerExplanation?: string;
}

export interface SeasonPlayerStanding {
  userId: string;
  userName: string;
  avatarColor: string;
  rank: number;
  totalCorrect: number;
  totalGames: number;
  winPercentage: number;
  weeklyWins: number;
  weeksPlayed: number;
  recentWeeklyScores: { week: number; correct: number; total: number; isWinner: boolean }[];
}

export interface LeagueSettings {
  commissionerId?: string;
  leagueName: string;
  seasonYear: number;
  currentWeek: number;
  lockPolicy: "week" | "day" | "game";
  tiebreakerRuleSummary: string;
  eliminatorEnabled?: boolean;
  pickemEnabled?: boolean;
  leaguePassword?: string;
}

export interface EliminatorStatus {
  userId: string;
  status: "Alive" | "Eliminated";
  eliminatedWeek?: number;
  picksByWeek: Record<number, {
    teamId: string;
    abbreviation: string;
    logo: string;
    result: "won" | "lost" | "pending";
  }>;
}
