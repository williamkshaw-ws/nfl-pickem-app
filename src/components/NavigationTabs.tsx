
"use client";

import React from "react";
import { CheckCircle2, Award, Trophy, Grid, SlidersHorizontal, Target } from "lucide-react";

export type TabType = "picks" | "weekly" | "season" | "matrix" | "eliminator" | "commissioner";

interface NavigationTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeWeek: number;
  picksCount: number;
  totalGames: number;
  hasWeeklyWinner: boolean;
  isCommissioner: boolean;
  pickemEnabled?: boolean;
  eliminatorEnabled?: boolean;
}

export function NavigationTabs({
  activeTab,
  onTabChange,
  activeWeek,
  picksCount,
  totalGames,
  hasWeeklyWinner,
  isCommissioner,
  pickemEnabled = true,
  eliminatorEnabled,
}: NavigationTabsProps) {
  
  const allTabs: { id: TabType; label: string; shortLabel: string; icon: any; desktopOnlyLabel?: boolean; badge?: string; badgeColor?: string }[] = [
    {
      id: "picks",
      label: pickemEnabled ? "My Picks" : "My Pick",
      shortLabel: pickemEnabled ? "Picks" : "Pick",
      icon: CheckCircle2,
      badge: !pickemEnabled ? (picksCount > 0 ? "Done" : "Pending") : (picksCount < totalGames ? `${picksCount}/${totalGames}` : "Done"),
      badgeColor: !pickemEnabled ? (picksCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : (picksCount < totalGames ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"),
    },
    {
      id: "weekly",
      label: "Weekly Results",
      shortLabel: "Results",
      icon: Award,
      badge: hasWeeklyWinner ? "Final" : "Live",
      badgeColor: hasWeeklyWinner ? "bg-slate-100 text-slate-600" : "bg-red-500 text-white animate-pulse shadow-sm",
    },
    {
      id: "season",
      label: "Season Standings",
      shortLabel: "Season",
      icon: Trophy,
    },
    {
      id: "matrix",
      label: "Pick Matrix",
      shortLabel: "Matrix",
      icon: Grid,
      desktopOnlyLabel: true,
    }
  ];

  const tabs = allTabs.filter(tab => {
    if (!pickemEnabled && (tab.id === "weekly" || tab.id === "matrix" || tab.id === "season")) return false; // Hide Pickem specific tabs
    return true;
  });

  if (eliminatorEnabled) {
    tabs.push({
      id: "eliminator",
      label: "Survivor",
      shortLabel: "Survivor",
      icon: Target,
    });
  }

  if (isCommissioner) {
    tabs.push({
      id: "commissioner",
      label: "Commissioner Hub",
      shortLabel: "Admin",
      icon: SlidersHorizontal,
    });
  }

  return (
    <>
      <div className="hidden md:block bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group flex items-center gap-2 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-slate-900 dark:text-white" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-200"
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md inline-block min-w-[40px] text-center ${tab.badgeColor || ''}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] px-2 py-1.5 flex items-center justify-around pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-1 transition-all relative ${
                isActive
                  ? "text-slate-900 dark:text-white font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-bold"
              }`}
            >
              <Icon className={`w-5 h-5 transition-colors flex-shrink-0 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-400"}`} />
              <span className="text-[10px] tracking-tight mt-1 w-full text-center truncate px-0.5">
                {tab.shortLabel}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-slate-900 dark:bg-white" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
