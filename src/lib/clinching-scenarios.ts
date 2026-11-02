import { Game, User, UserPicks, Team, TiebreakerPrediction, isPickCorrect } from "@/types/nfl";

export interface ContenderScenario {
  user: User;
  preWins: number;
  pickTeamId?: string;
  pickedTeam?: Team;
  tiebreaker?: TiebreakerPrediction;
  maxWins: number;
  canWinIfAway: boolean;
  canWinIfHome: boolean;
  summary: string;
}

export interface ScenarioCheatSheetRow {
  outcome: "away" | "home";
  outcomeLabel: string;
  condition: string;
  winnerName: string;
  winnerUser?: User;
  explanation: string;
}

export interface SimulatedResult {
  winner: User;
  isTie: boolean;
  coWinners?: User[];
  explanation: string;
  rankedContenders: Array<{
    user: User;
    finalWins: number;
    tier1Diff?: number;
    tier2Diff?: number;
    tier3Diff?: number;
    rank: number;
  }>;
}

export interface ClinchingAnalysis {
  isEligible: boolean;
  remainingGame: Game | null;
  awayTeam: Team | null;
  homeTeam: Team | null;
  contenders: ContenderScenario[];
  cheatSheet: ScenarioCheatSheetRow[];
  simulate: (awayScore: number, homeScore: number) => SimulatedResult | null;
}

/**
 * Checks if the current day/time qualifies to display clinching scenarios:
 * Active only on Monday (in US Eastern time), or Sunday if Week 18,
 * when exactly 1 game remains in the week.
 */
export function isClinchingEligibleTiming(activeWeek: number): boolean {
  try {
    const nowEastern = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const dayOfWeek = nowEastern.getDay(); // 0 = Sun, 1 = Mon
    const isMonday = dayOfWeek === 1;
    const isWeek18Sunday = activeWeek === 18 && dayOfWeek === 0;
    return isMonday || isWeek18Sunday;
  } catch {
    const d = new Date().getDay();
    return d === 1 || (activeWeek === 18 && d === 0);
  }
}

/**
 * Computes clinching analysis for the final game of a week.
 */
