"use client";

import React, { useMemo } from "react";
import { Game, User, UserPicks, Team, EliminatorStatus } from "@/types/nfl";
import { Check, X, Clock, Trophy, Target } from "lucide-react";
import Image from "next/image";

interface PickMatrixProps {
  games: Game[];
  users: User[];
  allPicks: UserPicks[];
  activeWeek: number;
  currentUserId?: string;
  lockPolicy?: "week" | "day" | "game";
  eliminatorEnabled?: boolean;
  eliminatorStatus?: EliminatorStatus[];
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
}: PickMatrixProps) {
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

      return {
        user,
        userPickRecord,
        userPicksMap,
        tb,
        correctCount,
        incorrectCount,
        maxPossible,
        elimPickTeamId,
        elimTeam,
        elimResult,
        isElimGameLocked,
      };
    });
  }, [allPicks, activeWeek, users, completedGames, remainingCount, sortedGames, games, lockPolicy]);

  // Highest current score
  const maxCurrentCorrect = useMemo(() => {
    return Math.max(...playerStats.map((p) => p.correctCount), 0);
  }, [playerStats]);

  // Compute live contention status for each player
  const playerContention = useMemo(() => {
    return playerStats.map((p) => {
      if (completedCount === 0) {
        return {
          status: "contending" as const,
          label: "In Contention",
          detail: `${totalGamesCount} to play`,
          badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
        };
      }

      if (isWeekFinished) {
        if (p.correctCount === maxCurrentCorrect && maxCurrentCorrect > 0) {
          return {
          status: "winner" as const,
          label: "Weekly Winner",
          detail: `${p.correctCount} pts`,
          badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
        };
      }
      return {
        status: "finished" as const,
        label: "Finished",
        detail: `${p.correctCount} pts`,
        badgeColor: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
      };
    }

    // Mid-week elimination math:
    // If the player cannot even tie the leader's CURRENT score with all remaining games, they are eliminated!
    if (p.maxPossible < maxCurrentCorrect) {
      return {
        status: "eliminated" as const,
        label: "Eliminated",
        detail: `Max: ${p.maxPossible} pts`,
        badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
      };
    }

    if (p.correctCount === maxCurrentCorrect && maxCurrentCorrect > 0) {
      const otherPlayers = playerStats.filter((other) => other.user.id !== p.user.id);
      const maxOtherPossible = Math.max(...otherPlayers.map((o) => o.maxPossible), 0);

      if (p.correctCount > maxOtherPossible) {
        return {
          status: "clinched" as const,
          label: "Clinched 1st",
          detail: `${p.correctCount} pts (Uncatchable)`,
          badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
        };
      }

      return {
        status: "leader" as const,
        label: "Leader",
        detail: `${p.correctCount} pts (Max: ${p.maxPossible})`,
        badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
      };
    }

    return {
      status: "contending" as const,
      label: "In Contention",
      detail: `Max: ${p.maxPossible} pts`,
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
    };
  });
}, [playerStats, completedCount, isWeekFinished, maxCurrentCorrect, totalGamesCount]);

  const inContentionCount = playerContention.filter(
    (c) => c.status === "contending" || c.status === "leader" || c.status === "clinched"
  ).length;
  const eliminatedCount = playerContention.filter((c) => c.status === "eliminated").length;

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-end justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Week {activeWeek} Pick Matrix</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Compare all players&apos; picks, live scores, and contention status.
          </p>
        </div>
      </div>

      {/* Live Contention Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>
                <strong>{completedCount}</strong> of {totalGamesCount} games final
                {liveCount > 0
                  ? ` (${liveCount} live, ${remainingCount - liveCount} upcoming)`
                  : remainingCount > 0
                  ? ` (${remainingCount} left)`
                  : " (Complete)"}
              </span>
            </div>

            {completedCount > 0 && remainingCount > 0 && (
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
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Correct
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Incorrect
            </span>
            {eliminatorEnabled && (
              <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                <span className="text-[9px] font-black px-1 rounded bg-purple-100 dark:bg-purple-950 border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300">S</span> Survivor Pick
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ================= COMPACT GRID ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-center border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 select-none">
              <tr>
                {/* Sticky Score Header */}
                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 p-1.5 text-center border-r border-slate-200 dark:border-slate-700/80 min-w-[50px] max-w-[56px] shadow-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-tight">
                    Pts
                  </div>
                  <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 leading-tight">
                    Score
                  </div>
                </th>

                {/* Narrow Matchup Headers */}
                {sortedGames.map((game) => {
                  const isFinal = game.status.completed;
                  const isLive = game.status.state === "in";
                  return (
                    <th
                      key={game.id}
                      className={`p-1 text-center border-r border-slate-200 dark:border-slate-800 min-w-[44px] max-w-[50px] ${
                        game.isTiebreakerGame
                          ? "bg-amber-50/60 dark:bg-amber-950/30"
                          : "bg-slate-50 dark:bg-slate-800/80"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center leading-tight py-1">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white tracking-tight">
                          {game.awayTeam.abbreviation}
                        </span>
                        <span
                          className={`text-[8.5px] font-black my-0.5 leading-none ${
                            isFinal
                              ? "text-emerald-700 dark:text-emerald-400"
                              : isLive
                              ? "text-amber-600 dark:text-amber-400 animate-pulse font-black"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {isFinal && typeof game.awayScore === "number"
                            ? `${game.awayScore}-${game.homeScore}`
                            : isLive
                            ? `${game.awayScore ?? 0}-${game.homeScore ?? 0}`
                            : game.odds?.spread !== undefined
                            ? `${game.odds.spread > 0 ? `+${game.odds.spread}` : game.odds.spread}`
                            : "@"}
                        </span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white tracking-tight">
                          {game.homeTeam.abbreviation}
                        </span>
                      </div>
                    </th>
                  );
                })}

                {/* TB Column Header */}
                {tbGame && (
                  <th className="p-1 text-center min-w-[46px] max-w-[52px] bg-slate-50 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-tight">
                      TB
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 leading-tight">
                      Pred
                    </div>
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {users.map((user, idx) => {
                const stat = playerStats[idx];
                const contention = playerContention[idx];
                const totalCols = sortedGames.length + (tbGame ? 2 : 1);

                return (
                  <React.Fragment key={user.id}>
                    {/* Player Full-Width Subheader Row */}
                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-t-2 border-slate-200/90 dark:border-slate-700/80">
                      <td
                        colSpan={totalCols}
                        className="sticky left-0 py-1 px-2.5 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs text-left"
                      >
                        <div className="flex items-center justify-between gap-2 max-w-full">
                          {/* Left: Name & Contention Badge */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                              {user.name}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-2xs whitespace-nowrap ${contention.badgeColor}`}
                              title={contention.detail}
                            >
                              {contention.status === "winner" ||
                              contention.status === "clinched" ||
                              contention.status === "leader" ? (
                                <Trophy className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                              ) : contention.status === "contending" ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              ) : (
                                <X className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                              )}
                              <span>{contention.label}</span>
                            </span>
                          </div>

                          {/* Right: Survivor Pick Info */}
                          {eliminatorEnabled && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold flex-shrink-0">
                              <span className="text-slate-400 dark:text-slate-500 hidden xs:inline">Survivor:</span>
                              {user.id !== currentUserId && !stat.isElimGameLocked ? (
                                stat.elimPickTeamId ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 font-bold text-[9px]">
                                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                                    Hidden until kickoff
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">No pick</span>
                                )
                              ) : stat.elimTeam ? (
                                <>
                                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                    {stat.elimTeam.logo && (
                                      <Image
                                        src={stat.elimTeam.logo}
                                        alt={stat.elimTeam.abbreviation}
                                        width={12}
                                        height={12}
                                        className="w-3 h-3 object-contain"
                                        unoptimized
                                      />
                                    )}
                                    <span className="font-black text-slate-900 dark:text-white">
                                      {stat.elimTeam.abbreviation}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[8.5px] px-1 py-0.2 rounded font-black uppercase ${
                                      stat.elimResult === "won"
                                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70"
                                        : stat.elimResult === "lost"
                                        ? "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70"
                                        : stat.elimResult === "in_play"
                                        ? "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 animate-pulse font-black"
                                        : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
                                    }`}
                                  >
                                    {stat.elimResult === "won"
                                      ? "Survived"
                                      : stat.elimResult === "lost"
                                      ? "Elim"
                                      : stat.elimResult === "in_play"
                                      ? "Live"
                                      : "Upcoming"}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 text-[10px]">No pick</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Picks Row */}
                    <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-200/60 dark:border-slate-800/60">
                      {/* Sticky Left Score Cell */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 p-1 text-center border-r border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="font-black text-amber-600 dark:text-amber-400 text-sm leading-none">
                          {stat.correctCount}
                        </div>
                        <div className="text-[9px] font-bold text-amber-600/90 dark:text-amber-400/90 leading-tight">
                          pts
                        </div>
                        <div
                          className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold leading-none mt-0.5"
                          title={`Max possible: ${stat.maxPossible}`}
                        >
                          Max {stat.maxPossible}
                        </div>
                      </td>

                      {/* Matchups Pick Cells */}
                      {sortedGames.map((game) => {
                        const isGameLocked = checkIsGameLocked(game, games, lockPolicy);
                        const isRevealed = isGameLocked || user.id === currentUserId;
                        const pickedTeamId = stat.userPicksMap[game.id];
                        const isCorrect = game.status.completed && game.winnerTeamId === pickedTeamId;
                        const isIncorrect =
                          game.status.completed &&
                          game.winnerTeamId !== undefined &&
                          game.winnerTeamId !== pickedTeamId;

                        const pickedTeam =
                          pickedTeamId === game.awayTeam.id
                            ? game.awayTeam
                            : pickedTeamId === game.homeTeam.id
                            ? game.homeTeam
                            : null;

                        const isSurvivorChoice =
                          stat.elimPickTeamId &&
                          pickedTeamId === stat.elimPickTeamId &&
                          isRevealed;

                        return (
                          <td
                            key={game.id}
                            className={`p-1 text-center border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap min-w-[44px] max-w-[50px] ${
                              isSurvivorChoice
                                ? "bg-purple-50/70 dark:bg-purple-950/40 ring-1 ring-inset ring-purple-300/90 dark:ring-purple-700/80"
                                : game.isTiebreakerGame
                                ? "bg-amber-50/15 dark:bg-amber-950/20"
                                : ""
                            }`}
                          >
                            {pickedTeam ? (
                              !isGameLocked && user.id !== currentUserId ? (
                                <div
                                  className="flex flex-col items-center justify-center py-1 text-slate-300 dark:text-slate-600"
                                  title="Pick hidden until kickoff"
                                >
                                  <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                                  <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 mt-0.5">•••</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-1">
                                  {/* Team Logo (Unobstructed & Clean) */}
                                  {pickedTeam.logo ? (
                                    <Image
                                      src={pickedTeam.logo}
                                      alt={pickedTeam.abbreviation}
                                      width={20}
                                      height={20}
                                      className={`w-5 h-5 object-contain ${
                                        isIncorrect ? "opacity-35 grayscale" : ""
                                      }`}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700" />
                                  )}

                                  {/* Team Abbreviation with colored status */}
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5 leading-none">
                                    <span
                                      className={`relative inline-flex items-center justify-center text-[10px] font-black tracking-tight ${
                                        isCorrect
                                          ? "text-emerald-600 dark:text-emerald-400 font-black"
                                          : isIncorrect
                                          ? "text-rose-500 dark:text-rose-400 font-bold"
                                          : "text-slate-800 dark:text-slate-200 font-bold"
                                      }`}
                                    >
                                      {pickedTeam.abbreviation}
                                      {isIncorrect && (
                                        <span
                                          aria-hidden="true"
                                          className="absolute -inset-x-0.5 top-[46%] -translate-y-1/2 h-[1.5px] bg-rose-500 dark:bg-rose-400 pointer-events-none rounded-full"
                                        />
                                      )}
                                    </span>
                                    {isSurvivorChoice && (
                                      <span
                                        className="text-[7.5px] font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-700 px-0.5 rounded leading-none"
                                        title="Survivor Pick"
                                      >
                                        S
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            ) : (
                              <span className="text-slate-200 dark:text-slate-700 text-xs font-bold">–</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Tiebreaker Pick Cell */}
                      {tbGame && (
                        <td className="p-1 text-center min-w-[46px] max-w-[52px] border-l border-slate-200 dark:border-slate-800 bg-slate-50/25 dark:bg-slate-800/25">
                          {stat.tb ? (
                            (() => {
                              const isTbLocked = checkIsGameLocked(tbGame, games, lockPolicy);
                              if (!isTbLocked && user.id !== currentUserId) {
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
    </div>
  );
}
