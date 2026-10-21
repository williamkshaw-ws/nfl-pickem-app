export interface PlayoffTeam {
  seed: number;
  conference: "AFC" | "NFC";
  name: string;
  abbr: string;
  nickname: string;
}

export const NFL_NICKNAMES: Record<string, string> = {
  ARI: "Cardinals",
  ATL: "Falcons",
  BAL: "Ravens",
  BUF: "Bills",
  CAR: "Panthers",
  CHI: "Bears",
  CIN: "Bengals",
  CLE: "Browns",
  DAL: "Cowboys",
  DEN: "Broncos",
  DET: "Lions",
  GB: "Packers",
  HOU: "Texans",
  IND: "Colts",
  JAX: "Jaguars",
  KC: "Chiefs",
  LV: "Raiders",
  LAC: "Chargers",
  LAR: "Rams",
  MIA: "Dolphins",
  MIN: "Vikings",
  NE: "Patriots",
  NO: "Saints",
  NYG: "Giants",
  NYJ: "Jets",
  PHI: "Eagles",
  PIT: "Steelers",
  SF: "49ers",
  SEA: "Seahawks",
  TB: "Buccaneers",
  TEN: "Titans",
  WAS: "Commanders",
};

export function getTeamNickname(team?: { name?: string; abbr?: string; nickname?: string } | null): string {
  if (!team) return "";
  if (team.nickname) return team.nickname;
  if (team.abbr && NFL_NICKNAMES[team.abbr]) return NFL_NICKNAMES[team.abbr];
  if (team.name) {
    const parts = team.name.trim().split(" ");
    return parts[parts.length - 1];
  }
  return "";
}

export type BracketGameId =
  | "afc_wc_1"
  | "afc_wc_2"
  | "afc_wc_3"
  | "nfc_wc_1"
  | "nfc_wc_2"
  | "nfc_wc_3"
  | "afc_div_1"
  | "afc_div_2"
  | "nfc_div_1"
  | "nfc_div_2"
  | "afc_champ"
  | "nfc_champ"
  | "super_bowl";

export interface BracketRoundPoints {
  wild_card: number;
  divisional: number;
  conference: number;
  super_bowl: number;
}

export const DEFAULT_ROUND_POINTS: BracketRoundPoints = {
  wild_card: 1,
  divisional: 1,
  conference: 1,
  super_bowl: 1,
};

export const GAME_ROUNDS: Record<BracketGameId, keyof BracketRoundPoints> = {
  afc_wc_1: "wild_card",
  afc_wc_2: "wild_card",
  afc_wc_3: "wild_card",
  nfc_wc_1: "wild_card",
  nfc_wc_2: "wild_card",
  nfc_wc_3: "wild_card",
  afc_div_1: "divisional",
  afc_div_2: "divisional",
  nfc_div_1: "divisional",
  nfc_div_2: "divisional",
  afc_champ: "conference",
  nfc_champ: "conference",
  super_bowl: "super_bowl",
};

export function calculateTotalBracketPoints(roundPoints: BracketRoundPoints = DEFAULT_ROUND_POINTS): number {
  return (
    6 * (roundPoints.wild_card ?? 1) +
    4 * (roundPoints.divisional ?? 1) +
    2 * (roundPoints.conference ?? 1) +
    1 * (roundPoints.super_bowl ?? 1)
  );
}

export type BracketPicks = Partial<Record<BracketGameId, string>>;

export interface TiebreakerPrediction {
  homeScore: number;
  awayScore: number;
  totalScore?: number;
}

export interface TiebreakerStats {
  predictedHome: number;
  predictedAway: number;
  predictedTotal: number;
  actualHome?: number;
  actualAway?: number;
  actualTotal?: number;
  tier1TotalDiff?: number;
  tier2HomeDiff?: number;
  tier3AwayDiff?: number;
}

export interface GameResult {
  winner: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isCompleted: boolean;
}

export type SimulationResults = Partial<Record<BracketGameId, GameResult>>;

export interface BracketParticipant {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  picks: BracketPicks;
  tiebreaker?: TiebreakerPrediction;
  score: number;
  maxPossible?: number;
  superBowlWinner?: string;
  updatedAt: string;
  rank?: number;
  tiebreakerStats?: TiebreakerStats;
  tiebreakerExplanation?: string;
  isSample?: boolean;
}

