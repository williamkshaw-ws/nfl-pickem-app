"use client";

import React from "react";
import { Trophy, X } from "lucide-react";

interface TiebreakerRulesModalProps {
  onClose: () => void;
}

export function TiebreakerRulesModal({ onClose }: TiebreakerRulesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              3-Tier Tiebreaker Rules
            </h3>
          </div>
          <button
            onClick={onClose}
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

          <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">
              NFL Game Ties = Win
            </span>
            <span className="text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed block">
              Any game that finishes in a tie counts as a <strong>Win</strong> for all picks (both teams count as correct). In Survivor pools, picking either team in a tie advances you as a win.
            </span>
          </div>
        </div>

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
