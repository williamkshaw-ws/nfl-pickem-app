import {
  Game,
  User,
  UserPicks,
  WeeklyPlayerResult,
  SeasonPlayerStanding,
  TiebreakerStats,
  isPickCorrect,
} from "@/types/nfl";

/**
 * Calculates weekly results and determines the weekly winner(s) using the user's 3-tier tiebreaker rule:
 * 1. Most correct picks
 * 2. Tier 1: Closest to Total Combined Points (|pred_total - actual_total|)
 * 3. Tier 2: Closest to Home Team Score (|pred_home - actual_home|)
 * 4. Tier 3: Closest to Away Team Score (|pred_away - actual_away|)
 * 5. Co-winners if completely tied through Tier 3
 */
export function calculateWeeklyResults(
  games: Game[],
  users: User[],
  allPicks: UserPicks[],
  weekNumber: number
): WeeklyPlayerResult[] {
  // Find the tiebreaker game (marked or last game by kickoff time)
  const tiebreakerGame =
    games.find((g) => g.isTiebreakerGame) ||
    [...games].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

  const tiebreakerFinal =
    tiebreakerGame &&
    tiebreakerGame.status.completed &&
    typeof tiebreakerGame.homeScore === "number" &&
    typeof tiebreakerGame.awayScore === "number";

  const actualHome = tiebreakerFinal ? tiebreakerGame.homeScore : undefined;
  const actualAway = tiebreakerFinal ? tiebreakerGame.awayScore : undefined;
  const actualTotal =
    actualHome !== undefined && actualAway !== undefined
      ? actualHome + actualAway
      : undefined;

  // Games that have completed (either has a winner or tied)
  const completedGames = games.filter(
    (g) => g.status.completed && (g.winnerTeamId || (typeof g.homeScore === "number" && typeof g.awayScore === "number"))
  );
  const totalCompleted = completedGames.length;

  // Index picks for this week for O(1) lookup
  const weekPicksMap = new Map<string, UserPicks>();
  for (const p of allPicks) {
    if (p.week === weekNumber) {
      weekPicksMap.set(p.userId, p);
    }
  }

  // Calculate stats for each user
  const playerStats = users.map((user) => {
    const userPickRecord = weekPicksMap.get(user.id);

    let correctCount = 0;
    if (userPickRecord && userPickRecord.picks) {
      completedGames.forEach((game) => {
        const pickedTeamId = userPickRecord.picks[game.id];
        if (isPickCorrect(game, pickedTeamId)) {
          correctCount++;
        }
      });
    }

    const winPct =
      totalCompleted > 0
        ? Math.round((correctCount / totalCompleted) * 1000) / 10
        : 0;

    let tiebreakerStats: TiebreakerStats | undefined = undefined;
    if (userPickRecord?.tiebreaker) {
      const tb = userPickRecord.tiebreaker;
      const predTotal = tb.totalScore ?? tb.homeScore + tb.awayScore;

      tiebreakerStats = {
        predictedHome: tb.homeScore,
        predictedAway: tb.awayScore,
        predictedTotal: predTotal,
        actualHome,
        actualAway,
        actualTotal,
      };

      if (
        actualTotal !== undefined &&
        actualHome !== undefined &&
        actualAway !== undefined
      ) {
        tiebreakerStats.tier1TotalDiff = Math.abs(predTotal - actualTotal);
        tiebreakerStats.tier2HomeDiff = Math.abs(tb.homeScore - actualHome);
        tiebreakerStats.tier3AwayDiff = Math.abs(tb.awayScore - actualAway);
      }
    }

    return {
      userId: user.id,
      userName: user.name,
      avatarColor: user.avatarColor,
      correctPicks: correctCount,
      totalGames: totalCompleted,
      winPercentage: winPct,
      tiebreaker: tiebreakerStats,
      rank: 1,
      isWeeklyWinner: false,
      tiebreakerExplanation: undefined as string | undefined,
    };
  });

  // Sort players:
  // 1. Correct picks descending
  // 2. If tiebreaker game finished and diffs are computed:
  //    - Tier 1: tier1TotalDiff ascending
  //    - Tier 2: tier2HomeDiff ascending
  //    - Tier 3: tier3AwayDiff ascending
  playerStats.sort((a, b) => {
    // 1. Correct picks
    if (b.correctPicks !== a.correctPicks) {
      return b.correctPicks - a.correctPicks;
    }

    // If tiebreaker is active and both have tiebreaker diffs
    const aT1 = a.tiebreaker?.tier1TotalDiff;
    const bT1 = b.tiebreaker?.tier1TotalDiff;

    if (aT1 !== undefined && bT1 !== undefined && aT1 !== bT1) {
      return aT1 - bT1; // smaller delta is better
    }

    const aT2 = a.tiebreaker?.tier2HomeDiff;
    const bT2 = b.tiebreaker?.tier2HomeDiff;

    if (aT2 !== undefined && bT2 !== undefined && aT2 !== bT2) {
      return aT2 - bT2; // smaller delta is better
    }

    const aT3 = a.tiebreaker?.tier3AwayDiff;
    const bT3 = b.tiebreaker?.tier3AwayDiff;

    if (aT3 !== undefined && bT3 !== undefined && aT3 !== bT3) {
      return aT3 - bT3; // smaller delta is better
    }

    return a.userName.localeCompare(b.userName);
  });

  // Assign ranks & detect tiebreaker explanations
  for (let i = 0; i < playerStats.length; i++) {
    if (i > 0) {
      const prev = playerStats[i - 1];
      const curr = playerStats[i];

      const sameCorrect = curr.correctPicks === prev.correctPicks;
      const sameT1 =
        curr.tiebreaker?.tier1TotalDiff !== undefined &&
        curr.tiebreaker?.tier1TotalDiff === prev.tiebreaker?.tier1TotalDiff;
      const sameT2 =
        curr.tiebreaker?.tier2HomeDiff !== undefined &&
        curr.tiebreaker?.tier2HomeDiff === prev.tiebreaker?.tier2HomeDiff;
      const sameT3 =
        curr.tiebreaker?.tier3AwayDiff !== undefined &&
        curr.tiebreaker?.tier3AwayDiff === prev.tiebreaker?.tier3AwayDiff;

      // Are they truly tied in every metric?
      const trulyTied =
        sameCorrect &&
        ((!curr.tiebreaker && !prev.tiebreaker) ||
          (curr.tiebreaker?.tier1TotalDiff === undefined &&
            prev.tiebreaker?.tier1TotalDiff === undefined) ||
          (sameT1 && sameT2 && sameT3));

      if (trulyTied) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    } else {
      playerStats[0].rank = 1;
    }
  }

  // Determine weekly winners (rank 1) - ONLY crowned when all games for the week are completed
  // and at least one player actually participated with picks
  const topRankPlayers = playerStats.filter((p) => p.rank === 1);
  const allCompleted = games.length > 0 && games.every((g) => g.status.completed);
  const hasActiveParticipants =
    playerStats.some((p) => p.correctPicks > 0) ||
    allPicks.some((p) => p.week === weekNumber && Object.keys(p.picks || {}).length > 0);

  if (allCompleted && hasActiveParticipants) {
    topRankPlayers.forEach((p) => {
      const hasUserPicks = allPicks.some(
        (pick) => pick.userId === p.userId && pick.week === weekNumber && Object.keys(pick.picks || {}).length > 0
      );
      if (hasUserPicks || p.correctPicks > 0) {
        p.isWeeklyWinner = true;
      }
    });

    // Provide helpful explanations for why the winner edged out the runner-up
    if (playerStats.length > 1) {
      const winner = playerStats[0];
      const second = playerStats[1];

      if (winner.correctPicks === second.correctPicks) {
        if (
          winner.tiebreaker?.tier1TotalDiff !== undefined &&
          second.tiebreaker?.tier1TotalDiff !== undefined &&
          winner.tiebreaker.tier1TotalDiff < second.tiebreaker.tier1TotalDiff
        ) {
          winner.tiebreakerExplanation = `Won on Tier 1 (Total Points diff: ±${winner.tiebreaker.tier1TotalDiff} vs ±${second.tiebreaker.tier1TotalDiff})`;
        } else if (
          winner.tiebreaker?.tier2HomeDiff !== undefined &&
          second.tiebreaker?.tier2HomeDiff !== undefined &&
          winner.tiebreaker.tier2HomeDiff < second.tiebreaker.tier2HomeDiff
        ) {
          winner.tiebreakerExplanation = `Tied on Total Points! Won on Tier 2 (Home Team score diff: ±${winner.tiebreaker.tier2HomeDiff} vs ±${second.tiebreaker.tier2HomeDiff})`;
        } else if (
          winner.tiebreaker?.tier3AwayDiff !== undefined &&
          second.tiebreaker?.tier3AwayDiff !== undefined &&
          winner.tiebreaker.tier3AwayDiff < second.tiebreaker.tier3AwayDiff
        ) {
          winner.tiebreakerExplanation = `Tied on Total & Home score! Won on Tier 3 (Away Team score diff: ±${winner.tiebreaker.tier3AwayDiff} vs ±${second.tiebreaker.tier3AwayDiff})`;
        } else if (winner.rank === second.rank) {
          winner.tiebreakerExplanation = "Official Co-Winners (Tied through all 3 tiers!)";
          second.tiebreakerExplanation = "Official Co-Winners (Tied through all 3 tiers!)";
        }
      }
    }
  }

  return playerStats;
}

