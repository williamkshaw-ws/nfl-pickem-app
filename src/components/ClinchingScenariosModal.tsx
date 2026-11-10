"use client";

import React, { useMemo } from "react";
import { X, Trophy, Zap, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { Game, User, UserPicks } from "@/types/nfl";
import { TeamLogo } from "./TeamLogo";
import { computeClinchingAnalysis } from "@/lib/clinching-scenarios";

interface ClinchingScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  users: User[];
  allPicks: UserPicks[];
  activeWeek: number;
}

export function ClinchingScenariosModal({
  isOpen,
  onClose,
  games,
  users,
  allPicks,
  activeWeek,
}: ClinchingScenariosModalProps) {
  const analysis = useMemo(() => {
    return computeClinchingAnalysis(games, users, allPicks, activeWeek, true);
  }, [games, users, allPicks, activeWeek]);

  if (!isOpen || !analysis.isEligible || !analysis.remainingGame || !analysis.awayTeam || !analysis.homeTeam) {
    return null;
  }

  const { remainingGame, awayTeam, homeTeam, contenders } = analysis;

  const isGameLive = remainingGame.status?.state === "in";
  const isGameFinal = Boolean(remainingGame.status?.completed || remainingGame.status?.state === "post");
  const curAwayScore = Number(remainingGame.awayScore) || 0;
  const curHomeScore = Number(remainingGame.homeScore) || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinching-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-3.5 py-3 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-3 bg-gradient-to-r from-amber-500/10 via-slate-50 to-emerald-500/10 dark:from-amber-950/30 dark:via-slate-900 dark:to-emerald-950/30">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <h3 id="clinching-modal-title" className="text-sm sm:text-lg font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2 leading-tight">
                <span className="tracking-tight">Week {activeWeek} Clinching Scenarios</span>
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap shrink-0">
                  {contenders.length} {contenders.length === 1 ? "Contender" : "Contenders"}
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Winning conditions for each player in contention heading into the final game
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matchup Banner */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <TeamLogo src={awayTeam.logo} alt={awayTeam.abbreviation} width={24} height={24} />
              <span>{awayTeam.name}</span>
              {(isGameLive || isGameFinal) && (
                <span className="ml-1 text-sm font-mono font-black text-slate-900 dark:text-white">
                  {curAwayScore}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-400">@</span>
            <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <TeamLogo src={homeTeam.logo} alt={homeTeam.abbreviation} width={24} height={24} />
              <span>{homeTeam.name}</span>
              {(isGameLive || isGameFinal) && (
                <span className="ml-1 text-sm font-mono font-black text-slate-900 dark:text-white">
                  {curHomeScore}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isGameLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                LIVE • {remainingGame.status?.detail || "In Progress"} (Total: {curAwayScore + curHomeScore} pts)
              </span>
            ) : isGameFinal ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                Final Score (Total: {curAwayScore + curHomeScore} pts)
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {remainingGame.status?.detail || "Final game of the week"}
              </span>
            )}
          </div>
        </div>

        {/* Contender Paths Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {contenders.map((c) => {
              const pickedAway = c.pickTeamId === awayTeam.id;
              const isEliminated = c.isLiveEliminated;

              return (
                <div
                  key={c.user.id}
                  className={`p-4 rounded-2xl border transition shadow-xs flex flex-col justify-between gap-3 ${
                    isEliminated
                      ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-75"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    {/* Top User Info & Status */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${
                            c.user.avatarColor || "bg-emerald-600"
                          }`}
                        >
                          {c.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {c.user.name}
                          </h4>
                          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Current: {c.preWins} wins • Max: {c.maxWins}
                          </div>
                        </div>
                      </div>

                      {/* Pick Badge */}
                      {c.pickedTeam && (
                        <div
                          className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 ${
                            pickedAway
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          }`}
                        >
                          <TeamLogo src={c.pickedTeam.logo} alt={c.pickedTeam.abbreviation} width={16} height={16} />
                          <span>Picked {c.pickedTeam.abbreviation}</span>
                        </div>
                      )}
                    </div>

                    {/* Path to Victory */}
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed mb-2.5">
                      <span className="font-bold text-slate-900 dark:text-white">Path to Victory: </span>
                      <span>{c.summary}</span>
                    </div>

                    {/* Tiebreaker Prediction Details */}
                    {c.tiebreaker && (
                      <div className="text-xs bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-mono flex items-center justify-between">
                        <span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Predicted Score:</span>{" "}
                          {awayTeam.abbreviation} {c.tiebreaker.awayScore} - {homeTeam.abbreviation} {c.tiebreaker.homeScore}
                        </span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">
                          {c.tiebreaker.totalScore ?? c.tiebreaker.homeScore + c.tiebreaker.awayScore} pts
                        </span>
                      </div>
                    )}

                    {/* Live Status Badge / Elimination Notice */}
                    {isGameLive && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                        {isEliminated ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Eliminated live (Score: {curAwayScore}–{curHomeScore}, {curAwayScore + curHomeScore} pts)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live Contender • Still has an active path to 1st place</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isGameFinal && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                        {c.liveStatusLabel?.includes("Winner") ? (
                          <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>Weekly Winner!</span>
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-slate-400 px-1">
                            Did not win week
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clean Tiebreaker Hierarchy Box at the bottom */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Official Tiebreaker Hierarchy</span>
            </div>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              1. Most correct picks → 2. Closest to Total Combined Points → 3. Closest to Home Team score ({homeTeam.name}) → 4. Closest to Away Team score ({awayTeam.name}).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Automatically updates with live NFL scores
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
