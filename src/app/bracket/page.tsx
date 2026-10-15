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
  Medal,
  RefreshCw,
  Sun,
  Moon,
  Lock,
  Unlock,
  Users,
  Flame,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { TeamLogo } from "@/components/TeamLogo";
import {
  BracketGameId,
  BracketPicks,
  BracketParticipant,
  SimulationResults,
  TiebreakerPrediction,
  resolveBracketMatchups,
  calculateBracketScore,
  extractActualWinners,
  TEAM_BY_ABBR,
  PlayoffTeam,
} from "@/lib/playoff-bracket";

const STORAGE_PICKS_KEY = "pocketpicks_bracket_picks_v1";
const STORAGE_TIEBREAKER_KEY = "pocketpicks_bracket_tb_v1";

export default function BracketPage() {
  const { user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const [activeTab, setActiveTab] = useState<"bracket" | "leaderboard" | "rules">("bracket");
  const [mobileRoundTab, setMobileRoundTab] = useState<"wc" | "div" | "conf" | "sb">("wc");
  const [bracketViewMode, setBracketViewMode] = useState<"actual" | "projected">("actual");

  const [picks, setPicks] = useState<BracketPicks>({});
  const [tiebreaker, setTiebreaker] = useState<TiebreakerPrediction>({
    homeScore: 24,
    awayScore: 21,
    totalScore: 45,
  });

  const [results, setResults] = useState<SimulationResults>({});
  const [isSimulated, setIsSimulated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState<string>("2026-01-10T21:30:00.000Z");
  const [leaderboard, setLeaderboard] = useState<BracketParticipant[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savingPicks, setSavingPicks] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
        setIsLocked(!!data.isLocked);
        if (data.lockTime) setLockTime(data.lockTime);
        setLeaderboard(data.leaderboard || []);

        if (data.currentUserEntry?.picks) {
          setPicks(data.currentUserEntry.picks);
        } else {
          const cached = localStorage.getItem(STORAGE_PICKS_KEY);
          if (cached) {
            try {
              setPicks(JSON.parse(cached));
            } catch {
              // Ignore corrupt cache
            }
          }
        }

        if (data.currentUserEntry?.tiebreaker) {
          setTiebreaker(data.currentUserEntry.tiebreaker);
        } else {
          const cachedTb = localStorage.getItem(STORAGE_TIEBREAKER_KEY);
          if (cachedTb) {
            try {
              setTiebreaker(JSON.parse(cachedTb));
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch bracket data:", err);
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

  // Persist picks and tiebreaker to localStorage
  useEffect(() => {
    if (Object.keys(picks).length > 0) {
      localStorage.setItem(STORAGE_PICKS_KEY, JSON.stringify(picks));
    }
    if (tiebreaker) {
      localStorage.setItem(STORAGE_TIEBREAKER_KEY, JSON.stringify(tiebreaker));
    }
  }, [picks, tiebreaker]);

  // Save picks and tiebreaker to Firestore backend
  const savePicksToBackend = async (newPicks: BracketPicks, newTb: TiebreakerPrediction) => {
    if (!user || isLocked) return;
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
          tiebreaker: newTb,
          userName: user.name || user.username || "PocketPicks Fan",
          userAvatar: user.avatarColor || "bg-emerald-600",
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        const data = await res.json();
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
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
    if (isLocked) {
      alert("Brackets are locked. Picks cannot be modified.");
      return;
    }

    setPicks((prev) => {
      const updated = { ...prev, [gameId]: teamAbbr };
      const newMatchups = resolveBracketMatchups(updated);

      // Verify Divisional picks
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

      // Verify Conference picks
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

      // Verify Super Bowl pick
      const updatedMatchups3 = resolveBracketMatchups(updated);
      if (
        updated.super_bowl &&
        updatedMatchups3.super_bowl.homeTeam?.abbr !== updated.super_bowl &&
        updatedMatchups3.super_bowl.awayTeam?.abbr !== updated.super_bowl
      ) {
        delete updated.super_bowl;
      }

      savePicksToBackend(updated, tiebreaker);
      return updated;
    });
  };

  // Tiebreaker inputs change handler
  const handleTiebreakerChange = (field: "home" | "away", val: number) => {
    if (isLocked) return;
    const clamped = Math.max(0, Math.min(99, isNaN(val) ? 0 : val));
    const nextTb: TiebreakerPrediction = {
      homeScore: field === "home" ? clamped : tiebreaker.homeScore,
      awayScore: field === "away" ? clamped : tiebreaker.awayScore,
      totalScore: (field === "home" ? clamped : tiebreaker.homeScore) + (field === "away" ? clamped : tiebreaker.awayScore),
    };
    setTiebreaker(nextTb);
    savePicksToBackend(picks, nextTb);
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

  // Toggle lock status (open/locked)
  const handleToggleLock = async () => {
    try {
      const next = !isLocked;
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_lock", isLocked: next }),
      });
      if (res.ok) {
        setIsLocked(next);
      }
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    }
  };

  // Seed sample competitors
  const handleSeedParticipants = async () => {
    try {
      setSeeding(true);
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to seed participants:", err);
    } finally {
      setSeeding(false);
    }
  };

  // Clear sample competitors
  const handleClearSampleParticipants = async () => {
    try {
      setSeeding(true);
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_samples" }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to clear sample participants:", err);
    } finally {
      setSeeding(false);
    }
  };

  // Clear all user picks
  const handleClearPicks = () => {
    if (isLocked) {
      alert("Brackets are locked. Picks cannot be cleared.");
      return;
    }
    if (confirm("Are you sure you want to clear all your bracket picks?")) {
      setPicks({});
      localStorage.removeItem(STORAGE_PICKS_KEY);
      savePicksToBackend({}, tiebreaker);
    }
  };

  // Matchup resolvers: User Projected Picks vs Actual Tournament Field
  const actualWinners = useMemo(() => extractActualWinners(results), [results]);
  const actualTournamentMatchups = useMemo(() => resolveBracketMatchups(actualWinners), [actualWinners]);
  const userProjectedMatchups = useMemo(() => resolveBracketMatchups(picks), [picks]);

  // When simulated or tournament active, default to showing the actual teams advancing in the tournament
  const isDisplayingActual = isSimulated && bracketViewMode === "actual";
  const activeMatchups = isDisplayingActual ? actualTournamentMatchups : userProjectedMatchups;

  const scoreDetails = useMemo(() => calculateBracketScore(picks, results, tiebreaker), [picks, results, tiebreaker]);
  const completedPicksCount = useMemo(() => Object.keys(picks).length, [picks]);

  // Component to render an individual matchup card
  const renderMatchupCard = (slotKey: BracketGameId) => {
    const slot = activeMatchups[slotKey];
    const userPickAbbr = picks[slotKey];
    const gameResult = results[slotKey];
    const isGameDone = isSimulated && gameResult?.isCompleted;

    // Check if the user's pick for this round matches either team in the actual matchup
    const homeAbbr = slot.homeTeam?.abbr;
    const awayAbbr = slot.awayTeam?.abbr;
    const hasPickedInMatchup = userPickAbbr && (userPickAbbr === homeAbbr || userPickAbbr === awayAbbr);
    const isPickEliminated = isDisplayingActual && userPickAbbr && !hasPickedInMatchup;
    const eliminatedTeam = isPickEliminated ? TEAM_BY_ABBR[userPickAbbr] : null;

    const isCorrect = isGameDone && userPickAbbr && userPickAbbr === gameResult?.winner;
    const isWrong = isGameDone && userPickAbbr && (userPickAbbr !== gameResult?.winner || isPickEliminated);

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
        <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
          <span className="truncate min-w-0 flex-1">{slot.title}</span>
          {isGameDone && (
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap inline-flex items-center gap-0.5 ${
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
        {renderTeamRow(slotKey, slot.awayTeam, gameResult?.awayScore, isGameDone, gameResult?.winner)}

        {/* Home Team Option */}
        {renderTeamRow(slotKey, slot.homeTeam, gameResult?.homeScore, isGameDone, gameResult?.winner)}

        {/* Display eliminated pick if user's pick was knocked out in an earlier round */}
        {isPickEliminated && eliminatedTeam && (
          <div className="mt-0.5 flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[10px] font-bold text-rose-700 dark:text-rose-400 animate-fade-in">
            <span className="flex items-center gap-1 min-w-0">
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="truncate">Your pick:</span>
            </span>
            <span className="font-black shrink-0 text-rose-800 dark:text-rose-300">
              {eliminatedTeam.name} ❌ (Out)
            </span>
          </div>
        )}
      </div>
    );
  };

  // Component to render each team row inside a matchup
  const renderTeamRow = (
    gameId: BracketGameId,
    team: PlayoffTeam | null,
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
    const isPickCorrect = isGameDone && isSelected && isWinnerOfGame;
    const isPickWrong = isGameDone && isSelected && !isWinnerOfGame;

    return (
      <button
        type="button"
        disabled={isLocked}
        onClick={() => handleSelectTeam(gameId, team.abbr)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold text-xs transition-all ${
          isPickCorrect
            ? "bg-emerald-600 text-white shadow-xs"
            : isPickWrong
            ? "bg-rose-600 text-white shadow-xs dark:bg-rose-600 dark:text-white"
            : isSelected
            ? "bg-emerald-600 text-white shadow-xs"
            : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
        } ${isLocked ? "cursor-default opacity-90" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-black shrink-0 ${
              isPickCorrect || isPickWrong || isSelected
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
                isPickCorrect || (isSelected && !isPickWrong)
                  ? "text-emerald-100"
                  : isPickWrong
                  ? "text-rose-100"
                  : isWinnerOfGame
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500"
              }`}
            >
              {score}
            </span>
          )}

          {/* Show checkmark for correct pick, RED X for incorrect pick, or green check for unpicked winner */}
          {isSelected && (
            isPickWrong ? (
              <XCircle className="w-4 h-4 text-white shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            )
          )}

          {!isSelected && isWinnerOfGame && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
        </div>
      </button>
    );
  };

  // Resolve teams for Super Bowl tiebreaker labels
  const sbHomeName = activeMatchups.super_bowl.homeTeam?.name || "Home Team";
  const sbAwayName = activeMatchups.super_bowl.awayTeam?.name || "Away Team";

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

          {/* Right: Lock Indicator, Simulation Actions & User Info */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Lock Status / Toggle */}
            <button
              type="button"
              onClick={handleToggleLock}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                isLocked
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
              title={isLocked ? "Click to Unlock Brackets" : "Click to Lock Brackets"}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5 text-rose-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
              <span className="hidden sm:inline">{isLocked ? "Locked" : "Open"}</span>
            </button>

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

            {/* Score Pill & View Mode Switch */}
            <div className="flex items-center gap-2.5 shrink-0 py-2.5">
              {isSimulated && (
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setBracketViewMode("actual")}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      bracketViewMode === "actual"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-2xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    Actual Field
                  </button>
                  <button
                    type="button"
                    onClick={() => setBracketViewMode("projected")}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      bracketViewMode === "projected"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-2xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    My Picks Tree
                  </button>
                </div>
              )}

              {isLocked && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold">
                  <Lock className="w-3 h-3 text-rose-600" />
                  <span>Picks Locked</span>
                </div>
              )}

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
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
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

              {/* Col 3: Conference Championships, Super Bowl & Tiebreaker */}
              <div className="flex flex-col gap-5 items-center">
                <div className="text-center font-black text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Championship &amp; Super Bowl
                </div>

                {/* AFC Championship */}
                <div className="w-full flex justify-center">
                  {renderMatchupCard("afc_champ")}
                </div>

                {/* Lombardi Trophy & Super Bowl Card */}
                <div className="w-full max-w-[280px] bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-3xl p-4 flex flex-col items-center gap-3 text-center shadow-md">
                  <Trophy className="w-8 h-8 text-amber-500" />
                  <div className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                    Super Bowl Champion
                  </div>
                  {renderMatchupCard("super_bowl")}

                  {/* Super Bowl Tiebreaker Prediction Input (arrow-free) */}
                  <div className="w-full mt-2 pt-3 border-t border-purple-300/30 dark:border-purple-800/40 flex flex-col gap-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                        Tiebreaker Score
                      </span>
                      <span className="text-[11px] font-mono font-black text-purple-600 dark:text-purple-400">
                        Total: {tiebreaker.homeScore + tiebreaker.awayScore}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 truncate" title={sbHomeName}>
                          {sbHomeName}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          disabled={isLocked}
                          value={tiebreaker.homeScore}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            handleTiebreakerChange("home", raw === "" ? 0 : parseInt(raw, 10));
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-75 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 truncate" title={sbAwayName}>
                          {sbAwayName}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          disabled={isLocked}
                          value={tiebreaker.awayScore}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            handleTiebreakerChange("away", raw === "" ? 0 : parseInt(raw, 10));
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-75 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                      Tier 1: Closest total &bull; Tier 2: Home diff &bull; Tier 3: Away diff
                    </span>
                  </div>
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
                    <Trophy className="w-8 h-8 text-amber-500" />
                    <div className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                      Super Bowl Championship
                    </div>
                    {renderMatchupCard("super_bowl")}

                    {/* Tiebreaker Input on Mobile (arrow-free) */}
                    <div className="w-full mt-2 pt-3 border-t border-purple-300/30 dark:border-purple-800/40 flex flex-col gap-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                          Tiebreaker Score
                        </span>
                        <span className="text-[11px] font-mono font-black text-purple-600 dark:text-purple-400">
                          Total: {tiebreaker.homeScore + tiebreaker.awayScore}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 truncate" title={sbHomeName}>
                            {sbHomeName}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={isLocked}
                            value={tiebreaker.homeScore}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              handleTiebreakerChange("home", raw === "" ? 0 : parseInt(raw, 10));
                            }}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-75 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 truncate" title={sbAwayName}>
                            {sbAwayName}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={isLocked}
                            value={tiebreaker.awayScore}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              handleTiebreakerChange("away", raw === "" ? 0 : parseInt(raw, 10));
                            }}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-75 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                        Tier 1: Closest total &bull; Tier 2: Home diff &bull; Tier 3: Away diff
                      </span>
                    </div>
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
                  disabled={isLocked}
                  onClick={handleClearPicks}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold transition disabled:opacity-50"
                >
                  Clear Picks
                </button>
              </div>

              <div className="flex items-center gap-3">
                {user ? (
                  <button
                    type="button"
                    onClick={() => savePicksToBackend(picks, tiebreaker)}
                    disabled={savingPicks || isLocked}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {savingPicks ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : isLocked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Locked
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Tournament Leaderboard</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rankings update dynamically as games complete. Ties broken by Super Bowl score.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Populate / Clear competitors */}
                {leaderboard.some((p) => p.isSample) ? (
                  <button
                    type="button"
                    onClick={handleClearSampleParticipants}
                    disabled={seeding}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    title="Remove sample competitors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Clear Test Competitors</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSeedParticipants}
                    disabled={seeding}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    title="Populate leaderboard with sample competitors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Add Sample Competitors</span>
                  </button>
                )}

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
                  Click &ldquo;Add Sample Competitors&rdquo; above to fill the leaderboard, or make your own picks below!
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleSeedParticipants}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" /> Add Competitors
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("bracket")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Make Your Picks
                  </button>
                </div>
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
                        <th className="py-3.5 px-4 text-center">Tiebreaker Prediction</th>
                        <th className="py-3.5 px-4 text-center">Picks Made</th>
                        <th className="py-3.5 px-4 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {leaderboard.map((entry) => {
                        const isCurrentUser = user && entry.userId === user.id;
                        const rank = entry.rank || 1;
                        const totalPicks = Object.keys(entry.picks || {}).length;
                        const tb = entry.tiebreaker;
                        const tbStats = entry.tiebreakerStats;

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
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate font-bold text-slate-900 dark:text-white">
                                      {entry.userName}
                                    </span>
                                    {isCurrentUser && (
                                      <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                        (You)
                                      </span>
                                    )}
                                    {entry.isSample && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                        Test
                                      </span>
                                    )}
                                  </div>
                                  {entry.tiebreakerExplanation && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                                      {entry.tiebreakerExplanation}
                                    </span>
                                  )}
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

                            <td className="py-3.5 px-4 text-center">
                              {tb ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {tb.homeScore} - {tb.awayScore}
                                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                                      ({(tb.totalScore ?? (tb.homeScore + tb.awayScore))} pts)
                                    </span>
                                  </span>
                                  {isSimulated && tbStats?.tier1TotalDiff !== undefined && (
                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-extrabold">
                                      diff: &plusmn;{tbStats.tier1TotalDiff}
                                    </span>
                                  )}
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
                  You receive <strong>1 point</strong> for every game picked correctly across all 4 playoff rounds. With 13 total games, the maximum possible score is <strong>13 points</strong>.
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">2. Official 3-Tier Super Bowl Tiebreaker</strong>
                <span>
                  Just like the regular season, if two or more participants tie with the same point total, the winner is determined by:
                </span>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li><strong>Tier 1:</strong> Closest predicted combined total Super Bowl score.</li>
                  <li><strong>Tier 2:</strong> If tied on total points, closest predicted Home Team score.</li>
                  <li><strong>Tier 3:</strong> If still tied, closest predicted Away Team score.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">3. NFL Dynamic Reseeding</strong>
                <span>
                  Unlike college basketball brackets, the NFL re-seeds teams in the Divisional round. The <strong>#1 seed</strong> always plays the <strong>lowest remaining seed</strong> (highest seed number) that wins in the Wild Card round. When you pick your Wild Card winners, your Divisional matchups automatically populate!
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                <strong className="text-slate-900 dark:text-white font-bold">4. Bracket Locking</strong>
                <span>
                  Brackets can be locked when the postseason kicks off. Once locked, picks cannot be altered.
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
