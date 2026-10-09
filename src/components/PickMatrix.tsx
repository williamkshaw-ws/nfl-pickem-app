"use client";

import React, { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { Game, User, UserPicks, Team, EliminatorStatus, WeeklyPlayerResult } from "@/types/nfl";
import { Check, X, Clock, Trophy, Target, Crown, Sparkles, HelpCircle } from "lucide-react";
import Image from "next/image";
import { TeamLogo } from "./TeamLogo";

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
}

function checkIsGameLocked(
  game: Game,
  allWeekGames: Game[],
  lockPolicy: "week" | "day" | "game"
): boolean {
  if (game.status.completed || game.status.state === "in") return true;
  const now = new Date().getTime();
  if (lockPolicy === "week") {
    const firstGameOfWeek = Math.min(...allWeekGames.map((g) => new Date(g.date).getTime()));
    return now >= firstGameOfWeek;
  }
  if (lockPolicy === "day") {
    const gameDateStr = new Date(game.date).toDateString();
    const firstGameOfDay = Math.min(
      ...allWeekGames
        .filter((g) => new Date(g.date).toDateString() === gameDateStr)
        .map((g) => new Date(g.date).getTime())
    );
    return now >= firstGameOfDay;
  }
  return now >= new Date(game.date).getTime();
}

