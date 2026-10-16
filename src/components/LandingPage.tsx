"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Shield,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Users,
  ChevronRight,
  Check,
  Smartphone,
  Zap,
  Printer,
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
  Settings,
  Share2,
} from "lucide-react";
import { TeamLogo } from "@/components/TeamLogo";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { UserSettingsModal } from "@/components/UserSettingsModal";
import { GameSwitcherDropdown } from "@/components/GameSwitcherDropdown";

type PoolModeTab = "pickem" | "bracket" | "squares";

export function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [modalCode, setModalCode] = useState("");
  const [modalError, setModalError] = useState("");

  // Interactive Hero Preview Tab & Create Modal Pool Type
  const [previewTab, setPreviewTab] = useState<PoolModeTab>("pickem");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPoolType, setCreatePoolType] = useState<PoolModeTab>("pickem");
  const [createLeagueName, setCreateLeagueName] = useState("");
  const [createFormat, setCreateFormat] = useState<"both" | "pickem" | "survivor">("both");

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginResetMessage, setLoginResetMessage] = useState("");
  const [loginResetSending, setLoginResetSending] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

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

  const openStartPoolModal = (defaultType: PoolModeTab = "pickem") => {
    if (user) {
      if (defaultType === "bracket") {
        router.push("/bracket");
        return;
      }
      if (defaultType === "squares") {
        router.push("/squares");
        return;
      }
    }
    setCreatePoolType(defaultType);
    setShowCreateModal(true);
  };

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
    try {
      localStorage.removeItem("pending_redirect_after_auth");
    } catch {
      // Ignore storage errors
    }
    if (action === "register") {
      router.push(`/auth/register?join=${clean}`);
    } else {
      try {
        localStorage.setItem("pending_join_code", clean);
      } catch {
        // Ignore storage errors
      }
      setLoginError("");
      setShowLoginModal(true);
    }
  };

  const handleCreateModalSubmit = (action: "register" | "login") => {
    setShowCreateModal(false);

    // Standalone Playoff Bracket or Super Bowl Squares flow (no Pick'em league required)
    if (createPoolType === "bracket" || createPoolType === "squares") {
      const targetPath = createPoolType === "bracket" ? "/bracket" : "/squares";
      try {
        localStorage.setItem("pending_redirect_after_auth", targetPath);
        localStorage.removeItem("pending_create_league_name");
      } catch {
        // Ignore storage errors
      }
      if (action === "register") {
        router.push(`/auth/register?redirect=${encodeURIComponent(targetPath)}`);
      } else {
        setLoginError("");
        setShowLoginModal(true);
      }
      return;
    }

    // Pick'em & Survivor League flow
    const cleanName = createLeagueName.trim();
    try {
      localStorage.removeItem("pending_redirect_after_auth");
      if (cleanName) {
        localStorage.setItem("pending_create_league_name", cleanName);
        localStorage.setItem("pending_create_league_format", createFormat);
      }
    } catch {
      // Ignore storage errors
    }
    if (action === "register") {
      const queryStr = cleanName
        ? `?create=true&name=${encodeURIComponent(cleanName)}`
        : "?create=true";
      router.push(`/auth/register${queryStr}`);
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

      let pendingRedirect: string | null = null;
      let pendingJoin: string | null = null;
      let pendingCreate: string | null = null;
      try {
        pendingRedirect = localStorage.getItem("pending_redirect_after_auth");
        pendingJoin = localStorage.getItem("pending_join_code");
        pendingCreate = localStorage.getItem("pending_create_league_name");
      } catch {
        // Ignore storage errors
      }

      if (pendingRedirect && pendingRedirect.startsWith("/")) {
        try {
          localStorage.removeItem("pending_redirect_after_auth");
        } catch {}
        window.location.href = pendingRedirect;
        return;
      }

      if (pendingJoin && pendingJoin.length === 5) {
        try {
          localStorage.removeItem("pending_join_code");
        } catch {}
        window.location.href = `/?join=${pendingJoin.toUpperCase()}`;
        return;
      }

      if (pendingCreate) {
        window.location.href = `/?create=true&name=${encodeURIComponent(pendingCreate)}`;
        return;
      }

      try {
        const q = query(collection(db, "memberships"), where("userId", "==", userCredential.user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          let lastLeague: string | null = null;
          try {
            lastLeague = localStorage.getItem("last_active_league");
          } catch {}
          const matchingDoc = snapshot.docs.find((d) => d.data().leagueId === lastLeague);
          const targetLeagueId = matchingDoc ? matchingDoc.data().leagueId : snapshot.docs[0].data().leagueId;
          try {
            localStorage.setItem("last_active_league", targetLeagueId);
          } catch {}
          window.location.href = `/league/${targetLeagueId}`;
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

  const handleForgotPassword = async () => {
    setLoginError("");
    setLoginResetMessage("");
    const raw = loginIdentifier.trim();
    if (!raw) {
      setLoginError("Please enter your username or email above first, then click Forgot password.");
      return;
    }

    setLoginResetSending(true);
    try {
      let email = raw;
      if (!email.includes("@")) {
        const lookupRes = await fetch("/api/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email }),
        });
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.email) {
          setLoginError(lookupData.error || "No account found with that username.");
          setLoginResetSending(false);
          return;
        }
        email = lookupData.email;
      }

      await sendPasswordResetEmail(auth, email);
      setLoginResetMessage(`Password reset link sent to ${email}! Check your inbox.`);
    } catch (err: any) {
      setLoginError(err.message ? err.message.replace("Firebase: ", "") : "Failed to send reset email.");
    } finally {
      setLoginResetSending(false);
    }
  };

  const faqs = [
    {
      q: "Can I create just a Super Bowl Squares board or Playoff Bracket without a Pick'em league?",
      a: "Yes! All three games work independently. You can create a standalone Super Bowl Squares board, run a Playoff Bracket challenge, or host a full season-long Weekly Pick'em & Survivor league — whatever fits your group.",
    },
    {
      q: "Do players need an account to view a Super Bowl Squares board?",
      a: "No! Only the commissioner needs an account to set up and manage the Squares grid. Once published, you get a shareable view-only link that anyone can open on their phone or computer without logging in.",
    },
    {
      q: "Can we run both Weekly Pick'em and Survivor in the same league?",
      a: "Absolutely. Commissioners can enable Weekly Pick'em, Eliminator/Survivor, or both together so players make their weekly game picks and their Survivor lock on one screen.",
    },
    {
      q: "How do anti-peeking locks and tiebreakers work?",
      a: "Other players' picks remain strictly hidden until kickoff so nobody can copy selections early. Ties are broken automatically using a 3-tier tiebreaker on Monday Night Football (or the Super Bowl): closest to combined total points, then home score, then away score.",
    },
    {
      q: "Is PocketPicks free and do scores update automatically?",
      a: "PocketPicks is 100% free with no ads or player limits, and live scores, quarter payouts, and standings sync automatically from ESPN.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-emerald-500 selection:text-white scroll-smooth overflow-x-clip">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo & Game Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <GameSwitcherDropdown currentGame="pickem" />
            <Link href="/" className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white hover:opacity-90 transition-opacity">
              PocketPicks<span className="text-[10px] align-super font-bold text-emerald-600 dark:text-emerald-400 ml-0.5">TM</span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href="#modes" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              3 Ways to Play
            </a>
            <a href="#features" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              FAQ
            </a>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <div className={`w-4 h-4 rounded ${user.avatarColor || "bg-emerald-600"} text-white font-black flex items-center justify-center text-[9px] shrink-0`}>
                    {((user.name || user.username || user.email || "U").charAt(0) || "U").toUpperCase()}
                  </div>
                  <span>Settings</span>
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <Link
                  href="/"
                  className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 active:scale-95 transition-all whitespace-nowrap"
                >
                  <span>My Pools</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem("pending_redirect_after_auth");
                    } catch {}
                    setLoginError("");
                    setShowLoginModal(true);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => openStartPoolModal("pickem")}
                  className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>Start a Pool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header spacer */}
      <div className="h-14 sm:h-16 shrink-0" aria-hidden="true" />

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION + INTERACTIVE 3-GAME PREVIEW
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-10 sm:pt-16 sm:pb-20">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-400/10 dark:bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Pill Badge */}
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold mb-5 shadow-2xs">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Pick&apos;em &amp; Survivor
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Playoff Bracket
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Super Bowl Squares
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.08]">
            Run your NFL pools without the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400">
              headaches.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Host a season-long Pick&apos;em &amp; Survivor league, a postseason Playoff Bracket, or a 100-Square Super Bowl board. Automated live ESPN scores, zero spreadsheets.
          </p>

          {/* Call to action buttons */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => openStartPoolModal(previewTab)}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start a Free Pool</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setModalError("");
                setShowJoinModal(true);
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm sm:text-base border border-slate-200 dark:border-slate-800 shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Join League with Code</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <p className="mt-3 text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
            100% Free • Use any pool type independently • 30-second setup
          </p>

          {/* ─────────────────────────────────────────────────────────────
              3. INTERACTIVE 3-TAB PREVIEW SHOWCASE
          ───────────────────────────────────────────────────────────── */}
          <div className="mt-7 sm:mt-12 max-w-5xl mx-auto">
            {/* Mode Switcher Pills */}
            <div className="inline-flex p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4 max-w-full overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setPreviewTab("pickem")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  previewTab === "pickem"
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Pick&apos;em &amp; Survivor</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("bracket")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  previewTab === "bracket"
                    ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                <span>Playoff Bracket</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("squares")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  previewTab === "squares"
                    ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>Super Bowl Squares</span>
              </button>
            </div>

            {/* Preview Frame */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-xl overflow-hidden text-left">
              {previewTab === "pickem" && (
                <div>
                  {/* Header Strip */}
                  <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                        <Trophy className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center min-w-0 gap-2">
                        <h3 className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                          Sunday Gridiron Club <span className="text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">&apos;26</span>
                        </h3>
                        <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                          Week 6
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        14/14 Saved
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 sm:p-6 bg-slate-50/60 dark:bg-slate-950/50 space-y-3">
                    {/* Survivor Status Bar */}
                    <div className="rounded-2xl border p-3 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-slate-900 dark:bg-slate-800 text-white">
                          <Target className="w-3 h-3 text-rose-400" />
                          Survivor
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Alive (9 of 15 left)
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Anti-peeking active until kickoff
                      </span>
                    </div>

                    {/* Live Matchup Card */}
                    <div className="bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-xs border-emerald-300 dark:border-emerald-700">
                      <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                        <span>Sun 4:25 PM • KC -2.5</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          4th 2:14
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
                        <div className="flex-1 p-3 flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/40">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TeamLogo src="https://a.espncdn.com/i/teamlogos/nfl/500/kc.png" alt="KC" width={26} height={26} className="w-6.5 h-6.5 object-contain shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold truncate text-emerald-900 dark:text-emerald-200">Kansas City Chiefs</div>
                              <div className="text-[10px] text-slate-500">4-1 • Your Pick</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">28</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white">Survivor</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          </div>
                        </div>
                        <div className="flex-1 p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TeamLogo src="https://a.espncdn.com/i/teamlogos/nfl/500/buf.png" alt="BUF" width={26} height={26} className="w-6.5 h-6.5 object-contain shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white">Buffalo Bills</div>
                              <div className="text-[10px] text-slate-500">4-1 • Home</div>
                            </div>
                          </div>
                          <span className="text-base sm:text-lg font-black text-slate-400">24</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === "bracket" && (
                <div>
                  {/* Header Strip */}
                  <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                        <Trophy className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                        NFL Playoff Bracket Challenge
                      </h3>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shrink-0">
                      13 / 13 Picks
                    </span>
                  </div>

                  {/* Bracket Preview Body */}
                  <div className="p-3.5 sm:p-6 bg-slate-50/60 dark:bg-slate-950/50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      {/* AFC Championship */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          AFC Championship
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] opacity-80">#1</span> Buffalo Bills
                          </span>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">#2</span> Kansas City Chiefs
                          </span>
                        </div>
                      </div>

                      {/* Super Bowl Centerpiece */}
                      <div className="bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-2xl p-3.5 text-center space-y-2">
                        <Trophy className="w-6 h-6 text-amber-500 mx-auto" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300">
                          Super Bowl Champion
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs">
                          <span>Buffalo Bills</span>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Tiebreaker: BUF 27 – DET 24
                        </div>
                      </div>

                      {/* NFC Championship */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          NFC Championship
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] opacity-80">#1</span> Detroit Lions
                          </span>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">#2</span> San Francisco 49ers
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === "squares" && (
                <div>
                  {/* Header Strip */}
                  <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                        <Trophy className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                        Super Bowl Squares Pool
                      </h3>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                      100 / 100 Claimed
                    </span>
                  </div>

                  {/* Squares Preview Body */}
                  <div className="p-3.5 sm:p-6 bg-slate-50/60 dark:bg-slate-950/50 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase text-amber-600">Q1 Winner</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">Sarah J.</div>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-600">+$150</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-sky-300 dark:border-sky-800 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase text-sky-600">Halftime</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">Jimmy</div>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-600">+$250</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-300 dark:border-purple-800 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase text-purple-600">Q3 Winner</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">Marcus</div>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-600">+$150</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-400 dark:border-emerald-700 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase text-emerald-600">Final Score</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">Coach Tom</div>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-600">+$450</span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Share2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Shareable public link — players view live without logging in</span>
                      </span>
                      <span className="hidden sm:inline text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        Live ESPN Sync
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. THREE WAYS TO PLAY (ALL 3 SITE OPTIONS)
      ───────────────────────────────────────────────────────────── */}
      <section id="modes" className="scroll-mt-16 py-10 sm:py-16 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-7 sm:mb-12">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              3 Ways to Play
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Play one pool or run all three.
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-base">
              Each game mode works completely on its own — create just a Squares board, a Playoff Bracket, or a full weekly league.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Option 1: Weekly Pick'em & Survivor */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 tracking-wider">
                    Full Season League
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  NFL Pick&apos;em &amp; Survivor
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Pick weekly game winners straight up and run a high-stakes Eliminator / Survivor pool side-by-side.
                </p>

                <ul className="mt-4 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Run Pick&apos;em, Survivor, or both</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Anti-peeking locks until game kickoff</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>3-tier Monday Night Football tiebreaker</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openStartPoolModal("pickem")}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Create Pick&apos;em League</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Option 2: Playoff Bracket */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-500/20">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 tracking-wider">
                    Postseason Challenge
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Playoff Bracket
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Predict every NFL playoff matchup from Wild Card weekend through the Super Bowl Champion — no weekly league required.
                </p>

                <ul className="mt-4 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Interactive AFC &amp; NFC bracket tree</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Auto-advancing seeds &amp; round scoring</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Super Bowl score tiebreaker &amp; PDF print</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openStartPoolModal("bracket")}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Start Playoff Bracket</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Option 3: Super Bowl Squares */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-sm shadow-amber-500/20">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 tracking-wider">
                    100-Square Grid
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Super Bowl Squares
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Build a 10x10 Squares pool in seconds, randomize numbers with one click, and share a live link with your party.
                </p>

                <ul className="mt-4 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Public view-only link (no login for players)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Live ESPN Q1, Half, Q3 &amp; Final winners</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Single-page landscape PDF printout</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openStartPoolModal("squares")}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Create Squares Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. KEY FEATURES (COMPACT 2x3 MOBILE GRID)
      ───────────────────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-16 py-10 sm:py-16 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-7 sm:mb-12">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Built for Commissioners &amp; Players
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Everything automated. Zero spreadsheets.
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2.5">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="font-black text-xs sm:text-base text-slate-900 dark:text-white">Live ESPN Sync</h4>
              <p className="mt-1 text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 leading-snug">
                Game scores, standings, and quarter winners update automatically in real time.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="font-black text-xs sm:text-base text-slate-900 dark:text-white">Anti-Peeking Locks</h4>
              <p className="mt-1 text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 leading-snug">
                Picks stay hidden until kickoff so nobody can copy selections ahead of time.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5">
                <Share2 className="w-4 h-4" />
              </div>
              <h4 className="font-black text-xs sm:text-base text-slate-900 dark:text-white">Easy Sharing</h4>
              <p className="mt-1 text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 leading-snug">
                Invite friends with a 5-digit league code or a view-only Squares link.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="font-black text-xs sm:text-base text-slate-900 dark:text-white">3-Tier Tiebreakers</h4>
              <p className="mt-1 text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 leading-snug">
                Fair combined-score tiebreakers settle weekly and Super Bowl ties automatically.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
                <Printer className="w-4 h-4" />
              </div>
              <h4 className="font-black text-xs sm:text-base text-slate-900 dark:text-white">Print &amp; PDF Ready</h4>
              <p className="mt-1 text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 leading-snug">
                1-page printable Squares grids and Playoff Brackets ready for game day parties.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <h4 className="font-black text-xs sm:text-base text-slate-900 dark:text-white">Mobile-First UI</h4>
              <p className="mt-1 text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 leading-snug">
                Designed for quick thumb taps on your phone while watching Sunday kickoff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. HOW IT WORKS (3 COMPACT STEPS)
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-16 py-9 sm:py-14 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                1
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Pick Your Pool Type</h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Start a Pick&apos;em &amp; Survivor league, a Playoff Bracket, or a Super Bowl Squares board.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                2
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Invite Your Group</h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Share your 5-digit league code or send out a public view-only Squares link.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                3
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Track Live on Game Day</h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Watch live ESPN scores automatically update standings, brackets, and quarter payouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FAQ ACCORDION SECTION
      ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-16 py-10 sm:py-16 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-10">
            <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              FAQ
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Common Questions
            </h2>
          </div>

          <div className="space-y-2.5">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 shrink-0 ${
                        isOpen ? "rotate-180 text-emerald-500" : "text-slate-400"
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3.5 pt-1 sm:px-4 sm:pb-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800">
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
          8. BOTTOM CALL TO ACTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-10 sm:py-16 bg-white dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800/80 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Ready for kickoff?
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
            Start a Pick&apos;em league, Playoff Bracket, or Super Bowl Squares board in seconds.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => openStartPoolModal("pickem")}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start a Free Pool</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setModalError("");
                setShowJoinModal(true);
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Join with Code</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. JOIN WITH CODE MODAL
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
              Enter the 5-digit invite code provided by your league commissioner.
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
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Register &amp; Join</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleModalSubmit("login")}
                  disabled={modalCode.trim().length !== 5}
                  className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                >
                  Already have an account? Sign in and join →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. UNIFIED START A POOL MODAL (ALL 3 OPTIONS)
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

            <div
              className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm ${
                createPoolType === "pickem"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  : createPoolType === "bracket"
                  ? "bg-gradient-to-br from-purple-500 to-purple-600"
                  : "bg-gradient-to-br from-amber-500 to-amber-600"
              }`}
            >
              <Trophy className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Start a Free Pool
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Choose which game you&apos;d like to set up — no other leagues required.
            </p>

            {/* 3-Option Selector inside Modal */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-5">
              <button
                type="button"
                onClick={() => setCreatePoolType("pickem")}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                  createPoolType === "pickem"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Pick&apos;em
              </button>
              <button
                type="button"
                onClick={() => setCreatePoolType("bracket")}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                  createPoolType === "bracket"
                    ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Bracket
              </button>
              <button
                type="button"
                onClick={() => setCreatePoolType("squares")}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                  createPoolType === "squares"
                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Squares
              </button>
            </div>

            {createPoolType === "pickem" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateModalSubmit("register");
                }}
                className="mt-5 space-y-4"
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
                    League Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateFormat("both")}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
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
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
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
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
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
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue to Register &amp; Create</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateModalSubmit("login")}
                    className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                  >
                    Already have an account? Sign in to create →
                  </button>
                </div>
              </form>
            ) : createPoolType === "bracket" ? (
              <div className="mt-5 space-y-4">
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="font-black text-purple-900 dark:text-purple-200 text-sm">
                    Standalone Playoff Bracket
                  </div>
                  <p className="leading-relaxed">
                    Fill out your AFC &amp; NFC postseason bracket, set your Super Bowl score tiebreaker, and compete on the leaderboard — no weekly Pick&apos;em league needed.
                  </p>
                </div>

                <div className="pt-1 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCreateModalSubmit("register")}
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Register &amp; Open Playoff Bracket</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateModalSubmit("login")}
                    className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                  >
                    Already have an account? Sign in to Bracket →
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="font-black text-amber-900 dark:text-amber-200 text-sm">
                    Standalone Super Bowl Squares
                  </div>
                  <p className="leading-relaxed">
                    Create a 10x10 Squares board, randomize row &amp; column numbers, and share a view-only link with friends (players don&apos;t need an account to view).
                  </p>
                </div>

                <div className="pt-1 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCreateModalSubmit("register")}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Register &amp; Open Squares Board</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateModalSubmit("login")}
                    className="w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                  >
                    Already have an account? Sign in to Squares →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          11. DEDICATED SIGN IN MODAL
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
              Enter your username or email to access your leagues, brackets, and squares boards.
            </p>

            {loginError && (
              <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {loginResetMessage && (
              <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{loginResetMessage}</span>
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
                    if (loginResetMessage) setLoginResetMessage("");
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <button
                    type="button"
                    disabled={loginResetSending}
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {loginResetSending ? "Sending reset link..." : "Forgot password?"}
                  </button>
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
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
                    className="font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                  >
                    Start a Pool →
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setModalError("");
                      setShowJoinModal(true);
                    }}
                    className="font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                  >
                    Join with 5-Digit Code →
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onProfileUpdated={() => router.refresh()}
      />
    </div>
  );
}