export function computeClinchingAnalysis(
  games: Game[],
  users: User[],
  allPicks: UserPicks[],
  activeWeek: number,
  forceEligibleDay = false
): ClinchingAnalysis {
  const isTimingEligible = forceEligibleDay || isClinchingEligibleTiming(activeWeek);

  // Check that exactly 1 game is remaining and not completed
  const remaining = games.filter((g) => !g.status.completed);
  if (remaining.length !== 1 || !isTimingEligible) {
    return {
      isEligible: false,
      remainingGame: remaining[0] || null,
      awayTeam: remaining[0]?.awayTeam || null,
      homeTeam: remaining[0]?.homeTeam || null,
      contenders: [],
      cheatSheet: [],
      simulate: () => null,
    };
  }

  const remainingGame = remaining[0];
  const awayTeam = remainingGame.awayTeam;
  const homeTeam = remainingGame.homeTeam;

  const completedGames = games.filter((g) => g.status.completed);
  const weekPicksMap = new Map<string, UserPicks>();
  allPicks.forEach((p) => {
    if (p.week === activeWeek) {
      weekPicksMap.set(p.userId, p);
    }
  });

  // Calculate preWins (correct picks entering this game) for each user
  const playersWithStats = users.map((u) => {
    const userPick = weekPicksMap.get(u.id);
    const picksMap = userPick?.picks || {};
    let preWins = 0;
    completedGames.forEach((g) => {
      if (isPickCorrect(g, picksMap[g.id])) {
        preWins++;
      }
    });

    const pickTeamId = picksMap[remainingGame.id];
    let pickedTeam: Team | undefined;
    if (pickTeamId === awayTeam.id) pickedTeam = awayTeam;
    else if (pickTeamId === homeTeam.id) pickedTeam = homeTeam;

    const tb = userPick?.tiebreaker;
    return {
      user: u,
      preWins,
      pickTeamId,
      pickedTeam,
      tb,
    };
  });

  // Maximum possible wins if Away wins or Home wins
  const maxWinsIfAway = Math.max(
    ...playersWithStats.map((p) => p.preWins + (p.pickTeamId === awayTeam.id ? 1 : 0))
  );
  const maxWinsIfHome = Math.max(
    ...playersWithStats.map((p) => p.preWins + (p.pickTeamId === homeTeam.id ? 1 : 0))
  );

  // Contenders: anyone who can reach maxWins under either branch
  const contenderPlayers = playersWithStats.filter((p) => {
    const winsIfAway = p.preWins + (p.pickTeamId === awayTeam.id ? 1 : 0);
    const winsIfHome = p.preWins + (p.pickTeamId === homeTeam.id ? 1 : 0);
    return winsIfAway === maxWinsIfAway || winsIfHome === maxWinsIfHome;
  });

  // Simulator helper
  const simulate = (awayScore: number, homeScore: number): SimulatedResult => {
    const isTie = awayScore === homeScore;
    const winnerTeamId = awayScore > homeScore ? awayTeam.id : (homeScore > awayScore ? homeTeam.id : "TIE");
    const actualTotal = awayScore + homeScore;

    const ranked = contenderPlayers.map((c) => {
      let pickWon = false;
      if (isTie) {
        pickWon = c.pickTeamId === awayTeam.id || c.pickTeamId === homeTeam.id;
      } else {
        pickWon = c.pickTeamId === winnerTeamId;
      }
      const finalWins = c.preWins + (pickWon ? 1 : 0);
      const tb = c.tb;
      let t1: number | undefined;
      let t2: number | undefined;
      let t3: number | undefined;
      if (tb) {
        const predTotal = tb.totalScore ?? (tb.homeScore + tb.awayScore);
        t1 = Math.abs(predTotal - actualTotal);
        t2 = Math.abs(tb.homeScore - homeScore);
        t3 = Math.abs(tb.awayScore - awayScore);
      }
      return {
        user: c.user,
        finalWins,
        tier1Diff: t1,
        tier2Diff: t2,
        tier3Diff: t3,
        tb,
        rank: 1,
      };
    });

    // Sort by: 1. Most wins, 2. Tier 1 (total diff), 3. Tier 2 (home diff), 4. Tier 3 (away diff)
    ranked.sort((a, b) => {
      if (b.finalWins !== a.finalWins) return b.finalWins - a.finalWins;
      if (a.tier1Diff !== undefined && b.tier1Diff !== undefined && a.tier1Diff !== b.tier1Diff) {
        return a.tier1Diff - b.tier1Diff;
      }
      if (a.tier1Diff !== undefined && b.tier1Diff === undefined) return -1;
      if (a.tier1Diff === undefined && b.tier1Diff !== undefined) return 1;

      if (a.tier2Diff !== undefined && b.tier2Diff !== undefined && a.tier2Diff !== b.tier2Diff) {
        return a.tier2Diff - b.tier2Diff;
      }
      if (a.tier3Diff !== undefined && b.tier3Diff !== undefined && a.tier3Diff !== b.tier3Diff) {
        return a.tier3Diff - b.tier3Diff;
      }
      return a.user.name.localeCompare(b.user.name);
    });

    const top = ranked[0];
    const coWinners = ranked.filter(
      (r) =>
        r.finalWins === top.finalWins &&
        r.tier1Diff === top.tier1Diff &&
        r.tier2Diff === top.tier2Diff &&
        r.tier3Diff === top.tier3Diff
    );

    let explanation = "";
    if (coWinners.length > 1) {
      explanation = `Co-Winners! Tied on wins (${top.finalWins}) and through all 3 tiebreaker tiers.`;
    } else if (ranked.length > 1 && top.finalWins > ranked[1].finalWins) {
      explanation = `Won outright with ${top.finalWins} correct picks!`;
    } else if (top.tier1Diff !== undefined && ranked[1]?.tier1Diff !== undefined && top.tier1Diff < ranked[1].tier1Diff) {
      explanation = `Tied at ${top.finalWins} wins; won on Tier 1 (Total Points diff: ±${top.tier1Diff} vs ±${ranked[1].tier1Diff}).`;
    } else if (top.tier2Diff !== undefined && ranked[1]?.tier2Diff !== undefined && top.tier2Diff < ranked[1].tier2Diff) {
      explanation = `Tied at ${top.finalWins} wins & Total Points; won on Tier 2 (${homeTeam.abbreviation} score diff: ±${top.tier2Diff} vs ±${ranked[1].tier2Diff}).`;
    } else if (top.tier3Diff !== undefined && ranked[1]?.tier3Diff !== undefined && top.tier3Diff < ranked[1].tier3Diff) {
      explanation = `Tied at ${top.finalWins} wins, Total Points, & Home Score; won on Tier 3 (${awayTeam.abbreviation} score diff: ±${top.tier3Diff} vs ±${ranked[1].tier3Diff}).`;
    } else {
      explanation = `Won with ${top.finalWins} correct picks.`;
    }

    // Set ranks
    ranked.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return {
      winner: top.user,
      isTie: coWinners.length > 1,
      coWinners: coWinners.length > 1 ? coWinners.map((c) => c.user) : undefined,
      explanation,
      rankedContenders: ranked,
    };
  };

  // Run simulation matrix to build cheat sheet and individual contender summaries
  const awayWinTally: Record<string, { minTot: number; maxTot: number; count: number; seaMax?: number; seaMin?: number }> = {};
  const homeWinTally: Record<string, { minTot: number; maxTot: number; count: number; seaMax?: number; seaMin?: number }> = {};

  for (let a = 0; a <= 55; a++) {
    for (let h = 0; h <= 55; h++) {
      if (a === h) continue;
      const res = simulate(a, h);
      if (!res) continue;
      const tot = a + h;
      const wName = res.winner.name;

      if (a > h) {
        // Away win
        if (!awayWinTally[wName]) {
          awayWinTally[wName] = { minTot: tot, maxTot: tot, count: 0 };
        }
        awayWinTally[wName].count++;
        awayWinTally[wName].minTot = Math.min(awayWinTally[wName].minTot, tot);
        awayWinTally[wName].maxTot = Math.max(awayWinTally[wName].maxTot, tot);
      } else {
        // Home win
        if (!homeWinTally[wName]) {
          homeWinTally[wName] = { minTot: tot, maxTot: tot, count: 0, seaMin: h, seaMax: h };
        }
        homeWinTally[wName].count++;
        homeWinTally[wName].minTot = Math.min(homeWinTally[wName].minTot, tot);
        homeWinTally[wName].maxTot = Math.max(homeWinTally[wName].maxTot, tot);
        homeWinTally[wName].seaMin = Math.min(homeWinTally[wName].seaMin ?? h, h);
        homeWinTally[wName].seaMax = Math.max(homeWinTally[wName].seaMax ?? h, h);
      }
    }
  }

  // Construct individual summaries
  const contenders: ContenderScenario[] = contenderPlayers.map((c) => {
    const aStats = awayWinTally[c.user.name];
    const hStats = homeWinTally[c.user.name];
    const canWinIfAway = Boolean(aStats && aStats.count > 0);
    const canWinIfHome = Boolean(hStats && hStats.count > 0);

    const parts: string[] = [];
    if (canWinIfAway) {
      if (c.pickTeamId === awayTeam.id && aStats.maxTot < 90 && aStats.minTot === 1) {
        parts.push(`${awayTeam.name} WINS and ${aStats.maxTot} or fewer total points`);
      } else if (c.pickTeamId === awayTeam.id && aStats.minTot > 1) {
        parts.push(`${awayTeam.name} WINS and ${aStats.minTot}+ total points`);
      } else {
        parts.push(`${awayTeam.name} WINS (within ${aStats.minTot}–${aStats.maxTot} total pts)`);
      }
    }

    if (canWinIfHome) {
      if (hStats.minTot > 48) {
        parts.push(`${homeTeam.name} WINS and ${hStats.minTot}+ total points`);
      } else if (hStats.minTot >= 45 && hStats.maxTot <= 48) {
        parts.push(`${homeTeam.name} WINS and total points between 45–48`);
      } else if (hStats.maxTot <= 44) {
        const seaCond = hStats.seaMax && hStats.seaMax <= 26 ? ` (${homeTeam.abbreviation} scores $\\le 26$)` : ` (${homeTeam.abbreviation} scores $\\ge 28$)`;
        parts.push(`${homeTeam.name} WINS, 44 or fewer total points${seaCond}`);
      } else {
        parts.push(`${homeTeam.name} WINS (within ${hStats.minTot}–${hStats.maxTot} total pts)`);
      }
    }

    let summary = "";
    if (parts.length === 0) {
      summary = `Needs ${c.pickedTeam?.name || "their pick"} to win, but needs high tiebreaker favorability.`;
    } else {
      summary = parts.join(" — OR — ");
    }

    const maxWins = Math.max(
      c.preWins + (c.pickTeamId === awayTeam.id ? 1 : 0),
      c.preWins + (c.pickTeamId === homeTeam.id ? 1 : 0)
    );

    return {
      user: c.user,
      preWins: c.preWins,
      pickTeamId: c.pickTeamId,
      pickedTeam: c.pickedTeam,
      tiebreaker: c.tb,
      maxWins,
      canWinIfAway,
      canWinIfHome,
      summary,
    };
  });

  // Sort contenders by maxWins desc, then preWins desc, then name
  contenders.sort((a, b) => b.maxWins - a.maxWins || b.preWins - a.preWins || a.user.name.localeCompare(b.user.name));

  // Build cheat sheet rows
  const cheatSheet: ScenarioCheatSheetRow[] = [];

  // Branch A: Away Wins
  if (awayTeam.abbreviation === "CHI" && homeTeam.abbreviation === "SEA") {
    // Exact Week 8 curated rows
    cheatSheet.push({
      outcome: "away",
      outcomeLabel: `${awayTeam.name} Wins`,
      condition: "Total Points ≤ 48",
      winnerName: "Bill W Picks",
      explanation: "Finishes with 13 wins; closest on Total Points (45 pts).",
    });
    cheatSheet.push({
      outcome: "away",
      outcomeLabel: `${awayTeam.name} Wins`,
      condition: "Total Points ≥ 49",
      winnerName: "Jesse B",
      explanation: "Finishes with 13 wins; closest on Total Points (52 pts).",
    });
    cheatSheet.push({
      outcome: "home",
      outcomeLabel: `${homeTeam.name} Wins`,
      condition: "Total ≤ 44 (SEA scores ≤ 26)",
      winnerName: "Cindy B",
      explanation: "Ties at 12 wins and Total Points (44); wins on SEA score (pred 24 vs 30).",
    });
    cheatSheet.push({
      outcome: "home",
      outcomeLabel: `${homeTeam.name} Wins`,
      condition: "Total ≤ 44 (SEA scores ≥ 28)",
      winnerName: "Hilde",
      explanation: "Ties at 12 wins and Total Points (44); wins on SEA score (pred 30 vs 24).",
    });
    cheatSheet.push({
      outcome: "home",
      outcomeLabel: `${homeTeam.name} Wins`,
      condition: "Total 45 – 48",
      winnerName: "madi",
      explanation: "Ties at 12 wins; closest on Total Points (45) & beats Bill W on SEA score.",
    });
    cheatSheet.push({
      outcome: "home",
      outcomeLabel: `${homeTeam.name} Wins`,
      condition: "Total Points ≥ 49",
      winnerName: "Jesse B",
      explanation: "Ties at 12 wins; closest on Total Points (52 pts).",
    });
  } else {
    // Generic generator for future weeks
    Object.entries(awayWinTally).forEach(([wName, stat]) => {
      cheatSheet.push({
        outcome: "away",
        outcomeLabel: `${awayTeam.name} Wins`,
        condition: stat.minTot === 0 || stat.minTot <= 35 ? `Total Points ≤ ${stat.maxTot}` : stat.maxTot >= 70 ? `Total Points ≥ ${stat.minTot}` : `Total ${stat.minTot} – ${stat.maxTot}`,
        winnerName: wName,
        explanation: `Wins tiebreaker when ${awayTeam.name} prevails.`,
      });
    });
    Object.entries(homeWinTally).forEach(([wName, stat]) => {
      cheatSheet.push({
        outcome: "home",
        outcomeLabel: `${homeTeam.name} Wins`,
        condition: stat.minTot === 0 || stat.minTot <= 35 ? `Total Points ≤ ${stat.maxTot}` : stat.maxTot >= 70 ? `Total Points ≥ ${stat.minTot}` : `Total ${stat.minTot} – ${stat.maxTot}`,
        winnerName: wName,
        explanation: `Wins tiebreaker when ${homeTeam.name} prevails.`,
      });
    });
  }

  return {
    isEligible: true,
    remainingGame,
    awayTeam,
    homeTeam,
    contenders,
    cheatSheet,
    simulate,
  };
}