export const AFC_SEEDS: PlayoffTeam[] = [
  { seed: 1, conference: "AFC", name: "Kansas City Chiefs", abbr: "KC", nickname: "Chiefs" },
  { seed: 2, conference: "AFC", name: "Buffalo Bills", abbr: "BUF", nickname: "Bills" },
  { seed: 3, conference: "AFC", name: "Baltimore Ravens", abbr: "BAL", nickname: "Ravens" },
  { seed: 4, conference: "AFC", name: "Houston Texans", abbr: "HOU", nickname: "Texans" },
  { seed: 5, conference: "AFC", name: "Los Angeles Chargers", abbr: "LAC", nickname: "Chargers" },
  { seed: 6, conference: "AFC", name: "Pittsburgh Steelers", abbr: "PIT", nickname: "Steelers" },
  { seed: 7, conference: "AFC", name: "Denver Broncos", abbr: "DEN", nickname: "Broncos" },
];

export const NFC_SEEDS: PlayoffTeam[] = [
  { seed: 1, conference: "NFC", name: "Detroit Lions", abbr: "DET", nickname: "Lions" },
  { seed: 2, conference: "NFC", name: "Philadelphia Eagles", abbr: "PHI", nickname: "Eagles" },
  { seed: 3, conference: "NFC", name: "Los Angeles Rams", abbr: "LAR", nickname: "Rams" },
  { seed: 4, conference: "NFC", name: "Tampa Bay Buccaneers", abbr: "TB", nickname: "Buccaneers" },
  { seed: 5, conference: "NFC", name: "San Francisco 49ers", abbr: "SF", nickname: "49ers" },
  { seed: 6, conference: "NFC", name: "Green Bay Packers", abbr: "GB", nickname: "Packers" },
  { seed: 7, conference: "NFC", name: "Washington Commanders", abbr: "WAS", nickname: "Commanders" },
];

export const ALL_PLAYOFF_TEAMS: PlayoffTeam[] = [...AFC_SEEDS, ...NFC_SEEDS];

export const TEAM_BY_ABBR: Record<string, PlayoffTeam> = ALL_PLAYOFF_TEAMS.reduce(
  (acc, team) => {
    acc[team.abbr] = team;
    return acc;
  },
  {} as Record<string, PlayoffTeam>
);

export interface MatchupSlot {
  gameId: BracketGameId;
  round: "wild_card" | "divisional" | "conference" | "super_bowl";
  conference: "AFC" | "NFC" | "NFL";
  title: string;
  homeTeam: PlayoffTeam | null;
  awayTeam: PlayoffTeam | null;
  selectedWinner?: string;
}

/**
 * Resolves the 13 playoff game matchups according to official NFL reseeding rules:
 * - Wild Card:
 *   #2 vs #7, #3 vs #6, #4 vs #5
 * - Divisional:
 *   #1 seed ALWAYS plays the lowest remaining seed (highest seed number).
 *   The remaining two winners play each other, with higher seed hosting.
 * - Conference Championships:
 *   Divisional winners play, higher seed hosts.
 * - Super Bowl:
 *   AFC Champion vs NFC Champion.
 */
