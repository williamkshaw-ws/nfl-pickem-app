"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  HelpCircle,
  Share2,
  Copy,
  Check,
  Flame,
  Medal,
  ChevronRight,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { TeamLogo } from "@/components/TeamLogo";
import {
  AFC_SEEDS,
  NFC_SEEDS,
  BracketGameId,
  BracketPicks,
  BracketParticipant,
  SimulationResults,
  resolveBracketMatchups,
  calculateBracketScore,
  PlayoffTeam,
} from "@/lib/playoff-bracket";

const STORAGE_PICKS_KEY = "pocketpicks_bracket_picks_v1";

export default function BracketPage() {
  const { user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const [activeTab, setActiveTab] = useState<"bracket" | "leaderboard" | "rules">("bracket");
  const [mobileRoundTab, setMobileRoundTab] = useState<"wc" | "div" | "conf" | "sb">("wc");

  const [picks, setPicks] = useState<BracketPicks>({});
  const [results, setResults] = useState<SimulationResults>({});
  const [isSimulated, setIsSimulated] = useState(false);
  const [leaderboard, setLeaderboard] = useState<BracketParticipant[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savingPicks, setSavingPicks] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load initial bracket state from API / localStorage
  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const token = user ? await (await import("@/lib/firebase")).auth.currentUser?.getIdToken() : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/bracket", { headers });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(!!data.isSimulated);
        setLeaderboard(data.leaderboard || []);

        if (data.currentUserEntry?.picks) {
          setPicks(data.currentUserEntry.picks);
        } else {
          // Fallback to localStorage if guest or no saved remote picks
          const cached = localStorage.getItem(STORAGE_PICKS_KEY);
          if (cached) {
            try {
              setPicks(JSON.parse(cached));
            } catch {
              // Ignore corrupt local cache
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch bracket data:", err);
      // Fallback local picks
      const cached = localStorage.getItem(STORAGE_PICKS_KEY);
      if (cached) {
        try {
          setPicks(JSON.parse(cached));
        } catch {
          // Ignore
        }
      }
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Persist picks to localStorage on changes
  useEffect(() => {
    if (Object.keys(picks).length > 0) {
      localStorage.setItem(STORAGE_PICKS_KEY, JSON.stringify(picks));
    }
  }, [picks]);

  // Save picks to Firestore backend if user is authenticated
  const savePicksToBackend = async (newPicks: BracketPicks) => {
    if (!user) return;
    setSavingPicks(true);
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          picks: newPicks,
          userName: user.name || user.username || "PocketPicks Fan",
          userAvatar: user.avatarColor || "bg-emerald-600",
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        // Refresh leaderboard quietly
        const dataRes = await fetch("/api/bracket");
        if (dataRes.ok) {
          const d = await dataRes.json();
          setLeaderboard(d.leaderboard || []);
        }
      }
    } catch (err) {
      console.error("Error saving picks:", err);
    } finally {
      setSavingPicks(false);
    }
  };

  // Handle pick selection and cascade clearing of invalid downstream picks
  const handleSelectTeam = (gameId: BracketGameId, teamAbbr: string) => {
    setPicks((prev) => {
      const updated = { ...prev, [gameId]: teamAbbr };

      // Re-resolve matchups to check if downstream picks became invalid
      const newMatchups = resolveBracketMatchups(updated);

      // Verify Divisional
      if (
        updated.afc_div_1 &&
        newMatchups.afc_div_1.homeTeam?.abbr !== updated.afc_div_1 &&
        newMatchups.afc_div_1.awayTeam?.abbr !== updated.afc_div_1
      ) {
        delete updated.afc_div_1;
      }
      if (
        updated.afc_div_2 &&
        newMatchups.afc_div_2.homeTeam?.abbr !== updated.afc_div_2 &&
        newMatchups.afc_div_2.awayTeam?.abbr !== updated.afc_div_2
      ) {
        delete updated.afc_div_2;
      }
      if (
        updated.nfc_div_1 &&
        newMatchups.nfc_div_1.homeTeam?.abbr !== updated.nfc_div_1 &&
        newMatchups.nfc_div_1.awayTeam?.abbr !== updated.nfc_div_1
      ) {
        delete updated.nfc_div_1;
      }
      if (
        updated.nfc_div_2 &&
        newMatchups.nfc_div_2.homeTeam?.abbr !== updated.nfc_div_2 &&
        newMatchups.nfc_div_2.awayTeam?.abbr !== updated.nfc_div_2
      ) {
        delete updated.nfc_div_2;
      }

      // Verify Conference
      const updatedMatchups2 = resolveBracketMatchups(updated);
      if (
        updated.afc_champ &&
        updatedMatchups2.afc_champ.homeTeam?.abbr !== updated.afc_champ &&
        updatedMatchups2.afc_champ.awayTeam?.abbr !== updated.afc_champ
      ) {
        delete updated.afc_champ;
      }
      if (
        updated.nfc_champ &&
        updatedMatchups2.nfc_champ.homeTeam?.abbr !== updated.nfc_champ &&
        updatedMatchups2.nfc_champ.awayTeam?.abbr !== updated.nfc_champ
      ) {
        delete updated.nfc_champ;
      }

      // Verify Super Bowl
      const updatedMatchups3 = resolveBracketMatchups(updated);
      if (
        updated.super_bowl &&
        updatedMatchups3.super_bowl.homeTeam?.abbr !== updated.super_bowl &&
        updatedMatchups3.super_bowl.awayTeam?.abbr !== updated.super_bowl
      ) {
        delete updated.super_bowl;
      }

      savePicksToBackend(updated);
      return updated;
    });
  };

  // Simulate outcomes button handler
  const handleSimulate = async () => {
    try {
      setSimulating(true);
      const res = await fetch("/api/bracket/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(true);
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  // Reset simulation handler
  const handleResetSimulation = async () => {
    try {
      setSimulating(true);
      const res = await fetch("/api/bracket/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(false);
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  // Clear all picks
  const handleClearPicks = () => {
    if (confirm("Are you sure you want to clear all your bracket picks?")) {
      setPicks({});
      localStorage.removeItem(STORAGE_PICKS_KEY);
      savePicksToBackend({});
    }
  };

  // Share bracket link
  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const matchups = useMemo(() => resolveBracketMatchups(picks), [picks]);
  const scoreDetails = useMemo(() => calculateBracketScore(picks, results), [picks, results]);
  const completedPicksCount = useMemo(() => Object.keys(picks).length, [picks]);

  // Component to render an individual matchup card
  const renderMatchupCard = (slotKey: BracketGameId) => {
    const slot = matchups[slotKey];
    const userPick = picks[slotKey];
    const gameResult = results[slotKey];
    const isGameDone = isSimulated && gameResult?.isCompleted;
    const isCorrect = isGameDone && userPick && userPick === gameResult.winner;
    const isWrong = isGameDone && userPick && userPick !== gameResult.winner;

    return (
      <div
        key={slot.gameId}
        className={`w-full max-w-[280px] bg-white dark:bg-slate-900 border rounded-2xl p-2.5 transition-all shadow-xs flex flex-col gap-1.5 ${
          isCorrect
            ? "border-emerald-500/80 dark:border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/20"
            : isWrong
            ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
          <span className="truncate">{slot.title}</span>
          {isGameDone && (
            <span
              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                isCorrect
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : isWrong
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {isCorrect ? "+1 Pt" : isWrong ? "0 Pts" : "Final"}
            </span>
          )}
        </div>

        {/* Away Team Option */}
        {renderTeamRow(slotKey, slot.awayTeam, slot.homeTeam, gameResult?.awayScore, isGameDone, gameResult?.winner)}

        {/* Home Team Option */}
        {renderTeamRow(slotKey, slot.homeTeam, slot.awayTeam, gameResult?.homeScore, isGameDone, gameResult?.winner)}
      </div>
    );
  };

  // Component to render each team row inside a matchup
  const renderTeamRow = (
    gameId: BracketGameId,
    team: PlayoffTeam | null,
    opponent: PlayoffTeam | null,
    score: number | undefined,
    isGameDone: boolean | undefined,
    winnerAbbr: string | undefined
  ) => {
    if (!team) {
      return (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs font-semibold">
          <span>TBD</span>
          <span className="text-[10px] text-slate-400">awaiting round</span>
        </div>
      );
    }

    const isSelected = picks[gameId] === team.abbr;
    const isWinnerOfGame = isGameDone && winnerAbbr === team.abbr;

    return (
      <button
        type="button"
        onClick={() => handleSelectTeam(gameId, team.abbr)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold text-xs transition-all ${
          isSelected
            ? "bg-emerald-600 text-white shadow-xs"
            : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-black shrink-0 ${
              isSelected
                ? "bg-white/20 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {team.seed}
          </span>
          <TeamLogo alt={team.abbr} width={20} height={20} className="w-5 h-5 shrink-0 object-contain" />
          <span className="truncate">{team.name}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {score !== undefined && (
            <span
              className={`font-mono text-xs font-extrabold ${
                isSelected ? "text-emerald-100" : isWinnerOfGame ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"
              }`}
            >
              {score}
            </span>
          )}
          {isSelected && (
            <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Back & Logo */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                  Playoff Bracket
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Challenge
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden xs:inline">
                Pick 13 games &bull; 1 pt per correct game
              </span>
            </div>
          </div>

          {/* Right: Simulation Actions & User Info */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Simulation controls */}
            {isSimulated ? (
              <button
                type="button"
                onClick={handleResetSimulation}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title="Reset simulation to unplayed state"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Reset Scores</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSimulate}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors"
                title="Generate realistic playoff outcomes to test scoring"
              >
                <Sparkles className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
                <span>Simulate Outcomes</span>
              </button>
            )}

            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Share Bracket Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Auth Info / Login */}
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shadow-xs ${
                    user.avatarColor || "bg-emerald-600"
                  }`}
                  title={user.name || user.email}
                >
                  {(user.name || user.username || user.email).charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[100px] truncate hidden md:inline">
                  {user.name || user.username}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <Link
                  href="/auth/login?redirect=/bracket"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-xs transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/auth/register?redirect=/bracket"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sub-header Navigation Tabs */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 sm:gap-6 py-2.5">
              <button
                type="button"
                onClick={() => setActiveTab("bracket")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === "bracket"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>My Bracket</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-black/20">
                  {completedPicksCount}/13
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("leaderboard")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === "leaderboard"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Medal className="w-3.5 h-3.5" />
                <span>Leaderboard</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {leaderboard.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("rules")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "rules"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Rules &amp; Scoring</span>
              </button>
            </div>

            {/* Score Pill / Progress */}
            <div className="flex items-center gap-2 shrink-0 py-2.5">
              {isSimulated && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-black">
                  <Flame className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>
                    Your Score: {scoreDetails.score} / 13 pts
                  </span>
                </div>
              )}

              {saveSuccess && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Picks Saved
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
        {/* Guest Banner if not signed in */}
        {!authLoading && !user && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="font-black text-amber-950 dark:text-amber-100">Make your playoff picks!</span> Log in or create an account to save your bracket and compete on the leaderboard.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/auth/login?redirect=/bracket"
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Log In
              </Link>
              <Link
                href="/auth/register?redirect=/bracket"
                className="px-3 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-950 dark:text-amber-100 font-bold text-xs transition"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* TAB 1: INTERACTIVE BRACKET */}
        {activeTab === "bracket" && (
          <div className="flex-1 flex flex-col gap-6">
            {/* Mobile Round Filter Pills */}
            <div className="flex lg:hidden items-center justify-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <button
                type="button"
                onClick={() => setMobileRoundTab("wc")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                  mobileRoundTab === "wc"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Wild Card
              </button>
              <button
                type="button"
                onClick={() => setMobileRoundTab("div")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                  mobileRoundTab === "div"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Divisional
              </button>
              <button
                type="button"
                onClick={() => setMobileRoundTab("conf")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                  mobileRoundTab === "conf"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Championship
              </button>
              <button
                type="button"
                onClick={() => setMobileRoundTab("sb")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                  mobileRoundTab === "sb"
                    ? "bg-purple-600 text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Super Bowl
              </button>
            </div>

            {/* DESKTOP FULL BRACKET TREE */}
            <div className="hidden lg:grid grid-cols-5 gap-4 items-center">
              {/* Col 1: AFC Wild Card */}
              <div className="flex flex-col gap-4">
                <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  AFC Wild Card
                </div>
                {renderMatchupCard("afc_wc_1")}
                {renderMatchupCard("afc_wc_2")}
                {renderMatchupCard("afc_wc_3")}
              </div>

              {/* Col 2: AFC Divisional */}
              <div className="flex flex-col gap-6">
                <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  AFC Divisional
                </div>
                <div className="flex flex-col gap-8 justify-around h-full py-4">
                  {renderMatchupCard("afc_div_1")}
                  {renderMatchupCard("afc_div_2")}
                </div>
              </div>

              {/* Col 3: Conference Championships & Super Bowl */}
              <div className="flex flex-col gap-6 items-center">
                <div className="text-center font-black text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Championship &amp; Super Bowl
                </div>

                {/* AFC Championship */}
                <div className="w-full flex justify-center">
                  {renderMatchupCard("afc_champ")}
                </div>

                {/* Lombardi Trophy & Super Bowl Card */}
                <div className="w-full max-w-[280px] bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-3xl p-4 flex flex-col items-center gap-3 text-center shadow-md">
                  <Trophy className="w-8 h-8 text-amber-500 animate-bounce" />
                  <div className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                    Super Bowl Champion
                  </div>
                  {renderMatchupCard("super_bowl")}
                </div>

                {/* NFC Championship */}
                <div className="w-full flex justify-center">
                  {renderMatchupCard("nfc_champ")}
                </div>
              </div>

              {/* Col 4: NFC Divisional */}
              <div className="flex flex-col gap-6">
                <div className="text-center font-black text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  NFC Divisional
                </div>
                <div className="flex flex-col gap-8 justify-around h-full py-4">
                  {renderMatchupCard("nfc_div_1")}
                  {renderMatchupCard("nfc_div_2")}
                </div>
              </div>

              {/* Col 5: NFC Wild Card */}
              <div className="flex flex-col gap-4">
                <div className="text-center font-black text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  NFC Wild Card
                </div>
                {renderMatchupCard("nfc_wc_1")}
                {renderMatchupCard("nfc_wc_2")}
                {renderMatchupCard("nfc_wc_3")}
              </div>
            </div>

            {/* MOBILE VIEW (by selected round) */}
            <div className="lg:hidden flex flex-col gap-4 items-center">
              {mobileRoundTab === "wc" && (
                <div className="w-full flex flex-col gap-6">
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3 text-center">
                      AFC Wild Card Games
                    </h3>
                    <div className="flex flex-col gap-3 items-center">
                      {renderMatchupCard("afc_wc_1")}
                      {renderMatchupCard("afc_wc_2")}
                      {renderMatchupCard("afc_wc_3")}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 text-center">
                      NFC Wild Card Games
                    </h3>
                    <div className="flex flex-col gap-3 items-center">
                      {renderMatchupCard("nfc_wc_1")}
                      {renderMatchupCard("nfc_wc_2")}
                      {renderMatchupCard("nfc_wc_3")}
                    </div>
                  </div>
                </div>
              )}

              {mobileRoundTab === "div" && (
                <div className="w-full flex flex-col gap-6">
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3 text-center">
                      AFC Divisional Games
                    </h3>
                    <div className="flex flex-col gap-3 items-center">
                      {renderMatchupCard("afc_div_1")}
                      {renderMatchupCard("afc_div_2")}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 text-center">
                      NFC Divisional Games
                    </h3>
                    <div className="flex flex-col gap-3 items-center">
                      {renderMatchupCard("nfc_div_1")}
                      {renderMatchupCard("nfc_div_2")}
                    </div>
                  </div>
                </div>
              )}

              {mobileRoundTab === "conf" && (
                <div className="w-full flex flex-col gap-6 items-center">
                  <div className="w-full">
                    <h3 className="font-black text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 text-center">
                      Conference Championships
                    </h3>
                    <div className="flex flex-col gap-3 items-center">
                      {renderMatchupCard("afc_champ")}
                      {renderMatchupCard("nfc_champ")}
                    </div>
                  </div>
                </div>
              )}

              {mobileRoundTab === "sb" && (
                <div className="w-full flex flex-col gap-4 items-center">
                  <div className="w-full max-w-[280px] bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-3xl p-4 flex flex-col items-center gap-3 text-center shadow-md">
                    <Trophy className="w-8 h-8 text-amber-500 animate-bounce" />
                    <div className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                      Super Bowl Championship
                    </div>
                    {renderMatchupCard("super_bowl")}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Picks: <strong className="text-slate-900 dark:text-white">{completedPicksCount} / 13</strong>
                </span>
                <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                <button
                  type="button"
                  onClick={handleClearPicks}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold transition"
                >
                  Clear Picks
                </button>
              </div>

              <div className="flex items-center gap-3">
                {user ? (
                  <button
                    type="button"
                    onClick={() => savePicksToBackend(picks)}
                    disabled={savingPicks}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    {savingPicks ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Save Bracket
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href="/auth/login?redirect=/bracket"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Sign in to Save
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LEADERBOARD */}
        {activeTab === "leaderboard" && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Tournament Leaderboard</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rankings update dynamically as playoff games conclude or simulations run.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isSimulated && (
                  <button
                    type="button"
                    onClick={handleSimulate}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Scores</span>
                  </button>
                )}
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">No Brackets Submitted Yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Be the first to pick your playoff bracket and set the pace on the leaderboard!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("bracket")}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  Make Your Picks
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider text-[10px]">
                        <th className="py-3.5 px-4 w-12 text-center">Rank</th>
                        <th className="py-3.5 px-4">Participant</th>
                        <th className="py-3.5 px-4 text-center">Super Bowl Pick</th>
                        <th className="py-3.5 px-4 text-center">Picks Made</th>
                        <th className="py-3.5 px-4 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {leaderboard.map((entry, idx) => {
                        const isCurrentUser = user && entry.userId === user.id;
                        const rank = idx + 1;
                        const totalPicks = Object.keys(entry.picks || {}).length;

                        return (
                          <tr
                            key={entry.id}
                            className={`transition-colors ${
                              isCurrentUser
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 font-bold"
                                : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center font-black">
                              {rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                                  🥇
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                  🥈
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                                  🥉
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono">#{rank}</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${
                                    entry.userAvatar || "bg-emerald-600"
                                  }`}
                                >
                                  {entry.userName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate font-bold text-slate-900 dark:text-white">
                                    {entry.userName}
                                    {isCurrentUser && (
                                      <span className="ml-1.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                        (You)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {entry.superBowlWinner ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                                  <TeamLogo
                                    alt={entry.superBowlWinner}
                                    width={16}
                                    height={16}
                                    className="w-4 h-4 object-contain"
                                  />
                                  <span>{entry.superBowlWinner}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                              {totalPicks} / 13
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <span className="inline-flex items-center gap-1 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                                {entry.score} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RULES & SCORING */}
        {activeTab === "rules" && (
          <div className="max-w-2xl mx-auto w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 flex flex-col gap-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  How Playoff Bracket Works
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Simple, authentic NFL playoff rules and scoring.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">1. Simple 1-Point Scoring</strong>
                <span>
                  You receive <strong>1 point</strong> for every game picked correctly across all 4 playoff rounds. With 13 total games, the maximum possible score is <strong>13 points</strong>. No complicated point spreads or over/unders required.
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">2. NFL Dynamic Reseeding</strong>
                <span>
                  Unlike college basketball brackets, the NFL re-seeds teams in the Divisional round. The <strong>#1 seed</strong> (Kansas City in AFC, Detroit in NFC) always plays the <strong>lowest remaining seed</strong> (highest seed number) that wins in the Wild Card round. When you pick your Wild Card winners, your Divisional matchups automatically populate!
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">3. Rounds Breakdown (13 Games Total)</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li><strong>Wild Card Round:</strong> 6 Games (3 AFC, 3 NFC)</li>
                  <li><strong>Divisional Round:</strong> 4 Games (2 AFC, 2 NFC)</li>
                  <li><strong>Conference Championships:</strong> 2 Games (AFC &amp; NFC)</li>
                  <li><strong>Super Bowl:</strong> 1 Championship Game</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">4. Simulation / Test Mode</strong>
                <span>
                  Click the <strong>Simulate Outcomes</strong> button in the top bar anytime to test results! It simulates scores across all 13 games and immediately recalculates all participants&apos; points on the leaderboard. Click <strong>Reset Scores</strong> to return to an unplayed state.
                </span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setActiveTab("bracket")}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black transition shadow-xs"
              >
                Go to My Bracket
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
