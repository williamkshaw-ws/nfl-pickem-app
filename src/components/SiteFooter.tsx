"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Shield, CheckCircle2, Zap, Lock, Sparkles, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function SiteFooter() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // On active league pages, mobile navigation tabs sit fixed at the bottom.
  // Add extra bottom padding so the footer content is never hidden behind the navigation.
  const isLeaguePage = pathname?.startsWith("/league/");

  return (
    <footer
      className={`border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 text-xs transition-colors mt-auto ${
        isLeaguePage ? "pb-24 md:pb-10 pt-10" : "py-12"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12 pb-10 border-b border-slate-100 dark:border-slate-800/80">
          {/* Column 1: Branding & Description */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-slate-900 dark:text-white">
                  PocketPicks
                </span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 tracking-wider">
                  NFL
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              The modern, headache-free platform for NFL Weekly Pick&apos;em and Eliminator Survivor Pools. Built for friends, family, and office leagues.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live ESPN Score Sync</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200 dark:border-slate-700">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Anti-Peeking Locks</span>
              </div>
            </div>
          </div>

          {/* Column 2: Game Modes */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              Game Modes
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Weekly NFL Pick&apos;em</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span>Eliminator / Survivor</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>3-Tier MNF Tiebreakers</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                <span>Season Championship</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Features */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              League Features
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Zap className="w-3.5 h-3.5 text-cyan-500" />
                <span>Real-Time League Picks Board</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Automatic Kickoff Locks</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="w-3.5 h-3.5 text-center font-bold text-[10px] text-emerald-500">5#</span>
                <span>Instant 5-Digit Invite Codes</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                <span>Commissioner Audit &amp; Overrides</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Theme Switcher */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} PocketPicks. All rights reserved.</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>NFL Pick&apos;em &amp; Survivor Pool Platform</span>
          </div>

          {/* Quick theme switcher */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Theme:</span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Light mode"
                className={`p-1 rounded-md transition-all ${
                  theme === "light"
                    ? "bg-white text-amber-500 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                title="Dark mode"
                className={`p-1 rounded-md transition-all ${
                  theme === "dark"
                    ? "bg-slate-700 text-emerald-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                title="System theme"
                className={`p-1 rounded-md transition-all ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-700 text-blue-500 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