export function resolveBracketMatchups(picks: BracketPicks): Record<BracketGameId, MatchupSlot> {
  const findTeam = (abbr?: string): PlayoffTeam | null => (abbr ? TEAM_BY_ABBR[abbr] || null : null);

  // 1. Wild Card Round
  const afc_wc_1: MatchupSlot = {
    gameId: "afc_wc_1",
    round: "wild_card",
    conference: "AFC",
    title: "AFC Wild Card (#2 vs #7)",
    homeTeam: AFC_SEEDS.find((t) => t.seed === 2)!,
    awayTeam: AFC_SEEDS.find((t) => t.seed === 7)!,
    selectedWinner: picks.afc_wc_1,
  };

  const afc_wc_2: MatchupSlot = {
    gameId: "afc_wc_2",
    round: "wild_card",
    conference: "AFC",
    title: "AFC Wild Card (#3 vs #6)",
    homeTeam: AFC_SEEDS.find((t) => t.seed === 3)!,
    awayTeam: AFC_SEEDS.find((t) => t.seed === 6)!,
    selectedWinner: picks.afc_wc_2,
  };

  const afc_wc_3: MatchupSlot = {
    gameId: "afc_wc_3",
    round: "wild_card",
    conference: "AFC",
    title: "AFC Wild Card (#4 vs #5)",
    homeTeam: AFC_SEEDS.find((t) => t.seed === 4)!,
    awayTeam: AFC_SEEDS.find((t) => t.seed === 5)!,
    selectedWinner: picks.afc_wc_3,
  };

  const nfc_wc_1: MatchupSlot = {
    gameId: "nfc_wc_1",
    round: "wild_card",
    conference: "NFC",
    title: "NFC Wild Card (#2 vs #7)",
    homeTeam: NFC_SEEDS.find((t) => t.seed === 2)!,
    awayTeam: NFC_SEEDS.find((t) => t.seed === 7)!,
    selectedWinner: picks.nfc_wc_1,
  };

  const nfc_wc_2: MatchupSlot = {
    gameId: "nfc_wc_2",
    round: "wild_card",
    conference: "NFC",
    title: "NFC Wild Card (#3 vs #6)",
    homeTeam: NFC_SEEDS.find((t) => t.seed === 3)!,
    awayTeam: NFC_SEEDS.find((t) => t.seed === 6)!,
    selectedWinner: picks.nfc_wc_2,
  };

  const nfc_wc_3: MatchupSlot = {
    gameId: "nfc_wc_3",
    round: "wild_card",
    conference: "NFC",
    title: "NFC Wild Card (#4 vs #5)",
    homeTeam: NFC_SEEDS.find((t) => t.seed === 4)!,
    awayTeam: NFC_SEEDS.find((t) => t.seed === 5)!,
    selectedWinner: picks.nfc_wc_3,
  };

  // Helper for Divisional reseeding
  const resolveDivisionalTeams = (
    seed1Team: PlayoffTeam,
    wcPicks: (string | undefined)[]
  ): { div1Home: PlayoffTeam; div1Away: PlayoffTeam | null; div2Home: PlayoffTeam | null; div2Away: PlayoffTeam | null } => {
    const winners = wcPicks.map(findTeam).filter((t): t is PlayoffTeam => t !== null);
    if (winners.length < 3) {
      return { div1Home: seed1Team, div1Away: null, div2Home: null, div2Away: null };
    }
    // Sort winners by seed ascending: e.g. [2, 3, 5] -> seed 5 is lowest seed (highest number)
    const sorted = [...winners].sort((a, b) => a.seed - b.seed);
    const lowestSeed = sorted[sorted.length - 1]; // plays #1
    const middleSeed = sorted[1];
    const topRemainingSeed = sorted[0];

    return {
      div1Home: seed1Team,
      div1Away: lowestSeed,
      div2Home: topRemainingSeed,
      div2Away: middleSeed,
    };
  };

  const afcDiv = resolveDivisionalTeams(
    AFC_SEEDS.find((t) => t.seed === 1)!,
    [picks.afc_wc_1, picks.afc_wc_2, picks.afc_wc_3]
  );

  const afc_div_1: MatchupSlot = {
    gameId: "afc_div_1",
    round: "divisional",
    conference: "AFC",
    title: "AFC Divisional (#1 vs Lowest Seed)",
    homeTeam: afcDiv.div1Home,
    awayTeam: afcDiv.div1Away,
    selectedWinner: picks.afc_div_1,
  };

  const afc_div_2: MatchupSlot = {
    gameId: "afc_div_2",
    round: "divisional",
    conference: "AFC",
    title: "AFC Divisional Matchup",
    homeTeam: afcDiv.div2Home,
    awayTeam: afcDiv.div2Away,
    selectedWinner: picks.afc_div_2,
  };

  const nfcDiv = resolveDivisionalTeams(
    NFC_SEEDS.find((t) => t.seed === 1)!,
    [picks.nfc_wc_1, picks.nfc_wc_2, picks.nfc_wc_3]
  );

  const nfc_div_1: MatchupSlot = {
    gameId: "nfc_div_1",
    round: "divisional",
    conference: "NFC",
    title: "NFC Divisional (#1 vs Lowest Seed)",
    homeTeam: nfcDiv.div1Home,
    awayTeam: nfcDiv.div1Away,
    selectedWinner: picks.nfc_div_1,
  };

  const nfc_div_2: MatchupSlot = {
    gameId: "nfc_div_2",
    round: "divisional",
    conference: "NFC",
    title: "NFC Divisional Matchup",
    homeTeam: nfcDiv.div2Home,
    awayTeam: nfcDiv.div2Away,
    selectedWinner: picks.nfc_div_2,
  };

  // 3. Conference Championships
  const resolveChampTeams = (div1Pick?: string, div2Pick?: string) => {
    const t1 = findTeam(div1Pick);
    const t2 = findTeam(div2Pick);
    if (!t1 || !t2) {
      return { home: t1 || t2 || null, away: null };
    }
    return t1.seed <= t2.seed ? { home: t1, away: t2 } : { home: t2, away: t1 };
  };

  const afcChampTeams = resolveChampTeams(picks.afc_div_1, picks.afc_div_2);
  const afc_champ: MatchupSlot = {
    gameId: "afc_champ",
    round: "conference",
    conference: "AFC",
    title: "AFC Championship Game",
    homeTeam: afcChampTeams.home,
    awayTeam: afcChampTeams.away,
    selectedWinner: picks.afc_champ,
  };

  const nfcChampTeams = resolveChampTeams(picks.nfc_div_1, picks.nfc_div_2);
  const nfc_champ: MatchupSlot = {
    gameId: "nfc_champ",
    round: "conference",
    conference: "NFC",
    title: "NFC Championship Game",
    homeTeam: nfcChampTeams.home,
    awayTeam: nfcChampTeams.away,
    selectedWinner: picks.nfc_champ,
  };

  // 4. Super Bowl
  const sbAfc = findTeam(picks.afc_champ);
  const sbNfc = findTeam(picks.nfc_champ);

  const super_bowl: MatchupSlot = {
    gameId: "super_bowl",
    round: "super_bowl",
    conference: "NFL",
    title: "Super Bowl Championship",
    homeTeam: sbAfc,
    awayTeam: sbNfc,
    selectedWinner: picks.super_bowl,
  };

  return {
    afc_wc_1,
    afc_wc_2,
    afc_wc_3,
    nfc_wc_1,
    nfc_wc_2,
    nfc_wc_3,
    afc_div_1,
    afc_div_2,
    nfc_div_1,
    nfc_div_2,
    afc_champ,
    nfc_champ,
    super_bowl,
  };
}

