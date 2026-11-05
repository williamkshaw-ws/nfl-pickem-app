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
  isLiveEliminated?: boolean;
  liveStatusLabel?: string;
  liveEliminationReason?: string;
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

  // Run simulation matrix to build individual contender summaries
  const awayWinTally: Record<string, { minTot: number; maxTot: number; count: number; homeMin: number; homeMax: number }> = {};
  const homeWinTally: Record<string, { minTot: number; maxTot: number; count: number; homeMin: number; homeMax: number }> = {};
  let totalAwayCombos = 0;
  let totalHomeCombos = 0;

  for (let a = 0; a <= 55; a++) {
    for (let h = 0; h <= 55; h++) {
      if (a === h) continue;
      const res = simulate(a, h);
      if (!res) continue;
      const tot = a + h;
      const wName = res.winner.name;

      if (a > h) {
        totalAwayCombos++;
        if (!awayWinTally[wName]) {
          awayWinTally[wName] = { minTot: tot, maxTot: tot, count: 0, homeMin: h, homeMax: h };
        }
        awayWinTally[wName].count++;
        awayWinTally[wName].minTot = Math.min(awayWinTally[wName].minTot, tot);
        awayWinTally[wName].maxTot = Math.max(awayWinTally[wName].maxTot, tot);
        awayWinTally[wName].homeMin = Math.min(awayWinTally[wName].homeMin, h);
        awayWinTally[wName].homeMax = Math.max(awayWinTally[wName].homeMax, h);
      } else {
        totalHomeCombos++;
        if (!homeWinTally[wName]) {
          homeWinTally[wName] = { minTot: tot, maxTot: tot, count: 0, homeMin: h, homeMax: h };
        }
        homeWinTally[wName].count++;
        homeWinTally[wName].minTot = Math.min(homeWinTally[wName].minTot, tot);
        homeWinTally[wName].maxTot = Math.max(homeWinTally[wName].maxTot, tot);
        homeWinTally[wName].homeMin = Math.min(homeWinTally[wName].homeMin, h);
        homeWinTally[wName].homeMax = Math.max(homeWinTally[wName].homeMax, h);
      }
    }
  }

  const formatBranchCondition = (
    teamName: string,
    stats: { minTot: number; maxTot: number; count: number; homeMin: number; homeMax: number },
    totalBranchCombos: number,
    allBranchStats: Record<string, { minTot: number; maxTot: number; count: number; homeMin: number; homeMax: number }>
  ): string => {
    if (stats.count >= totalBranchCombos) {
      return `${teamName} WINS`;
    }

    const overlapping = Object.values(allBranchStats).filter(
      (other) => other !== stats && other.minTot === stats.minTot && other.maxTot === stats.maxTot
    );
    let tier2Suffix = "";
    if (overlapping.length > 0) {
      const otherHomeMax = Math.max(...overlapping.map((o) => o.homeMax));
      if (stats.homeMax < otherHomeMax) {
        tier2Suffix = ` (${homeTeam.abbreviation} scores ≤ ${stats.homeMax})`;
      } else {
        tier2Suffix = ` (${homeTeam.abbreviation} scores ≥ ${stats.homeMin})`;
      }
    }

    if (stats.minTot <= 1 && stats.maxTot < 105) {
      return `${teamName} WINS and ${stats.maxTot} or fewer total points${tier2Suffix}`;
    }
    if (stats.maxTot >= 105 && stats.minTot > 1) {
      return `${teamName} WINS and ${stats.minTot}+ total points${tier2Suffix}`;
    }
    if (stats.minTot === stats.maxTot) {
      return `${teamName} WINS and exactly ${stats.minTot} total points${tier2Suffix}`;
    }
    return `${teamName} WINS and total points between ${stats.minTot}–${stats.maxTot}${tier2Suffix}`;
  };

  // Check live game state & live mathematical elimination
  const isGameLive = remainingGame.status?.state === "in";
  const isGameFinal = Boolean(remainingGame.status?.completed || remainingGame.status?.state === "post");
  const curAwayScore = Number(remainingGame.awayScore) || 0;
  const curHomeScore = Number(remainingGame.homeScore) || 0;
  const curLiveTotal = curAwayScore + curHomeScore;

  const liveAliveSet = new Set<string>();
  if (isGameLive) {
    for (let a = curAwayScore; a <= 75; a++) {
      for (let h = curHomeScore; h <= 75; h++) {
        if (a === h) continue;
        const res = simulate(a, h);
        if (res) {
          liveAliveSet.add(res.winner.name);
          if (res.coWinners) {
            res.coWinners.forEach((cw) => liveAliveSet.add(cw.name));
          }
        }
      }
    }
  }

  let finalWinnerName = "";
  if (isGameFinal) {
    const finalRes = simulate(curAwayScore, curHomeScore);
    if (finalRes) {
      finalWinnerName = finalRes.winner.name;
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
      parts.push(formatBranchCondition(awayTeam.name, aStats, totalAwayCombos, awayWinTally));
    }

    if (canWinIfHome) {
      parts.push(formatBranchCondition(homeTeam.name, hStats, totalHomeCombos, homeWinTally));
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

    let isLiveEliminated = false;
    let liveStatusLabel = "In Contention";
    let liveEliminationReason: string | undefined;

    if (isGameFinal) {
      if (c.user.name === finalWinnerName) {
        liveStatusLabel = "🏆 Weekly Winner";
      } else {
        isLiveEliminated = true;
        liveStatusLabel = "Final (Eliminated)";
      }
    } else if (isGameLive) {
      if (liveAliveSet.has(c.user.name)) {
        liveStatusLabel = "Live Contender";
      } else {
        isLiveEliminated = true;
        liveStatusLabel = "Eliminated (Live)";
        liveEliminationReason = `Mathematically eliminated based on current live score (${awayTeam.abbreviation} ${curAwayScore} - ${homeTeam.abbreviation} ${curHomeScore}, ${curLiveTotal} total pts).`;
      }
    }

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
      isLiveEliminated,
      liveStatusLabel,
      liveEliminationReason,
    };
  });

  // Sort contenders by maxWins desc, then preWins desc, then name
  contenders.sort((a, b) => b.maxWins - a.maxWins || b.preWins - a.preWins || a.user.name.localeCompare(b.user.name));

  return {
    isEligible: true,
    remainingGame,
    awayTeam,
    homeTeam,
    contenders,
    simulate,
  };
}
