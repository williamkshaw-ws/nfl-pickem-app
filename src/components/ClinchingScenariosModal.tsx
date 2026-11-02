"use client";

import React, { useState, useMemo } from "react";
import { X, Trophy, Zap, HelpCircle, ChevronRight, Calculator, CheckCircle2, ShieldAlert } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"cheatsheet" | "contenders" | "simulator">("cheatsheet");

  const analysis = useMemo(() => {
    return computeClinchingAnalysis(games, users, allPicks, activeWeek, true);
  }, [games, users, allPicks, activeWeek]);

  // Score simulator state: default to 21 - 24
  const [simAwayScore, setSimAwayScore] = useState<number>(21);
  const [simHomeScore, setSimHomeScore] = useState<number>(24);

  const simResult = useMemo(() => {
    if (!analysis.simulate) return null;
    return analysis.simulate(simAwayScore, simHomeScore);
  }, [analysis, simAwayScore, simHomeScore]);

  if (!isOpen || !analysis.isEligible || !analysis.remainingGame || !analysis.awayTeam || !analysis.homeTeam) {
    return null;
  }

  const { remainingGame, awayTeam, homeTeam, contenders, cheatSheet } = analysis;

  const presets = [
    { label: `${awayTeam.abbreviation} Close`, away: 24, home: 21 },
    { label: `${homeTeam.abbreviation} Close`, away: 21, home: 24 },
    { label: "Low Scoring", away: 16, home: 13 },
    { label: "High Scoring", away: 31, home: 28 },
    { label: "Shootout", away: 35, home: 38 },
  ];

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
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-slate-50 to-emerald-500/10 dark:from-amber-950/30 dark:via-slate-900 dark:to-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 id="clinching-modal-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Week {activeWeek} Clinching Scenarios</span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {contenders.length} in Contention
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live breakdown of every winning path heading into the final game
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matchup Banner */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <TeamLogo src={awayTeam.logo} alt={awayTeam.abbreviation} width={24} height={24} />
              <span>{awayTeam.name}</span>
            </div>
            <span className="text-xs font-bold text-slate-400">@</span>
            <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <TeamLogo src={homeTeam.logo} alt={homeTeam.abbreviation} width={24} height={24} />
              <span>{homeTeam.name}</span>
            </div>
          </div>
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            {remainingGame.status?.detail || "Final game of the week"}
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("cheatsheet")}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "cheatsheet"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Cheat Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contenders")}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "contenders"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Contender Paths ({contenders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "simulator"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Score Simulator</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: CHEAT SHEET */}
          {activeTab === "cheatsheet" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 sm:px-4">Game Outcome</th>
                      <th className="py-2.5 px-3 sm:px-4">Score Condition</th>
                      <th className="py-2.5 px-3 sm:px-4">Winner</th>
                      <th className="py-2.5 px-3 sm:px-4 hidden md:table-cell">Tiebreaker Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cheatSheet.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-black ${
                              row.outcome === "away"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}
                          >
                            {row.outcomeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {row.condition}
                        </td>
                        <td className="py-3 px-3 sm:px-4 font-black text-emerald-600 dark:text-emerald-400">
                          🏆 {row.winnerName}
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                          {row.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Tiebreaker Hierarchy:</strong> 1. Most correct picks $\rightarrow$ 2. Closest to Total Combined Points $\rightarrow$ 3. Closest to Home Team score ({homeTeam.name}) $\rightarrow$ 4. Closest to Away Team score ({awayTeam.name}).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CONTENDER CARDS */}
          {activeTab === "contenders" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {contenders.map((c) => {
                const pickedAway = c.pickTeamId === awayTeam.id;
                return (
                  <div
                    key={c.user.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${
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

                      {c.tiebreaker && (
                        <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-slate-700 dark:text-slate-300 mb-2.5 font-mono">
                          <span className="font-bold">Tiebreaker:</span> {awayTeam.abbreviation} {c.tiebreaker.awayScore} - {homeTeam.abbreviation} {c.tiebreaker.homeScore} ({c.tiebreaker.totalScore ?? c.tiebreaker.homeScore + c.tiebreaker.awayScore} pts)
                        </div>
                      )}

                      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="font-bold text-slate-900 dark:text-white">Path to Victory: </span>
                        {c.summary}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: INTERACTIVE SCORE SIMULATOR */}
          {activeTab === "simulator" && (
            <div className="space-y-4">
              {/* Score Inputs Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="text-center mb-4">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Simulate Any Final Score
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adjust the scores below or select a preset to see who wins in real-time
                  </p>
                </div>

                <div className="flex items-center justify-center gap-6 sm:gap-10 my-3">
                  {/* Away Score */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                      <TeamLogo src={awayTeam.logo} alt={awayTeam.abbreviation} width={28} height={28} />
                      <span>{awayTeam.abbreviation}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSimAwayScore((s) => Math.max(0, s - 1))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={simAwayScore}
                        onChange={(e) => setSimAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-12 text-center text-2xl font-black rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setSimAwayScore((s) => s + 1)}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-xl font-black text-slate-400 self-center">VS</div>

                  {/* Home Score */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                      <TeamLogo src={homeTeam.logo} alt={homeTeam.abbreviation} width={28} height={28} />
                      <span>{homeTeam.abbreviation}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSimHomeScore((s) => Math.max(0, s - 1))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={simHomeScore}
                        onChange={(e) => setSimHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-12 text-center text-2xl font-black rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setSimHomeScore((s) => s + 1)}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Presets:</span>
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSimAwayScore(p.away);
                        setSimHomeScore(p.home);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
                    >
                      {p.label} ({p.away}–{p.home})
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation Result */}
              {simResult && (
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-2xl shrink-0 border border-emerald-500/30">
                        🏆
                      </div>
                      <div>
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Projected Weekly Winner
                        </div>
                        <h4 className="text-lg font-black text-emerald-950 dark:text-emerald-100">
                          {simResult.isTie && simResult.coWinners
                            ? simResult.coWinners.map((u) => u.name).join(" & ")
                            : simResult.winner.name}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-200">
                        Total Points: {simAwayScore + simHomeScore}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        {simAwayScore > simHomeScore
                          ? `${awayTeam.name} Wins`
                          : simHomeScore > simAwayScore
                          ? `${homeTeam.name} Wins`
                          : "Tied Game"}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 font-medium bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                    {simResult.explanation}
                  </p>

                  {/* Ranked Contenders Table */}
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-1.5">
                      Contender Standings Under This Score:
                    </div>
                    <div className="space-y-1">
                      {simResult.rankedContenders.map((rc) => (
                        <div
                          key={rc.user.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/60 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-400 w-4">
                              #{rc.rank}
                            </span>
                            <span className="font-bold">{rc.user.name}</span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-3">
                            <span>{rc.finalWins} wins</span>
                            {rc.tier1Diff !== undefined && (
                              <span>Total diff: ±{rc.tier1Diff}</span>
                            )}
                            {rc.tier2Diff !== undefined && (
                              <span>Home diff: ±{rc.tier2Diff}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <span>Updates automatically as final score unfolds</span>
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