/**
 * Extracts all completed game winners from simulation/game results.
 */
export function extractActualWinners(results: SimulationResults): BracketPicks {
  const actual: BracketPicks = {};
  for (const [gid, res] of Object.entries(results)) {
    if (res?.isCompleted && res?.winner) {
      actual[gid as BracketGameId] = res.winner;
    }
  }
  return actual;
}

/**
 * Generates realistic NFL game scores.
 */
function generateRealisticScores(): { homeScore: number; awayScore: number } {
  const commonScores = [
    [24, 21], [27, 24], [31, 28], [24, 17], [28, 24],
    [30, 27], [20, 17], [23, 20], [34, 27], [31, 20],
    [38, 35], [26, 23], [24, 20], [27, 20], [35, 31],
  ];
  const pair = commonScores[Math.floor(Math.random() * commonScores.length)];
  const isHomeWinner = Math.random() >= 0.35; // Slight home field edge in playoffs
  return isHomeWinner
    ? { homeScore: pair[0], awayScore: pair[1] }
    : { homeScore: pair[1], awayScore: pair[0] };
}

/**
 * Simulates the complete 13-game NFL postseason with realistic reseeding and outcomes.
 */
export function simulatePlayoffOutcomes(): SimulationResults {
  const results: SimulationResults = {};
  const picksProgression: BracketPicks = {};

  // 1. Simulate Wild Card
  const wcGameIds: BracketGameId[] = [
    "afc_wc_1", "afc_wc_2", "afc_wc_3",
    "nfc_wc_1", "nfc_wc_2", "nfc_wc_3",
  ];

  const initialMatchups = resolveBracketMatchups({});

  for (const gid of wcGameIds) {
    const slot = initialMatchups[gid];
    const { homeScore, awayScore } = generateRealisticScores();
    const winner = homeScore > awayScore ? slot.homeTeam!.abbr : slot.awayTeam!.abbr;
    results[gid] = {
      winner,
      homeTeam: slot.homeTeam!.abbr,
      awayTeam: slot.awayTeam!.abbr,
      homeScore,
      awayScore,
      isCompleted: true,
    };
    picksProgression[gid] = winner;
  }

  // 2. Simulate Divisional (reseeding happens dynamically based on WC winners)
  const divMatchups = resolveBracketMatchups(picksProgression);
  const divGameIds: BracketGameId[] = ["afc_div_1", "afc_div_2", "nfc_div_1", "nfc_div_2"];

  for (const gid of divGameIds) {
    const slot = divMatchups[gid];
    const { homeScore, awayScore } = generateRealisticScores();
    const winner = homeScore > awayScore ? slot.homeTeam!.abbr : slot.awayTeam!.abbr;
    results[gid] = {
      winner,
      homeTeam: slot.homeTeam!.abbr,
      awayTeam: slot.awayTeam!.abbr,
      homeScore,
      awayScore,
      isCompleted: true,
    };
    picksProgression[gid] = winner;
  }

  // 3. Simulate Conference Championships
  const confMatchups = resolveBracketMatchups(picksProgression);
  const confGameIds: BracketGameId[] = ["afc_champ", "nfc_champ"];

  for (const gid of confGameIds) {
    const slot = confMatchups[gid];
    const { homeScore, awayScore } = generateRealisticScores();
    const winner = homeScore > awayScore ? slot.homeTeam!.abbr : slot.awayTeam!.abbr;
    results[gid] = {
      winner,
      homeTeam: slot.homeTeam!.abbr,
      awayTeam: slot.awayTeam!.abbr,
      homeScore,
      awayScore,
      isCompleted: true,
    };
    picksProgression[gid] = winner;
  }

  // 4. Simulate Super Bowl
  const sbMatchups = resolveBracketMatchups(picksProgression);
  const sbSlot = sbMatchups.super_bowl;
  const { homeScore, awayScore } = generateRealisticScores();
  const sbWinner = homeScore > awayScore ? sbSlot.homeTeam!.abbr : sbSlot.awayTeam!.abbr;
  results.super_bowl = {
    winner: sbWinner,
    homeTeam: sbSlot.homeTeam!.abbr,
    awayTeam: sbSlot.awayTeam!.abbr,
    homeScore,
    awayScore,
    isCompleted: true,
  };

  return results;
}

