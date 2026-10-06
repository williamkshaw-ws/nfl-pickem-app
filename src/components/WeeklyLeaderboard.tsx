"use client";

import React, { useState, useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { WeeklyPlayerResult, Game } from "@/types/nfl";
import {
  Trophy,
  Crown,
  Sparkles,
  PartyPopper,
  HelpCircle,
  X,
  ChevronDown,
} from "lucide-react";

interface WeeklyLeaderboardProps {
  weeklyResults: WeeklyPlayerResult[];
  activeWeek: number;
  games: Game[];
  currentUserId?: string;
}

function formatKickoff(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function WeeklyLeaderboard({
  weeklyResults,
  activeWeek,
  games,
  currentUserId,
}: WeeklyLeaderboardProps) {
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [selectedPlayerForTB, setSelectedPlayerForTB] = useState<WeeklyPlayerResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const weeklyWinners = weeklyResults.filter((p) => p.isWeeklyWinner);
  const primaryWinner = weeklyWinners[0];
  const completedCount = games.filter((g) => g.status.completed).length;
  const remaining = games.length - completedCount;
  const hasGamesCompleted = completedCount > 0;
  const allGamesCompleted = games.length > 0 && remaining === 0;

  const leaderCorrect = weeklyResults[0]?.correctPicks ?? 0;
  const tiedAtTop = weeklyResults.filter((p) => p.correctPicks === leaderCorrect);
  const runnerUp = weeklyResults.find((p) => p.correctPicks < leaderCorrect);

  // Tied ranks get a "T" prefix (e.g. T1) while the week is still in progress
  const rankCounts = useMemo(() => {
    const m = new Map<number, number>();
    weeklyResults.forEach((p) => m.set(p.rank, (m.get(p.rank) ?? 0) + 1));
    return m;
  }, [weeklyResults]);

  // Trigger celebration confetti if there's a winner
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#3b82f6"],
      });
    } catch {
      // ignore
    }
  };

  // Auto-celebrate only once per viewer per finished week
  useEffect(() => {
    if (!primaryWinner || !allGamesCompleted) return;
    const key = `confetti-shown:wk${activeWeek}:${primaryWinner.userId}:${currentUserId ?? "anon"}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // storage unavailable — still celebrate
    }
    triggerConfetti();
  }, [activeWeek, primaryWinner?.userId, allGamesCompleted, currentUserId]);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowRulesModal(false);
        setSelectedPlayerForTB(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tiebreakerGame =
    games.find((g) => g.isTiebreakerGame) ||
    [...games].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
  const tbFinal =
    !!tiebreakerGame?.status.completed &&
    typeof tiebreakerGame.homeScore === "number" &&
    typeof tiebreakerGame.awayScore === "number";
  const tbLabel = tiebreakerGame
    ? `${tiebreakerGame.awayTeam.abbreviation} @ ${tiebreakerGame.homeTeam.abbreviation}`
    : "";

  const firstKickoff = [...games].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0];

  const rankLabel = (p: WeeklyPlayerResult) => {
    if (allGamesCompleted) {
      if (p.rank === 1) return <span>🥇</span>;
      if (p.rank === 2) return <span>🥈</span>;
      if (p.rank === 3) return <span>🥉</span>;
    }
    const tied = (rankCounts.get(p.rank) ?? 0) > 1;
    return (
      <span className="text-slate-500 font-bold">
        {tied ? "T" : ""}
        {p.rank}
      </span>
    );
  };

  // "Out" = can't catch the leader even by winning every remaining game
  const isEliminated = (p: WeeklyPlayerResult) =>
    !allGamesCompleted && hasGamesCompleted && p.correctPicks + remaining < leaderCorrect;

  // ---------- Status line ----------
  let statusLeft: React.ReactNode;
  if (allGamesCompleted && primaryWinner) {
    const names = weeklyWinners.map((w) => w.userName).join(" & ");
    statusLeft = (
      <>
        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="font-bold text-slate-900 truncate">
          Week {activeWeek}: {names}
        </span>
        <span className="text-slate-500 whitespace-nowrap">
          {primaryWinner.correctPicks}/{primaryWinner.totalGames}
          {primaryWinner.tiebreakerExplanation && weeklyWinners.length === 1 ? " · won on tiebreaker" : ""}
          {weeklyWinners.length > 1 ? " · co-winners" : ""}
        </span>
      </>
    );
  } else if (hasGamesCompleted) {
    const leaderText =
      tiedAtTop.length > 1
        ? `${tiedAtTop.length} tied at ${leaderCorrect}`
        : `${weeklyResults[0]?.userName} leads by ${leaderCorrect - (runnerUp?.correctPicks ?? leaderCorrect)}`;
    statusLeft = (
      <>
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />
        <span className="font-bold text-slate-900 whitespace-nowrap">
          {completedCount} of {games.length} final
        </span>
        <span className="text-slate-600 truncate">· {leaderText}</span>
      </>
    );
  } else {
    statusLeft = (
      <>
        <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
        <span className="font-bold text-slate-900 truncate">
          Week {activeWeek} · {games.length} games
        </span>
        {firstKickoff && (
          <span className="text-slate-500 whitespace-nowrap">
            · Kicks off {formatKickoff(firstKickoff.date)}
          </span>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status line */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-2xl px-4 py-2.5 text-xs sm:text-sm border ${
          allGamesCompleted && primaryWinner
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">{statusLeft}</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tiebreakerGame && (
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              TB: {tbLabel}
              {tbFinal && ` (${tiebreakerGame.awayScore! + tiebreakerGame.homeScore!})`}
            </span>
          )}
          {allGamesCompleted && primaryWinner && (
            <button
              onClick={triggerConfetti}
              className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200 transition active:scale-95"
              title="Celebrate!"
              aria-label="Celebrate"
            >
              <PartyPopper className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Week {activeWeek} Standings
          </h3>
          <button
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[11px] transition"
            title="View 3-tier tiebreaker rules"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Tiebreaker rules
          </button>
        </div>

        {/* Desktop / tablet table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 pl-5 pr-2 w-14">Rank</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3 text-center">Correct</th>
                <th className="py-2.5 px-3 text-center" title="Picks behind the leader">Back</th>
                <th className="py-2.5 pl-3 pr-5 text-right" title={`Tiebreaker prediction for ${tbLabel}`}>
                  TB Pick{tbFinal ? " (±)" : ""}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {weeklyResults.map((p) => {
                const tb = p.tiebreaker;
                const isMe = p.userId === currentUserId;
                const back = leaderCorrect - p.correctPicks;
                const out = isEliminated(p);
                return (
                  <tr
                    key={p.userId}
                    className={`${
                      p.isWeeklyWinner
                        ? "bg-amber-50/70 dark:bg-amber-950/40"
                        : isMe
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                    } ${out ? "opacity-60" : ""}`}
                  >
                    <td className={`py-2.5 pl-5 pr-2 font-black whitespace-nowrap text-slate-900 dark:text-white ${isMe ? "border-l-4 border-emerald-500 pl-4" : ""}`}>
                      {rankLabel(p)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg ${p.avatarColor} text-white font-bold flex items-center justify-center text-xs flex-shrink-0`}
                        >
                          {p.userName.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">{p.userName}</span>
                        {p.isWeeklyWinner && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        )}
                        {p.tiebreakerExplanation && (
                          <span title={p.tiebreakerExplanation}>
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="font-black text-slate-900 dark:text-white">{p.correctPicks}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">/{p.totalGames}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                      {back === 0 ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{back}</span>
                      )}
                      {out && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase text-rose-500">Out</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                      {tb ? (
                        <button
                          onClick={() => setSelectedPlayerForTB(p)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                          title="View tiebreaker breakdown"
                        >
                          <span className="font-bold text-slate-900 dark:text-white">{tb.predictedTotal}</span>
                          <span className="text-slate-400 dark:text-slate-500">
                            ({tb.predictedAway}-{tb.predictedHome})
                          </span>
                          {tb.tier1TotalDiff !== undefined && (
                            <span className="px-1.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                              ±{tb.tier1TotalDiff}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: compact rows, tap to expand tiebreaker details */}
        <div className="md:hidden">
          <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-right">Correct</span>
            <span className="text-right">Back</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {weeklyResults.map((p) => {
              const tb = p.tiebreaker;
              const isMe = p.userId === currentUserId;
              const isOpen = expandedId === p.userId;
              const back = leaderCorrect - p.correctPicks;
              const out = isEliminated(p);
              return (
                <li
                  key={p.userId}
                  className={
                    p.isWeeklyWinner ? "bg-amber-50/70 dark:bg-amber-950/40" : isMe ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""
                  }
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : p.userId)}
                    aria-expanded={isOpen}
                    className={`w-full grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2.5 text-left ${
                      isMe ? "border-l-4 border-emerald-500 pl-2" : ""
                    } ${out ? "opacity-60" : ""}`}
                  >
                    <span className="text-sm font-black text-center text-slate-900 dark:text-white">{rankLabel(p)}</span>

                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg ${p.avatarColor} text-white font-bold flex items-center justify-center text-xs flex-shrink-0`}
                      >
                        {p.userName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1">
                          <span className="truncate">{p.userName}</span>
                          {p.isWeeklyWinner && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {tb ? (
                            <>
                              TB {tb.predictedTotal}
                              {tb.tier1TotalDiff !== undefined && (
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold"> · ±{tb.tier1TotalDiff}</span>
                              )}
                            </>
                          ) : (
                            "No TB pick"
                          )}
                          {out && <span className="text-rose-500 font-bold uppercase"> · Out</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <span className="font-black text-base text-slate-900 dark:text-white">{p.correctPicks}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">/{p.totalGames}</span>
                    </div>

                    <div className="flex items-center justify-end gap-0.5 font-bold text-sm">
                      {back === 0 ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{back}</span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {p.tiebreakerExplanation && (
                        <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/60 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <span>{p.tiebreakerExplanation}</span>
                        </div>
                      )}
                      {tb ? (
                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">
                              TB pick · {tbLabel}
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {tiebreakerGame?.awayTeam.abbreviation} {tb.predictedAway} – {tb.predictedHome}{" "}
                              {tiebreakerGame?.homeTeam.abbreviation}
                              <span className="text-slate-400 dark:text-slate-500 font-normal"> ({tb.predictedTotal})</span>
                            </div>
                            {tbFinal && (
                              <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                                Actual {tiebreakerGame!.awayScore}–{tiebreakerGame!.homeScore} · off by{" "}
                                {tb.tier1TotalDiff}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedPlayerForTB(p)}
                            className="flex-shrink-0 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800"
                          >
                            Details
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          No tiebreaker prediction entered
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {hasGamesCompleted && !allGamesCompleted && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
          Back = picks behind the leader. Out = can&apos;t catch the leader with {remaining} game
          {remaining === 1 ? "" : "s"} left.
        </p>
      )}

      {/* 1. Popup Note Modal: League 3-Tier Tiebreaker Rules */}
      {showRulesModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Week {activeWeek} Tiebreaker Rules
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Official 3-Tier Hierarchy</p>
                </div>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Designated Tiebreaker Matchup Card */}
            {tiebreakerGame && (
              <div className="mt-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4">
                <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 tracking-wider">
                  Designated Tiebreaker Game
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    {tiebreakerGame.awayTeam.displayName} @ {tiebreakerGame.homeTeam.displayName}
                  </div>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800">
                    TB Matchup
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                  <span>Kickoff: {tiebreakerGame.shortName}</span>
                  {tiebreakerGame.status.completed && typeof tiebreakerGame.homeScore === "number" ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                      • Final: {tiebreakerGame.awayScore}-{tiebreakerGame.homeScore} (Total: {tiebreakerGame.awayScore! + tiebreakerGame.homeScore!} pts)
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 italic">• Scheduled finale</span>
                  )}
                </div>
              </div>
            )}

            {/* 3-Tier Steps */}
            <div className="mt-5 space-y-2.5">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                How Ties Are Broken (In Order)
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Total Combined Points
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Closest prediction to the combined final score of both teams (|Predicted Total - Actual Total|).
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Closest to Home Team Score
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    If players remain tied on total points, whoever predicted closest to the home team&apos;s actual points wins (|Predicted Home - Actual Home|).
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Closest to Away Team Score
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    If still tied on Home points, closest to the away team&apos;s actual score wins (|Predicted Away - Actual Away|).
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-900 dark:text-blue-300 font-medium">
              ℹ️ Tiebreakers are only evaluated if two or more players finish with the identical number of correct picks.
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 shadow-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Popup Note Modal: Individual Player Tiebreaker Breakdown */}
      {selectedPlayerForTB && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedPlayerForTB(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${selectedPlayerForTB.avatarColor} text-white font-black flex items-center justify-center text-sm shadow-xs`}
                >
                  {selectedPlayerForTB.userName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{selectedPlayerForTB.userName}</span>
                    {selectedPlayerForTB.isWeeklyWinner && (
                      <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Week {activeWeek} • {selectedPlayerForTB.correctPicks} of {selectedPlayerForTB.totalGames} Picks Correct
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayerForTB(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tiebreaker Winning Context note */}
            {selectedPlayerForTB.tiebreakerExplanation && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-900/60 text-xs font-bold text-amber-950 dark:text-amber-200 flex items-start gap-2 shadow-2xs">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{selectedPlayerForTB.tiebreakerExplanation}</span>
              </div>
            )}

            {/* Tiebreaker Data */}
            {selectedPlayerForTB.tiebreaker ? (
              <div className="mt-4 space-y-4">
                {/* Matchup Header */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Tiebreaker Game
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {tiebreakerGame?.awayTeam.abbreviation} @ {tiebreakerGame?.homeTeam.abbreviation}
                  </div>
                  {tiebreakerGame?.status.completed && typeof tiebreakerGame.homeScore === "number" ? (
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                      Final: {tiebreakerGame.awayScore} - {tiebreakerGame.homeScore} (Total: {tiebreakerGame.awayScore! + tiebreakerGame.homeScore!} pts)
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                      Scheduled kickoff
                    </div>
                  )}
                </div>

                {/* Score Comparison Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Player Prediction */}
                  <div className="bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl p-3.5 border border-amber-200 dark:border-amber-900/60 text-center">
                    <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                      Prediction
                    </div>
                    <div className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-1">
                      {selectedPlayerForTB.tiebreaker.predictedTotal}
                      <span className="text-xs font-normal text-amber-800 dark:text-amber-300 ml-1">pts</span>
                    </div>
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1">
                      {tiebreakerGame?.awayTeam.abbreviation} {selectedPlayerForTB.tiebreaker.predictedAway} - {selectedPlayerForTB.tiebreaker.predictedHome} {tiebreakerGame?.homeTeam.abbreviation}
                    </div>
                  </div>

                  {/* Actual Score */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                      Actual Final
                    </div>
                    {tiebreakerGame?.status.completed && typeof tiebreakerGame.homeScore === "number" ? (
                      <>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                          {tiebreakerGame.awayScore! + tiebreakerGame.homeScore!}
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">pts</span>
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {tiebreakerGame.awayTeam.abbreviation} {tiebreakerGame.awayScore} - {tiebreakerGame.homeScore} {tiebreakerGame.homeTeam.abbreviation}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-3">
                        Pending Game Final
                      </div>
                    )}
                  </div>
                </div>

                {/* 3-Tier Diffs */}
                {selectedPlayerForTB.tiebreaker.tier1TotalDiff !== undefined ? (
                  <div>
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider text-center">
                      Tiebreaker Accuracy Diffs (|Pred - Actual|)
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Tier 1: Total</div>
                        <div className="text-sm font-black text-amber-700 dark:text-amber-400 mt-0.5">
                          ±{selectedPlayerForTB.tiebreaker.tier1TotalDiff} pts
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Tier 2: Home</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          ±{selectedPlayerForTB.tiebreaker.tier2HomeDiff} pts
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Tier 3: Away</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          ±{selectedPlayerForTB.tiebreaker.tier3AwayDiff} pts
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    Differences will calculate automatically as soon as the tiebreaker game finishes!
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500 italic py-4">
                No tiebreaker prediction was entered for this week.
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPlayerForTB(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
