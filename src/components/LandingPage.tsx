"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Shield,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Flame,
  Users,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Check,
  Crown,
  Smartphone,
  Zap,
  HelpCircle,
  Eye,
  Sliders,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function LandingPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [inviteCode, setInviteCode] = useState("");
  const [activeDemoTab, setActiveDemoTab] = useState<"pickem" | "survivor">("pickem");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inviteCode.trim().toUpperCase();
    if (clean.length > 0) {
      router.push(`/auth/register?join=${clean}`);
    } else {
      router.push("/auth/register");
    }
  };

  const faqs = [
    {
      q: "Is PocketPicks free to use?",
      a: "Yes, 100% free! There are no entry fees, subscription paywalls, or limits on how many friends or coworkers you can invite to your league.",
    },
    {
      q: "How does the Eliminator / Survivor pool work?",
      a: "Each week, pick one NFL team to win their game. If they win, you advance to the next week; if they lose or tie, you are eliminated. The catch? You can only select each team once per season, so strategic planning is key!",
    },
    {
      q: "Can we run both Pick'em and Survivor in the same league?",
      a: "Absolutely! Commissioners can enable Pick'em, Survivor, or both. When both are enabled, members can make their weekly game picks and their survivor lock in one streamlined view.",
    },
    {
      q: "How do tiebreakers work for Weekly Pick'em?",
      a: "We use a fair 3-tier tiebreaker on the final game of the week (usually Monday Night Football). Tiebreakers evaluate: (1) Closest to the total combined game score, (2) Closest to the home team's actual score, and (3) Closest to the away team's score.",
    },
    {
      q: "Can other players see my picks before games start?",
      a: "Never. Anti-peeking game locks keep everyone's picks strictly hidden until the respective game kicks off. Once kickoff occurs, selections are unveiled in the live Pick Matrix.",
    },
    {
      q: "Do commissioners need to enter scores manually?",
      a: "No! PocketPicks automatically syncs live scores, statuses, and final results directly from ESPN every 45 seconds during game days.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-emerald-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                PocketPicks
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 tracking-wider">
                  NFL
                </span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Features
            </a>
            <a href="#modes" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Game Modes
            </a>
            <a href="#how-it-works" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              FAQ
            </a>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Theme switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Light mode"
                className={`p-1.5 rounded-lg transition-all ${
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
                className={`p-1.5 rounded-lg transition-all ${
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
                className={`p-1.5 rounded-lg transition-all ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-700 text-blue-500 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>

            <Link
              href="/auth/login"
              className="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Sign In
            </Link>

            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        {/* Subtle decorative background gradient glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-400/10 dark:bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold mb-6 animate-fade-in shadow-xs">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>The Modern NFL Pick&apos;em &amp; Survivor Pool Platform</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.08]">
            Run your NFL pool without the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400">
              headaches.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Automated ESPN live scores, anti-peeking game locks, 3-tier tiebreakers, and real-time pick matrices. Built for friends, family, and office leagues.
          </p>

          {/* Call to action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Create Free League</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm sm:text-base border border-slate-200 dark:border-slate-800 shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Join with Code</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          <p className="mt-3.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
            100% Free • No credit card • Instant 30-second setup
          </p>

          {/* ─────────────────────────────────────────────────────────────
              3. INTERACTIVE PRODUCT DEMO / MOCKUP
          ───────────────────────────────────────────────────────────── */}
          <div className="mt-14 max-w-4xl mx-auto text-left">
            <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-xl">
              {/* Fake App Header Bar */}
              <div className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                    🏈
                  </div>
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      Sunday Gridiron Club
                      <span className="text-[10px] text-slate-400 font-semibold">&apos;26</span>
                    </div>
                  </div>
                </div>

                {/* Demo Tab Toggle */}
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-900/80 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveDemoTab("pickem")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeDemoTab === "pickem"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Weekly Pick&apos;em
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDemoTab("survivor")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeDemoTab === "survivor"
                        ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Survivor Pool
                  </button>
                </div>
              </div>

              {/* Fake App Body Content */}
              <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/40">
                {activeDemoTab === "pickem" ? (
                  <div className="space-y-4">
                    {/* Live Game Matchup Card Mock */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          <strong className="text-slate-900 dark:text-white font-bold">4th Quarter • 2:14</strong>
                        </span>
                        <span className="text-[11px] uppercase font-bold text-slate-400">Week 5 Matchup</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3">
                        {/* Team Away */}
                        <div className="p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-red-700 text-white font-black text-xs flex items-center justify-center">
                              KC
                            </div>
                            <div>
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white">Chiefs</div>
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">✓ Picked by you</div>
                            </div>
                          </div>
                          <span className="text-xl font-black text-slate-900 dark:text-white">28</span>
                        </div>

                        {/* Team Home */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between opacity-80">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-black text-xs flex items-center justify-center">
                              BUF
                            </div>
                            <div>
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white">Bills</div>
                              <div className="text-[11px] text-slate-400 font-medium">Spread: -1.5</div>
                            </div>
                          </div>
                          <span className="text-xl font-black text-slate-900 dark:text-white">24</span>
                        </div>
                      </div>
                    </div>

                    {/* Matrix Snippet */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                      <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 font-bold uppercase text-[10px] text-slate-500 tracking-wider flex justify-between">
                        <span>Live Pick Matrix</span>
                        <span>Correct / Remaining</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="px-4 py-2.5 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white font-black flex items-center justify-center text-[10px]">
                              W
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">William (You)</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                              #1
                            </span>
                          </div>
                          <div className="font-black text-slate-900 dark:text-white">
                            12/15 <span className="text-emerald-600 font-semibold">(80%)</span>
                          </div>
                        </div>

                        <div className="px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-black flex items-center justify-center text-[10px]">
                              S
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">Sarah J.</span>
                          </div>
                          <div className="font-black text-slate-900 dark:text-white">
                            11/15 <span className="text-slate-400 font-semibold">(73%)</span>
                          </div>
                        </div>

                        <div className="px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-amber-600 text-white font-black flex items-center justify-center text-[10px]">
                              M
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">Big Mike</span>
                          </div>
                          <div className="font-black text-slate-900 dark:text-white">
                            10/15 <span className="text-slate-400 font-semibold">(66%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Survivor Mockup View */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500" />
                        <span>Survivor Battle: <strong>3 Alive</strong> • 1 Eliminated</span>
                      </div>
                      <span className="text-xs text-amber-700/80 dark:text-amber-400/80">Week 5 Lock</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">Player</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Wk 1</th>
                            <th className="p-3 text-center">Wk 2</th>
                            <th className="p-3 text-center">Wk 3</th>
                            <th className="p-3 text-center">Wk 4</th>
                            <th className="p-3 text-center">Wk 5</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          <tr>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">William (You)</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px]">
                                ALIVE
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-600">SEA ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">CLE ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">GB ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">PIT ✓</td>
                            <td className="p-3 text-center font-black text-indigo-600 dark:text-indigo-400">KC (Yours)</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">Sarah J.</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px]">
                                ALIVE
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-600">MIA ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">BUF ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">DET ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">PHI ✓</td>
                            <td className="p-3 text-center text-slate-400 font-medium">🔒 Hidden</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">Coach Tom</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-black text-[10px]">
                                OUT W3
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-600">DAL ✓</td>
                            <td className="p-3 text-center font-bold text-emerald-600">BAL ✓</td>
                            <td className="p-3 text-center font-bold text-rose-600">CAR ✗</td>
                            <td className="p-3 text-center text-slate-300">—</td>
                            <td className="p-3 text-center text-slate-300">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. TWO GAME MODES (PICK'EM & SURVIVOR)
      ───────────────────────────────────────────────────────────── */}
      <section id="modes" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Dual Formats
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Two iconic formats. One unified league.
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Run both games in parallel or choose your league&apos;s favorite format with one switch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Mode 1: Weekly Pick'em */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-7 sm:p-9 border border-slate-200 dark:border-slate-800 relative flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="inline-block text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 mb-3 tracking-wider">
                  Weekly Leaderboards
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Weekly NFL Pick&apos;em
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Predict every matchup of the NFL week straight up or with point spreads. Tally points, climb season standings, and chase weekly winner titles.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>3-tier Monday Night Football tiebreaker</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Live Pick Matrix unveiling right at kickoff</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Season rankings with games back (GB) &amp; rank moves</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>Play all 18 regular season weeks</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Mode 2: Survivor Pool */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-7 sm:p-9 border border-slate-200 dark:border-slate-800 relative flex flex-col justify-between hover:border-amber-500/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="inline-block text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 mb-3 tracking-wider">
                  High-Stakes Survival
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Eliminator / Survivor
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Pick one winning team each week. If they triumph, you survive to next week. If they stumble or tie, you are eliminated.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Can only pick each team once all season</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Opponent locks kept strictly hidden until game start</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Sole Survivor crowning or longest-survival tiebreaks</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                <span>Survive until the final whistle</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. KEY FEATURES / COMMISSIONER PERKS
      ───────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Built for Real Leagues
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Features commissioners &amp; players rave about
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Everything you need for clean competition without wrestling with spreadsheets.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Anti-Peeking Game Locks</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Picks are completely masked until kickoff. Players can never copy an opponent&apos;s picks right before deadline.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Live ESPN Score Sync</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Scores and winner decisions update automatically in real-time. No commissioner score entry needed.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Eye className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">The Pick Matrix</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                A birds-eye view grid showing all league members, selections, and live winning percentages side-by-side.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <Sliders className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Commissioner Hub</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Override picks for friends who texted late, adjust tiebreaker rules, and easily manage rosters with full audit control.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Mobile-First Experience</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Engineered for quick thumb taps on your phone browser while you watch the game at a bar or on the couch.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Instant 5-Digit Invite Codes</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Invite friends via a short 5-character code or direct link with optional league password protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. HOW IT WORKS (3 SIMPLE STEPS)
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Quick Setup
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Up and running in 30 seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center sm:text-left space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center mx-auto sm:mx-0 shadow-sm shadow-emerald-600/30">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create or Join a League</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Start a new league in one click, or enter your commissioner&apos;s 5-character invite code to join.
              </p>
            </div>

            <div className="text-center sm:text-left space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center mx-auto sm:mx-0 shadow-sm shadow-emerald-600/30">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Make Your Weekly Picks</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Tap your predicted game winners and survivor lock before kickoff. Picks stay locked and hidden until game time.
              </p>
            </div>

            <div className="text-center sm:text-left space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center mx-auto sm:mx-0 shadow-sm shadow-emerald-600/30">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Track the Drama Live</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Watch the Pick Matrix update in real-time on Sunday and Monday as final scores roll in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. QUICK JOIN WITH CODE BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-emerald-600 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
            Have an invite code from your commissioner?
          </h3>
          <p className="mt-2 text-emerald-100 text-xs sm:text-sm max-w-md mx-auto">
            Enter the 5-character league code below to jump straight in.
          </p>

          <form onSubmit={handleQuickJoin} className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-sm mx-auto">
            <input
              type="text"
              maxLength={5}
              placeholder="e.g. 10047"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full sm:w-auto flex-1 uppercase tracking-widest text-center sm:text-left font-black px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm outline-none shadow-md border border-white"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-md transition-all active:scale-95"
            >
              Join League
            </button>
          </form>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. FAQ ACCORDION SECTION
      ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-white dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Answers
            </span>
            <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    <span>{faq.q}</span>
                    <span className="text-slate-400 font-black text-lg">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. BOTTOM CALL TO ACTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25 mb-6">
            <Trophy className="w-7 h-7" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight max-w-xl mx-auto">
            Ready for Sunday kickoff?
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-md mx-auto">
            Create your league in seconds, share your 5-digit code with friends, and start making your picks.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm sm:text-base border border-slate-200 dark:border-slate-800 shadow-xs transition-all"
            >
              Sign In to Your League
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-black">
              <Trophy className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-slate-900 dark:text-white text-sm">PocketPicks</span>
            <span>• NFL Pick&apos;em &amp; Survivor Pool</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/auth/register" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Create Account
            </Link>
            <span>&copy; {new Date().getFullYear()} PocketPicks</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