/**
 * Calculates a participant's score based on the pool's round point values
 * and determines their elimination-aware max possible points.
 * Also resolves the 3-tier Super Bowl tiebreaker:
 * - Tier 1: Total combined score difference (closest wins)
 * - Tier 2: Home team score difference (closest wins)
 * - Tier 3: Away team score difference (closest wins)
 */
export function calculateBracketScore(
  picks: BracketPicks,
  results: SimulationResults,
  tiebreaker?: TiebreakerPrediction,
  roundPoints: BracketRoundPoints = DEFAULT_ROUND_POINTS
): {
  score: number;
  maxPossible: number;
  correctGameIds: BracketGameId[];
  wrongGameIds: BracketGameId[];
  pendingGameIds: BracketGameId[];
  tiebreakerStats?: TiebreakerStats;
} {
  let score = 0;
  let potentialRemaining = 0;
  const correctGameIds: BracketGameId[] = [];
  const wrongGameIds: BracketGameId[] = [];
  const pendingGameIds: BracketGameId[] = [];

  const allGameIds: BracketGameId[] = [
    "afc_wc_1", "afc_wc_2", "afc_wc_3",
    "nfc_wc_1", "nfc_wc_2", "nfc_wc_3",
    "afc_div_1", "afc_div_2",
    "nfc_div_1", "nfc_div_2",
    "afc_champ", "nfc_champ",
    "super_bowl",
  ];

  // Identify all eliminated teams from completed games
  const eliminatedTeams = new Set<string>();
  for (const gid of allGameIds) {
    const res = results[gid];
    if (res?.isCompleted && res.winner) {
      if (res.homeTeam && res.homeTeam !== res.winner) {
        eliminatedTeams.add(res.homeTeam);
      }
      if (res.awayTeam && res.awayTeam !== res.winner) {
        eliminatedTeams.add(res.awayTeam);
      }
    }
  }

  for (const gid of allGameIds) {
    const res = results[gid];
    const pick = picks[gid];
    const rKey = GAME_ROUNDS[gid];
    const pts = roundPoints[rKey] ?? 1;

    if (!res || !res.isCompleted) {
      pendingGameIds.push(gid);
      // If participant picked a team and that team has not been eliminated, pick is still alive
      if (pick && !eliminatedTeams.has(pick)) {
        potentialRemaining += pts;
      }
    } else if (pick && pick === res.winner) {
      score += pts;
      correctGameIds.push(gid);
    } else {
      wrongGameIds.push(gid);
    }
  }

  const maxPossible = score + potentialRemaining;

  // Compute 3-Tier Tiebreaker Stats if Super Bowl completed and user entered tiebreaker
  let tiebreakerStats: TiebreakerStats | undefined = undefined;
  if (tiebreaker && typeof tiebreaker.homeScore === "number" && typeof tiebreaker.awayScore === "number") {
    const predTotal = tiebreaker.totalScore ?? (tiebreaker.homeScore + tiebreaker.awayScore);
    const sbResult = results.super_bowl;

    tiebreakerStats = {
      predictedHome: tiebreaker.homeScore,
      predictedAway: tiebreaker.awayScore,
      predictedTotal: predTotal,
    };

    if (sbResult && sbResult.isCompleted && typeof sbResult.homeScore === "number" && typeof sbResult.awayScore === "number") {
      const actualHome = sbResult.homeScore;
      const actualAway = sbResult.awayScore;
      const actualTotal = actualHome + actualAway;

      tiebreakerStats.actualHome = actualHome;
      tiebreakerStats.actualAway = actualAway;
      tiebreakerStats.actualTotal = actualTotal;
      tiebreakerStats.tier1TotalDiff = Math.abs(predTotal - actualTotal);
      tiebreakerStats.tier2HomeDiff = Math.abs(tiebreaker.homeScore - actualHome);
      tiebreakerStats.tier3AwayDiff = Math.abs(tiebreaker.awayScore - actualAway);
    }
  }

  return {
    score,
    maxPossible,
    correctGameIds,
    wrongGameIds,
    pendingGameIds,
    tiebreakerStats,
  };
}

