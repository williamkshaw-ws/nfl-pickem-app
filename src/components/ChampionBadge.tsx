"use client";

import React from "react";
import { PastSeasonChampion } from "@/types/nfl";

interface ChampionBadgeProps {
  titles: PastSeasonChampion[];
  isReigning: boolean;
  compact?: boolean;
}

/**
 * Displays a compact championship ring / trophy pill next to past season winners.
 */
export function ChampionBadge({ titles, isReigning, compact = false }: ChampionBadgeProps) {
  if (titles.length === 0) return null;

  const yearsText = titles.map((t) => `'${String(t.seasonYear).slice(-2)}`).join(" ");
  const tooltipLines = titles
    .slice()
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .map((t) => {
      const details = [t.record, t.weeklyWins ? `${t.weeklyWins} wk win${t.weeklyWins === 1 ? "" : "s"}` : null]
        .filter(Boolean)
        .join(" · ");
      return `${t.seasonYear} Champion${details ? ` (${details})` : ""}`;
    });

  return (
    <span
      title={tooltipLines.join("\n")}
      className={`inline-flex items-center gap-0.5 rounded-full border font-black leading-none shrink-0 whitespace-nowrap tabular-nums ${
        isReigning
          ? "bg-amber-100/95 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
      } ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"}`}
    >
      <span>{isReigning ? "👑" : "🏆"}</span>
      <span>{yearsText}</span>
    </span>
  );
}
