"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Check,
  Copy,
  Share2,
  Plus,
  PlusCircle,
  Shield,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { TeamLogo } from "@/components/TeamLogo";
import { GameSwitcherDropdown } from "@/components/GameSwitcherDropdown";
import { UserSettingsModal } from "@/components/UserSettingsModal";
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
  BracketPool,
  UserBracketPool,
  extractBracketCode,
} from "@/lib/playoff-bracket";

const STORAGE_PICKS_KEY = "pocketpicks_bracket_picks_v3";
const STORAGE_TIEBREAKER_KEY = "pocketpicks_bracket_tb_v3";

function BracketApp() {
  const { user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Pool state
  const rawIdParam = searchParams.get("id");
  const poolId = useMemo(() => (rawIdParam ? extractBracketCode(rawIdParam) : ""), [rawIdParam]);
  const [poolData, setPoolData] = useState<BracketPool | null>(null);
  const [userPools, setUserPools] = useState<UserBracketPool[]>([]);
  const [poolsFetched, setPoolsFetched] = useState(false);
  const [loadingPool, setLoadingPool] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [userRole, setUserRole] = useState<"commissioner" | "member" | "viewer">("viewer");

  // Dropdown menus
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showUserPoolsMenu, setShowUserPoolsMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userPoolsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    if (!userDropdownOpen && !showUserPoolsMenu) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
      if (userPoolsMenuRef.current && !userPoolsMenuRef.current.contains(target)) {
        setShowUserPoolsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [userDropdownOpen, showUserPoolsMenu]);

  // Clean up pending storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("pending_bracket_code");
        localStorage.removeItem("pending_redirect_after_auth");
        localStorage.removeItem("pending_join_code");
      } catch {}
    }
  }, []);

  const handleLogout = async () => {
    try {
      setUserDropdownOpen(false);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("last_active_league");
          localStorage.removeItem("pending_join_code");
          localStorage.removeItem("pending_bracket_code");
        } catch {}
      }
      await signOut(auth);
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const [activeTab, setActiveTab] = useState<"bracket" | "leaderboard">("bracket");
  const tabScrollMap = useRef<Record<string, number>>({ bracket: 0, leaderboard: 0 });

  const handleTabChange = useCallback((newTab: "bracket" | "leaderboard") => {
    if (newTab === activeTab) return;
    tabScrollMap.current[activeTab] = window.scrollY;
    setActiveTab(newTab);
    requestAnimationFrame(() => {
      window.scrollTo({
        top: tabScrollMap.current[newTab] ?? 0,
        behavior: "instant",
      });
    });
  }, [activeTab]);

  const [mobileRoundTab, setMobileRoundTab] = useState<"wc" | "div" | "conf" | "sb">("wc");
  const [bracketViewMode, setBracketViewMode] = useState<"actual" | "projected">("actual");

  // Mobile swipe gesture between rounds
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const ROUND_TABS: ("wc" | "div" | "conf" | "sb")[] = ["wc", "div", "conf", "sb"];

  const handleMobileTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleMobileTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const diffX = touchStartXRef.current - e.changedTouches[0].clientX;
    const diffY = touchStartYRef.current - e.changedTouches[0].clientY;

    // Minimum swipe threshold (45px) and ensure horizontal gesture is dominant
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      const currentIdx = ROUND_TABS.indexOf(mobileRoundTab);
      if (diffX > 0 && currentIdx < ROUND_TABS.length - 1) {
        // Swiped left -> advance to next round
        setMobileRoundTab(ROUND_TABS[currentIdx + 1]);
      } else if (diffX < 0 && currentIdx > 0) {
        // Swiped right -> go to previous round
        setMobileRoundTab(ROUND_TABS[currentIdx - 1]);
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Modals state
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [viewingParticipant, setViewingParticipant] = useState<BracketParticipant | null>(null);

  // Pool management modals
  const [showCreatePoolModal, setShowCreatePoolModal] = useState(false);
  const [createPoolName, setCreatePoolName] = useState("");
  const [creatingPool, setCreatingPool] = useState(false);

  const [showJoinPoolModal, setShowJoinPoolModal] = useState(false);
  const [joinPoolCode, setJoinPoolCode] = useState("");
  const [joiningPool, setJoiningPool] = useState(false);
  const [joinError, setJoinError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [poolToDelete, setPoolToDelete] = useState<string | null>(null);
  const [deletingPool, setDeletingPool] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [poolToLeave, setPoolToLeave] = useState<string | null>(null);
  const [leavingPool, setLeavingPool] = useState(false);

  // Share pool modal
  const [showShareModal, setShowShareModal] = useState(false);

  // Prevent background scrolling when any modal is open
  const isAnyModalOpen = Boolean(
    showRulesModal ||
    showClearModal ||
    viewingParticipant ||
    showCreatePoolModal ||
    showJoinPoolModal ||
    showDeleteModal ||
    showLeaveModal ||
    showShareModal
  );

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

  // Bracket Picks and Simulation state
  const [picks, setPicks] = useState<BracketPicks>({});
  const [tiebreaker, setTiebreaker] = useState<TiebreakerPrediction>({
    homeScore: 0,
    awayScore: 0,
    totalScore: 0,
  });
  const [homeScoreInput, setHomeScoreInput] = useState<string>("");
  const [awayScoreInput, setAwayScoreInput] = useState<string>("");
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [results, setResults] = useState<SimulationResults>({});
  const [isSimulated, setIsSimulated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [leaderboard, setLeaderboard] = useState<BracketParticipant[]>([]);
  const [savingPicks, setSavingPicks] = useState(false);
  const [simulating, setSimulating] = useState(false);
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
      return (await auth.currentUser?.getIdToken()) || null;
    } catch {
      return null;
    }
  }, []);

  // Fetch bracket pool data or user's pool list
  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const fetchBracketData = async () => {
      setLoadingPool(true);
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const url = poolId ? `/api/bracket?id=${encodeURIComponent(poolId)}` : "/api/bracket";
        const res = await fetch(url, { headers });
        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          if (!active) return;

          setUserPools(data.userPools || []);
          setPoolsFetched(true);

          if (data.pool) {
            setPoolData(data.pool);
            setResults(data.pool.results || {});
            setIsSimulated(!!data.pool.isSimulated);
            setIsLocked(!!data.pool.isLocked);
            setLeaderboard(data.leaderboard || []);
            setIsOwner(!!data.isOwner);
            setUserRole(data.role || "viewer");

            // Auto-join pool if authenticated user opened via direct link and is not yet a member
            if (user && token && data.role === "viewer" && !data.isOwner) {
              fetch("/api/bracket/join", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ code: data.pool.joinCode || poolId }),
              })
                .then(async (joinRes) => {
                  if (joinRes.ok) {
                    setUserRole("member");
                    const poolsRes = await fetch("/api/bracket", { headers: { Authorization: `Bearer ${token}` } });
                    if (poolsRes.ok) {
                      const poolsData = await poolsRes.json();
                      if (poolsData.userPools) setUserPools(poolsData.userPools);
                    }
                  }
                })
                .catch(() => null);
            }

            if (data.currentUserEntry?.picks) {
              setPicks(data.currentUserEntry.picks);
            } else {
              setPicks({});
            }

            if (
              data.currentUserEntry?.tiebreaker &&
              (Number(data.currentUserEntry.tiebreaker.homeScore) > 0 ||
                Number(data.currentUserEntry.tiebreaker.awayScore) > 0)
            ) {
              setTiebreaker(data.currentUserEntry.tiebreaker);
              setHomeScoreInput(String(data.currentUserEntry.tiebreaker.homeScore));
              setAwayScoreInput(String(data.currentUserEntry.tiebreaker.awayScore));
            } else {
              setTiebreaker({ homeScore: 0, awayScore: 0, totalScore: 0 });
              setHomeScoreInput("");
              setAwayScoreInput("");
            }
          } else {
            // No specific pool loaded: if user has pools, auto-forward to the first one
            setPoolData(null);
            if (data.userPools && data.userPools.length > 0 && !poolId) {
              const defaultPool = data.userPools[0];
              router.replace(`/bracket?id=${encodeURIComponent(defaultPool.joinCode || defaultPool.id)}`);
            }
          }
        } else if (res.status === 404 && poolId) {
          showToast("Bracket pool not found. Please check your code.");
          setPoolData(null);
          setPoolsFetched(true);
        }
      } catch (err) {
        console.error("Failed to fetch bracket data:", err);
      } finally {
        if (active) setLoadingPool(false);
      }
    };

    fetchBracketData();
    return () => {
      active = false;
    };
  }, [authLoading, user, poolId, getAuthToken, router, showToast]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  // Save picks and tiebreaker to Firestore backend for the active pool
  const savePicksToBackend = useCallback(
    async (newPicks: BracketPicks, newTb: TiebreakerPrediction) => {
      if (!user || isLocked || !poolId) return;
      setSavingPicks(true);
      try {
        const token = await getAuthToken();
        if (!token) return;

        const res = await fetch(`/api/bracket/${encodeURIComponent(poolId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            picks: newPicks,
            tiebreaker: newTb,
            userName: user.name || user.username || "Participant",
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
    [user, isLocked, poolId, getAuthToken]
  );

  const debouncedSavePicksToBackend = useCallback(
    (newPicks: BracketPicks, newTb: TiebreakerPrediction, delayMs = 600) => {
      if (!user || isLocked || !poolId) return;
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      setSavingPicks(true);
      saveDebounceRef.current = setTimeout(() => {
        savePicksToBackend(newPicks, newTb);
      }, delayMs);
    },
    [user, isLocked, poolId, savePicksToBackend]
  );

  // Handle pick selection and cascade clearing of downstream invalid picks
  const handleSelectTeam = (gameId: BracketGameId, teamAbbr: string) => {
    if (isLocked) return;

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

    const homeVal =
      field === "home"
        ? cleanStr === ""
          ? 0
          : parseInt(cleanStr, 10)
        : homeScoreInput === ""
        ? 0
        : parseInt(homeScoreInput, 10);
    const awayVal =
      field === "away"
        ? cleanStr === ""
          ? 0
          : parseInt(cleanStr, 10)
        : awayScoreInput === ""
        ? 0
        : parseInt(awayScoreInput, 10);

    const nextTb: TiebreakerPrediction = {
      homeScore: homeVal,
      awayScore: awayVal,
      totalScore: homeVal + awayVal,
    };
    setTiebreaker(nextTb);
    debouncedSavePicksToBackend(picks, nextTb, 600);
  };

  const handleTiebreakerBlur = () => {
    // Keep inputs empty if left empty
  };

  // Simulate outcomes button handler (commissioner only)
  const handleSimulate = async () => {
    if (!poolId || !user) {
      showToast("Please sign in to simulate playoff scores.");
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
        body: JSON.stringify({ poolId, action: "simulate" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(true);
        setIsLocked(true);
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

  // Reset simulation handler (commissioner only)
  const handleResetSimulation = async () => {
    if (!poolId || !user) {
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
        body: JSON.stringify({ poolId, action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || {});
        setIsSimulated(false);
        setIsLocked(false);
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

  // Toggle lock handler (commissioner only)
  const handleToggleLock = async () => {
    if (!poolId || !user || !isOwner) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/bracket/${encodeURIComponent(poolId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "toggle_lock", isLocked: !isLocked }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsLocked(!!data.isLocked);
        showToast(data.isLocked ? "🔒 Bracket locked for all members." : "🔓 Bracket unlocked for picks.");
      }
    } catch (err) {
      console.error("Error toggling lock:", err);
    }
  };

  // Create new bracket pool handler
  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Please log in to create a bracket pool.");
      return;
    }
    setCreatingPool(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: createPoolName.trim() || "Playoff Bracket Challenge" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create bracket pool");
      }
      setShowCreatePoolModal(false);
      setCreatePoolName("");
      showToast(`Created bracket pool: ${data.name || data.poolId}`);
      router.push(`/bracket?id=${encodeURIComponent(data.poolId)}`);
    } catch (err: any) {
      showToast(err.message || "Failed to create bracket pool");
    } finally {
      setCreatingPool(false);
    }
  };

  // Join bracket pool handler
  const handleJoinPool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Please log in to join a bracket pool.");
      return;
    }
    const clean = extractBracketCode(joinPoolCode);
    if (!clean) {
      setJoinError("Please enter a valid 5-character code or link.");
      return;
    }
    setJoiningPool(true);
    setJoinError("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/bracket/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join bracket pool");
      }
      setShowJoinPoolModal(false);
      setJoinPoolCode("");
      showToast(`Joined bracket pool: ${data.name || data.poolId}`);
      router.push(`/bracket?id=${encodeURIComponent(data.poolId)}`);
    } catch (err: any) {
      setJoinError(err.message || "Failed to join bracket pool");
    } finally {
      setJoiningPool(false);
    }
  };

  // Confirm delete bracket pool
  const handleConfirmDeletePool = async () => {
    if (!poolToDelete || !user) return;
    setDeletingPool(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/bracket/${encodeURIComponent(poolToDelete)}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete bracket pool");

      showToast("Bracket pool permanently deleted.");
      setShowDeleteModal(false);
      const remaining = userPools.filter((p) => p.id !== poolToDelete && p.joinCode !== poolToDelete);
      setUserPools(remaining);
      setPoolToDelete(null);

      if (remaining.length > 0) {
        router.push(`/bracket?id=${encodeURIComponent(remaining[0].id)}`);
      } else {
        router.push("/bracket");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete bracket pool");
    } finally {
      setDeletingPool(false);
    }
  };

  // Confirm leave bracket pool
  const handleConfirmLeavePool = async () => {
    if (!poolToLeave || !user) return;
    setLeavingPool(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/bracket/${encodeURIComponent(poolToLeave)}/leave`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave bracket pool");

      showToast("Left bracket pool successfully.");
      setShowLeaveModal(false);
      const remaining = userPools.filter((p) => p.id !== poolToLeave && p.joinCode !== poolToLeave);
      setUserPools(remaining);
      setPoolToLeave(null);

      if (remaining.length > 0) {
        router.push(`/bracket?id=${encodeURIComponent(remaining[0].id)}`);
      } else {
        router.push("/bracket");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to leave bracket pool");
    } finally {
      setLeavingPool(false);
    }
  };

  // Copy bracket code to clipboard
  const handleCopyCode = useCallback(() => {
    if (!poolId) return;
    const cleanCode = (poolData?.joinCode || poolId).toUpperCase();

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(cleanCode);
      setCopiedCode(true);
      showToast(`Copied bracket code: ${cleanCode}`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [poolId, poolData, showToast]);

  // Clear user picks and tiebreaker via modal
  const handleConfirmClearPicks = () => {
    setPicks({});
    const emptyTb: TiebreakerPrediction = { homeScore: 0, awayScore: 0, totalScore: 0 };
    setTiebreaker(emptyTb);
    setHomeScoreInput("");
    setAwayScoreInput("");
    try {
      localStorage.removeItem(STORAGE_PICKS_KEY);
    } catch {}
    savePicksToBackend({}, emptyTb);
    setShowClearModal(false);
    showToast("All picks and tiebreaker scores cleared");
  };

  // Matchup resolvers: User Projected Picks vs Actual Tournament Field
  const actualWinners = useMemo(() => extractActualWinners(results), [results]);
  const actualTournamentMatchups = useMemo(() => resolveBracketMatchups(actualWinners), [actualWinners]);
  const userProjectedMatchups = useMemo(() => resolveBracketMatchups(picks), [picks]);

  const isDisplayingActual = isSimulated && bracketViewMode === "actual";
  const activeMatchups = isDisplayingActual ? actualTournamentMatchups : userProjectedMatchups;

  const scoreDetails = useMemo(() => calculateBracketScore(picks, results, tiebreaker), [picks, results, tiebreaker]);
  const completedPicksCount = useMemo(() => Object.keys(picks).length, [picks]);

  // Render matchup card
  const renderMatchupCard = (slotKey: BracketGameId) => {
    const slot = activeMatchups[slotKey];
    const userPickAbbr = picks[slotKey];
    const gameResult = results[slotKey];
    const isGameDone = isSimulated && gameResult?.isCompleted;

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
        className={`w-full bg-white dark:bg-slate-900 border rounded-2xl p-2 sm:p-2.5 transition-all shadow-xs flex flex-col gap-1.5 ${
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

        {/* Sub-line if predicted pick was eliminated */}
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

  // Render team row
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
        className={`w-full flex items-center justify-between px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-left font-bold text-xs transition-all ${
          isPickCorrect
            ? "bg-emerald-600 text-white shadow-xs"
            : isPickWrong
            ? "bg-rose-600 text-white shadow-xs dark:bg-rose-600 dark:text-white"
            : isSelected
            ? "bg-emerald-600 text-white shadow-xs"
            : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
        } ${isLocked ? "cursor-default opacity-90" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className={`w-4 h-4 sm:w-4.5 sm:h-4.5 flex items-center justify-center rounded-md text-[9px] sm:text-[10px] font-black shrink-0 ${
              isPickCorrect || isPickWrong || isSelected
                ? "bg-white/20 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {team.seed}
          </span>
          <TeamLogo alt={team.abbr} width={18} height={18} className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 object-contain" />
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

  const sbHomeName = activeMatchups.super_bowl.homeTeam?.name || "Home Team";
  const sbAwayName = activeMatchups.super_bowl.awayTeam?.name || "Away Team";

  // Super Bowl Champion Center Card
  const renderSuperBowlCenterCard = () => (
    <div className="w-full bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 flex flex-col items-center gap-2 text-center shadow-md">
      <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 shrink-0" />
      <div className="font-black text-[10px] sm:text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
        Super Bowl Champion
      </div>
      {renderMatchupCard("super_bowl")}

      {/* Super Bowl Tiebreaker Prediction Card */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-xs flex flex-col gap-1.5 mt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
            Tiebreaker: Final Score
          </span>
          <span className="text-[10px] text-slate-400 font-bold">
            Total: {homeScoreInput || awayScoreInput ? (Number(homeScoreInput || 0) + Number(awayScoreInput || 0)) : "—"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-left">
          <div>
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate block mb-1">
              {sbAwayName}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isLocked}
              value={awayScoreInput}
              onChange={(e) => handleTiebreakerInputChange("away", e.target.value)}
              placeholder="0"
              className="w-full font-mono text-center font-bold text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:opacity-80"
            />
          </div>
          <div>
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate block mb-1">
              {sbHomeName}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isLocked}
              value={homeScoreInput}
              onChange={(e) => handleTiebreakerInputChange("home", e.target.value)}
              placeholder="0"
              className="w-full font-mono text-center font-bold text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:opacity-80"
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted || authLoading) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading playoff bracket...</span>
      </div>
    );
  }

  const cleanDisplayCode = poolId ? (poolData?.joinCode || poolId).toUpperCase() : "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex flex-col font-sans w-full max-w-full">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Branding & Game Switcher & Bracket Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <GameSwitcherDropdown currentGame="bracket" />

            {/* Bracket Title & 5-Character Code Pill */}
            {poolData ? (
              <div className="min-w-0 flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight leading-none text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[200px]">
                  {poolData.name}
                </h1>
                {cleanDisplayCode && (
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="inline-flex items-center text-[11px] font-mono font-black tracking-wider px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/30 transition cursor-pointer shrink-0"
                    title="Click to view share code and link"
                  >
                    <span>{cleanDisplayCode}</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Right: Simulation Controls & Brackets Dropdown & Theme & User Info */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Simulation controls (commissioner only) */}
            {user && isOwner && poolData && (
              <>
                {isSimulated ? (
                  <button
                    type="button"
                    onClick={handleResetSimulation}
                    disabled={simulating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors cursor-pointer"
                    title="Generate realistic playoff outcomes to test scoring"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
                    <span>Simulate Scores</span>
                  </button>
                )}

                {/* Clear Picks Button */}
                {!isLocked && completedPicksCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Clear your picks"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Clear</span>
                  </button>
                )}
              </>
            )}

            {/* Brackets Dropdown (Created vs Joined) */}
            {user ? (
              <div ref={userPoolsMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserPoolsMenu((prev) => !prev)}
                  className="inline-flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer"
                  title="Switch between your bracket pools"
                >
                  <Trophy className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="hidden sm:inline">
                    {userPools.length > 0 ? `My Brackets (${userPools.length})` : "Brackets"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform ${showUserPoolsMenu ? "rotate-180" : ""}`}
                  />
                </button>

                {showUserPoolsMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserPoolsMenu(false)} />
                    <div className="absolute right-0 mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 text-xs max-h-96 overflow-y-auto">
                      {/* Header with quick Join & Create buttons */}
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          My Playoff Brackets
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserPoolsMenu(false);
                              setJoinPoolCode("");
                              setJoinError("");
                              setShowJoinPoolModal(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                          >
                            <LogIn className="w-2.5 h-2.5" />
                            Join
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserPoolsMenu(false);
                              setCreatePoolName("");
                              setShowCreatePoolModal(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow-2xs"
                          >
                            <PlusCircle className="w-2.5 h-2.5" />
                            New
                          </button>
                        </div>
                      </div>

                      {userPools.length === 0 ? (
                        <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                          You haven&apos;t created or joined any bracket pools yet.
                        </div>
                      ) : (
                        <>
                          {userPools.filter((p) => p.role === "commissioner").length > 0 && (
                            <div>
                              <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span>Brackets You Run</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                                  {userPools.filter((p) => p.role === "commissioner").length}
                                </span>
                              </div>
                              {userPools
                                .filter((p) => p.role === "commissioner")
                                .map((p) => {
                                  const cCode = (p.joinCode || p.id).toUpperCase();
                                  const isCurrent = cleanDisplayCode === cCode;
                                  return (
                                    <div
                                      key={p.id}
                                      className={`px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                                        isCurrent
                                          ? "bg-purple-500/10 font-bold text-purple-700 dark:text-purple-400"
                                          : "text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      <Link
                                        href={`/bracket?id=${cCode}`}
                                        onClick={() => setShowUserPoolsMenu(false)}
                                        className="min-w-0 pr-2 flex-1"
                                      >
                                        <div className="font-bold truncate flex items-center gap-1.5">
                                          <span className="truncate">{p.name}</span>
                                          {cCode && (
                                            <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                              {cCode}
                                            </span>
                                          )}
                                        </div>
                                      </Link>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPoolToDelete(p.id);
                                            setShowDeleteModal(true);
                                            setShowUserPoolsMenu(false);
                                          }}
                                          title="Delete this bracket pool"
                                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}

                          {userPools.filter((p) => p.role === "member").length > 0 && (
                            <div className={userPools.filter((p) => p.role === "commissioner").length > 0 ? "border-t border-slate-100 dark:border-slate-800 mt-1 pt-1" : ""}>
                              <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span>Joined Brackets</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                                  {userPools.filter((p) => p.role === "member").length}
                                </span>
                              </div>
                              {userPools
                                .filter((p) => p.role === "member")
                                .map((p) => {
                                  const cCode = (p.joinCode || p.id).toUpperCase();
                                  const isCurrent = cleanDisplayCode === cCode;
                                  return (
                                    <div
                                      key={p.id}
                                      className={`px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                                        isCurrent
                                          ? "bg-purple-500/10 font-bold text-purple-700 dark:text-purple-400"
                                          : "text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      <Link
                                        href={`/bracket?id=${cCode}`}
                                        onClick={() => setShowUserPoolsMenu(false)}
                                        className="min-w-0 pr-2 flex-1"
                                      >
                                        <div className="font-bold truncate flex items-center gap-1.5">
                                          <span className="truncate">{p.name}</span>
                                          {cCode && (
                                            <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                              {cCode}
                                            </span>
                                          )}
                                        </div>
                                      </Link>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPoolToLeave(p.id);
                                            setShowLeaveModal(true);
                                            setShowUserPoolsMenu(false);
                                          }}
                                          title="Leave this bracket pool"
                                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                        >
                                          <LogOut className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </>
                      )}

                    </div>
                  </>
                )}
              </div>
            ) : null}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
              title="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Auth Info / Login */}
            {authLoading ? (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : user ? (
              <div ref={userDropdownRef} className="relative pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 text-left transition-opacity hover:opacity-80 cursor-pointer"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${
                      user.avatarColor || "bg-emerald-600"
                    } flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs transition-colors`}
                    title={user.name || user.email}
                  >
                    {((user.name || user.username || user.email || "U").charAt(0) || "U").toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[100px]">
                      {user.name || user.username || (user.email ? user.email.split("@")[0] : "User")}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-tight">
                      Account
                    </span>
                  </div>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name || user.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setShowSettings(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-400" />
                        Settings
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(poolId ? `/bracket?id=${poolId}` : "/bracket")}`}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href={`/auth/register?redirect=${encodeURIComponent(poolId ? `/bracket?id=${poolId}` : "/bracket")}`}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sub-header Navigation Tabs */}
        {poolData && (
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

                {/* Rules Modal Button */}
                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition whitespace-nowrap shrink-0 cursor-pointer"
                  title="View Rules & Scoring"
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Rules</span>
                </button>
              </div>

              {/* Right: Desktop Controls & Indicators */}
              <div className="hidden lg:flex items-center gap-2.5 shrink-0">
                {/* Lock Status indicator */}
                {isLocked ? (
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Locked
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    Open for Picks
                  </span>
                )}

                {/* Commissioner Lock toggle button */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleToggleLock}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    {isLocked ? "Unlock Bracket" : "Lock Bracket"}
                  </button>
                )}

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
                    <span>{scoreDetails.score} / 13 pts</span>
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
        {/* Zero State: No Pools Found */}
        {user && poolsFetched && userPools.length === 0 && !poolId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto my-auto py-12">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/20 mb-5">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Playoff Bracket Challenge
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Pick winners for all 13 postseason games with realistic reseeding and compete with friends. Create your own private bracket pool or join with a 5-digit code.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setCreatePoolName("");
                  setShowCreatePoolModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Playoff Bracket</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setJoinPoolCode("");
                  setJoinError("");
                  setShowJoinPoolModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm shadow-2xs transition cursor-pointer"
              >
                <Users className="w-4 h-4 text-purple-500" />
                <span>Join With Code</span>
              </button>
            </div>
          </div>
        ) : loadingPool ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <span className="text-xs font-bold text-slate-500">Loading bracket pool...</span>
          </div>
        ) : !poolData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto py-12">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Bracket Not Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              We couldn&apos;t find a bracket pool matching that code. Check your link or join another bracket.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setJoinPoolCode("");
                  setJoinError("");
                  setShowJoinPoolModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
              >
                Enter Code
              </button>
              <button
                type="button"
                onClick={() => router.push("/bracket")}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
              >
                Home
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: BRACKET CANVAS VIEW */}
            {activeTab === "bracket" && (
              <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
                {/* Mobile View with swipe gesture support between rounds */}
                <div
                  className="xl:hidden flex flex-col gap-4 w-full touch-pan-y"
                  onTouchStart={handleMobileTouchStart}
                  onTouchEnd={handleMobileTouchEnd}
                >
                  <div className="flex flex-col gap-2.5">
                    {isSimulated && (
                      <div className="flex items-center justify-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold mx-auto max-w-xs w-full">
                        <button
                          type="button"
                          onClick={() => setBracketViewMode("actual")}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
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
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                            bracketViewMode === "projected"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-2xs"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          My Picks Tree
                        </button>
                      </div>
                    )}

                    {/* Mobile Round Selection Tabs */}
                    <div className="flex items-center justify-between gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setMobileRoundTab("wc")}
                        className={`flex-1 py-1.5 px-2 rounded-xl transition text-center ${
                          mobileRoundTab === "wc"
                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                        }`}
                      >
                        Wild Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileRoundTab("div")}
                        className={`flex-1 py-1.5 px-2 rounded-xl transition text-center ${
                          mobileRoundTab === "div"
                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                        }`}
                      >
                        Divisional
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileRoundTab("conf")}
                        className={`flex-1 py-1.5 px-2 rounded-xl transition text-center ${
                          mobileRoundTab === "conf"
                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                        }`}
                      >
                        Conference
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileRoundTab("sb")}
                        className={`flex-1 py-1.5 px-2 rounded-xl transition text-center ${
                          mobileRoundTab === "sb"
                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                        }`}
                      >
                        Super Bowl
                      </button>
                    </div>

                    {/* Subtle round indicator dots */}
                    <div className="flex items-center justify-center gap-1.5 pt-0.5">
                      {ROUND_TABS.map((tab, idx) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setMobileRoundTab(tab)}
                          aria-label={`Go to round ${idx + 1}`}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            mobileRoundTab === tab
                              ? "w-5 bg-emerald-500"
                              : "w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Mobile Round Content */}
                  <div className="flex flex-col items-center gap-4 w-full">
                    {mobileRoundTab === "wc" && (
                    <div className="w-full flex flex-col gap-4">
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          AFC Wild Card
                        </div>
                        {renderMatchupCard("afc_wc_1")}
                        {renderMatchupCard("afc_wc_2")}
                        {renderMatchupCard("afc_wc_3")}
                      </div>

                      <div className="flex flex-col items-center gap-3 w-full pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-center font-black text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          NFC Wild Card
                        </div>
                        {renderMatchupCard("nfc_wc_1")}
                        {renderMatchupCard("nfc_wc_2")}
                        {renderMatchupCard("nfc_wc_3")}
                      </div>
                    </div>
                  )}

                  {mobileRoundTab === "div" && (
                    <div className="w-full flex flex-col gap-4">
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          AFC Divisional
                        </div>
                        {renderMatchupCard("afc_div_1")}
                        {renderMatchupCard("afc_div_2")}
                      </div>

                      <div className="flex flex-col items-center gap-3 w-full pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-center font-black text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          NFC Divisional
                        </div>
                        {renderMatchupCard("nfc_div_1")}
                        {renderMatchupCard("nfc_div_2")}
                      </div>
                    </div>
                  )}

                  {mobileRoundTab === "conf" && (
                    <div className="w-full flex flex-col items-center gap-4">
                      <div className="w-full flex flex-col items-center gap-3">
                        <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          AFC Championship
                        </div>
                        {renderMatchupCard("afc_champ")}
                      </div>

                      <div className="w-full flex flex-col items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-center font-black text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          NFC Championship
                        </div>
                        {renderMatchupCard("nfc_champ")}
                      </div>
                    </div>
                  )}

                  {mobileRoundTab === "sb" && (
                    <div className="w-full flex flex-col items-center gap-4">
                      {renderSuperBowlCenterCard()}
                    </div>
                  )}
                  </div>
                </div>

                {/* Desktop 7-Column Balanced Interactive Bracket Canvas */}
                <div className="hidden xl:block w-full pb-4">
                  <div className="w-full grid grid-cols-7 gap-1.5 2xl:gap-2.5 items-stretch py-2">
                    {/* Col 1: AFC Wild Card */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 py-1 mb-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        AFC Wild Card
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-2 gap-3">
                        {renderMatchupCard("afc_wc_1")}
                        {renderMatchupCard("afc_wc_2")}
                        {renderMatchupCard("afc_wc_3")}
                      </div>
                    </div>

                    {/* Col 2: AFC Divisional */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 py-1 mb-2">
                        AFC Divisional
                      </div>
                      <div className="flex-1 flex flex-col justify-around py-4">
                        {renderMatchupCard("afc_div_1")}
                        {renderMatchupCard("afc_div_2")}
                      </div>
                    </div>

                    {/* Col 3: AFC Championship */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 py-1 mb-2">
                        AFC Championship
                      </div>
                      <div className="flex-1 flex flex-col justify-center py-4">
                        {renderMatchupCard("afc_champ")}
                      </div>
                    </div>

                    {/* Col 4: Super Bowl (Center of bracket) */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5 py-1 mb-2">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        Super Bowl
                      </div>
                      <div className="flex-1 flex flex-col justify-center items-center py-2">
                        {renderSuperBowlCenterCard()}
                      </div>
                    </div>

                    {/* Col 5: NFC Championship */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 py-1 mb-2">
                        NFC Championship
                      </div>
                      <div className="flex-1 flex flex-col justify-center py-4">
                        {renderMatchupCard("nfc_champ")}
                      </div>
                    </div>

                    {/* Col 6: NFC Divisional */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 py-1 mb-2">
                        NFC Divisional
                      </div>
                      <div className="flex-1 flex flex-col justify-around py-4">
                        {renderMatchupCard("nfc_div_1")}
                        {renderMatchupCard("nfc_div_2")}
                      </div>
                    </div>

                    {/* Col 7: NFC Wild Card */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center justify-center gap-1.5 py-1 mb-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        NFC Wild Card
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-2 gap-3">
                        {renderMatchupCard("nfc_wc_1")}
                        {renderMatchupCard("nfc_wc_2")}
                        {renderMatchupCard("nfc_wc_3")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LEADERBOARD TABLE */}
            {activeTab === "leaderboard" && (
              <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {poolData.name} Leaderboard
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ranked by total correct picks, followed by the 3-tier Super Bowl tiebreaker.
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-500">
                    {leaderboard.length} {leaderboard.length === 1 ? "participant" : "participants"}
                  </div>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No brackets submitted yet. Make your picks to appear on the leaderboard!
                    </p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
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
                                    ? "bg-purple-50/50 dark:bg-purple-950/20 font-bold"
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
                                          <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">
                                            (You)
                                          </span>
                                        )}
                                      </div>
                                      {entry.tiebreakerExplanation && (
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate">
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

                                <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {totalPicks}/13
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <span className="inline-flex items-center gap-1 font-mono font-black text-sm text-purple-600 dark:text-purple-400">
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
                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
                      : "bg-purple-50 dark:bg-purple-950/70 border border-purple-500/50 text-purple-900 dark:text-purple-200"
                    : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <span
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded text-[8px] sm:text-[9px] font-black shrink-0 ${
                      isPicked
                        ? isCorrect || isWrong
                          ? "bg-white/20 text-white"
                          : "bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200"
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
                      <span className="text-[8px] sm:text-[9px] font-black uppercase px-1 py-0.2 rounded bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200">
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
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scroll sideways hint */}
              <div className="xl:hidden flex items-center justify-center gap-1.5 py-1 px-2.5 mt-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Scroll sideways to view all 7 rounds</span>
              </div>

              {/* 7-Column Balanced Bracket Canvas */}
              <div className="overflow-x-auto overflow-y-auto flex-1 py-2 sm:py-3 pr-1">
                <div className="min-w-[1040px] lg:min-w-[1180px] py-1 sm:py-2">
                  <div className="grid grid-cols-7 gap-2 sm:gap-2.5 items-stretch">
                    {/* Col 1: AFC Wild Card */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1 py-1 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        AFC Wild Card
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1 gap-2">
                        {renderViewerMatchupBox("afc_wc_1")}
                        {renderViewerMatchupBox("afc_wc_2")}
                        {renderViewerMatchupBox("afc_wc_3")}
                      </div>
                    </div>

                    {/* Col 2: AFC Divisional */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 py-1 mb-1.5">
                        AFC Divisional
                      </div>
                      <div className="flex-1 flex flex-col justify-around py-3">
                        {renderViewerMatchupBox("afc_div_1")}
                        {renderViewerMatchupBox("afc_div_2")}
                      </div>
                    </div>

                    {/* Col 3: AFC Championship */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[9px] sm:text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 py-1 mb-1.5">
                        AFC Championship
                      </div>
                      <div className="flex-1 flex flex-col justify-center py-3">
                        {renderViewerMatchupBox("afc_champ")}
                      </div>
                    </div>

                    {/* Col 4: Super Bowl Pick */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 py-1 mb-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        Super Bowl Pick
                      </div>
                      <div className="flex-1 flex flex-col justify-center items-center py-1">
                        <div className="w-full max-w-[240px] bg-gradient-to-b from-purple-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center gap-2 text-center shadow-xs">
                          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500" />
                          <div className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                            Super Bowl Pick
                          </div>
                          {renderViewerMatchupBox("super_bowl")}
                        </div>
                      </div>
                    </div>

                    {/* Col 5: NFC Championship */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[9px] sm:text-[10px] uppercase tracking-wider text-sky-600 dark:text-sky-400 py-1 mb-1.5">
                        NFC Championship
                      </div>
                      <div className="flex-1 flex flex-col justify-center py-3">
                        {renderViewerMatchupBox("nfc_champ")}
                      </div>
                    </div>

                    {/* Col 6: NFC Divisional */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-sky-600 dark:text-sky-400 py-1 mb-1.5">
                        NFC Divisional
                      </div>
                      <div className="flex-1 flex flex-col justify-around py-3">
                        {renderViewerMatchupBox("nfc_div_1")}
                        {renderViewerMatchupBox("nfc_div_2")}
                      </div>
                    </div>

                    {/* Col 7: NFC Wild Card */}
                    <div className="flex flex-col h-full">
                      <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center justify-center gap-1 py-1 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        NFC Wild Card
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1 gap-2">
                        {renderViewerMatchupBox("nfc_wc_1")}
                        {renderViewerMatchupBox("nfc_wc_2")}
                        {renderViewerMatchupBox("nfc_wc_3")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: CLEAR PICKS */}
      {showClearModal && (
        <div
          onClick={() => setShowClearModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative"
          >
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-2">Clear All Picks?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              This will remove all your game selections and reset the bracket canvas. You can make new picks anytime before the tournament locks.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearPicks}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-xs"
              >
                Clear Picks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE BRACKET POOL */}
      {showCreatePoolModal && (
        <div
          onClick={() => setShowCreatePoolModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Create Playoff Bracket Pool
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePoolModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePool} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Bracket Pool Name
                </label>
                <input
                  type="text"
                  value={createPoolName}
                  onChange={(e) => setCreatePoolName(e.target.value)}
                  placeholder="e.g. Office Playoff Challenge"
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  A unique 5-character code will be generated automatically for friends to join.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePoolModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPool}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-md transition cursor-pointer disabled:opacity-60"
                >
                  {creatingPool && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Bracket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: JOIN BRACKET POOL */}
      {showJoinPoolModal && (
        <div
          onClick={() => setShowJoinPoolModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Join Playoff Bracket Pool
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinPoolModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleJoinPool} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  5-Character Code or Invite Link
                </label>
                <input
                  type="text"
                  value={joinPoolCode}
                  onChange={(e) => {
                    setJoinPoolCode(e.target.value);
                    if (joinError) setJoinError("");
                  }}
                  placeholder="e.g. K9W2M or link"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                {joinError && (
                  <p className="text-[11px] font-bold text-rose-500 mt-1.5 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{joinError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinPoolModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningPool || !joinPoolCode.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-md transition cursor-pointer disabled:opacity-60"
                >
                  {joiningPool && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Join Bracket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE BRACKET POOL CONFIRMATION */}
      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-2">
              Delete Bracket Pool?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this bracket pool? This action cannot be undone and will delete all participants&apos; brackets from this pool.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePool}
                disabled={deletingPool}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-xs disabled:opacity-60"
              >
                {deletingPool && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: LEAVE BRACKET POOL CONFIRMATION */}
      {showLeaveModal && (
        <div
          onClick={() => setShowLeaveModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-2">
              Leave Bracket Pool?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to leave this bracket pool? Your bracket picks and score will be removed from the pool leaderboard.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLeavePool}
                disabled={leavingPool}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition cursor-pointer shadow-xs disabled:opacity-60"
              >
                {leavingPool && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Leave Pool</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: SHARE / INVITE MODAL */}
      {showShareModal && poolId && (
        <div
          onClick={() => setShowShareModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Share Bracket Pool
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Invite friends to join this playoff bracket challenge.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 5-Digit Bracket Code Box */}
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                  5-Character Bracket Code
                </span>
                <span className="text-[10px] text-purple-700/80 dark:text-purple-400/80 font-medium">
                  For PocketPicks users
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-purple-300 dark:border-purple-800/80">
                <span className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
                  {cleanDisplayCode}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(cleanDisplayCode);
                      showToast(`Code ${cleanDisplayCode} copied!`);
                    } catch {
                      showToast("Could not copy code");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Friends with an account can click <strong>Join With Code</strong> in the brackets menu and enter this code.
              </p>
            </div>

            {/* Direct Web Link Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Direct Invite Link
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  One-click join link
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/bracket?id=${cleanDisplayCode}` : ""}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const url = typeof window !== "undefined"
                      ? `${window.location.origin}/bracket?id=${cleanDisplayCode}`
                      : `https://pocketpicks.app/bracket?id=${cleanDisplayCode}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      showToast("Invite link copied to clipboard!");
                    } catch {
                      showToast("Could not copy link");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Send this link directly to friends. When they open it, they will be taken straight to this bracket.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: RULES & SCORING */}
      {showRulesModal && (
        <div
          onClick={() => setShowRulesModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Rules &amp; Scoring
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  1. How Scoring Works
                </h4>
                <p>
                  Each correct game pick is worth <strong>1 point</strong> across all 13 postseason games. The maximum possible score is <strong>13 points</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  2. Official NFL Reseeding
                </h4>
                <p>
                  In the Divisional round, the #1 seed ALWAYS hosts the lowest remaining seed. The two middle winners play each other. Your bracket automatically updates with dynamic reseeding as you make your picks.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  3. 3-Tier Super Bowl Tiebreaker
                </h4>
                <p>If participants are tied in points, ties are broken sequentially:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li><strong>Tier 1:</strong> Closest combined total score to the actual Super Bowl.</li>
                  <li><strong>Tier 2:</strong> Closest predicted score for the home team.</li>
                  <li><strong>Tier 3:</strong> Closest predicted score for the away team.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white transition cursor-pointer"
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

      {/* User Settings Modal */}
      <UserSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default function BracketClient() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <span className="text-xs font-bold text-slate-500">Loading playoff bracket...</span>
        </div>
      }
    >
      <BracketApp />
    </Suspense>
  );
}
