export interface PlayoffTeam {
  seed: number;
  conference: "AFC" | "NFC";
  name: string;
  abbr: string;
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

export type BracketPicks = Partial<Record<BracketGameId, string>>;

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
  score: number;
  superBowlWinner?: string;
  updatedAt: string;
}

export const AFC_SEEDS: PlayoffTeam[] = [
  { seed: 1, conference: "AFC", name: "Kansas City Chiefs", abbr: "KC" },
  { seed: 2, conference: "AFC", name: "Buffalo Bills", abbr: "BUF" },
  { seed: 3, conference: "AFC", name: "Baltimore Ravens", abbr: "BAL" },
  { seed: 4, conference: "AFC", name: "Houston Texans", abbr: "HOU" },
  { seed: 5, conference: "AFC", name: "Los Angeles Chargers", abbr: "LAC" },
  { seed: 6, conference: "AFC", name: "Pittsburgh Steelers", abbr: "PIT" },
  { seed: 7, conference: "AFC", name: "Denver Broncos", abbr: "DEN" },
];

export const NFC_SEEDS: PlayoffTeam[] = [
  { seed: 1, conference: "NFC", name: "Detroit Lions", abbr: "DET" },
  { seed: 2, conference: "NFC", name: "Philadelphia Eagles", abbr: "PHI" },
  { seed: 3, conference: "NFC", name: "Los Angeles Rams", abbr: "LAR" },
  { seed: 4, conference: "NFC", name: "Tampa Bay Buccaneers", abbr: "TB" },
  { seed: 5, conference: "NFC", name: "San Francisco 49ers", abbr: "SF" },
  { seed: 6, conference: "NFC", name: "Green Bay Packers", abbr: "GB" },
  { seed: 7, conference: "NFC", name: "Washington Commanders", abbr: "WAS" },
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
 * Calculates a participant's score (1 point per correct game pick, max 13 points).
 */
export function calculateBracketScore(
  picks: BracketPicks,
  results: SimulationResults
): {
  score: number;
  maxPossible: number;
  correctGameIds: BracketGameId[];
  wrongGameIds: BracketGameId[];
  pendingGameIds: BracketGameId[];
} {
  let score = 0;
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

  for (const gid of allGameIds) {
    const res = results[gid];
    const pick = picks[gid];

    if (!res || !res.isCompleted) {
      pendingGameIds.push(gid);
    } else if (pick && pick === res.winner) {
      score += 1;
      correctGameIds.push(gid);
    } else {
      wrongGameIds.push(gid);
    }
  }

  const maxPossible = score + pendingGameIds.length;

  return {
    score,
    maxPossible,
    correctGameIds,
    wrongGameIds,
    pendingGameIds,
  };
}