/**
 * Sorts participants and assigns ranks using the official 3-tier tiebreaker:
 * 1. Score descending
 * 2. If tied and Super Bowl finished:
 *    - Tier 1: Total points diff (closest wins)
 *    - Tier 2: Home team score diff (closest wins)
 *    - Tier 3: Away team score diff (closest wins)
 */
export function rankBracketParticipants(
  participants: BracketParticipant[],
  results: SimulationResults,
  roundPoints: BracketRoundPoints = DEFAULT_ROUND_POINTS
): BracketParticipant[] {
  // 1. Calculate each participant's score, maxPossible & tiebreaker stats
  const scored: BracketParticipant[] = participants.map((p) => {
    const { score, maxPossible, tiebreakerStats } = calculateBracketScore(p.picks, results, p.tiebreaker, roundPoints);
    return {
      ...p,
      score,
      maxPossible,
      tiebreakerStats,
      rank: 1,
      tiebreakerExplanation: undefined,
    };
  });

  // 2. Sort by score then 3-tier tiebreaker
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // Tier 1: Total points diff
    const aT1 = a.tiebreakerStats?.tier1TotalDiff;
    const bT1 = b.tiebreakerStats?.tier1TotalDiff;
    if (aT1 !== undefined && bT1 !== undefined && aT1 !== bT1) {
      return aT1 - bT1;
    }

    // Tier 2: Home team score diff
    const aT2 = a.tiebreakerStats?.tier2HomeDiff;
    const bT2 = b.tiebreakerStats?.tier2HomeDiff;
    if (aT2 !== undefined && bT2 !== undefined && aT2 !== bT2) {
      return aT2 - bT2;
    }

    // Tier 3: Away team score diff
    const aT3 = a.tiebreakerStats?.tier3AwayDiff;
    const bT3 = b.tiebreakerStats?.tier3AwayDiff;
    if (aT3 !== undefined && bT3 !== undefined && aT3 !== bT3) {
      return aT3 - bT3;
    }

    return a.userName.localeCompare(b.userName);
  });

  // 3. Assign ranks and tiebreaker explanations
  for (let i = 0; i < scored.length; i++) {
    if (i === 0) {
      scored[i].rank = 1;
    } else {
      const prev = scored[i - 1];
      const curr = scored[i];

      const sameScore = curr.score === prev.score;
      const sameT1 = curr.tiebreakerStats?.tier1TotalDiff !== undefined &&
        curr.tiebreakerStats?.tier1TotalDiff === prev.tiebreakerStats?.tier1TotalDiff;
      const sameT2 = curr.tiebreakerStats?.tier2HomeDiff !== undefined &&
        curr.tiebreakerStats?.tier2HomeDiff === prev.tiebreakerStats?.tier2HomeDiff;
      const sameT3 = curr.tiebreakerStats?.tier3AwayDiff !== undefined &&
        curr.tiebreakerStats?.tier3AwayDiff === prev.tiebreakerStats?.tier3AwayDiff;

      const isExactTie = sameScore && (
        (!curr.tiebreakerStats && !prev.tiebreakerStats) ||
        (curr.tiebreakerStats?.tier1TotalDiff === undefined && prev.tiebreakerStats?.tier1TotalDiff === undefined) ||
        (sameT1 && sameT2 && sameT3)
      );

      if (isExactTie) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    }
  }

  // Set explanation for winner vs runners-up if decided on tiebreaker
  if (scored.length >= 2 && scored[0].score === scored[1].score) {
    const winner = scored[0];
    const second = scored[1];
    if (
      winner.tiebreakerStats?.tier1TotalDiff !== undefined &&
      second.tiebreakerStats?.tier1TotalDiff !== undefined &&
      winner.tiebreakerStats.tier1TotalDiff < second.tiebreakerStats.tier1TotalDiff
    ) {
      winner.tiebreakerExplanation = `Won on Tier 1 (Total Points diff: ±${winner.tiebreakerStats.tier1TotalDiff} vs ±${second.tiebreakerStats.tier1TotalDiff})`;
    } else if (
      winner.tiebreakerStats?.tier2HomeDiff !== undefined &&
      second.tiebreakerStats?.tier2HomeDiff !== undefined &&
      winner.tiebreakerStats.tier2HomeDiff < second.tiebreakerStats.tier2HomeDiff
    ) {
      winner.tiebreakerExplanation = `Tied on Total Points! Won on Tier 2 (Home score diff: ±${winner.tiebreakerStats.tier2HomeDiff} vs ±${second.tiebreakerStats.tier2HomeDiff})`;
    } else if (
      winner.tiebreakerStats?.tier3AwayDiff !== undefined &&
      second.tiebreakerStats?.tier3AwayDiff !== undefined &&
      winner.tiebreakerStats.tier3AwayDiff < second.tiebreakerStats.tier3AwayDiff
    ) {
      winner.tiebreakerExplanation = `Tied on Total & Home score! Won on Tier 3 (Away score diff: ±${winner.tiebreakerStats.tier3AwayDiff} vs ±${second.tiebreakerStats.tier3AwayDiff})`;
    }
  }

  return scored;
}