/**
 * Calculates overall season standings across all weeks
 */
export function calculateSeasonStandings(
  allWeeksGames: Record<number, Game[]>,
  users: User[],
  allPicks: UserPicks[]
): SeasonPlayerStanding[] {
  // Find all weeks that have games
  const weekNumbers = Object.keys(allWeeksGames)
    .map(Number)
    .sort((a, b) => a - b);

  // Compute weekly winners for every week that has completed games
  const weeklyWinnersMap = new Map<number, Set<string>>(); // week -> set of winner userIds

  weekNumbers.forEach((weekNum) => {
    const games = allWeeksGames[weekNum] || [];
    const hasCompletedGames = games.some((g) => g.status.completed);
    if (!hasCompletedGames) return;

    const weeklyResults = calculateWeeklyResults(
      games,
      users,
      allPicks,
      weekNum
    );

    const winners = new Set<string>();
    weeklyResults.forEach((res) => {
      if (res.isWeeklyWinner) {
        winners.add(res.userId);
      }
    });

    weeklyWinnersMap.set(weekNum, winners);
  });

  // Pre-filter completed games by week once
  const completedGamesByWeek = new Map<number, Game[]>();
  weekNumbers.forEach((w) => {
    const games = allWeeksGames[w] || [];
    const completed = games.filter(
      (g) => g.status.completed && (g.winnerTeamId || (typeof g.homeScore === "number" && typeof g.awayScore === "number"))
    );
    if (completed.length > 0) {
      completedGamesByWeek.set(w, completed);
    }
  });

  // Pre-index all picks by `${week}_${userId}` for O(1) instant lookup
  const picksByWeekAndUser = new Map<string, UserPicks>();
  allPicks.forEach((p) => {
    picksByWeekAndUser.set(`${p.week}_${p.userId}`, p);
  });

  const standings: SeasonPlayerStanding[] = users.map((user) => {
    let totalCorrect = 0;
    let totalGames = 0;
    let weeklyWins = 0;
    let weeksPlayed = 0;
    const recentWeeklyScores: SeasonPlayerStanding["recentWeeklyScores"] = [];

    weekNumbers.forEach((weekNum) => {
      const completedGames = completedGamesByWeek.get(weekNum);
      if (!completedGames || completedGames.length === 0) return;

      const userPickRecord = picksByWeekAndUser.get(`${weekNum}_${user.id}`);

      let weekCorrect = 0;
      if (userPickRecord && userPickRecord.picks) {
        weeksPlayed++;
        completedGames.forEach((g) => {
          if (isPickCorrect(g, userPickRecord.picks[g.id])) {
            weekCorrect++;
          }
        });
      }

      totalCorrect += weekCorrect;
      totalGames += completedGames.length;

      const isWinner =
        weeklyWinnersMap.get(weekNum)?.has(user.id) ?? false;
      if (isWinner) {
        weeklyWins++;
      }

      recentWeeklyScores.push({
        week: weekNum,
        correct: weekCorrect,
        total: completedGames.length,
        isWinner,
      });
    });

    const winPct =
      totalGames > 0
        ? Math.round((totalCorrect / totalGames) * 1000) / 10
        : 0;

    return {
      userId: user.id,
      userName: user.name,
      avatarColor: user.avatarColor,
      rank: 1,
      totalCorrect,
      totalGames,
      winPercentage: winPct,
      weeklyWins,
      weeksPlayed,
      recentWeeklyScores,
    };
  });

  // Sort overall standings:
  // 1. Total correct picks descending
  // 2. Weekly wins descending
  // 3. Win percentage descending
  // 4. Alphabetical
  standings.sort((a, b) => {
    if (b.totalCorrect !== a.totalCorrect) {
      return b.totalCorrect - a.totalCorrect;
    }
    if (b.weeklyWins !== a.weeklyWins) {
      return b.weeklyWins - a.weeklyWins;
    }
    if (b.winPercentage !== a.winPercentage) {
      return b.winPercentage - a.winPercentage;
    }
    return a.userName.localeCompare(b.userName);
  });

  // Assign ranks
  for (let i = 0; i < standings.length; i++) {
    if (i > 0) {
      const prev = standings[i - 1];
      const curr = standings[i];
      if (
        curr.totalCorrect === prev.totalCorrect &&
        curr.weeklyWins === prev.weeklyWins &&
        curr.winPercentage === prev.winPercentage
      ) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    } else {
      standings[0].rank = 1;
    }
  }

  return standings;
}

