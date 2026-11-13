"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { fireCelebrationConfetti } from "@/lib/confetti";
import { Game, User, UserPicks, Team, EliminatorStatus, WeeklyPlayerResult, isPickCorrect, isSurvivorPickWon } from "@/types/nfl";
import { Check, X, Clock, Trophy, Sparkles, HelpCircle, Zap } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import { isClinchingEligibleTiming } from "@/lib/clinching-scenarios";
import { isGameLockedClient } from "@/lib/game-lock";

const ClinchingScenariosModal = dynamic(
  () => import("./ClinchingScenariosModal").then((m) => m.ClinchingScenariosModal),
  { ssr: false }
);
const TiebreakerRulesModal = dynamic(
  () => import("./TiebreakerRulesModal").then((m) => m.TiebreakerRulesModal),
  { ssr: false }
);

interface PickMatrixProps {
  games: Game[];
  users: User[];
  allPicks: UserPicks[];
  activeWeek: number;
  currentUserId?: string;
  lockPolicy?: "week" | "day" | "game";
  eliminatorEnabled?: boolean;
  eliminatorStatus?: EliminatorStatus[];
  weeklyResults?: WeeklyPlayerResult[];
  settings?: any;
}

export function PickMatrix({
  games,
  users,
  allPicks,
  activeWeek,
  currentUserId,
  lockPolicy = "game",
  eliminatorEnabled = false,
  weeklyResults,
  settings,
}: PickMatrixProps) {
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showClinchingModal, setShowClinchingModal] = useState<boolean>(false);

  const triggerConfetti = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    fireCelebrationConfetti();
  };

  const {
    sortedGames,
    tbGame,
    completedGames,
    remainingGames,
    completedCount,
    liveCount,
    remainingCount,
    totalGamesCount,
    isWeekFinished,
  } = useMemo(() => {
    const sorted = [...games].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const tb = games.find((g) => g.isTiebreakerGame) || sorted[sorted.length - 1];
    const completed = sorted.filter((g) => g.status.completed);
    const live = sorted.filter((g) => g.status.state === "in");
    const remaining = sorted.filter((g) => !g.status.completed);
    return {
      sortedGames: sorted,
      tbGame: tb,
      completedGames: completed,
      remainingGames: remaining,
      completedCount: completed.length,
      liveCount: live.length,
      remainingCount: remaining.length,
      totalGamesCount: sorted.length,
      isWeekFinished: sorted.length > 0 && remaining.length === 0,
    };
  }, [games]);

  const isClinchingEligible = useMemo(() => {
    return isClinchingEligibleTiming(activeWeek) && remainingCount === 1 && !isWeekFinished;
  }, [activeWeek, remainingCount, isWeekFinished]);

  const tbFinal =
    tbGame &&
    tbGame.status.completed &&
    typeof tbGame.homeScore === "number" &&
    typeof tbGame.awayScore === "number";
  const actualTbTotal = tbFinal ? tbGame.homeScore! + tbGame.awayScore! : undefined;

  // Compute stats for each player
  const playerStats = useMemo(() => {
    const weekPicksMap = new Map<string, UserPicks>();
    allPicks.forEach((p) => {
      if (p.week === activeWeek) {
        weekPicksMap.set(p.userId, p);
      }
    });

    return users.map((user) => {
      const userPickRecord = weekPicksMap.get(user.id);
      const userPicksMap = userPickRecord?.picks || {};
      const tb = userPickRecord?.tiebreaker;
      const elimPickTeamId = userPickRecord?.eliminatorPick;
      const pickedCount = Object.keys(userPicksMap).filter(
        (k) => userPicksMap[k] && userPicksMap[k] !== ""
      ).length;

      let correctCount = 0;
      let incorrectCount = 0;
      completedGames.forEach((g) => {
        if (isPickCorrect(g, userPicksMap[g.id])) {
          correctCount++;
        } else if (userPicksMap[g.id]) {
          incorrectCount++;
        }
      });

      // Calculate true maximum possible points remaining
      let potentialRemaining = 0;
      remainingGames.forEach((g) => {
        const isLocked = isGameLockedClient(g, games, lockPolicy);
        const pick = userPicksMap[g.id];
        if (pick && pick !== "" && pick !== "HIDDEN") {
          potentialRemaining++;
        } else if (pick === "HIDDEN") {
          potentialRemaining++;
        } else if (!isLocked && lockPolicy !== "week") {
          potentialRemaining++;
        }
      });

      const maxPossible = correctCount + potentialRemaining;

      // Survivor result for this week
      let elimResult: "won" | "lost" | "in_play" | "pending" | "none" = "none";
      let elimTeam: Team | undefined;
      let isElimGameLocked = false;

      if (elimPickTeamId && elimPickTeamId !== "HIDDEN") {
        const elimGame = sortedGames.find(
          (g) => g.homeTeam.id === elimPickTeamId || g.awayTeam.id === elimPickTeamId
        );
        if (elimGame) {
          isElimGameLocked = isGameLockedClient(elimGame, games, lockPolicy);
          elimTeam = elimGame.homeTeam.id === elimPickTeamId ? elimGame.homeTeam : elimGame.awayTeam;
          if (elimGame.status.completed) {
            elimResult = isSurvivorPickWon(elimGame, elimPickTeamId) ? "won" : "lost";
          } else if (elimGame.status.state === "in") {
            elimResult = "in_play";
          } else {
            elimResult = "pending";
          }
        }
      }

      // Tiebreaker difference if available
      let tbDiff: number | undefined = undefined;
      if (tb && typeof tb.totalScore === "number" && actualTbTotal !== undefined) {
        tbDiff = Math.abs(tb.totalScore - actualTbTotal);
      }

      return {
        user,
        userPickRecord,
        userPicksMap,
        tb,
        tbDiff,
        correctCount,
        incorrectCount,
        maxPossible,
        pickedCount,
        elimPickTeamId,
        elimTeam,
        elimResult,
        isElimGameLocked,
      };
    });
  }, [allPicks, activeWeek, users, completedGames, remainingGames, sortedGames, games, lockPolicy, actualTbTotal]);

  // Highest current score
  const maxCurrentCorrect = useMemo(() => {
    return Math.max(...playerStats.map((p) => p.correctCount), 0);
  }, [playerStats]);

  // Add gamesBack and sort players by rank
  const rankedPlayers = useMemo(() => {
    const weeklyResultMap = new Map<string, WeeklyPlayerResult>();
    (weeklyResults || []).forEach((r) => weeklyResultMap.set(r.userId, r));

    const enhanced = playerStats.map((p) => {
      const gamesBack = Math.max(0, maxCurrentCorrect - p.correctCount);
      const wr = weeklyResultMap.get(p.user.id);
      return {
        ...p,
        gamesBack,
        weeklyResult: wr,
        isWeeklyWinner: wr?.isWeeklyWinner ?? false,
        tiebreakerExplanation: wr?.tiebreakerExplanation,
      };
    });

    // Sort: 1. Most correct picks, 2. Lowest tiebreaker diff if finished, 3. User name
    enhanced.sort((a, b) => {
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      if (a.weeklyResult && b.weeklyResult) {
        return a.weeklyResult.rank - b.weeklyResult.rank;
      }
      if (a.tbDiff !== undefined && b.tbDiff !== undefined) {
        return a.tbDiff - b.tbDiff;
      }
      return a.user.name.localeCompare(b.user.name);
    });

    // Compute ranks with "T-" tie prefix
    return enhanced.map((p, idx) => {
      let rank = idx + 1;
      let tiedWithOthers = false;

      if (isWeekFinished) {
        if (p.weeklyResult) {
          rank = p.weeklyResult.rank;
          tiedWithOthers =
            enhanced.filter((other) => other.weeklyResult?.rank === rank).length > 1;
        } else if (p.tbDiff !== undefined) {
          const prev = idx > 0 ? enhanced[idx - 1] : null;
          if (prev && prev.correctCount === p.correctCount && prev.tbDiff === p.tbDiff) {
            rank = (prev as any).rank || idx;
          }
          tiedWithOthers =
            enhanced.filter(
              (o) => o.correctCount === p.correctCount && o.tbDiff === p.tbDiff
            ).length > 1;
        } else {
          let currentRank = 1;
          for (let j = 0; j <= idx; j++) {
            if (j > 0 && enhanced[j].correctCount !== enhanced[j - 1].correctCount) {
              currentRank = j + 1;
            }
          }
          rank = currentRank;
          tiedWithOthers =
            enhanced.filter((other) => other.correctCount === p.correctCount).length > 1;
        }
      } else {
        let currentRank = 1;
        for (let j = 0; j <= idx; j++) {
          if (j > 0 && enhanced[j].correctCount !== enhanced[j - 1].correctCount) {
            currentRank = j + 1;
          }
        }
        rank = currentRank;
        tiedWithOthers =
          enhanced.filter((other) => other.correctCount === p.correctCount).length > 1;
      }

      const rankLabel = tiedWithOthers ? `T-${rank}` : `#${rank}`;

      return {
        ...p,
        rank,
        rankLabel,
      };
    });
  }, [playerStats, maxCurrentCorrect, weeklyResults, isWeekFinished]);

  // Contention status for each ranked player
  const playerContentionMap = useMemo(() => {
    const map = new Map<string, { status: string; label: string; detail: string; badgeColor: string }>();

    // If active week is completely finished
    if (isWeekFinished) {
      const hasOfficialWinner = rankedPlayers.some((p) => p.isWeeklyWinner);
      rankedPlayers.forEach((p, idx) => {
        const isWinner = hasOfficialWinner
          ? p.isWeeklyWinner
          : idx === 0 && p.correctCount > 0;

        if (isWinner) {
          map.set(p.user.id, {
            status: "winner",
            label: "Weekly Winner",
            detail: `${p.correctCount} pts`,
            badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
          });
        } else {
          const tiedTopScore = p.correctCount === maxCurrentCorrect && maxCurrentCorrect > 0;
          map.set(p.user.id, {
            status: "finished",
            label: tiedTopScore ? "2nd Place (TB)" : "Finished",
            detail: `${p.correctCount} pts`,
            badgeColor: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
          });
        }
      });
      return map;
    }

    // If 0 games have completed AND no games have locked/started yet
    const anyGameLockedOrStarted = games.some((g) => isGameLockedClient(g, games, lockPolicy));
    if (completedCount === 0 && !anyGameLockedOrStarted) {
      rankedPlayers.forEach((p) => {
        map.set(p.user.id, {
          status: "contending",
          label: "In Contention",
          detail: `${totalGamesCount} to play`,
          badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        });
      });
      return map;
    }

    // Step 1: Identify which players are mathematically eliminated
    const eliminatedPlayers = new Set<string>();
    const eliminationDetails = new Map<string, string>();

    rankedPlayers.forEach((p) => {
      // Condition 1: Player's absolute maximum possible points cannot reach the leader's current score
      if (p.maxPossible < maxCurrentCorrect && maxCurrentCorrect > 0) {
        eliminatedPlayers.add(p.user.id);
        eliminationDetails.set(p.user.id, `Max: ${p.maxPossible} pts`);
        return;
      }

      // Condition 2: Head-to-head pick elimination against players with higher current scores
      for (const other of rankedPlayers) {
        if (other.user.id === p.user.id) continue;
        if (other.correctCount <= p.correctCount) continue;

        // How many games can `p` gain on `other` across the remaining uncompleted games?
        let maxGainsOnOther = 0;
        for (const g of remainingGames) {
          const isLocked = isGameLockedClient(g, games, lockPolicy);
          const pPick = p.userPicksMap[g.id];
          const oPick = other.userPicksMap[g.id];

          if (pPick && pPick !== "" && pPick !== "HIDDEN") {
            if (oPick && oPick !== "" && oPick !== "HIDDEN") {
              if (pPick !== oPick) {
                // Different picks: if p wins and other loses, p gains 1 game
                maxGainsOnOther++;
              }
              // If pPick === oPick, both picked the same team so p can NEVER gain on other!
            } else if (!isLocked) {
              // other pick is not locked/known yet; other could pick differently
              maxGainsOnOther++;
            } else {
              // Game locked and other has no pick; p can gain 1
              maxGainsOnOther++;
            }
          } else if (!isLocked && lockPolicy !== "week") {
            // p has no pick yet, but game is unlocked; p could still submit a pick
            maxGainsOnOther++;
          }
        }

        // If other's lead over p is strictly greater than the maximum games p can gain on other:
        // Even if all remaining games go 100% in p's favor, p cannot even tie other!
        if (p.correctCount + maxGainsOnOther < other.correctCount) {
          eliminatedPlayers.add(p.user.id);
          eliminationDetails.set(
            p.user.id,
            p.maxPossible < maxCurrentCorrect
              ? `Max: ${p.maxPossible} pts`
              : `Uncatchable (Max: ${p.maxPossible} pts)`
          );
          return;
        }
      }
    });

    // Step 2: Assign contention status
    rankedPlayers.forEach((p) => {
      if (eliminatedPlayers.has(p.user.id)) {
        map.set(p.user.id, {
          status: "eliminated",
          label: "Eliminated",
          detail: eliminationDetails.get(p.user.id) || `Max: ${p.maxPossible} pts`,
          badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
        });
        return;
      }

      if (p.correctCount === maxCurrentCorrect && maxCurrentCorrect > 0) {
        const others = rankedPlayers.filter((o) => o.user.id !== p.user.id);
        const allOthersEliminated = others.length > 0 && others.every((o) => eliminatedPlayers.has(o.user.id));
        const maxOtherPossible = Math.max(...others.map((o) => o.maxPossible), 0);

        if (allOthersEliminated || p.correctCount > maxOtherPossible) {
          map.set(p.user.id, {
            status: "clinched",
            label: "Clinched 1st",
            detail: `${p.correctCount} pts (Uncatchable)`,
            badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
          });
          return;
        }

        map.set(p.user.id, {
          status: "leader",
          label: "Leader",
          detail: `${p.correctCount} pts (Max: ${p.maxPossible})`,
          badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
        });
        return;
      }

      map.set(p.user.id, {
        status: "contending",
        label: "In Contention",
        detail: `Max: ${p.maxPossible} pts`,
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
      });
    });

    return map;
  }, [rankedPlayers, completedCount, isWeekFinished, maxCurrentCorrect, totalGamesCount, games, remainingGames, lockPolicy]);

  const inContentionCount = useMemo(() => {
    return Array.from(playerContentionMap.values()).filter(
      (c) => c.status === "contending" || c.status === "leader" || c.status === "clinched"
    ).length;
  }, [playerContentionMap]);

  const eliminatedCount = useMemo(() => {
    return Array.from(playerContentionMap.values()).filter((c) => c.status === "eliminated").length;
  }, [playerContentionMap]);

  // Final display list of players:
  // In-contention players (leaders, clinched, contending) listed FIRST,
  // followed by mathematically eliminated players below them.
  const displayPlayers = useMemo(() => {
    if (isWeekFinished) return rankedPlayers;

    const inContention: typeof rankedPlayers = [];
    const eliminated: typeof rankedPlayers = [];

    rankedPlayers.forEach((p) => {
      const c = playerContentionMap.get(p.user.id);
      if (c && c.status === "eliminated") {
        eliminated.push(p);
      } else {
        inContention.push(p);
      }
    });

    return [...inContention, ...eliminated];
  }, [rankedPlayers, playerContentionMap, isWeekFinished]);

  // Identify weekly winners for the banner
  const weeklyWinners = useMemo(() => {
    return rankedPlayers.filter((p) => p.isWeeklyWinner);
  }, [rankedPlayers]);
  const primaryWinner = weeklyWinners[0];

  const weeklyFee = Number(settings?.weeklyFee) || 0;
  const weeklyPot = weeklyFee > 0 ? weeklyFee * users.length : 0;

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Week {activeWeek} League Picks</h2>
            {weeklyPot > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60">
                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  {isWeekFinished && primaryWinner
                    ? `Week ${activeWeek} Prize: $${weeklyPot.toLocaleString()} (${primaryWinner.user.name})`
                    : `Weekly Prize: $${weeklyPot.toLocaleString()}`}
                </span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Compare all league picks, live scores, points, and games back.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Tiebreaker Rules</span>
          </button>
        </div>
      </div>

      {/* Clinching Scenarios Announcement Banner (Active only when 1 game remains on Monday or W18 Sunday) */}
      {isClinchingEligible && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-emerald-500/10 border border-amber-300 dark:border-amber-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Week {activeWeek} Clinching Scenarios</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  Final Game
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
                Only 1 game left to decide the week! Click to see how each contender in the hunt can take 1st place.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowClinchingModal(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs transition shadow-xs cursor-pointer shrink-0 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>View Scenarios</span>
          </button>
        </div>
      )}

      {/* Games Summary & Legend Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>
                <strong>{completedCount}</strong> of {totalGamesCount} games final
                {liveCount === 0 && remainingCount > 0
                  ? ` (${remainingCount} left)`
                  : liveCount === 0 && remainingCount === 0
                  ? " (Final)"
                  : ""}
              </span>
            </div>

            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300/60 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{liveCount} live</span>
              </span>
            )}

            {isWeekFinished && primaryWinner ? (
              <button
                type="button"
                onClick={(e) => triggerConfetti(e)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 transition-all cursor-pointer active:scale-95"
                title="Celebrate Weekly Winner!"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Celebrate Winner</span>
              </button>
            ) : completedCount > 0 && remainingCount > 0 ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Check className="w-3 h-3" />
                  {inContentionCount} in contention
                </span>
                {eliminatedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    <X className="w-3 h-3" />
                    {eliminatedCount} eliminated
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-semibold flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 shrink-0" /> Away Pick
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Correct
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> Incorrect
            </span>
            {eliminatorEnabled && (
              <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" /> Survivor Pick
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ================= COMPACT LEAGUE PICKS GRID ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-center border-collapse tabular-nums">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 select-none">
              <tr>
                {/* Matchup Columns */}
                {sortedGames.map((game) => {
                  const isFinal = game.status.completed;
                  const isLive = game.status.state === "in";
                  return (
                    <th
                      key={game.id}
                      className={`p-1 text-center border-r border-slate-200 dark:border-slate-800 min-w-[50px] max-w-[58px] ${
                        game.isTiebreakerGame
                          ? "bg-amber-50/60 dark:bg-amber-950/30"
                          : isLive
                          ? "bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-400/30 dark:ring-emerald-500/20"
                          : "bg-slate-50 dark:bg-slate-800/80"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center leading-tight py-1">
                        <div className="flex items-center justify-center gap-1">
                          <TeamLogo
                            src={game.awayTeam.logo}
                            alt={game.awayTeam.abbreviation}
                            width={13}
                            height={13}
                            className="w-3.5 h-3.5 object-contain shrink-0"
                          />
                          <span className="text-[10px] font-black text-slate-900 dark:text-white tracking-tight">
                            {game.awayTeam.abbreviation}
                          </span>
                        </div>
                        {isLive ? (
                          <div
                            className="flex items-center justify-center gap-1 my-0.5 leading-none"
                            title={game.status.detail ? `Live: ${game.status.detail}` : "In Progress"}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                              {game.awayScore ?? 0}-{game.homeScore ?? 0}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`text-[8.5px] font-black my-0.5 leading-none ${
                              isFinal
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {isFinal && typeof game.awayScore === "number"
                              ? `${game.awayScore}-${game.homeScore}`
                              : "VS"}
                          </span>
                        )}
                        <div className="flex items-center justify-center gap-1">
                          <TeamLogo
                            src={game.homeTeam.logo}
                            alt={game.homeTeam.abbreviation}
                            width={13}
                            height={13}
                            className="w-3.5 h-3.5 object-contain shrink-0"
                          />
                          <span className="text-[10px] font-black text-slate-900 dark:text-white tracking-tight">
                            {game.homeTeam.abbreviation}
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}

                {/* TB Column Header */}
                {tbGame && (
                  <th className="p-1 text-center min-w-[52px] max-w-[60px] bg-slate-50 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 leading-tight">
                      TB PTS
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 leading-tight">
                      {tbFinal ? `Act: ${actualTbTotal}` : "Pred"}
                    </div>
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {displayPlayers.map((stat, idx) => {
                const user = stat.user;
                const isMe = user.id === currentUserId;
                const contention = playerContentionMap.get(user.id) || {
                  status: "contending",
                  label: "In Contention",
                  detail: "",
                  badgeColor: "bg-slate-100 text-slate-700",
                };
                const totalCols = sortedGames.length + (tbGame ? 1 : 0);

                return (
                  <React.Fragment key={user.id}>
                    {/* Player Subheader Row */}
                    <tr
                      className={
                        isMe
                          ? "bg-blue-50/90 dark:bg-blue-950/50 border-t-2 border-blue-300 dark:border-blue-700/80"
                          : "bg-slate-50/90 dark:bg-slate-800/80 border-t-2 border-slate-200/90 dark:border-slate-700/80"
                      }
                    >
                      <td
                        colSpan={totalCols}
                        className={`sticky left-0 py-1.5 px-3 z-10 text-left ${
                          isMe
                            ? "bg-blue-100 dark:bg-blue-950 shadow-[inset_4px_0_0_0_#2563eb] pl-3"
                            : "bg-slate-50 dark:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 max-w-full">
                          {/* Left: Rank, Name, Contention, Points (XX/YY correct), Games Back */}
                          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                            <span className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 w-7 shrink-0">
                              {stat.rankLabel}
                            </span>
                            <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm truncate flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500 text-white shrink-0">
                                  You
                                </span>
                              )}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-2xs whitespace-nowrap ${contention.badgeColor}`}
                              title={contention.detail}
                            >
                              {contention.status === "winner" ||
                              contention.status === "clinched" ||
                              contention.status === "leader" ? (
                                <Trophy className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              ) : contention.status === "contending" ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <X className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              )}
                              <span>{contention.label}</span>
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              · <strong className="text-slate-900 dark:text-white font-black">{stat.correctCount}</strong>/{sortedGames.length} correct
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              · {isWeekFinished
                                  ? contention.status === "winner"
                                    ? "Winner"
                                    : stat.gamesBack === 0
                                    ? "2nd Place (Tiebreaker)"
                                    : `#${stat.rank} Place`
                                  : stat.gamesBack === 0
                                  ? rankedPlayers.filter((p) => p.gamesBack === 0).length > 1
                                    ? "Co-Leader"
                                    : "Leader"
                                  : `${stat.gamesBack} ${stat.gamesBack === 1 ? "game back" : "games back"}`}
                            </span>
                            {completedCount === 0 && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-2xs whitespace-nowrap ${
                                  stat.pickedCount === sortedGames.length
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                    : stat.pickedCount > 0
                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                {stat.pickedCount === sortedGames.length ? "✓ Picks In" : stat.pickedCount > 0 ? `${stat.pickedCount}/${sortedGames.length} Picks` : "No Picks"}
                              </span>
                            )}
                          </div>

                          {/* Right: Survivor Pick */}
                          {eliminatorEnabled && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                              <span className="text-slate-400 dark:text-slate-500 hidden xs:inline">Survivor:</span>
                              {user.id !== currentUserId && !stat.isElimGameLocked ? (
                                stat.elimPickTeamId ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 font-bold text-[9px]">
                                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                                    Hidden until kickoff
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">No pick</span>
                                )
                              ) : stat.elimTeam ? (
                                <div
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] border shadow-2xs ${
                                    stat.elimResult === "won"
                                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                      : stat.elimResult === "lost"
                                      ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                      : "bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-800"
                                  }`}
                                >
                                  <TeamLogo
                                    src={stat.elimTeam.logo}
                                    alt={stat.elimTeam.abbreviation}
                                    width={12}
                                    height={12}
                                    className="w-3 h-3 object-contain shrink-0"
                                  />
                                  <span>{stat.elimTeam.abbreviation}</span>
                                  {stat.elimResult === "won" && <span className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-amber-500 shrink-0" title="Survived" />}
                                  {stat.elimResult === "lost" && <X className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />}
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 text-[10px]">No pick</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Picks Data Row */}
                    <tr
                      className={`transition-colors ${
                        isMe
                          ? "bg-blue-100/50 dark:bg-blue-950/60 border-t border-blue-200/80 dark:border-blue-800/80 border-b-2 border-blue-300 dark:border-blue-700/80"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Pick Cells */}
                      {sortedGames.map((game) => {
                        const pickedTeamId = stat.userPicksMap[game.id];
                        const hasPicked = Boolean(pickedTeamId);
                        const isFinal = game.status.completed;
                        const isLocked = isGameLockedClient(game, games, lockPolicy);
                        const isHidden = hasPicked && (pickedTeamId === "HIDDEN" || (!isLocked && user.id !== currentUserId));

                        let pickedTeam: Team | undefined;
                        let isCorrect = false;
                        let isIncorrect = false;

                        if (pickedTeamId && pickedTeamId !== "HIDDEN") {
                          pickedTeam = game.homeTeam.id === pickedTeamId ? game.homeTeam : game.awayTeam;
                          if (isFinal) {
                            if (isPickCorrect(game, pickedTeamId)) isCorrect = true;
                            else if (game.winnerTeamId || (typeof game.homeScore === "number" && typeof game.awayScore === "number")) isIncorrect = true;
                          }
                        }

                        const isSurvivorPick = eliminatorEnabled && stat.elimPickTeamId === pickedTeamId && !isHidden;
                        const isAwayPick = Boolean(pickedTeam && pickedTeam.id === game.awayTeam.id && !isHidden);

                        return (
                          <td
                            key={game.id}
                            className={`p-0.5 text-center min-w-[46px] max-w-[54px] ${
                              isMe
                                ? `border-r border-blue-200/80 dark:border-blue-800/80 ${
                                    game.isTiebreakerGame
                                      ? "bg-blue-100/70 dark:bg-blue-900/50"
                                      : isAwayPick
                                      ? "bg-blue-200/40 dark:bg-blue-950/80"
                                      : "bg-blue-100/50 dark:bg-blue-950/60"
                                  }`
                                : `border-r border-slate-100 dark:border-slate-800/80 ${
                                    game.isTiebreakerGame
                                      ? isAwayPick
                                        ? "bg-amber-100/40 dark:bg-amber-950/25"
                                        : "bg-amber-50/20 dark:bg-amber-950/10"
                                      : isAwayPick
                                      ? "bg-slate-100/75 dark:bg-slate-800/50"
                                      : ""
                                  }`
                            }`}
                          >
                            {isHidden ? (
                              <span
                                className="text-[9px] font-bold text-slate-300 dark:text-slate-600"
                                title="Hidden until kickoff"
                              >
                                •••
                              </span>
                            ) : pickedTeam ? (
                              <div
                                title={`${pickedTeam.displayName} (${isAwayPick ? "Away" : "Home"})`}
                                className={`group relative py-1 px-1 rounded flex flex-col items-center justify-center transition-all w-full ${
                                  isSurvivorPick
                                    ? isFinal
                                      ? isCorrect
                                        ? "bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-200 font-black shadow-xs ring-1 ring-emerald-400/30"
                                        : "bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700/80 text-rose-950 dark:text-rose-200 font-bold shadow-xs ring-1 ring-rose-400/30"
                                      : "bg-orange-100 dark:bg-orange-950/70 border border-orange-300 dark:border-orange-700/80 text-orange-950 dark:text-orange-200 font-black shadow-xs ring-1 ring-orange-400/30"
                                    : isCorrect
                                    ? isAwayPick
                                      ? "bg-emerald-200/90 dark:bg-emerald-900/70 border border-emerald-400/80 dark:border-emerald-600/80 text-emerald-950 dark:text-emerald-100 font-black shadow-xs ring-1 ring-emerald-500/40"
                                      : "bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-200 font-black shadow-xs ring-1 ring-emerald-400/30"
                                    : isIncorrect
                                    ? isAwayPick
                                      ? "bg-rose-200/90 dark:bg-rose-900/70 border border-rose-400/80 dark:border-rose-600/80 text-rose-950 dark:text-rose-100 font-bold shadow-xs ring-1 ring-rose-500/40"
                                      : "bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700/80 text-rose-950 dark:text-rose-200 font-bold shadow-xs ring-1 ring-rose-400/30"
                                    : isMe
                                    ? isAwayPick
                                      ? "bg-blue-200/90 dark:bg-blue-900/80 border border-blue-400 dark:border-blue-500 text-blue-950 dark:text-blue-100 font-black shadow-2xs"
                                      : "bg-white/95 dark:bg-slate-800/90 border border-blue-300 dark:border-blue-600 text-blue-950 dark:text-blue-100 font-bold shadow-2xs"
                                    : isAwayPick
                                    ? "bg-slate-200/85 dark:bg-slate-800 border border-slate-300/85 dark:border-slate-700/80 text-slate-950 dark:text-slate-100 font-bold shadow-2xs"
                                    : "bg-transparent text-slate-800 dark:text-slate-200 font-semibold"
                                }`}
                              >
                                <TeamLogo
                                  src={pickedTeam.logo}
                                  alt={pickedTeam.abbreviation}
                                  width={18}
                                  height={18}
                                  className={`w-4.5 h-4.5 object-contain shrink-0 ${
                                    isIncorrect ? "opacity-35 grayscale" : ""
                                  }`}
                                />
                                <div className="flex items-center justify-center gap-0.5 mt-0.5 leading-none">
                                  <span className="text-[10px] tracking-tight">{pickedTeam.abbreviation}</span>
                                  {isSurvivorPick && isFinal && isCorrect && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-amber-500 shadow-2xs shrink-0 inline-block"
                                      title="Survivor Correct"
                                    />
                                  )}
                                  {isSurvivorPick && isFinal && isIncorrect && (
                                    <X className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                  )}
                                  {!isSurvivorPick && isCorrect && (
                                    <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  )}
                                  {!isSurvivorPick && isIncorrect && (
                                    <X className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-200 dark:text-slate-700 text-xs font-bold">–</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Tiebreaker Cell */}
                      {tbGame && (
                        <td
                          className={`p-1 text-center min-w-[52px] max-w-[60px] border-l ${
                            isMe
                              ? "bg-blue-100/60 dark:bg-blue-900/50 border-blue-200/80 dark:border-blue-800/80"
                              : "bg-slate-50/25 dark:bg-slate-800/25 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          {stat.tb ? (
                            (() => {
                              const isTbLocked = isGameLockedClient(tbGame, games, lockPolicy);
                              // Hide tiebreaker from other players until the tiebreaker game has kicked off
                              if ((!isTbLocked && user.id !== currentUserId) || (stat.tb as any)?.isHidden) {
                                return (
                                  <span
                                    className="text-[9px] font-bold text-slate-300 dark:text-slate-600"
                                    title="Hidden until kickoff"
                                  >
                                    •••
                                  </span>
                                );
                              }

                              return (
                                <div className="py-0.5">
                                  <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 leading-tight">
                                    {stat.tb.totalScore}
                                    {tbFinal && stat.tbDiff !== undefined && (
                                      <span
                                        className={`ml-1 text-[9px] font-extrabold ${
                                          stat.tbDiff === 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-slate-400 dark:text-slate-500"
                                        }`}
                                      >
                                        (±{stat.tbDiff})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold leading-none mt-0.5">
                                    {stat.tb.awayScore}-{stat.tb.homeScore}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">–</span>
                          )}
                        </td>
                      )}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiebreaker Rules Explainer Modal */}
      {showRulesModal && (
        <TiebreakerRulesModal onClose={() => setShowRulesModal(false)} />
      )}

      {/* Clinching Scenarios Modal */}
      {showClinchingModal && (
        <ClinchingScenariosModal
          isOpen={showClinchingModal}
          onClose={() => setShowClinchingModal(false)}
          games={games}
          users={users}
          allPicks={allPicks}
          activeWeek={activeWeek}
        />
      )}
    </div>
  );
}
