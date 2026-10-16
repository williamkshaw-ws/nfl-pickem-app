"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Trophy, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export type GameKey = "pickem" | "bracket" | "squares";

interface GameSwitcherDropdownProps {
  currentGame: GameKey;
  className?: string;
}

interface GameOption {
  key: GameKey;
  title: string;
  subtitle: string;
  href: string;
  badgeBg: string;
  badgeTextColor: string;
  activeColor: string;
}

const GAMES: GameOption[] = [
  {
    key: "pickem",
    title: "NFL Pick'em",
    subtitle: "Weekly pick'em & confidence pools",
    href: "/",
    badgeBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    badgeTextColor: "text-white",
    activeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
  },
  {
    key: "bracket",
    title: "Playoff Bracket",
    subtitle: "Postseason tournament challenge",
    href: "/bracket",
    badgeBg: "bg-gradient-to-br from-purple-500 to-purple-600",
    badgeTextColor: "text-white",
    activeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300",
  },
  {
    key: "squares",
    title: "Super Bowl Squares",
    subtitle: "100 Squares pool & live grid",
    href: "/squares",
    badgeBg: "bg-gradient-to-br from-amber-500 to-amber-600",
    badgeTextColor: "text-white",
    activeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
  },
];

export function GameSwitcherDropdown({ currentGame, className = "" }: GameSwitcherDropdownProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentGameConfig = GAMES.find((g) => g.key === currentGame) || GAMES[0];

  // If not mounted or user is not signed in, render simple home logo without dropdown
  if (!mounted || !user) {
    return (
      <Link
        href="/"
        className={`group flex items-center p-1 sm:p-1.5 -ml-1 sm:-ml-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer select-none shrink-0 ${className}`}
        title="PocketPicks"
        aria-label="PocketPicks Home"
      >
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${currentGameConfig.badgeBg} flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0`}
        >
          <Trophy className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      </Link>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left shrink-0 ${isOpen ? "z-50" : "z-20"} ${className}`}>
      {/* Clickable Trophy Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 -ml-1 sm:-ml-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer select-none"
        title="Switch PocketPicks games"
        aria-label="Switch between PocketPicks games"
        aria-expanded={isOpen}
      >
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${currentGameConfig.badgeBg} flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0`}
        >
          <Trophy className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 mb-1">
            <span>PocketPicks Games</span>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">3 Pools</span>
          </div>

          <div className="space-y-1">
            {GAMES.map((game) => {
              const isCurrent = game.key === currentGame;

              return (
                <Link
                  key={game.key}
                  href={game.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-slate-100 dark:bg-slate-800/80"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl ${game.badgeBg} flex items-center justify-center text-white shadow-xs shrink-0`}
                    >
                      <Trophy className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                        {game.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {game.subtitle}
                      </div>
                    </div>
                  </div>

                  {isCurrent ? (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${game.activeColor}`}
                    >
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 font-bold opacity-0 group-hover:opacity-100">
                      &rarr;
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