export interface SurvivorPickInfo {
  teamId: string;
  abbreviation: string;
  logo?: string;
  result: "won" | "lost" | "pending";
}

export interface SurvivorUserStatus {
  userId: string;
  status: "Alive" | "Eliminated";
  eliminatedWeek?: number;
  picksByWeek: Record<number, SurvivorPickInfo>;
}

/**
 * Calculates Survivor / Eliminator pool status across all weeks.
 * - Players who did not make a pick in any completed/locked week are eliminated in that week.
 * - Players who lose a game are eliminated (unless saved by mutual wipeout).
 * - Players eliminated in week W cannot have survivor picks in any subsequent week (w > W).
 */
export function calculateSurvivorStatus(
  gamesByWeek: Record<number, any[]>,
  users: { id: string; name?: string }[],
  rawAllPicks: any[],
  currentWeek: number,
  limitWeek: number,
  lockPolicy: string = "game",
  currentUserId?: string,
  now: number = Date.now()
): SurvivorUserStatus[] {
  const userPicksByWeek: Record<string, Record<number, SurvivorPickInfo>> = {};
  const userResultByWeek: Record<string, Record<number, "won" | "lost" | "pending">> = {};

  for (const u of users) {
    userPicksByWeek[u.id] = {};
    userResultByWeek[u.id] = {};

    for (let w = 1; w <= limitWeek; w++) {
      const userPick = rawAllPicks.find((p) => p.userId === u.id && p.week === w);
      const elimPick = userPick?.eliminatorPick;
      const gamesForW = gamesByWeek[w] || [];

      if (elimPick) {
        const game = gamesForW.find(
          (g: any) => g.homeTeam.id === elimPick || g.awayTeam.id === elimPick
        );

        let won = false;
        let lost = false;
        if (game && game.status.completed) {
          const homeScore = game.homeScore || 0;
          const awayScore = game.awayScore || 0;
          const isTie = homeScore === awayScore || game.winnerTeamId === "TIE";
          if (isTie) {
            won = true;
          } else if (elimPick === game.homeTeam.id && homeScore > awayScore) {
            won = true;
          } else if (elimPick === game.awayTeam.id && awayScore > homeScore) {
            won = true;
          } else {
            lost = true;
          }
        }

        const pickedTeam = game
          ? game.homeTeam.id === elimPick
            ? game.homeTeam
            : game.awayTeam
          : undefined;

        let isPickLocked = false;
        if (game) {
          if (lockPolicy === "first_game") {
            const earliestTime = Math.min(...gamesForW.map((g: any) => new Date(g.date).getTime()));
            isPickLocked = now >= earliestTime;
          } else {
            isPickLocked = now >= new Date(game.date).getTime();
          }
        }

        const hideToCaller = currentUserId && u.id !== currentUserId && !isPickLocked;
        const res: "won" | "lost" | "pending" = won ? "won" : lost ? "lost" : "pending";
        userResultByWeek[u.id][w] = res;

        userPicksByWeek[u.id][w] = {
          teamId: hideToCaller ? "HIDDEN" : elimPick,
          abbreviation: hideToCaller ? "Hidden" : pickedTeam?.abbreviation || elimPick,
          logo: hideToCaller ? undefined : pickedTeam?.logo,
          result: res,
        };
      } else {
        const isWeekPast = w < currentWeek;
        const isWeekComplete = gamesForW.length > 0 && gamesForW.every((g: any) => g.status?.completed);
        let isWeekFullyLocked = false;
        if (gamesForW.length > 0) {
          if (lockPolicy === "first_game") {
            const earliest = Math.min(...gamesForW.map((g: any) => new Date(g.date).getTime()));
            isWeekFullyLocked = now >= earliest;
          } else {
            isWeekFullyLocked = gamesForW.every((g: any) => now >= new Date(g.date).getTime());
          }
        }

        if (isWeekPast || isWeekComplete || isWeekFullyLocked) {
          userResultByWeek[u.id][w] = "lost";
        } else {
          userResultByWeek[u.id][w] = "pending";
        }
      }
    }
  }

  let activeSurvivors = users.map((u) => u.id);
  const eliminatedWeekByUser: Record<string, number> = {};

  // 1. Check Week 1 participation:
  // In NFL survivor pools, players must participate from Week 1.
  // If Week 1 is locked or completed, or currentWeek > 1:
  // Any user who did not participate / make picks in Week 1 is eliminated in Week 1.
  const week1Games = gamesByWeek[1] || [];
  const isWeek1Locked =
    currentWeek > 1 ||
    (week1Games.length > 0 &&
      week1Games.every(
        (g: any) => g.status?.completed || now >= new Date(g.date).getTime()
      ));

  if (isWeek1Locked) {
    for (const u of users) {
      const hasWeek1Picks = rawAllPicks.some(
        (p) => p.userId === u.id && p.week === 1 && (p.picks || p.eliminatorPick)
      );
      if (!hasWeek1Picks) {
        eliminatedWeekByUser[u.id] = 1;
      }
    }
    activeSurvivors = activeSurvivors.filter((uid) => !eliminatedWeekByUser[uid]);
  }

  // 2. Week by week survivor progression
  for (let w = 1; w <= limitWeek; w++) {
    if (activeSurvivors.length <= 1) break;

    const weekHadSurvivorPicks = rawAllPicks.some((p) => p.week === w && !!p.eliminatorPick);
    if (!weekHadSurvivorPicks) {
      // If no survivor picks in this week (e.g. prior to survivor starting),
      // verify if any active survivor missed participating in this week
      const gamesForW = gamesByWeek[w] || [];
      const isWeekPastOrLocked =
        w < currentWeek ||
        (gamesForW.length > 0 &&
          gamesForW.every(
            (g: any) => g.status?.completed || now >= new Date(g.date).getTime()
          ));
      if (isWeekPastOrLocked) {
        for (const uid of [...activeSurvivors]) {
          const userHasPickThisWeek = rawAllPicks.some(
            (p) => p.userId === uid && p.week === w && (p.picks || p.eliminatorPick)
          );
          if (!userHasPickThisWeek) {
            eliminatedWeekByUser[uid] = w;
            activeSurvivors = activeSurvivors.filter((id) => id !== uid);
          }
        }
      }
      continue;
    }

    const winners: string[] = [];
    const inProgress: string[] = [];
    const pickLosers: string[] = [];
    const noPickLosers: string[] = [];

    for (const uid of activeSurvivors) {
      const userPick = rawAllPicks.find((p) => p.userId === uid && p.week === w);
      const res = userResultByWeek[uid][w];

      if (res === "won") {
        winners.push(uid);
      } else if (res === "pending") {
        inProgress.push(uid);
      } else {
        if (!userPick?.eliminatorPick) {
          // Missed making a survivor pick
          noPickLosers.push(uid);
        } else {
          // Picked a team that lost
          pickLosers.push(uid);
        }
      }
    }

    // Players who made NO PICK in a week with survivor picks are ALWAYS eliminated immediately!
    for (const uid of noPickLosers) {
      eliminatedWeekByUser[uid] = w;
    }
    activeSurvivors = activeSurvivors.filter((uid) => !noPickLosers.includes(uid));

    // For players who made a pick that lost:
    if (inProgress.length > 0) {
      if (winners.length > 0) {
        for (const uid of pickLosers) {
          eliminatedWeekByUser[uid] = w;
        }
        activeSurvivors = activeSurvivors.filter((uid) => !pickLosers.includes(uid));
      }
    } else {
      if (winners.length > 0) {
        for (const uid of pickLosers) {
          eliminatedWeekByUser[uid] = w;
        }
        activeSurvivors = winners;
      } else {
        // Mutual wipeout: everyone who picked and lost in this week is resurrected!
      }
    }
  }

  return users.map((u) => {
    const isAlive = activeSurvivors.includes(u.id);
    const eliminatedWeek = isAlive ? undefined : eliminatedWeekByUser[u.id];

    // Exclude picks made in weeks AFTER elimination so eliminated users don't display picks
    const cleanPicksByWeek: Record<number, SurvivorPickInfo> = {};
    const userPicks = userPicksByWeek[u.id] || {};
    for (const [wStr, pInfo] of Object.entries(userPicks)) {
      const w = parseInt(wStr, 10);
      if (eliminatedWeek && w > eliminatedWeek) {
        continue;
      }
      cleanPicksByWeek[w] = pInfo;
    }

    return {
      userId: u.id,
      status: isAlive ? "Alive" : "Eliminated",
      eliminatedWeek,
      picksByWeek: cleanPicksByWeek,
    };
  });
}
