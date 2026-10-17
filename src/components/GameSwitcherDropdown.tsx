"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Trophy, ChevronDown, Check, Grid, Shield, Loader2, LogIn, PlusCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useUserAllPools, UnifiedPoolItem } from "@/lib/useUserAllPools";
import { FootballIcon } from "@/components/FootballIcon";

export type GameKey = "pickem" | "bracket" | "squares";

interface GameSwitcherDropdownProps {
  currentGame: GameKey;
  className?: string;
  onJoin?: () => void;
  onCreate?: () => void;
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

export function GameSwitcherDropdown({
  currentGame,
  className = "",
  onJoin,
  onCreate,
}: GameSwitcherDropdownProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    pickemPools,
    squaresPools,
    bracketPools,
    totalCount,
    loading,
    refetch,
  } = useUserAllPools();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Refresh data when opening dropdown
  useEffect(() => {
    if (!isOpen) return;
    refetch();
  }, [isOpen, refetch]);

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

  const renderGameIcon = (key: GameKey, iconClass: string) => {
    if (key === "pickem") return <FootballIcon className={iconClass} />;
    if (key === "squares") return <Grid className={iconClass} />;
    return <Trophy className={iconClass} />;
  };

  const renderPoolRow = (pool: UnifiedPoolItem) => (
    <Link
      key={`${pool.gameType}-${pool.id}`}
      href={pool.href}
      onClick={() => setIsOpen(false)}
      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-500 transition-colors shrink-0" />
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
          {pool.name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {pool.role === "commissioner" && (
          <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Shield className="w-2.5 h-2.5" />
            Commish
          </span>
        )}
      </div>
    </Link>
  );

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
          {renderGameIcon(currentGame, "w-4.5 h-4.5 sm:w-5 sm:h-5")}
        </div>
      </Link>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left shrink-0 ${isOpen ? "z-50" : "z-20"} ${className}`}>
      {/* Clickable Trigger (Angled Football for Pick'em, Trophy for Bracket, Grid for Squares) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 -ml-1 sm:-ml-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer select-none"
        title="Switch PocketPicks games & active pools"
        aria-label="PocketPicks Hub Navigation"
        aria-expanded={isOpen}
      >
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${currentGameConfig.badgeBg} flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0`}
        >
          {renderGameIcon(currentGame, "w-4.5 h-4.5 sm:w-5 sm:h-5")}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu (Compact All-in-One Hub) */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
            {/* Header with quick Join & Create buttons */}
            <div className="flex items-center justify-between px-3.5 pb-2 border-b border-slate-100 dark:border-slate-800/80 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  PocketPicks Hub
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {totalCount}
                </span>
              </div>

              {(onJoin || onCreate) && (
                <div className="flex items-center gap-1">
                  {onJoin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onJoin();
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      title="Join a pool with code"
                    >
                      <LogIn className="w-2.5 h-2.5" />
                      Join
                    </button>
                  )}
                  {onCreate && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onCreate();
                      }}
                      className={`flex items-center gap-1 px-2 py-1 ${currentGameConfig.badgeBg} hover:opacity-90 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs`}
                      title="Create a new pool"
                    >
                      <PlusCircle className="w-2.5 h-2.5" />
                      New
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span className="text-xs">Loading your pools...</span>
              </div>
            ) : (
              <div className="space-y-3 px-1">
                {/* 1. Pick'em Section */}
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <FootballIcon className="w-4 h-4" />
                      NFL Pick&apos;em ({pickemPools.length})
                    </span>
                    <Link
                      href="/"
                      onClick={() => setIsOpen(false)}
                      className="text-[9px] font-bold hover:underline opacity-80"
                    >
                      Open Game &rarr;
                    </Link>
                  </div>
                  {pickemPools.length > 0 ? (
                    <div className="space-y-0.5">{pickemPools.map(renderPoolRow)}</div>
                  ) : (
                    <div className="px-3 py-1 text-[11px] text-slate-400 italic">None joined</div>
                  )}
                </div>

                {/* 2. Squares Section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Grid className="w-3 h-3" />
                      Super Bowl Squares ({squaresPools.length})
                    </span>
                    <Link
                      href="/squares"
                      onClick={() => setIsOpen(false)}
                      className="text-[9px] font-bold hover:underline opacity-80"
                    >
                      Open Game &rarr;
                    </Link>
                  </div>
                  {squaresPools.length > 0 ? (
                    <div className="space-y-0.5">{squaresPools.map(renderPoolRow)}</div>
                  ) : (
                    <div className="px-3 py-1 text-[11px] text-slate-400 italic">None joined</div>
                  )}
                </div>

                {/* 3. Bracket Section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="w-3 h-3" />
                      Playoff Brackets ({bracketPools.length})
                    </span>
                    <Link
                      href="/bracket"
                      onClick={() => setIsOpen(false)}
                      className="text-[9px] font-bold hover:underline opacity-80"
                    >
                      Open Game &rarr;
                    </Link>
                  </div>
                  {bracketPools.length > 0 ? (
                    <div className="space-y-0.5">{bracketPools.map(renderPoolRow)}</div>
                  ) : (
                    <div className="px-3 py-1 text-[11px] text-slate-400 italic">None joined</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