export function PickMatrix({
  games,
  users,
  allPicks,
  activeWeek,
  currentUserId,
  lockPolicy = "game",
  eliminatorEnabled = false,
  eliminatorStatus,
  weeklyResults,
}: PickMatrixProps) {
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore if confetti not supported
    }
  };

  const {
    sortedGames,
    tbGame,
    completedGames,
    liveGames,
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
      liveGames: live,
      remainingGames: remaining,
      completedCount: completed.length,
      liveCount: live.length,
      remainingCount: remaining.length,
      totalGamesCount: sorted.length,
      isWeekFinished: sorted.length > 0 && remaining.length === 0,
    };
  }, [games]);

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
        if (userPicksMap[g.id] === g.winnerTeamId) {
          correctCount++;
        } else if (userPicksMap[g.id]) {
          incorrectCount++;
        }
      });

      const maxPossible = correctCount + remainingCount;

      // Survivor result for this week
      let elimResult: "won" | "lost" | "in_play" | "pending" | "none" = "none";
      let elimTeam: Team | undefined;
      let isElimGameLocked = false;

      if (elimPickTeamId && elimPickTeamId !== "HIDDEN") {
        const elimGame = sortedGames.find(
          (g) => g.homeTeam.id === elimPickTeamId || g.awayTeam.id === elimPickTeamId
        );
        if (elimGame) {
          isElimGameLocked = checkIsGameLocked(elimGame, games, lockPolicy);
          elimTeam = elimGame.homeTeam.id === elimPickTeamId ? elimGame.homeTeam : elimGame.awayTeam;
          if (elimGame.status.completed) {
            elimResult = elimGame.winnerTeamId === elimPickTeamId ? "won" : "lost";
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
  }, [allPicks, activeWeek, users, completedGames, remainingCount, sortedGames, games, lockPolicy, actualTbTotal]);

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
    let currentRank = 1;
    return enhanced.map((p, idx) => {
      if (idx > 0) {
        const prev = enhanced[idx - 1];
        if (prev.correctCount !== p.correctCount) {
          currentRank = idx + 1;
        }
      }
      const tiedWithOthers =
        enhanced.filter((other) => other.correctCount === p.correctCount).length > 1;
      const rankLabel = tiedWithOthers ? `T-${currentRank}` : `#${currentRank}`;

      return {
        ...p,
        rank: currentRank,
        rankLabel,
      };
    });
  }, [playerStats, maxCurrentCorrect, weeklyResults]);

  // Contention status for each ranked player
  const playerContentionMap = useMemo(() => {
    const map = new Map<string, { status: string; label: string; detail: string; badgeColor: string }>();

    rankedPlayers.forEach((p) => {
      if (completedCount === 0) {
        map.set(p.user.id, {
          status: "contending",
          label: "In Contention",
          detail: `${totalGamesCount} to play`,
          badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        });
        return;
      }

      if (isWeekFinished) {
        if (p.isWeeklyWinner || (p.correctCount === maxCurrentCorrect && maxCurrentCorrect > 0)) {
          map.set(p.user.id, {
            status: "winner",
            label: "Weekly Winner",
            detail: `${p.correctCount} pts`,
            badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
          });
          return;
        }
        map.set(p.user.id, {
          status: "finished",
          label: "Finished",
          detail: `${p.correctCount} pts`,
          badgeColor: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        });
        return;
      }

      if (p.maxPossible < maxCurrentCorrect) {
        map.set(p.user.id, {
          status: "eliminated",
          label: "Eliminated",
          detail: `Max: ${p.maxPossible} pts`,
          badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
        });
        return;
      }

      if (p.correctCount === maxCurrentCorrect && maxCurrentCorrect > 0) {
        const others = rankedPlayers.filter((o) => o.user.id !== p.user.id);
        const maxOther = Math.max(...others.map((o) => o.maxPossible), 0);
        if (p.correctCount > maxOther) {
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
  }, [rankedPlayers, completedCount, isWeekFinished, maxCurrentCorrect, totalGamesCount]);

  const inContentionCount = useMemo(() => {
    return Array.from(playerContentionMap.values()).filter(
      (c) => c.status === "contending" || c.status === "leader" || c.status === "clinched"
    ).length;
  }, [playerContentionMap]);

  const eliminatedCount = useMemo(() => {
    return Array.from(playerContentionMap.values()).filter((c) => c.status === "eliminated").length;
  }, [playerContentionMap]);

  // Identify weekly winners for the banner
  const weeklyWinners = useMemo(() => {
    return rankedPlayers.filter((p) => p.isWeeklyWinner);
  }, [rankedPlayers]);
  const primaryWinner = weeklyWinners[0];

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex items-end justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Week {activeWeek} League Picks</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Compare all league picks, live scores, points, and games back.
          </p>
        </div>

        <button
          onClick={() => setShowRulesModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Tiebreaker Rules</span>
        </button>
      </div>

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
                onClick={triggerConfetti}
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

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Correct
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> Incorrect
            </span>
            {eliminatorEnabled && (
              <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" /> Survivor Pick
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ================= COMPACT LEAGUE PICKS GRID ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-center border-collapse">
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
              {rankedPlayers.map((stat) => {
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
                          ? "bg-emerald-100/60 dark:bg-emerald-950/50 border-t-2 border-emerald-400 dark:border-emerald-700"
                          : "bg-slate-50/90 dark:bg-slate-800/80 border-t-2 border-slate-200/90 dark:border-slate-700/80"
                      }
                    >
                      <td
                        colSpan={totalCols}
                        className={`sticky left-0 py-1.5 px-3 z-10 backdrop-blur-xs text-left ${
                          isMe
                            ? "bg-emerald-100/75 dark:bg-emerald-950/90 border-l-4 border-emerald-500 pl-2.5"
                            : "bg-slate-50/95 dark:bg-slate-800/95"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 max-w-full">
                          {/* Left: Rank, Name, Contention, Points (XX/YY correct), Games Back */}
                          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                            <span className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 w-7 shrink-0">
                              {stat.rankLabel}
                            </span>
                            <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                              {user.name}
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
                              · {stat.gamesBack === 0 ? "Leader" : `${stat.gamesBack} ${stat.gamesBack === 1 ? "game back" : "games back"}`}
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
                                      : "bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800"
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
                      className={
                        isMe
                          ? "bg-emerald-100/35 dark:bg-emerald-950/30 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/45 transition-colors"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      }
                    >
                      {/* Pick Cells */}
                      {sortedGames.map((game) => {
                        const pickedTeamId = stat.userPicksMap[game.id];
                        const hasPicked = Boolean(pickedTeamId);
                        const isFinal = game.status.completed;
                        const isLocked = checkIsGameLocked(game, games, lockPolicy);
                        const isHidden = hasPicked && (pickedTeamId === "HIDDEN" || (!isLocked && user.id !== currentUserId));

                        let pickedTeam: Team | undefined;
                        let isCorrect = false;
                        let isIncorrect = false;

                        if (pickedTeamId && pickedTeamId !== "HIDDEN") {
                          pickedTeam = game.homeTeam.id === pickedTeamId ? game.homeTeam : game.awayTeam;
                          if (isFinal && game.winnerTeamId) {
                            if (pickedTeamId === game.winnerTeamId) isCorrect = true;
                            else isIncorrect = true;
                          }
                        }

                        const isSurvivorPick = eliminatorEnabled && stat.elimPickTeamId === pickedTeamId && !isHidden;

                        return (
                          <td
                            key={game.id}
                            className={`p-0.5 text-center border-r border-slate-100 dark:border-slate-800/80 min-w-[46px] max-w-[54px] ${
                              game.isTiebreakerGame ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
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
                                className={`group relative py-1 px-1 rounded flex flex-col items-center justify-center transition-all ${
                                  isSurvivorPick
                                    ? isFinal
                                      ? isCorrect
                                        ? "bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-200 font-black shadow-xs ring-1 ring-emerald-400/30"
                                        : "bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700/80 text-rose-950 dark:text-rose-200 font-bold shadow-xs ring-1 ring-rose-400/30"
                                      : "bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-700/80 text-purple-950 dark:text-purple-200 font-black shadow-xs ring-1 ring-purple-400/30"
                                    : isCorrect
                                    ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-black"
                                    : isIncorrect
                                    ? "bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold opacity-60"
                                    : "text-slate-800 dark:text-slate-200 font-bold"
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
                        <td className="p-1 text-center min-w-[52px] max-w-[60px] border-l border-slate-200 dark:border-slate-800 bg-slate-50/25 dark:bg-slate-800/25">
                          {stat.tb ? (
                            (() => {
                              const isTbLocked = checkIsGameLocked(tbGame, games, lockPolicy);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  3-Tier Tiebreaker Rules
                </h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              When two or more players finish with the same number of correct picks, the tiebreaker game determines the weekly winner:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                  Tier 1: Total Combined Points
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  Closest to the actual combined final score of both teams.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                  Tier 2: Home Team Score
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  If still tied on total points, closest to the home team&apos;s score.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                  Tier 3: Away Team Score
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  If still tied on home score, closest to the away team&apos;s score.
                </span>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
