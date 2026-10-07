"use client";

import React, { useMemo, useState } from "react";
import { SeasonPlayerStanding } from "@/types/nfl";
import {
  Trophy,
  Crown,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

interface OverallStandingsProps {
  standings: SeasonPlayerStanding[];
  seasonYear: number;
  currentUserId?: string;
  isSeasonOver?: boolean;
}

interface StandingRow extends SeasonPlayerStanding {
  gamesBack: number;
  latest?: { week: number; correct: number; total: number; isWinner: boolean };
  /** Positive = moved up, negative = moved down, 0 = unchanged, null = no prior week */
  movement: number | null;
}

/** Same ordering rules as calculateSeasonStandings in lib/scoring.ts */
function rankPlayers(
  players: { userId: string; userName: string; totalCorrect: number; weeklyWins: number; winPercentage: number }[]
): Map<string, number> {
  const sorted = [...players].sort((a, b) => {
    if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
    if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
    if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
    return a.userName.localeCompare(b.userName);
  });
  const ranks = new Map<string, number>();
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev && prev.totalCorrect === p.totalCorrect && prev.weeklyWins === p.weeklyWins) {
      ranks.set(p.userId, ranks.get(prev.userId)!);
    } else {
      ranks.set(p.userId, i + 1);
    }
  });
  return ranks;
}

function RankLabel({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-600">🥇</span>;
  if (rank === 2) return <span className="text-slate-600">🥈</span>;
  if (rank === 3) return <span className="text-amber-700">🥉</span>;
  return <span className="text-slate-500 font-bold">{rank}</span>;
}

function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300 text-[11px]">–</span>;
  if (value > 0)
    return (
      <span className="inline-flex items-center text-emerald-600 text-[11px] font-bold">
        <ArrowUp className="w-3 h-3" />
        {value}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center text-rose-600 text-[11px] font-bold">
        <ArrowDown className="w-3 h-3" />
        {Math.abs(value)}
      </span>
    );
  return <Minus className="w-3 h-3 text-slate-300" />;
}

