"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Trophy,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  HelpCircle,
  Medal,
  Sun,
  Moon,
  Users,
  Flame,
  Trash2,
  X,
  Eye,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { TeamLogo } from "@/components/TeamLogo";
import { GameSwitcherDropdown } from "@/components/GameSwitcherDropdown";
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

const STORAGE_PICKS_KEY = "pocketpicks_bracket_picks_v2";
const STORAGE_TIEBREAKER_KEY = "pocketpicks_bracket_tb_v2";

export default function BracketPage() {
  const { user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const [activeTab, setActiveTab] = useState<"bracket" | "leaderboard">("bracket");
  const tabScrollMap = useRef<Record<string, number>>({ bracket: 0, leaderboard: 0 });

  const handleTabChange = useCallback((newTab: "bracket" | "leaderboard") => {
    if (newTab === activeTab) return;
    // Save current scroll position for active tab
    tabScrollMap.current[activeTab] = window.scrollY;
    setActiveTab(newTab);
    // Restore target tab's scroll position
    requestAnimationFrame(() => {
      window.scrollTo({
        top: tabScrollMap.current[newTab] ?? 0,
        behavior: "instant",
      });
    });
  }, [activeTab]);

  const [mobileRoundTab, setMobileRoundTab] = useState<"wc" | "div" | "conf" | "sb">("wc");
  const [bracketViewMode, setBracketViewMode] = useState<"actual" | "projected">("actual");

  // Modals state
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [viewingParticipant, setViewingParticipant] = useState<BracketParticipant | null>(null);

  // Prevent background scrolling when any modal is open
  const isAnyModalOpen = Boolean(showRulesModal || showClearModal || viewingParticipant);
  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isAnyModalOpen]);

  const [picks, setPicks] = useState<BracketPicks>({});
  const [tiebreaker, setTiebreaker] = useState<TiebreakerPrediction>({
    homeScore: 24,
    awayScore: 21,
    totalScore: 45,
  });
  const [homeScoreInput, setHomeScoreInput] = useState<string>("24");
  const [awayScoreInput, setAwayScoreInput] = useState<string>("21");
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [results, setResults] = useState<SimulationResults>({});
  const [isSimulated, setIsSimulated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [leaderboard, setLeaderboard] = useState<BracketParticipant[]>([]);
  const [savingPicks, setSavingPicks] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const getAuthToken = useCallback(async () => {
    try {
      const { auth } = await import("@/lib/firebase");
      return (await auth.currentUser?.getIdToken()) || null;
    } catch {
      return null;
    }
  }, []);

  // Load initial bracket state from API / localStorage
  useEffect(() => {
    let active = true;
    const fetchBracketData = async () => {
      try {
        const token = user ? await (await import("@/lib/firebase")).auth.currentUser?.getIdToken() : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/bracket", { headers });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          setResults(data.results || {});
          setIsSimulated(!!data.isSimulated);
          setIsLocked(!!data.isLocked);
          setLeaderboard(data.leaderboard || []);

          if (data.currentUserEntry?.picks) {
            setPicks(data.currentUserEntry.picks);
          } else {
            // When not signed in or no entry, ensure clean default state with no picks selected
            setPicks({});
            try {
              localStorage.removeItem(STORAGE_PICKS_KEY);
              localStorage.removeItem("pocketpicks_bracket_picks_v1");
              localStorage.removeItem("pocketpicks_bracket_picks_v2");
            } catch {
              // Ignore
            }
          }

          if (data.currentUserEntry?.tiebreaker) {
            setTiebreaker(data.currentUserEntry.tiebreaker);
            setHomeScoreInput(String(data.currentUserEntry.tiebreaker.homeScore ?? 24));
            setAwayScoreInput(String(data.currentUserEntry.tiebreaker.awayScore ?? 21));
          } else {
            setTiebreaker({ homeScore: 24, awayScore: 21, totalScore: 45 });
            setHomeScoreInput("24");
            setAwayScoreInput("21");
            try {
              localStorage.removeItem(STORAGE_TIEBREAKER_KEY);
              localStorage.removeItem("pocketpicks_bracket_tb_v1");
              localStorage.removeItem("pocketpicks_bracket_tb_v2");
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch bracket data:", err);
      }
    };

    fetchBracketData();
    return () => {
      active = false;
    };
  }, [user]);

  // Persist picks and tiebreaker to localStorage
  useEffect(() => {
    if (Object.keys(picks).length > 0) {
      localStorage.setItem(STORAGE_PICKS_KEY, JSON.stringify(picks));
    }
    if (tiebreaker) {
      localStorage.setItem(STORAGE_TIEBREAKER_KEY, JSON.stringify(tiebreaker));
    }
  }, [picks, tiebreaker]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  // Save picks and tiebreaker to Firestore backend automatically
  const savePicksToBackend = useCallback(
    async (newPicks: BracketPicks, newTb: TiebreakerPrediction) => {
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
          setTimeout(() => setSaveSuccess(false), 2000);
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
    },
    [user, isLocked]
  );

  const debouncedSavePicksToBackend = useCallback(
    (newPicks: BracketPicks, newTb: TiebreakerPrediction, delayMs = 600) => {
      if (!user || isLocked) return;
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      setSavingPicks(true);
      saveDebounceRef.current = setTimeout(() => {
        savePicksToBackend(newPicks, newTb);
      }, delayMs);
    },
    [user, isLocked, savePicksToBackend]
  );

  // Handle pick selection and cascade clearing of invalid downstream picks
  const handleSelectTeam = (gameId: BracketGameId, teamAbbr: string) => {
    if (isLocked) {
      return;
    }

    const updated = { ...picks, [gameId]: teamAbbr };
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

    setPicks(updated);
    debouncedSavePicksToBackend(updated, tiebreaker, 300);
  };

  // Tiebreaker inputs change handler (debounced)
  const handleTiebreakerInputChange = (field: "home" | "away", rawVal: string) => {
    if (isLocked) return;
    const cleanStr = rawVal.replace(/[^0-9]/g, "").slice(0, 2);
    if (field === "home") {
      setHomeScoreInput(cleanStr);
    } else {
      setAwayScoreInput(cleanStr);
    }

    const homeVal = field === "home" ? (cleanStr === "" ? 0 : parseInt(cleanStr, 10)) : tiebreaker.homeScore;
    const awayVal = field === "away" ? (cleanStr === "" ? 0 : parseInt(cleanStr, 10)) : tiebreaker.awayScore;

    const nextTb: TiebreakerPrediction = {
      homeScore: homeVal,
      awayScore: awayVal,
      totalScore: homeVal + awayVal,
    };
    setTiebreaker(nextTb);
    debouncedSavePicksToBackend(picks, nextTb, 600);
  };

  const handleTiebreakerBlur = (field: "home" | "away") => {
    if (field === "home" && homeScoreInput === "") {
      setHomeScoreInput("0");
    } else if (field === "away" && awayScoreInput === "") {
      setAwayScoreInput("0");
    }
  };

  // Simulate outcomes button handler (locks bracket on simulate)
  const handleSimulate = async () => {
    if (!user) {
      showToast("Please sign in or register to simulate playoff scores.");
      return;
    }
    try {
      setSimulating(true);
      const token = await getAuthToken();
      const res = await fetch("/api/bracket/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "simulate" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(true);
        setIsLocked(true); // Automatically locks when scores are simulated
        setLeaderboard(data.leaderboard || []);
        showToast("⚡ Playoff scores simulated & bracket locked!");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Simulation failed. Please try again.");
      }
    } catch (err) {
      console.error("Simulation failed:", err);
      showToast("Simulation failed. Please try again.");
    } finally {
      setSimulating(false);
    }
  };

  // Reset simulation handler (unlocks bracket when reset)
  const handleResetSimulation = async () => {
    if (!user) {
      showToast("Please sign in to reset tournament scores.");
      return;
    }
    try {
      setSimulating(true);
      const token = await getAuthToken();
      const res = await fetch("/api/bracket/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(false);
        setIsLocked(false); // Unlocks when simulation is reset
        setLeaderboard(data.leaderboard || []);
        showToast("Scores reset to unplayed state.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Reset failed. Please try again.");
      }
    } catch (err) {
      console.error("Reset failed:", err);
      showToast("Reset failed. Please try again.");
    } finally {
      setSimulating(false);
    }
  };

  // Seed sample competitors
  const handleSeedParticipants = async () => {
    if (!user) {
      showToast("Please sign in to seed test competitors.");
      return;
    }
    try {
      setSeeding(true);
      const token = await getAuthToken();
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "seed" }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        showToast("Sample competitors added to leaderboard!");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to seed competitors.");
      }
    } catch (err) {
      console.error("Failed to seed participants:", err);
      showToast("Failed to seed competitors.");
    } finally {
      setSeeding(false);
    }
  };

  // Clear sample competitors
  const handleClearSampleParticipants = async () => {
    if (!user) {
      showToast("Please sign in to clear test competitors.");
      return;
    }
    try {
      setSeeding(true);
      const token = await getAuthToken();
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "clear_samples" }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        showToast("Test competitors removed.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to clear test competitors.");
      }
    } catch (err) {
      console.error("Failed to clear sample participants:", err);
      showToast("Failed to clear test competitors.");
    } finally {
      setSeeding(false);
    }
  };

  // Confirm clear user picks via modal
  const handleConfirmClearPicks = () => {
    setPicks({});
    localStorage.removeItem(STORAGE_PICKS_KEY);
    savePicksToBackend({}, tiebreaker);
    setShowClearModal(false);
  };

  // Matchup resolvers: User Projected Picks vs Actual Tournament Field
  const actualWinners = useMemo(() => extractActualWinners(results), [results]);
  const actualTournamentMatchups = useMemo(() => resolveBracketMatchups(actualWinners), [actualWinners]);
  const userProjectedMatchups = useMemo(() => resolveBracketMatchups(picks), [picks]);

  // When simulated, default to showing the actual teams advancing in the tournament
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

        {/* Slim, discreet sub-line if user's predicted pick was eliminated in an earlier round */}
        {isPickEliminated && eliminatedTeam && (
          <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] px-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Pick:</span>
              <TeamLogo
                alt={eliminatedTeam.abbr}
                width={14}
                height={14}
                className="w-3.5 h-3.5 shrink-0 object-contain"
              />
              <span className="truncate font-bold text-slate-700 dark:text-slate-300">
                {eliminatedTeam.name}
              </span>
            </div>
            <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 shrink-0 ml-1.5">
              Out
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

  // Helper to render the Super Bowl Champion card and tiebreaker inputs (shared between Desktop & Mobile)
  const renderSuperBowlCenterCard = () => (
    <div className="w-full max-w-[280px] bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-3xl p-4 flex flex-col items-center gap-3 text-center shadow-md">
      <Trophy className="w-8 h-8 text-amber-500" />
      <div className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
        Super Bowl Champion
      </div>
      {renderMatchupCard("super_bowl")}

      {/* Super Bowl Tiebreaker Prediction Input (arrow-free & debounced) */}
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
              value={homeScoreInput}
              onChange={(e) => handleTiebreakerInputChange("home", e.target.value)}
              onBlur={() => handleTiebreakerBlur("home")}
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
              value={awayScoreInput}
              onChange={(e) => handleTiebreakerInputChange("away", e.target.value)}
              onBlur={() => handleTiebreakerBlur("away")}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-75 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
          Tier 1: Closest total &bull; Tier 2: Home diff &bull; Tier 3: Away diff
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Branding & Game Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <GameSwitcherDropdown currentGame="bracket" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                  Playoff Bracket
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shrink-0">
                  Challenge
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Picks lock at start of 1st game &bull; 1 pt / win
              </span>
            </div>
          </div>

          {/* Right: Simulation Controls & User Info */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Simulation controls (authenticated only) */}
            {user && (
              <>
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
                    <span>Simulate Scores</span>
                  </button>
                )}

                {/* Clear Picks Button (in main bar) */}
                {!isLocked && completedPicksCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                    title="Clear all picks"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Clear</span>
                  </button>
                )}
              </>
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

        {/* Sub-header Navigation Tabs (authenticated only) */}
        {user && (
          <div className="border-t border-slate-100 dark:border-slate-800/80 px-3 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4 py-2 sm:py-2.5">
            {/* Left: Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange("bracket")}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === "bracket"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">My Bracket</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-black/20 shrink-0 whitespace-nowrap">
                  {completedPicksCount}/13
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("leaderboard")}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === "leaderboard"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Medal className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Leaderboard</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
                  {leaderboard.length}
                </span>
              </button>

              {/* Simplified Rules Popup Button */}
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition whitespace-nowrap shrink-0"
                title="View Rules & Scoring"
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Rules</span>
              </button>
            </div>

            {/* Right: Desktop Controls & Indicators (hidden on mobile to keep toolbar strictly centered) */}
            <div className="hidden lg:flex items-center gap-2.5 shrink-0">
              {/* Desktop View Mode Toggle */}
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

              {/* Desktop Score Badge */}
              {isSimulated && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-black shrink-0 whitespace-nowrap">
                  <Flame className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>
                    {scoreDetails.score} / 13 pts
                  </span>
                </div>
              )}

              {savingPicks ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>Saving...</span>
                </span>
              ) : saveSuccess ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in shrink-0 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Saved</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col overflow-x-hidden">
        {/* Loading State when checking auth */}
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-9 h-9 animate-spin text-purple-500 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Checking bracket access...</p>
          </div>
        ) : !user ? (
          /* Dedicated Bracket Lock / Landing Screen when unauthenticated */
          <div className="max-w-lg mx-auto my-6 sm:my-16 p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-800/80 shadow-2xs">
                <Trophy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Account Required</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Playoff Bracket Challenge
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8 max-w-md mx-auto">
              Predict the entire postseason journey from Wild Card weekend to the Super Bowl champion. Sign in or create a free account to make your picks, predict final scores, and compete on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto mb-6">
              <Link
                href="/auth/login?redirect=/bracket"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In to Make Picks</span>
              </Link>
              <Link
                href="/auth/register?redirect=/bracket"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-700 transition-all hover:-translate-y-0.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </Link>
            </div>

            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs text-slate-500">
              <span>Postseason Picks:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Picks lock automatically at kickoff of the first game.</span>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: INTERACTIVE BRACKET */}
        {activeTab === "bracket" && (
          <div className="flex-1 flex flex-col gap-4 sm:gap-6">
            {/* Mobile Simulation Bar: View Mode Switch + Score Badge */}
            {isSimulated && (
              <div className="flex lg:hidden items-center justify-between gap-2 w-full">
                <div className="flex-1 flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setBracketViewMode("actual")}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      bracketViewMode === "actual"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    Actual Field
                  </button>
                  <button
                    type="button"
                    onClick={() => setBracketViewMode("projected")}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      bracketViewMode === "projected"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    My Picks Tree
                  </button>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-black shrink-0 shadow-2xs whitespace-nowrap">
                  <Flame className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>{scoreDetails.score} / 13 pts</span>
                </div>
              </div>
            )}

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
                {renderSuperBowlCenterCard()}

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
                  {renderSuperBowlCenterCard()}
                </div>
              )}
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
                  Click any participant to view their full playoff bracket.
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
                  Click &ldquo;Add Sample Competitors&rdquo; above to fill the leaderboard, or make your own picks!
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
                    onClick={() => handleTabChange("bracket")}
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
                        <th className="py-3.5 px-4 w-16 text-center">Bracket</th>
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
                            onClick={() => setViewingParticipant(entry)}
                            className={`transition-colors cursor-pointer ${
                              isCurrentUser
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 font-bold"
                                : "hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
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

                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingParticipant(entry);
                                }}
                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="View full bracket"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
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
      </>
    )}
  </main>

      {/* MODAL 1: VIEW PARTICIPANT BRACKET */}
      {/* MODAL 1: VIEW PARTICIPANT BRACKET (OLD SCHOOL STYLE) */}
      {viewingParticipant && (() => {
        const pMatchups = resolveBracketMatchups(viewingParticipant.picks);

        const renderViewerMatchupBox = (gameId: BracketGameId, label?: string) => {
          const slot = pMatchups[gameId];
          const pick = viewingParticipant.picks[gameId];
          const res = results[gameId];
          const isDone = isSimulated && res?.isCompleted;
          const isCorrect = isDone && pick && pick === res.winner;
          const isWrong = isDone && pick && pick !== res.winner;
          const actualWinnerTeam = isDone && res?.winner ? TEAM_BY_ABBR[res.winner] : null;

          const renderViewerTeamLine = (team: PlayoffTeam | null) => {
            if (!team) {
              return (
                <div className="flex items-center justify-between px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 text-[10px] sm:text-[11px]">
                  <span>TBD</span>
                </div>
              );
            }

            const isPicked = pick === team.abbr;
            const isWinner = isDone && res?.winner === team.abbr;

            return (
              <div
                className={`flex items-center justify-between px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
                  isPicked
                    ? isCorrect
                      ? "bg-emerald-600 text-white shadow-xs"
                      : isWrong
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-500/50 text-emerald-900 dark:text-emerald-200"
                    : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <span
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded text-[8px] sm:text-[9px] font-black shrink-0 ${
                      isPicked
                        ? isCorrect || isWrong
                          ? "bg-white/20 text-white"
                          : "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {team.seed}
                  </span>
                  <TeamLogo alt={team.abbr} width={16} height={16} className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 object-contain" />
                  <span className="truncate text-[10px] sm:text-[11px]">{team.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {isPicked && (
                    isCorrect ? (
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
                    ) : isWrong ? (
                      <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
                    ) : (
                      <span className="text-[8px] sm:text-[9px] font-black uppercase px-1 py-0.2 rounded bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                        Pick
                      </span>
                    )
                  )}
                  {!isPicked && isWinner && (
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          };

          return (
            <div
              key={gameId}
              className={`w-full bg-white dark:bg-slate-900 border rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 shadow-xs flex flex-col gap-1 sm:gap-1.5 transition-all ${
                isCorrect
                  ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/10"
                  : isWrong
                  ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/10"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 px-0.5">
                <span className="truncate">{label || slot.title}</span>
                {isDone && (
                  <span
                    className={`text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-md shrink-0 inline-flex items-center gap-0.5 ${
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

              {renderViewerTeamLine(slot.awayTeam)}
              {renderViewerTeamLine(slot.homeTeam)}

              {/* Show actual winner if participant picked wrong */}
              {isWrong && actualWinnerTeam && (
                <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] sm:text-[10px] px-0.5 text-slate-400 dark:text-slate-500">
                  <span>Actual:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <TeamLogo alt={actualWinnerTeam.abbr} width={12} height={12} className="w-3 h-3 object-contain" />
                    <span className="truncate max-w-[100px] sm:max-w-[120px]">{actualWinnerTeam.name}</span>
                  </span>
                </div>
              )}
            </div>
          );
        };

        return (
          <div
            onClick={() => setViewingParticipant(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-2xl relative my-auto max-h-[94vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-black text-white shrink-0 ${
                      viewingParticipant.userAvatar || "bg-emerald-600"
                    }`}
                  >
                    {viewingParticipant.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {viewingParticipant.userName}&apos;s Bracket
                      </h3>
                      <span className="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 whitespace-nowrap">
                        {viewingParticipant.score} / 13 pts
                      </span>
                    </div>
                    {viewingParticipant.tiebreaker && (
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Tiebreaker: {viewingParticipant.tiebreaker.homeScore} - {viewingParticipant.tiebreaker.awayScore} ({viewingParticipant.tiebreaker.totalScore ?? (viewingParticipant.tiebreaker.homeScore + viewingParticipant.tiebreaker.awayScore)} pts)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingParticipant(null)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scroll sideways hint on smaller screens */}
              <div className="xl:hidden flex items-center justify-center gap-1.5 py-1 px-2.5 mt-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Scroll sideways to view all 5 rounds</span>
              </div>

              {/* Modal Body: Old School 5-Column Bracket Canvas */}
              <div className="overflow-x-auto overflow-y-auto flex-1 py-2 sm:py-3 pr-1">
                <div className="min-w-[720px] sm:min-w-[880px] lg:min-w-[1020px] py-1 sm:py-2">
                  <div className="grid grid-cols-5 gap-2 sm:gap-3.5 items-stretch">
                    {/* Col 1: AFC Wild Card */}
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        AFC Wild Card
                      </div>
                      {renderViewerMatchupBox("afc_wc_1")}
                      {renderViewerMatchupBox("afc_wc_2")}
                      {renderViewerMatchupBox("afc_wc_3")}
                    </div>

                    {/* Col 2: AFC Divisional */}
                    <div className="flex flex-col justify-around h-full py-2 sm:py-4 gap-2 sm:gap-4">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        AFC Divisional
                      </div>
                      {renderViewerMatchupBox("afc_div_1")}
                      {renderViewerMatchupBox("afc_div_2")}
                    </div>

                    {/* Col 3: Center Column (AFC Champ, Super Bowl with Trophy & Tiebreaker, NFC Champ) */}
                    <div className="flex flex-col justify-between h-full py-1 gap-2 sm:gap-3.5 items-center">
                      {/* AFC Championship */}
                      <div className="w-full">
                        <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
                          AFC Championship
                        </div>
                        {renderViewerMatchupBox("afc_champ", "AFC Title Game")}
                      </div>

                      {/* Super Bowl Center Card */}
                      <div className="w-full bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center gap-1.5 sm:gap-2 text-center shadow-md">
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="font-black text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-200">
                            Super Bowl LIX
                          </span>
                        </div>

                        {/* Super Bowl Matchup */}
                        <div className="w-full text-left">
                          {renderViewerMatchupBox("super_bowl", "Super Bowl")}
                        </div>

                        {/* Predicted Champion Hero */}
                        {viewingParticipant.superBowlWinner && (
                          <div className="w-full pt-1 sm:pt-1.5 border-t border-purple-300/30 dark:border-purple-800/40 flex items-center justify-between text-[10px] sm:text-xs">
                            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-400">
                              Champ Pick:
                            </span>
                            <span className="font-black text-slate-900 dark:text-white flex items-center gap-1">
                              <TeamLogo alt={viewingParticipant.superBowlWinner} width={14} height={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain" />
                              <span className="truncate max-w-[90px] sm:max-w-none">{TEAM_BY_ABBR[viewingParticipant.superBowlWinner]?.name || viewingParticipant.superBowlWinner}</span>
                            </span>
                          </div>
                        )}

                        {/* Predicted Tiebreaker Score */}
                        {viewingParticipant.tiebreaker && (
                          <div className="w-full pt-1 sm:pt-1.5 border-t border-purple-200/40 dark:border-purple-800/30 flex items-center justify-between text-[9px] sm:text-[11px]">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              Tiebreaker:
                            </span>
                            <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                              {viewingParticipant.tiebreaker.homeScore}-{viewingParticipant.tiebreaker.awayScore}{" "}
                              <span className="text-[8px] sm:text-[10px] text-slate-400">
                                ({viewingParticipant.tiebreaker.totalScore ?? (viewingParticipant.tiebreaker.homeScore + viewingParticipant.tiebreaker.awayScore)} pts)
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* NFC Championship */}
                      <div className="w-full">
                        <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
                          NFC Championship
                        </div>
                        {renderViewerMatchupBox("nfc_champ", "NFC Title Game")}
                      </div>
                    </div>

                    {/* Col 4: NFC Divisional */}
                    <div className="flex flex-col justify-around h-full py-2 sm:py-4 gap-2 sm:gap-4">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        NFC Divisional
                      </div>
                      {renderViewerMatchupBox("nfc_div_1")}
                      {renderViewerMatchupBox("nfc_div_2")}
                    </div>

                    {/* Col 5: NFC Wild Card */}
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        NFC Wild Card
                      </div>
                      {renderViewerMatchupBox("nfc_wc_1")}
                      {renderViewerMatchupBox("nfc_wc_2")}
                      {renderViewerMatchupBox("nfc_wc_3")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold">
                  Score: <span className="text-slate-900 dark:text-white font-black">{viewingParticipant.score} / 13</span> pts
                  {isSimulated && (
                    <span className="ml-1 sm:ml-2 text-[10px] sm:text-[11px] text-purple-600 dark:text-purple-400">
                      ({viewingParticipant.score} correct)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setViewingParticipant(null)}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl transition shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: CLEAR PICKS CONFIRMATION */}
      {showClearModal && (
        <div
          onClick={() => setShowClearModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Clear All Picks?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  This will remove all 13 of your playoff picks and reset your tiebreaker score. You can make new picks anytime before the tournament locks.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearPicks}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-xs"
              >
                Clear All Picks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RULES & SCORING POPUP */}
      {showRulesModal && (
        <div
          onClick={() => setShowRulesModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Rules &amp; Scoring</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Playoff Challenge Summary</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <strong className="text-slate-900 dark:text-white font-bold block mb-0.5">1 Point Per Game (Max 13 Pts)</strong>
                <span>Score 1 pt for each correct winner across Wild Card (6), Divisional (4), Conference (2), and Super Bowl (1).</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <strong className="text-slate-900 dark:text-white font-bold block mb-0.5">3-Tier Super Bowl Tiebreaker</strong>
                <span>If points are tied, the winner is decided by: (1) Closest combined score &bull; (2) Closest home team score &bull; (3) Closest away team score.</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <strong className="text-slate-900 dark:text-white font-bold block mb-0.5">NFL Reseeding</strong>
                <span>In the Divisional round, the #1 seed automatically plays the lowest remaining seed that advanced from the Wild Card round.</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl transition shadow-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-2xl shadow-xl animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