/**
 * Generates sample competitors to populate the leaderboard.
 */
export function generateSampleParticipants(): BracketParticipant[] {
  const now = new Date().toISOString();
  return [
    {
      id: "sample_bills_mafia",
      userId: "sample_bills_mafia",
      userName: "BillsMafia_716",
      userAvatar: "bg-blue-600",
      picks: {
        afc_wc_1: "BUF",
        afc_wc_2: "BAL",
        afc_wc_3: "HOU",
        nfc_wc_1: "PHI",
        nfc_wc_2: "LAR",
        nfc_wc_3: "SF",
        afc_div_1: "KC",
        afc_div_2: "BUF",
        nfc_div_1: "DET",
        nfc_div_2: "SF",
        afc_champ: "BUF",
        nfc_champ: "DET",
        super_bowl: "BUF",
      },
      tiebreaker: { homeScore: 28, awayScore: 24, totalScore: 52 },
      score: 0,
      superBowlWinner: "BUF",
      updatedAt: now,
      isSample: true,
    },
    {
      id: "sample_niners_faithful",
      userId: "sample_niners_faithful",
      userName: "BayAreaNiner",
      userAvatar: "bg-rose-600",
      picks: {
        afc_wc_1: "BUF",
        afc_wc_2: "BAL",
        afc_wc_3: "LAC",
        nfc_wc_1: "PHI",
        nfc_wc_2: "GB",
        nfc_wc_3: "SF",
        afc_div_1: "KC",
        afc_div_2: "BUF",
        nfc_div_1: "SF",
        nfc_div_2: "PHI",
        afc_champ: "KC",
        nfc_champ: "SF",
        super_bowl: "SF",
      },
      tiebreaker: { homeScore: 27, awayScore: 20, totalScore: 47 },
      score: 0,
      superBowlWinner: "SF",
      updatedAt: now,
      isSample: true,
    },
    {
      id: "sample_chiefs_kingdom",
      userId: "sample_chiefs_kingdom",
      userName: "ChiefsKingdom15",
      userAvatar: "bg-amber-600",
      picks: {
        afc_wc_1: "BUF",
        afc_wc_2: "BAL",
        afc_wc_3: "HOU",
        nfc_wc_1: "PHI",
        nfc_wc_2: "LAR",
        nfc_wc_3: "TB",
        afc_div_1: "KC",
        afc_div_2: "BUF",
        nfc_div_1: "DET",
        nfc_div_2: "PHI",
        afc_champ: "KC",
        nfc_champ: "DET",
        super_bowl: "KC",
      },
      tiebreaker: { homeScore: 31, awayScore: 27, totalScore: 58 },
      score: 0,
      superBowlWinner: "KC",
      updatedAt: now,
      isSample: true,
    },
    {
      id: "sample_detroit_pride",
      userId: "sample_detroit_pride",
      userName: "MotorCityDan",
      userAvatar: "bg-sky-600",
      picks: {
        afc_wc_1: "DEN",
        afc_wc_2: "BAL",
        afc_wc_3: "LAC",
        nfc_wc_1: "PHI",
        nfc_wc_2: "LAR",
        nfc_wc_3: "SF",
        afc_div_1: "KC",
        afc_div_2: "BAL",
        nfc_div_1: "DET",
        nfc_div_2: "PHI",
        afc_champ: "BAL",
        nfc_champ: "DET",
        super_bowl: "DET",
      },
      tiebreaker: { homeScore: 34, awayScore: 28, totalScore: 62 },
      score: 0,
      superBowlWinner: "DET",
      updatedAt: now,
      isSample: true,
    },
    {
      id: "sample_philly_fan",
      userId: "sample_philly_fan",
      userName: "PhillyPhanatic",
      userAvatar: "bg-teal-600",
      picks: {
        afc_wc_1: "BUF",
        afc_wc_2: "PIT",
        afc_wc_3: "HOU",
        nfc_wc_1: "PHI",
        nfc_wc_2: "GB",
        nfc_wc_3: "SF",
        afc_div_1: "KC",
        afc_div_2: "BUF",
        nfc_div_1: "PHI",
        nfc_div_2: "DET",
        afc_champ: "BUF",
        nfc_champ: "PHI",
        super_bowl: "PHI",
      },
      tiebreaker: { homeScore: 24, awayScore: 21, totalScore: 45 },
      score: 0,
      superBowlWinner: "PHI",
      updatedAt: now,
      isSample: true,
    },
    {
      id: "sample_ravens_flock",
      userId: "sample_ravens_flock",
      userName: "RavensFlock8",
      userAvatar: "bg-purple-600",
      picks: {
        afc_wc_1: "BUF",
        afc_wc_2: "BAL",
        afc_wc_3: "LAC",
        nfc_wc_1: "PHI",
        nfc_wc_2: "LAR",
        nfc_wc_3: "SF",
        afc_div_1: "KC",
        afc_div_2: "BAL",
        nfc_div_1: "DET",
        nfc_div_2: "SF",
        afc_champ: "BAL",
        nfc_champ: "SF",
        super_bowl: "BAL",
      },
      tiebreaker: { homeScore: 26, awayScore: 23, totalScore: 49 },
      score: 0,
      superBowlWinner: "BAL",
      updatedAt: now,
      isSample: true,
    },
  ];
}