export function OverallStandings({
  standings,
  seasonYear,
  currentUserId,
  isSeasonOver,
}: OverallStandingsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { rows, latestWeek } = useMemo(() => {
    const latestWeek = standings.reduce((max, p) => {
      const last = p.recentWeeklyScores[p.recentWeeklyScores.length - 1];
      return last ? Math.max(max, last.week) : max;
    }, 0);

    const leaderCorrect = standings[0]?.totalCorrect ?? 0;

    // Rebuild standings as they were before the latest week to compute movement
    const hasPriorWeek = standings.some((p) =>
      p.recentWeeklyScores.some((s) => s.week < latestWeek)
    );
    const previousRanks = hasPriorWeek
      ? rankPlayers(
          standings.map((p) => {
            const latest = p.recentWeeklyScores.find((s) => s.week === latestWeek);
            const prevCorrect = p.totalCorrect - (latest?.correct ?? 0);
            const prevGames = p.totalGames - (latest?.total ?? 0);
            return {
              userId: p.userId,
              userName: p.userName,
              totalCorrect: prevCorrect,
              weeklyWins: p.weeklyWins - (latest?.isWinner ? 1 : 0),
              winPercentage: prevGames > 0 ? prevCorrect / prevGames : 0,
            };
          })
        )
      : null;

    const rows: StandingRow[] = standings.map((p) => {
      const prevRank = previousRanks?.get(p.userId);
      return {
        ...p,
        gamesBack: leaderCorrect - p.totalCorrect,
        latest: p.recentWeeklyScores.find((s) => s.week === latestWeek),
        movement: prevRank === undefined ? null : prevRank - p.rank,
      };
    });

    return { rows, latestWeek };
  }, [standings]);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        No completed games yet for the {seasonYear} season.
      </div>
    );
  }

  // One-line headline
  
  const leaders = rows.filter((r) => r.rank === 1);
  const runnerUp = rows.find((r) => r.rank > 1);
  
  let headline = "";
  if (isSeasonOver) {
    headline =
      leaders.length > 1
        ? `${leaders.map(l => l.userName).join(' & ')} tie for the win!`
        : `${leaders[0].userName} wins the season!`;
  } else {
    headline =
      leaders.length > 1
        ? `${leaders.length}-way tie for 1st at ${leaders[0].totalCorrect}`
        : runnerUp
        ? `${leaders[0].userName} leads by ${leaders[0].totalCorrect - runnerUp.totalCorrect}`
        : `${leaders[0].userName} leads`;
  }

  const me = rows.find((r) => r.userId === currentUserId);
  const showMyPosition = me && me.rank > 5;

  return (
    <div className="space-y-3 pb-16 sm:pb-6">
      {/* Headline strip */}
      <div className={`flex items-center justify-between gap-3 border rounded-2xl px-4 py-2.5 text-xs sm:text-sm ${isSeasonOver ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className={`font-bold truncate ${isSeasonOver ? "text-amber-900 dark:text-amber-200" : "text-slate-900 dark:text-white"}`}>{headline}</span>
        </div>
        <span className={`font-semibold whitespace-nowrap ${isSeasonOver ? "text-amber-700/70 dark:text-amber-300/70" : "text-slate-500 dark:text-slate-400"}`}>
          {seasonYear} • {isSeasonOver ? "Final" : `Thru Wk ${latestWeek}`}
        </span>
      </div>

      {/* Your position (only when you're outside the top of the list) */}
      {showMyPosition && me && (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl px-4 py-2 text-xs sm:text-sm">
          <span className="font-bold text-emerald-900 dark:text-emerald-200">Your position: #{me.rank}</span>
          <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
            {me.totalCorrect} correct • {me.gamesBack} GB
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Desktop / tablet table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 pl-5 pr-2 w-14">Rank</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3 text-center">Correct</th>
                <th className="py-2.5 px-3 text-center">Pct</th>
                <th className="py-2.5 px-3 text-center" title="Games behind the leader">GB</th>
                <th className="py-2.5 px-3 text-center">Wk {latestWeek}</th>
                <th className="py-2.5 px-3 text-center" title={`Rank change since Week ${latestWeek - 1}`}>Move</th>
                <th className="py-2.5 px-3 text-center">Titles</th>
                <th className="py-2.5 pl-3 pr-5 hidden lg:table-cell">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rows.map((p) => {
                const isMe = p.userId === currentUserId;
                return (
                  <tr
                    key={p.userId}
                    className={
                      (isSeasonOver && p.rank === 1)
                        ? "bg-amber-50/70 dark:bg-amber-950/40"
                        : isMe
                        ? "bg-emerald-100/60 dark:bg-emerald-950/50 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/70"
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                    }
                  >
                    <td className={`py-2.5 pl-5 pr-2 font-black whitespace-nowrap text-slate-900 dark:text-white ${isMe ? "border-l-4 border-emerald-500 pl-4" : ""}`}>
                      <RankLabel rank={p.rank} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg ${p.avatarColor} text-white font-bold flex items-center justify-center text-xs flex-shrink-0`}
                        >
                          {p.userName.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">{p.userName}</span>
                        {p.rank === 1 && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="font-black text-slate-900 dark:text-white">{p.totalCorrect}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">/{p.totalGames}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                      {p.winPercentage}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                      {p.gamesBack === 0 ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{p.gamesBack}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {p.latest ? (
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            p.latest.isWinner ? "text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {p.latest.correct}/{p.latest.total}
                          {p.latest.isWinner && <Trophy className="w-3 h-3 text-amber-500" />}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">–</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Movement value={p.movement} />
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {p.weeklyWins > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 dark:text-amber-300">
                          <Trophy className="w-3 h-3 text-amber-500" />
                          {p.weeklyWins}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">–</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 hidden lg:table-cell">
                      <div className="flex items-center gap-1 flex-wrap">
                        {p.recentWeeklyScores.map((s) => (
                          <span
                            key={s.week}
                            title={`Week ${s.week}: ${s.correct}/${s.total}${s.isWinner ? " (Weekly winner)" : ""}`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              s.isWinner
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            W{s.week}:{s.correct}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: compact rows, tap to expand weekly history */}
        <div className="md:hidden">
          <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-right">Correct</span>
            <span className="text-right">GB</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rows.map((p) => {
              const isMe = p.userId === currentUserId;
              const isOpen = expandedId === p.userId;
              return (
                <li key={p.userId} className={(isSeasonOver && p.rank === 1) ? "bg-amber-50/70 dark:bg-amber-950/40" : isMe ? "bg-emerald-100/60 dark:bg-emerald-950/50" : ""}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : p.userId)}
                    aria-expanded={isOpen}
                    className={`w-full grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2.5 text-left ${
                      isMe ? "border-l-4 border-emerald-500 pl-2" : ""
                    }`}
                  >
                    {/* Rank + movement */}
                    <div className="flex flex-col items-center leading-none gap-0.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        <RankLabel rank={p.rank} />
                      </span>
                      <Movement value={p.movement} />
                    </div>

                    {/* Player */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg ${p.avatarColor} text-white font-bold flex items-center justify-center text-xs flex-shrink-0`}
                      >
                        {p.userName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {p.userName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                          {p.latest && (
                            <span className={p.latest.isWinner ? "text-amber-700 dark:text-amber-400 font-semibold" : ""}>
                              Wk{p.latest.week} {p.latest.correct}/{p.latest.total}
                            </span>
                          )}
                          {p.weeklyWins > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                              <Trophy className="w-2.5 h-2.5" />
                              {p.weeklyWins}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Correct */}
                    <div className="text-right whitespace-nowrap">
                      <span className="font-black text-base text-slate-900 dark:text-white">{p.totalCorrect}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">/{p.totalGames}</span>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{p.winPercentage}%</div>
                    </div>

                    {/* GB + chevron */}
                    <div className="flex items-center justify-end gap-0.5 font-bold text-sm">
                      {p.gamesBack === 0 ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{p.gamesBack}</span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {isOpen && p.recentWeeklyScores.length > 0 && (
                    <div className="px-3 pb-3 -mt-0.5">
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                        {p.recentWeeklyScores.map((s) => (
                          <span
                            key={s.week}
                            className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
                              s.isWinner
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            W{s.week}: {s.correct}/{s.total}
                            {s.isWinner && <Trophy className="w-3 h-3 text-amber-600" />}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 px-1">
        GB = games behind the leader. Move = rank change since Week {Math.max(latestWeek - 1, 1)}.
      </p>
    </div>
  );
}
