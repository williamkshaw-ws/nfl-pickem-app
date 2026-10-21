"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, ChevronDown, Check, Grid, Shield, Loader2, LogIn, PlusCircle, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useUserAllPools, UnifiedPoolItem } from "@/lib/useUserAllPools";
import { FootballIcon } from "@/components/FootballIcon";
import { PoolLeaveModal } from "@/components/PoolLeaveModal";

export type GameKey = "pickem" | "bracket" | "squares";

interface GameSwitcherDropdownProps {
  currentGame: GameKey;
  className?: string;
  currentLeagueId?: string;
  currentPoolId?: string;
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
  currentLeagueId,
  currentPoolId,
  onJoin,
  onCreate,
}: GameSwitcherDropdownProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<string>("");
  const [poolToLeave, setPoolToLeave] = useState<UnifiedPoolItem | null>(null);
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

  // Sync current query param when dropdown opens or pathname changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setCurrentQueryId(params.get("id") || params.get("code") || "");
    }
  }, [isOpen, pathname]);

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

  const isCurrentPool = (pool: UnifiedPoolItem) => {
    // 1. Explicit props check
    if (currentLeagueId && pool.gameType === "pickem") {
      if (pool.id.toLowerCase() === currentLeagueId.toLowerCase()) return true;
    }
    if (currentPoolId) {
      if (pool.id.toLowerCase() === currentPoolId.toLowerCase()) return true;
    }

    // 2. Pick'em route check
    if (pool.gameType === "pickem") {
      if (pathname && pathname.startsWith("/league/")) {
        const routeId = decodeURIComponent(pathname.replace(/^\/league\//, "").split("/")[0]).toLowerCase();
        if (pool.id.toLowerCase() === routeId) return true;
      }
      if (pathname === "/" || pathname === "") {
        const lastLeague = typeof window !== "undefined" ? localStorage.getItem("last_active_league")?.toLowerCase() : null;
        if (lastLeague && pool.id.toLowerCase() === lastLeague) return true;
      }
    }

    // 3. Squares route check
    if (pool.gameType === "squares" && pathname && pathname.startsWith("/squares")) {
      const activeId = currentQueryId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("code") : "");
      if (activeId) {
        if (pool.id.toLowerCase() === activeId.toLowerCase()) return true;
      } else {
        const lastSquares = typeof window !== "undefined" ? localStorage.getItem("last_active_squares_board")?.toLowerCase() : null;
        if (lastSquares && pool.id.toLowerCase() === lastSquares) return true;
      }
    }

    // 4. Bracket route check
    if (pool.gameType === "bracket" && pathname && pathname.startsWith("/bracket")) {
      const activeId = currentQueryId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("code") : "");
      if (activeId) {
        if (pool.id.toLowerCase() === activeId.toLowerCase()) return true;
      } else {
        const lastBracket = typeof window !== "undefined" ? localStorage.getItem("last_active_bracket_pool")?.toLowerCase() : null;
        if (lastBracket && pool.id.toLowerCase() === lastBracket) return true;
      }
    }

    return false;
  };

  const getPoolHighlightClasses = (gameType: UnifiedPoolItem["gameType"]) => {
    switch (gameType) {
      case "squares":
        return {
          container: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 dark:border-amber-500/40",
          dot: "bg-amber-500 ring-2 ring-amber-500/30 dark:ring-amber-400/30",
          text: "font-black text-amber-950 dark:text-amber-100",
          hoverText: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
          hoverDot: "group-hover:bg-amber-500",
        };
      case "bracket":
        return {
          container: "bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/30 dark:border-purple-500/40",
          dot: "bg-purple-500 ring-2 ring-purple-500/30 dark:ring-purple-400/30",
          text: "font-black text-purple-950 dark:text-purple-100",
          hoverText: "group-hover:text-purple-600 dark:group-hover:text-purple-400",
          hoverDot: "group-hover:bg-purple-500",
        };
      case "pickem":
      default:
        return {
          container: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-500/40",
          dot: "bg-emerald-500 ring-2 ring-emerald-500/30 dark:ring-emerald-400/30",
          text: "font-black text-emerald-950 dark:text-emerald-100",
          hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
          hoverDot: "group-hover:bg-emerald-500",
        };
    }
  };

  const renderPoolRow = (pool: UnifiedPoolItem) => {
    const isCurrent = isCurrentPool(pool);
    const highlight = getPoolHighlightClasses(pool.gameType);

    return (
      <div
        key={`${pool.gameType}-${pool.id}`}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl transition-all group ${
          isCurrent
            ? `${highlight.container} border shadow-2xs`
            : "hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent"
        }`}
      >
        <Link
          href={pool.href}
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 min-w-0 flex-1 py-0.5 cursor-pointer"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
              isCurrent
                ? highlight.dot
                : `bg-slate-300 dark:bg-slate-600 ${highlight.hoverDot}`
            }`}
          />
          <span
            className={`text-xs truncate transition-colors ${
              isCurrent
                ? highlight.text
                : `font-semibold text-slate-700 dark:text-slate-200 ${highlight.hoverText}`
            }`}
          >
            {pool.name}
          </span>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          {pool.role === "commissioner" && (
            <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Shield className="w-2 h-2" />
              Commish
            </span>
          )}
          <button
            type="button"
            title={pool.role === "commissioner" ? "Leave / Reassign / Delete" : "Leave Pool"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              setPoolToLeave(pool);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

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

                {/* 2. Bracket Section */}
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

                {/* 3. Squares Section */}
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
              </div>
            )}
          </div>
        </>
      )}

      {/* Pool Leave & Commissioner Reassign/Delete Modal */}
      <PoolLeaveModal
        isOpen={Boolean(poolToLeave)}
        onClose={() => setPoolToLeave(null)}
        pool={poolToLeave}
        onSuccess={() => {
          refetch();
          setPoolToLeave(null);
        }}
      />
    </div>
  );
}