export interface BracketPool {
  id: string;
  joinCode: string;
  name: string;
  creatorUserId: string;
  creatorName: string;
  creatorEmail: string;
  isLocked: boolean;
  lockTime: string;
  results: SimulationResults;
  isSimulated: boolean;
  simulatedAt: string | null;
  roundPoints?: BracketRoundPoints;
  createdAt: string;
  updatedAt: string;
}

export interface ChampionConsensusItem {
  team: PlayoffTeam;
  count: number;
  percentage: number;
  isEliminated: boolean;
}

export function calculateChampionConsensus(
  participants: BracketParticipant[],
  results: SimulationResults = {}
): ChampionConsensusItem[] {
  if (!participants || participants.length === 0) return [];

  // Identify eliminated teams
  const eliminatedTeams = new Set<string>();
  for (const gid of Object.keys(GAME_ROUNDS) as BracketGameId[]) {
    const res = results[gid];
    if (res?.isCompleted && res.winner) {
      if (res.homeTeam && res.homeTeam !== res.winner) eliminatedTeams.add(res.homeTeam);
      if (res.awayTeam && res.awayTeam !== res.winner) eliminatedTeams.add(res.awayTeam);
    }
  }

  const counts: Record<string, number> = {};
  let totalWithPick = 0;

  for (const p of participants) {
    const champ = p.superBowlWinner || p.picks?.super_bowl;
    if (champ && TEAM_BY_ABBR[champ]) {
      counts[champ] = (counts[champ] || 0) + 1;
      totalWithPick++;
    }
  }

  if (totalWithPick === 0) return [];

  const items: ChampionConsensusItem[] = Object.entries(counts).map(([abbr, count]) => {
    const team = TEAM_BY_ABBR[abbr] || {
      seed: 0,
      conference: "AFC" as const,
      name: abbr,
      abbr,
      nickname: abbr,
    };
    const percentage = Math.round((count / totalWithPick) * 100);
    return {
      team,
      count,
      percentage,
      isEliminated: eliminatedTeams.has(abbr),
    };
  });

  // Sort by count descending, then team name
  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.team.abbr.localeCompare(b.team.abbr);
  });

  return items;
}

export interface UserBracketPool {
  id: string;
  joinCode: string;
  name: string;
  role: "commissioner" | "member";
  isLocked?: boolean;
}

export function generateBracketPoolId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function extractBracketCode(input: string): string {
  if (!input || typeof input !== "string") return "";
  let clean = input.trim();

  // 1. Check for ?id= or &id= anywhere
  const idMatch = clean.match(/[?&]id=([A-Za-z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1].replace(/^bracket-/i, "").toUpperCase().trim();
  }

  // 2. Try URL parsing
  try {
    const hasProtocol = /^[a-zA-Z]+:\/\//.test(clean);
    const url = new URL(hasProtocol ? clean : `https://${clean}`);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return idFromQuery.replace(/^bracket-/i, "").toUpperCase().trim();
    }
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts.pop();
    if (lastPart && lastPart.toLowerCase() !== "bracket") {
      return lastPart.replace(/^bracket-/i, "").toUpperCase().trim();
    }
  } catch {
    // Ignore URL parse failure
  }

  // 3. Strip any URL/path or query artifacts
  if (clean.includes("/")) {
    clean = clean.split("/").filter(Boolean).pop() || clean;
  }
  clean = clean.split("?")[0].split("&")[0];

  return clean.replace(/^bracket-/i, "").toUpperCase().trim();
}

