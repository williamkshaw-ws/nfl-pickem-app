"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Shield,
  CheckCircle2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Lock,
  Users,
  ChevronRight,
  Check,
  Crown,
  Smartphone,
  Zap,
  Sliders,
  X,
  XCircle,
  PlusCircle,
  Clock,
  Grid,
  Target,
  ChevronDown,
  LogIn,
  Eye,
  EyeOff,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { TeamLogo } from "@/components/TeamLogo";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

export function LandingPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [modalCode, setModalCode] = useState("");
  const [modalError, setModalError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLeagueName, setCreateLeagueName] = useState("");
  const [createFormat, setCreateFormat] = useState<"both" | "pickem" | "survivor">("both");

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeDemoTab, setActiveDemoTab] = useState<"picks" | "matrix" | "survivor" | "standings">("picks");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Close modals when pressing Escape key
  useEffect(() => {
    if (!showJoinModal && !showCreateModal && !showLoginModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowJoinModal(false);
        setShowCreateModal(false);
        setShowLoginModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showJoinModal, showCreateModal, showLoginModal]);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inviteCode.trim().toUpperCase();
    if (clean.length > 0) {
      setModalCode(clean);
    }
    setModalError("");
    setShowJoinModal(true);
  };

  const handleModalSubmit = (action: "register" | "login") => {
    const clean = modalCode.trim().toUpperCase();
    if (clean.length !== 5) {
      setModalError("Invite codes must be exactly 5 characters.");
      return;
    }
    setModalError("");
    setShowJoinModal(false);
    if (action === "register") {
      router.push(`/auth/register?join=${clean}`);
    } else {
      if (typeof window !== "undefined") {
        localStorage.setItem("pending_join_code", clean);
      }
      setLoginError("");
      setShowLoginModal(true);
    }
  };

  const handleCreateModalSubmit = (action: "register" | "login") => {
    const cleanName = createLeagueName.trim();
    if (typeof window !== "undefined" && cleanName) {
      localStorage.setItem("pending_create_league_name", cleanName);
      localStorage.setItem("pending_create_league_format", createFormat);
    }
    setShowCreateModal(false);
    if (action === "register") {
      const query = cleanName
        ? `?create=true&name=${encodeURIComponent(cleanName)}`
        : "?create=true";
      router.push(`/auth/register${query}`);
    } else {
      setLoginError("");
      setShowLoginModal(true);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      let email = loginIdentifier.trim();

      if (!email.includes("@")) {
        const lookupRes = await fetch("/api/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email }),
        });
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.email) {
          setLoginError(lookupData.error || "No account found with that username.");
          setLoginLoading(false);
          return;
        }
        email = lookupData.email;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword);

      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        setLoginError("Please verify your email before logging in.");
        setLoginLoading(false);
        return;
      }

      setShowLoginModal(false);

      const pendingJoin = typeof window !== "undefined" ? localStorage.getItem("pending_join_code") : null;
      if (pendingJoin && pendingJoin.length === 5) {
        localStorage.removeItem("pending_join_code");
        window.location.href = `/?join=${pendingJoin.toUpperCase()}`;
        return;
      }

      const pendingCreate = typeof window !== "undefined" ? localStorage.getItem("pending_create_league_name") : null;
      if (pendingCreate) {
        window.location.href = `/?create=true&name=${encodeURIComponent(pendingCreate)}`;
        return;
      }

      const lastLeague = typeof window !== "undefined" ? localStorage.getItem("last_active_league") : null;
      if (lastLeague) {
        window.location.href = `/league/${lastLeague}`;
        return;
      }

      try {
        const q = query(collection(db, "memberships"), where("userId", "==", userCredential.user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const firstLeagueId = snapshot.docs[0].data().leagueId;
          if (typeof window !== "undefined") {
            localStorage.setItem("last_active_league", firstLeagueId);
          }
          window.location.href = `/league/${firstLeagueId}`;
          return;
        }
      } catch (err) {
        console.error("Failed to query user leagues on login:", err);
      }

      window.location.href = "/";
    } catch (err: any) {
      if (err.code === "auth/user-disabled") {
        setLoginError("This account has been disabled.");
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setLoginError("Invalid username, email, or password.");
      } else if (err.code === "auth/too-many-requests") {
        setLoginError("Too many failed attempts. Please try again later.");
      } else if (err.code === "auth/network-request-failed") {
        setLoginError("Network error. Please check your connection.");
      } else {
        setLoginError(err.message || "Failed to sign in.");
      }
      setLoginLoading(false);
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
      a: "Never. Anti-peeking game locks keep everyone's picks strictly hidden until the respective game kicks off. Once kickoff occurs, selections are unveiled in the live League Picks board.",
    },
    {
      q: "Do commissioners need to enter scores manually?",
      a: "No! PocketPicks automatically syncs live scores, statuses, and final results directly from ESPN every 45 seconds during game days.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-emerald-500 selection:text-white scroll-smooth">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                PocketPicks
              </span>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 tracking-wider">
                NFL
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

          {/* Right Controls: Single line on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setLoginError("");
                setShowLoginModal(true);
              }}
              className="px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 active:scale-95 transition-all whitespace-nowrap"
            >
              <span>Create League</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
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
            Automated ESPN live scores, anti-peeking game locks, 3-tier tiebreakers, and real-time league picks boards. Built for friends, family, and office leagues.
          </p>

          {/* Call to action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Create Free League</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setModalError("");
                setShowJoinModal(true);
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm sm:text-base border border-slate-200 dark:border-slate-800 shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Join with Code</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <p className="mt-3.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
            100% Free • No credit card • Instant 30-second setup
          </p>

          {/* ─────────────────────────────────────────────────────────────
              3. AUTHENTIC APP INTERACTIVE PREVIEW
          ───────────────────────────────────────────────────────────── */}
          <div className="mt-14 max-w-5xl mx-auto text-left">
            <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
              {/* Authentic App Header Strip (Matches Header.tsx exactly) */}
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 dark:bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center min-w-0 gap-2">
                    <h3 className="font-extrabold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white truncate flex items-center gap-1 sm:gap-1.5">
                      Sunday Gridiron Club <span className="text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">&apos;26</span>
                    </h3>

                    <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />

                    <div className="relative flex items-center flex-shrink-0 bg-slate-100/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm py-1 sm:py-1.5 pl-2.5 sm:pl-3 pr-7 sm:pr-8 rounded-md sm:rounded-lg border border-slate-200/80 dark:border-slate-700">
                      <span>Week 5</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    J
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">Jimmy</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-tight">Account</span>
                  </div>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400 ml-1" />
                </div>
              </div>

              {/* Authentic App Navigation Tabs Bar */}
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center gap-6 sm:gap-8 overflow-x-auto text-xs sm:text-sm font-bold no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveDemoTab("picks")}
                  className={`py-3.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDemoTab === "picks"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>My Picks</span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md inline-block min-w-[36px] text-center bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    15/15
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDemoTab("matrix")}
                  className={`py-3.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDemoTab === "matrix"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  <span>League Picks</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDemoTab("survivor")}
                  className={`py-3.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDemoTab === "survivor"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Target className="w-4 h-4" />
                  <span>Survivor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDemoTab("standings")}
                  className={`py-3.5 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeDemoTab === "standings"
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  <span>Season Standings</span>
                </button>
              </div>

              {/* Authentic Content Area based on Tab */}
              <div className="p-4 sm:p-6 bg-slate-50/60 dark:bg-slate-950/50">
                {activeDemoTab === "picks" && (
                  <div className="space-y-4">
                    {/* Week Subheader (Matches WeeklyPicks.tsx) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                          Week 5 Picks
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Picking as <strong className="text-slate-800 dark:text-slate-200">Jimmy</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-fit shadow-xs">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Next kickoff: <strong className="text-slate-800 dark:text-slate-200">Sun 1:00 PM</strong></span>
                      </div>
                    </div>

                    {/* Survivor Pool Health & Status Banner (Matches WeeklyPicks.tsx) */}
                    <div className="rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-colors bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-800/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white shadow-xs">
                            <Target className="w-3.5 h-3.5 text-rose-400" />
                            Survivor
                          </span>

                          <div className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>You are Alive</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1 rounded-full">
                            <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>
                              <strong className="text-slate-900 dark:text-white">3</strong> of 4 survivors alive
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium bg-white/60 dark:bg-slate-800/60 sm:bg-transparent px-2 sm:px-0 py-1 sm:py-0 rounded-lg sm:rounded-none">
                            <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span>
                              Next kickoff: <strong className="text-slate-800 dark:text-slate-200">Sun 1:00 PM</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matchup Card 1: Live Game (KC @ BUF) */}
                    <div className="bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-xs flex flex-col border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-300/30 dark:ring-emerald-700/30">
                      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Sun 1:00 PM</span>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <span>KC -2.5</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300/60 dark:border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>4th 2:14</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
                        {/* Chiefs (Away - Selected + Survivor Pick) */}
                        <div className="flex-1 min-w-0 p-3 flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/40">
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamLogo
                              src="https://a.espncdn.com/i/teamlogos/nfl/500/kc.png"
                              alt="KC"
                              width={28}
                              height={28}
                              className="w-7 h-7 object-contain shrink-0"
                            />
                            <div className="text-left min-w-0">
                              <div className="text-sm font-bold leading-tight truncate text-emerald-900 dark:text-emerald-200">
                                Kansas City Chiefs
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">4-0 • Away</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-900 dark:text-white">28</span>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold bg-rose-500 text-white shadow-xs whitespace-nowrap">
                              <Target className="w-3 h-3" />
                              <span>Survivor</span>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          </div>
                        </div>

                        {/* Bills (Home) */}
                        <div className="flex-1 min-w-0 p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamLogo
                              src="https://a.espncdn.com/i/teamlogos/nfl/500/buf.png"
                              alt="BUF"
                              width={28}
                              height={28}
                              className="w-7 h-7 object-contain shrink-0"
                            />
                            <div className="text-left min-w-0">
                              <div className="text-sm font-bold leading-tight truncate text-slate-900 dark:text-white">
                                Buffalo Bills
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">3-1 • Home</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-400 dark:text-slate-500">24</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matchup Card 2: Final Game (DET @ BAL) */}
                    <div className="bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-xs flex flex-col border-rose-300 dark:border-rose-900 bg-rose-50/10 dark:bg-rose-950/10">
                      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Sun 4:25 PM</span>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <span>BAL -3.0</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Final</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
                        {/* Lions (Away - Selected) */}
                        <div className="flex-1 min-w-0 p-3 flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/40">
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamLogo
                              src="https://a.espncdn.com/i/teamlogos/nfl/500/det.png"
                              alt="DET"
                              width={28}
                              height={28}
                              className="w-7 h-7 object-contain shrink-0"
                            />
                            <div className="text-left min-w-0">
                              <div className="text-sm font-bold leading-tight truncate text-emerald-900 dark:text-emerald-200">
                                Detroit Lions
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">4-1 • Away</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-400 dark:text-slate-500">21</span>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          </div>
                        </div>

                        {/* Ravens (Home - Winner) */}
                        <div className="flex-1 min-w-0 p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamLogo
                              src="https://a.espncdn.com/i/teamlogos/nfl/500/bal.png"
                              alt="BAL"
                              width={28}
                              height={28}
                              className="w-7 h-7 object-contain shrink-0"
                            />
                            <div className="text-left min-w-0">
                              <div className="text-sm font-bold leading-tight truncate text-slate-900 dark:text-white">
                                Baltimore Ravens
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">3-2 • Home</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-900 dark:text-white">24</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/70 px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center text-xs">
                        <span className="flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      </div>
                    </div>

                    {/* Tiebreaker Section (Pick'em only - 100% matches WeeklyPicks.tsx) */}
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 shadow-xs mt-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">Tiebreaker Prediction</h3>
                          </div>
                          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                            Tampa Bay Buccaneers @ Atlanta Falcons
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/60 shadow-xs">
                            <div className="flex items-center gap-2">
                              <TeamLogo
                                src="https://a.espncdn.com/i/teamlogos/nfl/500/tb.png"
                                alt="TB"
                                width={22}
                                height={22}
                                className="w-5.5 h-5.5 object-contain shrink-0"
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-8 text-right">TB</span>
                              <div className="w-12 h-8 flex items-center justify-center text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md">
                                27
                              </div>
                            </div>
                            <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-8 flex items-center justify-center text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md">
                                24
                              </div>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-8">ATL</span>
                              <TeamLogo
                                src="https://a.espncdn.com/i/teamlogos/nfl/500/atl.png"
                                alt="ATL"
                                width={22}
                                height={22}
                                className="w-5.5 h-5.5 object-contain shrink-0"
                              />
                            </div>
                            <div className="border-l border-slate-100 dark:border-slate-800 pl-3 ml-1 flex flex-col items-center justify-center min-w-[40px]">
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Total</span>
                              <span className="text-sm font-black text-slate-700 dark:text-slate-200">51</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemoTab === "matrix" && (
                  <div className="space-y-4">
                    {/* Header and Controls (Matches PickMatrix.tsx) */}
                    <div className="flex items-end justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Week 5 League Picks</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                          Compare all league picks, live scores, points, and games back.
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tiebreaker Rules</span>
                      </div>
                    </div>

                    {/* Games Summary & Legend Bar (Matches PickMatrix.tsx) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span><strong>12</strong> of 16 games final (2 live)</span>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300/60 dark:border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>2 live</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Correct
                          </span>
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <span className="w-2 h-2 rounded-full bg-rose-500" /> Incorrect
                          </span>
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <Target className="w-3 h-3 text-rose-500" /> Survivor
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Compact League Picks Grid Table (Matches PickMatrix.tsx) */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-center border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 select-none">
                            <tr>
                              <th className="p-2 sm:p-2.5 text-left border-r border-slate-200 dark:border-slate-800 min-w-[130px]">Player</th>
                              <th className="p-2 sm:p-2.5 text-center border-r border-slate-200 dark:border-slate-800 min-w-[55px]">Score</th>
                              <th className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 min-w-[65px] bg-emerald-50/60 dark:bg-emerald-950/30">
                                <div className="text-[10px] font-black">KC @ BUF</div>
                                <div className="text-[9px] text-emerald-600 font-bold">28-24 4Q</div>
                              </th>
                              <th className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 min-w-[65px]">
                                <div className="text-[10px] font-black">DET @ BAL</div>
                                <div className="text-[9px] text-slate-500 font-bold">21-24 F</div>
                              </th>
                              <th className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 min-w-[65px]">
                                <div className="text-[10px] font-black">GB @ LAR</div>
                                <div className="text-[9px] text-slate-500 font-bold">24-19 F</div>
                              </th>
                              <th className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 min-w-[75px] bg-amber-50/60 dark:bg-amber-950/30">
                                <div className="text-[10px] font-black flex items-center justify-center gap-0.5 text-amber-900 dark:text-amber-200">
                                  <Sparkles className="w-2.5 h-2.5" /> TB @ ATL
                                </div>
                                <div className="text-[9px] text-amber-700 font-bold">MNF TB</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {/* Jimmy (You) */}
                            <tr className="bg-emerald-100/60 dark:bg-emerald-950/50">
                              <td className="p-2 sm:p-2.5 text-left border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                                    J
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Jimmy</span>
                                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                </div>
                              </td>
                              <td className="p-2 sm:p-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-black text-slate-900 dark:text-white">
                                12 - 2
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>KC</span>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <Target className="w-3 h-3 text-rose-500" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>DET</span>
                                  <X className="w-3.5 h-3.5 text-rose-500" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>GB</span>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-amber-500/10 font-bold text-amber-900 dark:text-amber-200">
                                <span>TB (27-24)</span>
                              </td>
                            </tr>

                            {/* Sarah M. */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="p-2 sm:p-2.5 text-left border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                                    S
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Sarah M.</span>
                                </div>
                              </td>
                              <td className="p-2 sm:p-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                                11 - 3
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>KC</span>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>BAL</span>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <Target className="w-3 h-3 text-rose-500" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>GB</span>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-amber-500/10 font-bold text-amber-900 dark:text-amber-200">
                                <span>ATL (20-23)</span>
                              </td>
                            </tr>

                            {/* Dave K. */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="p-2 sm:p-2.5 text-left border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                                    D
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Dave K.</span>
                                </div>
                              </td>
                              <td className="p-2 sm:p-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                                10 - 4
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>BUF</span>
                                  <X className="w-3.5 h-3.5 text-rose-500" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>BAL</span>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                                <div className="inline-flex items-center gap-1">
                                  <span>LAR</span>
                                  <X className="w-3.5 h-3.5 text-rose-500" />
                                </div>
                              </td>
                              <td className="p-1 sm:p-1.5 text-center border-r border-slate-200 dark:border-slate-800 bg-amber-500/10 font-bold text-amber-900 dark:text-amber-200">
                                <span>TB (24-21)</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemoTab === "survivor" && (
                  <div className="space-y-4">
                    {/* Header (Matches EliminatorPool.tsx) */}
                    <div className="flex items-end justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Survivor Pool</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                          Pick one winner every week. Lose or tie and you&apos;re out.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span><strong>3 survivors alive</strong> entering Week 5 kickoff!</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
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
                            <tr className="bg-emerald-50/50 dark:bg-emerald-950/40">
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                                    J
                                  </div>
                                  <span>Jimmy (You)</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px] border border-emerald-300 dark:border-emerald-800">
                                  ALIVE
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600">KC ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">SF ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">BUF ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">DET ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  KC
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                                    S
                                  </div>
                                  <span>Sarah M.</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px] border border-emerald-300 dark:border-emerald-800">
                                  ALIVE
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600">BUF ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">DAL ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">KC ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">MIN ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">BAL ✓</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                                    D
                                  </div>
                                  <span>Dave K.</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px] border border-emerald-300 dark:border-emerald-800">
                                  ALIVE
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600">MIA ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">PHI ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">SEA ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">GB ✓</td>
                              <td className="p-3 text-center text-slate-400 font-medium">🔒 PHI</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-slate-600 text-white font-bold flex items-center justify-center text-xs">
                                    M
                                  </div>
                                  <span>Marcus T.</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-black text-[10px] border border-rose-300 dark:border-rose-900">
                                  OUT W3
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600">CIN ✓</td>
                              <td className="p-3 text-center font-bold text-emerald-600">BAL ✓</td>
                              <td className="p-3 text-center font-bold text-rose-600">NYJ ✗</td>
                              <td className="p-3 text-center text-slate-300 dark:text-slate-600">—</td>
                              <td className="p-3 text-center text-slate-300 dark:text-slate-600">—</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemoTab === "standings" && (
                  <div className="space-y-3">
                    {/* Headline strip - matches OverallStandings.tsx */}
                    <div className="flex items-center justify-between gap-3 border rounded-2xl px-4 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="font-bold truncate text-slate-900 dark:text-white">
                          Jimmy leads by 2
                        </span>
                      </div>
                      <span className="font-semibold whitespace-nowrap text-slate-500 dark:text-slate-400">
                        2026 • Thru Wk 5
                      </span>
                    </div>

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
                              <th className="py-2.5 px-3 text-center">Wk 5</th>
                              <th className="py-2.5 px-3 text-center">Move</th>
                              <th className="py-2.5 px-3 text-center">Titles</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {/* Jimmy (Rank 1 - You) */}
                            <tr className="bg-emerald-100/60 dark:bg-emerald-950/50">
                              <td className="py-2.5 pl-4 pr-2 font-black whitespace-nowrap text-slate-900 dark:text-white border-l-4 border-emerald-500">
                                <span className="text-amber-600">🥇</span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                    J
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Jimmy</span>
                                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-black text-slate-900 dark:text-white">62</span>
                                <span className="text-slate-400 dark:text-slate-500 text-xs">/75</span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                82.7%
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                                  12/15 <Trophy className="w-3 h-3 text-amber-500" />
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center text-emerald-600 text-[11px] font-bold">
                                  <ArrowUp className="w-3 h-3" />
                                  1
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                                  <Trophy className="w-3 h-3" /> 2
                                </span>
                              </td>
                            </tr>

                            {/* Sarah M. (Rank 2) */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 pl-5 pr-2 font-black whitespace-nowrap text-slate-700 dark:text-slate-300">
                                <span className="text-slate-600">🥈</span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                    S
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Sarah M.</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-black text-slate-900 dark:text-white">60</span>
                                <span className="text-slate-400 dark:text-slate-500 text-xs">/75</span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                80.0%
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                <span className="text-slate-700 dark:text-slate-300">2</span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  11/15
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Minus className="w-3 h-3 text-slate-300 mx-auto" />
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                                  <Trophy className="w-3 h-3" /> 1
                                </span>
                              </td>
                            </tr>

                            {/* Dave K. (Rank 3) */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 pl-5 pr-2 font-black whitespace-nowrap text-slate-700 dark:text-slate-300">
                                <span className="text-amber-700">🥉</span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                    D
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Dave K.</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-black text-slate-900 dark:text-white">57</span>
                                <span className="text-slate-400 dark:text-slate-500 text-xs">/75</span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                76.0%
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                <span className="text-slate-700 dark:text-slate-300">5</span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  10/15
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center text-rose-600 text-[11px] font-bold">
                                  <ArrowDown className="w-3 h-3" />
                                  1
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                                  <Trophy className="w-3 h-3" /> 1
                                </span>
                              </td>
                            </tr>

                            {/* Marcus T. (Rank 4) */}
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 pl-5 pr-2 font-bold whitespace-nowrap text-slate-500 dark:text-slate-400">
                                4
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-slate-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                    M
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">Marcus T.</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-black text-slate-900 dark:text-white">54</span>
                                <span className="text-slate-400 dark:text-slate-500 text-xs">/75</span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                                72.0%
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                <span className="text-slate-700 dark:text-slate-300">8</span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  9/15
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Minus className="w-3 h-3 text-slate-300 mx-auto" />
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap text-slate-400 text-xs">
                                —
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: compact rows matching OverallStandings.tsx */}
                      <div className="md:hidden">
                        <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <span className="text-center">#</span>
                          <span>Player</span>
                          <span className="text-right">Correct</span>
                          <span className="text-right">GB</span>
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {/* Jimmy (You) */}
                          <li className="bg-emerald-100/60 dark:bg-emerald-950/50">
                            <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2.5 text-left border-l-4 border-emerald-500 pl-2">
                              <div className="text-sm font-black text-center">🥇</div>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                  J
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1">
                                    <span>Jimmy</span>
                                    <Crown className="w-3 h-3 text-amber-500 fill-amber-400" />
                                  </div>
                                  <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 whitespace-nowrap font-semibold">
                                    <span>Wk5 12/15</span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <Trophy className="w-2.5 h-2.5" /> 2
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <span className="font-black text-base text-slate-900 dark:text-white">62</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">/75</span>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">82.7%</div>
                              </div>
                              <div className="text-right font-bold text-sm text-slate-300 dark:text-slate-600">—</div>
                            </div>
                          </li>

                          {/* Sarah M. */}
                          <li>
                            <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2.5 text-left">
                              <div className="text-sm font-bold text-center">🥈</div>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                  S
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    Sarah M.
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                    <span>Wk5 11/15</span>
                                    <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                                      <Trophy className="w-2.5 h-2.5" /> 1
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <span className="font-black text-base text-slate-900 dark:text-white">60</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">/75</span>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">80.0%</div>
                              </div>
                              <div className="text-right font-bold text-sm text-slate-700 dark:text-slate-300">2</div>
                            </div>
                          </li>

                          {/* Dave K. */}
                          <li>
                            <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2.5 text-left">
                              <div className="text-sm font-bold text-center">🥉</div>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                  D
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    Dave K.
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                    <span>Wk5 10/15</span>
                                    <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                                      <Trophy className="w-2.5 h-2.5" /> 1
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <span className="font-black text-base text-slate-900 dark:text-white">57</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">/75</span>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">76.0%</div>
                              </div>
                              <div className="text-right font-bold text-sm text-slate-700 dark:text-slate-300">5</div>
                            </div>
                          </li>

                          {/* Marcus T. */}
                          <li>
                            <div className="grid grid-cols-[2.25rem_1fr_auto_2.5rem] items-center gap-2 px-3 py-2.5 text-left">
                              <div className="text-sm font-bold text-slate-500 dark:text-slate-400 text-center">4</div>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-slate-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                  M
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    Marcus T.
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                    <span>Wk5 9/15</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <span className="font-black text-base text-slate-900 dark:text-white">54</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">/75</span>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">72.0%</div>
                              </div>
                              <div className="text-right font-bold text-sm text-slate-700 dark:text-slate-300">8</div>
                            </div>
                          </li>
                        </ul>
                      </div>
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
      <section id="modes" className="scroll-mt-20 py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
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
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-7 sm:p-9 border border-slate-200 dark:border-slate-800 relative flex flex-col justify-between">
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
                    <span>Live League Picks unveiling right at kickoff</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Season rankings with games back (GB) &amp; rank moves</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Mode 2: Survivor Pool */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-7 sm:p-9 border border-slate-200 dark:border-slate-800 relative flex flex-col justify-between">
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
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. KEY FEATURES / COMMISSIONER PERKS
      ───────────────────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-20 bg-slate-50 dark:bg-slate-950">
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
                <Grid className="w-5 h-5" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Live League Picks Board</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                A real-time birds-eye view grid showing all league members, selections, and live winning percentages side-by-side.
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
      <section id="how-it-works" className="scroll-mt-20 py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/40">
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
                Watch the League Picks board update in real-time on Sunday and Monday as final scores roll in.
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
            Enter the 5-character league code below to jump straight into your league.
          </p>

          <form onSubmit={handleQuickJoin} className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-sm mx-auto">
            <input
              type="text"
              maxLength={5}
              inputMode="numeric"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. 84920"
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
      <section id="faq" className="scroll-mt-20 py-20 bg-white dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80">
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
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 shrink-0 ${
                        isOpen ? "rotate-180 text-emerald-500" : "text-slate-400"
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 animate-fade-in">
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
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setModalError("");
                setShowJoinModal(true);
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm sm:text-base border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Join with Code</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. DEDICATED JOIN WITH CODE MODAL
      ───────────────────────────────────────────────────────────── */}
      {showJoinModal && (
        <div
          onClick={() => setShowJoinModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setShowJoinModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Join a League
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Enter the 5-digit invite code provided by your commissioner.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleModalSubmit("register");
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  5-Digit League Code
                </label>
                <input
                  type="text"
                  maxLength={5}
                  autoFocus
                  inputMode="numeric"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. 84920"
                  value={modalCode}
                  onChange={(e) => {
                    setModalCode(e.target.value.toUpperCase());
                    if (modalError) setModalError("");
                  }}
                  className="w-full text-center tracking-[0.3em] font-mono text-2xl font-black py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 uppercase transition-colors"
                />
                {modalError && (
                  <p className="text-rose-500 text-xs font-semibold mt-2">{modalError}</p>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={modalCode.trim().length !== 5}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Continue to Register &amp; Join</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleModalSubmit("login")}
                  disabled={modalCode.trim().length !== 5}
                  className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                >
                  Already have an account? Sign in and join →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          11. DEDICATED CREATE LEAGUE MODAL
      ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <PlusCircle className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create a League
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Start your free NFL Pick&apos;em and Survivor pool in seconds.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateModalSubmit("register");
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  League Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={50}
                  placeholder="e.g. Sunday Gridiron Club"
                  value={createLeagueName}
                  onChange={(e) => setCreateLeagueName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Pool Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateFormat("both")}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                      createFormat === "both"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Both Pools
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateFormat("pickem")}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                      createFormat === "pickem"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Pick&apos;em Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateFormat("survivor")}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                      createFormat === "survivor"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Survivor Only
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={!createLeagueName.trim()}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Continue to Register &amp; Create</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateModalSubmit("login")}
                  className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                >
                  Already have an account? Sign in to create →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          12. DEDICATED SIGN IN MODAL
      ───────────────────────────────────────────────────────────── */}
      {showLoginModal && (
        <div
          onClick={() => setShowLoginModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <LogIn className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Sign In
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Enter your username or email to access your leagues and picks.
            </p>

            {loginError && (
              <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Username or Email
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. jimmy or jimmy@example.com"
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value);
                    if (loginError) setLoginError("");
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    onClick={() => setShowLoginModal(false)}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={loginShowPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setLoginShowPassword(!loginShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {loginShowPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={loginLoading || !loginIdentifier.trim() || !loginPassword.trim()}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowCreateModal(true);
                    }}
                    className="font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    Create Free League →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowJoinModal(true);
                    }}
                    className="font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    Join with Code →
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
