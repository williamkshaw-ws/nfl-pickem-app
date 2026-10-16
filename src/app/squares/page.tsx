"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Trophy,
  Printer,
  RotateCcw,
  Shuffle,
  Trash2,
  CheckCircle2,
  Search,
  Users,
  Sparkles,
  Sun,
  Moon,
  AlertTriangle,
  X,
  Share2,
  Globe,
  Loader2,
  Copy,
  Grid,
  Radio,
  RefreshCw,
  ChevronDown,
  Check,
  Tv,
  HelpCircle,
  LogIn,
  UserPlus,
  ChevronRight,
  Settings,
  LogOut,
  Eraser,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { TeamLogo } from "@/components/TeamLogo";
import { GameSwitcherDropdown } from "@/components/GameSwitcherDropdown";
import { UserSettingsModal } from "@/components/UserSettingsModal";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { SquaresBoardState, extractSquaresCode } from "@/lib/squares-validation";

const DEFAULT_TOP_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const DEFAULT_LEFT_NUMBERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const INITIAL_STATE: SquaresBoardState = {
  title: "Super Bowl Squares Pool",
  topTeam: "Buffalo Bills",
  leftTeam: "San Francisco 49ers",
  topNumbers: [...DEFAULT_TOP_NUMBERS],
  leftNumbers: [...DEFAULT_LEFT_NUMBERS],
  grid: {},
  costPerSquare: 10,
  payouts: {
    q1: "",
    q2: "",
    q3: "",
    final: "",
  },
  q1Score: { top: "", left: "" },
  q2Score: { top: "", left: "" },
  q3Score: { top: "", left: "" },
  finalScore: { top: "", left: "" },
};

const STORAGE_KEY = "pocketpicks_squares_v2";

interface LiveScoreCompetitor {
  name: string;
  abbreviation: string;
  score: number;
  linescores: number[];
  isHome?: boolean;
}

interface LiveGameData {
  id: string;
  name: string;
  shortName: string;
  status: {
    state: "pre" | "in" | "post";
    detail: string;
    shortDetail: string;
    completed: boolean;
    period: number;
    clock: string;
  };
  topTeam: LiveScoreCompetitor;
  leftTeam: LiveScoreCompetitor;
  quarters?: {
    q1?: { top: number | null; left: number | null; completed: boolean };
    q2?: { top: number | null; left: number | null; completed: boolean };
    q3?: { top: number | null; left: number | null; completed: boolean };
    final?: { top: number | null; left: number | null; completed: boolean };
  };
}

interface AvailableGameOption {
  id: string;
  name: string;
  shortName: string;
  status: string;
  state: "pre" | "in" | "post";
  homeTeam: string;
  homeAbbr: string;
  homeScore: number;
  awayTeam: string;
  awayAbbr: string;
  awayScore: number;
  date: string;
}



function getTeamNickname(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

function getInitialBoardState(): SquaresBoardState {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    // Purge legacy storage keys to prevent stale boards from flashing
    localStorage.removeItem("pocketpicks_squares_v1");
    localStorage.removeItem("pocketpicks_squares_v2");
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clean squares storage:", e);
  }
  return INITIAL_STATE;
}

interface SquareCellProps {
  rIdx: number;
  cIdx: number;
  name: string;
  isSelected: boolean;
  isReadOnly: boolean;
  isFilterMatch: boolean;
  isQ1Winner: boolean;
  isQ2Winner: boolean;
  isQ3Winner: boolean;
  isFinalWinner: boolean;
  isPrintingBlank: boolean;
  topNumber: string;
  leftNumber: string;
  onSelect: (r: number, c: number) => void;
  onChange: (r: number, c: number, name: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent, r: number, c: number) => void;
}

const SquareCell = React.memo(function SquareCell({
  rIdx,
  cIdx,
  name,
  isSelected,
  isReadOnly,
  isFilterMatch,
  isQ1Winner,
  isQ2Winner,
  isQ3Winner,
  isFinalWinner,
  isPrintingBlank,
  topNumber,
  leftNumber,
  onSelect,
  onChange,
  onBlur,
  onKeyDown,
}: SquareCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  const isAnyWinner = isQ1Winner || isQ2Winner || isQ3Winner || isFinalWinner;
  let winnerBorderColor = "";
  let winnerBgColor = "";
  if (isFinalWinner) {
    winnerBorderColor = "border-emerald-600";
    winnerBgColor = "bg-emerald-50/80 dark:bg-emerald-950/40";
  } else if (isQ3Winner) {
    winnerBorderColor = "border-purple-500";
    winnerBgColor = "bg-purple-50/80 dark:bg-purple-950/40";
  } else if (isQ2Winner) {
    winnerBorderColor = "border-sky-500";
    winnerBgColor = "bg-sky-50/80 dark:bg-sky-950/40";
  } else if (isQ1Winner) {
    winnerBorderColor = "border-amber-500";
    winnerBgColor = "bg-amber-50/80 dark:bg-amber-950/40";
  }

  return (
    <td
      onClick={() => !isReadOnly && onSelect(rIdx, cIdx)}
      className={`p-0.5 border-b border-r border-slate-200 dark:border-slate-700/80 text-center align-middle relative transition select-none overflow-hidden last:border-r-0 ${
        isReadOnly ? "cursor-default" : "cursor-pointer"
      } ${
        isSelected
          ? "bg-emerald-50/90 dark:bg-emerald-950/60 z-10"
          : isAnyWinner
          ? winnerBgColor
          : isFilterMatch
          ? "bg-amber-100/90 dark:bg-amber-950/60"
          : name
          ? "bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
      }`}
    >
      {/* Symmetrical Uniform 2px Border Highlight (Equal thickness on top, bottom, left, and right) */}
      {isSelected ? (
        <div className="absolute inset-0 border-2 border-emerald-500 pointer-events-none z-20" />
      ) : isAnyWinner ? (
        <div className={`absolute inset-0 border-2 ${winnerBorderColor} pointer-events-none z-20`} />
      ) : isFilterMatch ? (
        <div className="absolute inset-0 border-2 border-amber-400 pointer-events-none z-20" />
      ) : null}

      {isSelected ? (
        <div className="w-full h-full flex items-center justify-center p-0.5">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => onChange(rIdx, cIdx, e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => onKeyDown(e, rIdx, cIdx)}
            placeholder="Name"
            className="w-full h-7 text-center text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 rounded border border-emerald-500 shadow-2xs px-1 focus:outline-hidden"
          />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center px-0.5">
          {!isPrintingBlank && name ? (
            /* If name contains spaces (first & last name), split into two rows to prevent wide stretching */
            name.includes(" ") ? (
              <div className="flex flex-col items-center justify-center leading-tight max-w-full">
                {name.split(" ").filter(Boolean).map((part, pIdx) => (
                  <span
                    key={pIdx}
                    className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white truncate max-w-full"
                  >
                    {part}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white truncate max-w-full">
                {name}
              </span>
            )
          ) : (
            <span className="text-[10px] text-slate-300 dark:text-slate-700 font-medium select-none no-print">
              {leftNumber},{topNumber}
            </span>
          )}

          {/* Winner Badge on square with matched color */}
          {isAnyWinner && (
            <div className="absolute top-0.5 right-0.5 flex gap-0.5 no-print z-10">
              {isQ1Winner && (
                <span className="text-[7px] font-black px-1 py-0.2 rounded bg-amber-500 text-white shadow-2xs">
                  Q1
                </span>
              )}
              {isQ2Winner && (
                <span className="text-[7px] font-black px-1 py-0.2 rounded bg-sky-500 text-white shadow-2xs">
                  Q2
                </span>
              )}
              {isQ3Winner && (
                <span className="text-[7px] font-black px-1 py-0.2 rounded bg-purple-500 text-white shadow-2xs">
                  Q3
                </span>
              )}
              {isFinalWinner && (
                <span className="text-[7px] font-black px-1 py-0.2 rounded bg-emerald-600 text-white shadow-2xs">
                  FINAL
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </td>
  );
});

function SquaresPoolApp() {
  const { setTheme, resolvedTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Board State
  const [board, setBoard] = useState<SquaresBoardState>(INITIAL_STATE);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [publishedPoolId, setPublishedPoolId] = useState<string | null>(null);
  const poolId = searchParams.get("id") || publishedPoolId;
  const [currentJoinCode, setCurrentJoinCode] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "local">("local");
  const [isLoadingOnline, setIsLoadingOnline] = useState<boolean>(() => Boolean(searchParams.get("id")));
  const [filterUser, setFilterUser] = useState<string>("");
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);

  // Live Score Tracker State
  const [liveGame, setLiveGame] = useState<LiveGameData | null>(null);
  const [isFetchingScore, setIsFetchingScore] = useState(false);
  const [autoSyncScores, setAutoSyncScores] = useState<boolean>(true);
  const [availableGames, setAvailableGames] = useState<AvailableGameOption[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [showGamePicker, setShowGamePicker] = useState(false);

  // Modals & UI state
  const [editingHeader, setEditingHeader] = useState<{ type: "top" | "left"; index: number } | null>(null);
  const [headerInputValue, setHeaderInputValue] = useState("");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("Super Bowl LIX Squares");
  const [newBoardTopTeam, setNewBoardTopTeam] = useState("Buffalo Bills");
  const [newBoardLeftTeam, setNewBoardLeftTeam] = useState("San Francisco 49ers");
  const [createSelectedGameId, setCreateSelectedGameId] = useState("");
  const [newBoardCost, setNewBoardCost] = useState(10);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [createBoardError, setCreateBoardError] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [poolsFetched, setPoolsFetched] = useState(false);
  const [poolNotFound, setPoolNotFound] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [isPrintingBlank, setIsPrintingBlank] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    actionVariant?: "danger" | "primary";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionLabel: "",
    onConfirm: () => {},
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Prevent background scrolling and handle Escape key when any modal is open
  const isAnyModalOpen = Boolean(
    showRulesModal || confirmModal.isOpen || editingHeader || showJoinModal || showShareModal || showCreateBoardModal
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

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowRulesModal(false);
          setEditingHeader(null);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isAnyModalOpen]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const { user, loading: authLoading } = useAuth();
  const [poolCreatorId, setPoolCreatorId] = useState<string | null>(null);
  const [poolCreatorName, setPoolCreatorName] = useState<string | null>(null);
  const [serverIsOwner, setServerIsOwner] = useState<boolean | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setUserDropdownOpen(false);
      await signOut(auth);
      router.push("/squares");
      router.refresh();
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  // User's existing created and joined pools
  interface UserPoolItem {
    id: string;
    joinCode?: string;
    title: string;
    topTeam: string;
    leftTeam: string;
    costPerSquare: number;
    totalClaimed: number;
    role: "commissioner" | "member";
  }
  const [userPools, setUserPools] = useState<UserPoolItem[]>([]);
  const [showUserPoolsMenu, setShowUserPoolsMenu] = useState(false);

  const getAuthToken = useCallback(async () => {
    try {
      return (await auth.currentUser?.getIdToken()) || null;
    } catch {
      return null;
    }
  }, []);

  const fetchUserPools = useCallback(async () => {
    if (!user) {
      setPoolsFetched(true);
      return;
    }
    try {
      const token = await getAuthToken();
      if (!token) {
        setPoolsFetched(true);
        return;
      }

      // Check localStorage for any legacy owner keys to recover previously created boards
      if (typeof window !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("squares_owner_key_sb-")) {
            const legacyPoolId = key.replace("squares_owner_key_", "");
            const ownerKey = localStorage.getItem(key) || "";
            try {
              await fetch(`/api/squares/${encodeURIComponent(legacyPoolId)}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "x-owner-key": ownerKey,
                },
              });
            } catch {
              // Ignore network error for individual legacy check
            }
          }
        }
      }

      const res = await fetch("/api/squares", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.pools)) {
          setUserPools(data.pools);
        }
      }
    } catch (e) {
      console.error("Failed to load user pools:", e);
    } finally {
      setPoolsFetched(true);
    }
  }, [user, getAuthToken]);

  // Viewer & Commissioner Mode State
  const [isAuthDenied, setIsAuthDenied] = useState(false);

  const isOwner = useMemo(() => {
    if (isAuthDenied) return false;
    if (searchParams.get("create") === "1" && user) return true;
    if (!poolId) return Boolean(user);
    if (publishedPoolId && publishedPoolId === poolId) return true;

    // 1. Authoritative server check if loaded
    if (serverIsOwner !== null) {
      return serverIsOwner;
    }

    // 2. Check userPools membership role for logged-in user
    if (user) {
      const membership = userPools.find((p) => p.id === poolId || p.joinCode === poolId);
      if (membership) {
        return membership.role === "commissioner";
      }
      if (poolCreatorId) {
        return poolCreatorId === user.id;
      }
    }

    // 3. Fallback for unauthenticated legacy commissioner
    if (!user && !poolCreatorId && typeof window !== "undefined") {
      try {
        const storedKey = localStorage.getItem(`squares_owner_key_${poolId}`);
        const legacyOwner = localStorage.getItem(`squares_owner_${poolId}`) === "true";
        if (storedKey || legacyOwner) {
          return true;
        }
      } catch {
        // Ignore storage errors
      }
    }

    return false;
  }, [isAuthDenied, poolId, publishedPoolId, user, serverIsOwner, userPools, poolCreatorId, searchParams]);

  const [isViewerPreview, setIsViewerPreview] = useState<boolean>(false);

  useEffect(() => {
    const viewParam = searchParams.get("view") === "1" || searchParams.get("mode") === "view";
    setIsViewerPreview(viewParam);
  }, [searchParams]);

  // Computed read-only status
  const isReadOnly = !isOwner || isViewerPreview;

  // Sync document.title
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${board.title || "Super Bowl Squares"} | PocketPicks`;
    }
  }, [board.title]);

  const loadFromLocal = useCallback(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("create") === "1") {
      setBoard({
        ...INITIAL_STATE,
        grid: {},
      });
      return;
    }
    setBoard(getInitialBoardState());
  }, []);

  // 1. Initial Load: Check if online pool ID in query param, otherwise local storage
  useEffect(() => {
    const idParam = searchParams.get("id");
    const editParam = searchParams.get("edit") === "1" || searchParams.get("edit") === "true";

    if (idParam) {
      if (editParam && typeof window !== "undefined") {
        try {
          localStorage.setItem(`squares_owner_${idParam}`, "true");
        } catch {
          // Ignore storage errors
        }
      }

      (async () => {
        try {
          const token = await getAuthToken();
          const ownerKey = typeof window !== "undefined" ? localStorage.getItem(`squares_owner_key_${idParam}`) || "" : "";
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          if (ownerKey) headers["x-owner-key"] = ownerKey;

          const res = await fetch(`/api/squares/${encodeURIComponent(idParam)}`, { headers });
          if (!res.ok) throw new Error("Pool not found");
          const data = await res.json();
          if (data.board) {
            setBoard({
              ...INITIAL_STATE,
              ...data.board,
              topNumbers: Array.isArray(data.board.topNumbers) && data.board.topNumbers.length === 10 ? data.board.topNumbers : DEFAULT_TOP_NUMBERS,
              leftNumbers: Array.isArray(data.board.leftNumbers) && data.board.leftNumbers.length === 10 ? data.board.leftNumbers : DEFAULT_LEFT_NUMBERS,
              grid: data.board.grid || {},
              costPerSquare: typeof data.board.costPerSquare === "number" ? data.board.costPerSquare : 10,
              payouts: data.board.payouts || { q1: "", q2: "", q3: "", final: "" },
            });
            if (data.creatorUserId) {
              setPoolCreatorId(data.creatorUserId);
            }
            if (typeof data.isOwner === "boolean") {
              setServerIsOwner(data.isOwner);
            }
            if (data.creatorName) {
              setPoolCreatorName(data.creatorName);
            }
            const cleanCode = (data.joinCode || idParam.replace(/^sb-/, "")).toUpperCase();
            setCurrentJoinCode(cleanCode);
            if (typeof window !== "undefined") {
              localStorage.setItem("last_active_squares_board", cleanCode);
              if (idParam !== cleanCode) {
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set("id", cleanCode);
                window.history.replaceState(null, "", currentUrl.toString());
              }
            }
            setSyncStatus("synced");
            setPoolNotFound(false);
            // Refresh memberships list so joined pool appears in dropdown
            fetchUserPools();
          }
        } catch (err) {
          console.error("Failed to load online squares pool:", err);
          if (typeof window !== "undefined") {
            localStorage.removeItem(`pocketpicks_squares_board_${idParam}`);
            localStorage.removeItem(`squares_owner_${idParam}`);
            localStorage.removeItem(`squares_owner_key_${idParam}`);
            if (localStorage.getItem("last_active_squares_board") === idParam) {
              localStorage.removeItem("last_active_squares_board");
            }
          }
          setPoolNotFound(true);
        } finally {
          setIsLoadingOnline(false);
        }
      })();
    } else {
      setPoolNotFound(false);
      setIsLoadingOnline(false);
      if (searchParams.get("create") === "1") {
        setBoard({
          ...INITIAL_STATE,
          grid: {},
        });
      } else {
        loadFromLocal();
      }
    }
  }, [searchParams, loadFromLocal, getAuthToken, fetchUserPools]);

  // Fetch user's created and joined pools if logged in
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchUserPools();
    } else {
      setPoolsFetched(true);
    }
  }, [authLoading, user, fetchUserPools]);

  // Auto-redirect to last active or first board for logged-in users visiting /squares without ?id or ?create
  useEffect(() => {
    const idParam = searchParams.get("id");
    const createParam = searchParams.get("create");
    if (!idParam && createParam !== "1" && poolsFetched && user && userPools.length > 0) {
      const lastBoardId = typeof window !== "undefined" ? localStorage.getItem("last_active_squares_board") : null;
      const target = userPools.find((p) => p.id === lastBoardId || p.joinCode === lastBoardId) || userPools[0];
      if (target) {
        const cleanTargetId = (target.joinCode || target.id).replace(/^sb-/, "").toUpperCase();
        router.replace(`/squares?id=${cleanTargetId}`);
      }
    }
  }, [searchParams, poolsFetched, user, userPools, router]);

  useEffect(() => {
    if (poolId && typeof window !== "undefined") {
      localStorage.setItem("last_active_squares_board", poolId);
    }
  }, [poolId]);

  const handleCreateNewBoard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      router.push("/auth/login?redirect=/squares");
      return;
    }

    setIsCreatingBoard(true);
    setCreateBoardError("");

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Please log in to create a board");

      const freshBoard: SquaresBoardState = {
        title: newBoardTitle.trim() || "Super Bowl LIX Squares",
        topTeam: newBoardTopTeam.trim() || "Buffalo Bills",
        leftTeam: newBoardLeftTeam.trim() || "San Francisco 49ers",
        topNumbers: [...DEFAULT_TOP_NUMBERS],
        leftNumbers: [...DEFAULT_LEFT_NUMBERS],
        grid: {}, // Guaranteed 100% blank grid!
        costPerSquare: typeof newBoardCost === "number" ? newBoardCost : 10,
        payouts: { q1: "", q2: "", q3: "", final: "" },
        q1Score: { top: "", left: "" },
        q2Score: { top: "", left: "" },
        q3Score: { top: "", left: "" },
        finalScore: { top: "", left: "" },
      };

      const res = await fetch("/api/squares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          board: freshBoard,
          creatorName: user.name || user.username || "",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error || "Failed to create board");
      }

      if (data.ownerKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(`squares_owner_key_${data.id}`, data.ownerKey);
          localStorage.setItem(`squares_owner_${data.id}`, "true");
        } catch {
          // Ignore storage errors
        }
      }

      setShowCreateBoardModal(false);
      showToast(`Board "${freshBoard.title}" created!`);
      setBoard(freshBoard);
      setPublishedPoolId(data.id);
      setPoolCreatorId(user.id);
      if (data.joinCode) {
        setCurrentJoinCode(data.joinCode);
      }
      await fetchUserPools();
      const cleanCreatedId = (data.joinCode || data.id).replace(/^sb-/, "").toUpperCase();
      router.push(`/squares?id=${cleanCreatedId}`);
    } catch (err: unknown) {
      console.error("Create board error:", err);
      const msg = err instanceof Error ? err.message : "Failed to create board";
      setCreateBoardError(msg);
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const openCreateModal = useCallback(() => {
    const firstGame = availableGames[0];
    if (firstGame) {
      setNewBoardTitle(`${firstGame.awayTeam} vs ${firstGame.homeTeam} Squares`);
      setNewBoardTopTeam(firstGame.awayTeam);
      setNewBoardLeftTeam(firstGame.homeTeam);
      setCreateSelectedGameId(firstGame.id);
    } else {
      setNewBoardTitle("Super Bowl LIX Squares");
      setNewBoardTopTeam("Buffalo Bills");
      setNewBoardLeftTeam("San Francisco 49ers");
      setCreateSelectedGameId("");
    }
    setNewBoardCost(10);
    setCreateBoardError("");
    setShowCreateBoardModal(true);
  }, [availableGames]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinInput.trim();
    if (!raw) return;

    const parsedCode = extractSquaresCode(raw);
    if (!parsedCode) {
      setJoinError("Please enter a valid 5-character code or share link");
      return;
    }

    setIsJoining(true);
    setJoinError("");

    try {
      const token = await getAuthToken();
      if (!token) {
        // If guest, redirect directly to board as viewer
        setShowJoinModal(false);
        router.push(`/squares?id=${parsedCode}`);
        return;
      }

      const res = await fetch("/api/squares/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: parsedCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || "Failed to join board");
        setIsJoining(false);
        return;
      }

      setShowJoinModal(false);
      setJoinInput("");
      showToast(`Joined ${data.title || "Squares Board"}!`);
      await fetchUserPools();
      const cleanJoinedId = (data.joinCode || data.poolId).replace(/^sb-/, "").toUpperCase();
      router.push(`/squares?id=${cleanJoinedId}`);
    } catch (err: unknown) {
      console.error("Join pool error:", err);
      const msg = err instanceof Error ? err.message : "Failed to join board";
      setJoinError(msg);
    } finally {
      setIsJoining(false);
    }
  };

  // 2. Save State: LocalStorage + Online Firestore sync (debounced)
  const saveState = (updated: SquaresBoardState, immediateOnline = false) => {
    setBoard(updated);

    // If viewer is viewing a shared board, do not modify localStorage or overwrite online
    if (!isOwner || isViewerPreview) return;

    // Save locally
    try {
      if (poolId) {
        localStorage.setItem(`pocketpicks_squares_board_${poolId}`, JSON.stringify(updated));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Local save error:", e);
    }

    // Sync online if this board has an online ID
    if (poolId) {
      setSyncStatus("saving");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const doSync = async () => {
        try {
          const token = await getAuthToken();
          let ownerKey = "";
          if (typeof window !== "undefined") {
            try {
              ownerKey = localStorage.getItem(`squares_owner_key_${poolId}`) || "";
            } catch {
              ownerKey = "";
            }
          }
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          if (ownerKey) headers["x-owner-key"] = ownerKey;

          const res = await fetch(`/api/squares/${encodeURIComponent(poolId)}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ board: updated }),
          });
          if (res.ok) {
            setSyncStatus("synced");
          } else if (res.status === 403) {
            setSyncStatus("local");
            setIsAuthDenied(true);
            setIsViewerPreview(true);
            showToast("Viewing as spectator (read-only). Changes are not saved to commissioner board.");
          } else {
            setSyncStatus("local");
          }
        } catch (e) {
          console.error("Online sync error:", e);
          setSyncStatus("local");
        }
      };

      if (immediateOnline) {
        doSync();
      } else {
        saveTimeoutRef.current = setTimeout(doSync, 700);
      }
    }
  };

  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const autoSyncScoresRef = useRef(autoSyncScores);
  useEffect(() => {
    autoSyncScoresRef.current = autoSyncScores;
  }, [autoSyncScores]);

  const saveStateRef = useRef(saveState);
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  // Fetch live score from ESPN & auto-populate quarter scores
  const fetchLiveScore = useCallback(async (forcedGameId?: string) => {
    try {
      setIsFetchingScore(true);
      const params = new URLSearchParams();
      const currentBoard = boardRef.current;
      if (currentBoard.topTeam) params.set("top", currentBoard.topTeam);
      if (currentBoard.leftTeam) params.set("left", currentBoard.leftTeam);
      const gId = forcedGameId !== undefined ? forcedGameId : selectedGameId;
      if (gId) params.set("gameId", gId);

      const res = await fetch(`/api/squares/live-score?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setLiveGame(data.matchedGame || null);
        setAvailableGames(data.availableGames || []);

        // Automatically populate quarter scores if autoSyncScores is enabled
        if (autoSyncScoresRef.current && data.matchedGame?.quarters) {
          const q = data.matchedGame.quarters;
          let changed = false;
          const nextBoard: SquaresBoardState = {
            ...currentBoard,
            q1Score: { ...currentBoard.q1Score },
            q2Score: { ...currentBoard.q2Score },
            q3Score: { ...currentBoard.q3Score },
            finalScore: { ...currentBoard.finalScore },
          };

          if (q.q1?.completed && q.q1.top !== null && q.q1.left !== null) {
            const topStr = String(q.q1.top);
            const leftStr = String(q.q1.left);
            if (nextBoard.q1Score.top !== topStr || nextBoard.q1Score.left !== leftStr) {
              nextBoard.q1Score = { top: topStr, left: leftStr };
              changed = true;
            }
          }

          if (q.q2?.completed && q.q2.top !== null && q.q2.left !== null) {
            const topStr = String(q.q2.top);
            const leftStr = String(q.q2.left);
            if (nextBoard.q2Score.top !== topStr || nextBoard.q2Score.left !== leftStr) {
              nextBoard.q2Score = { top: topStr, left: leftStr };
              changed = true;
            }
          }

          if (q.q3?.completed && q.q3.top !== null && q.q3.left !== null) {
            const topStr = String(q.q3.top);
            const leftStr = String(q.q3.left);
            if (nextBoard.q3Score.top !== topStr || nextBoard.q3Score.left !== leftStr) {
              nextBoard.q3Score = { top: topStr, left: leftStr };
              changed = true;
            }
          }

          if (q.final?.completed && q.final.top !== null && q.final.left !== null) {
            const topStr = String(q.final.top);
            const leftStr = String(q.final.left);
            if (nextBoard.finalScore.top !== topStr || nextBoard.finalScore.left !== leftStr) {
              nextBoard.finalScore = { top: topStr, left: leftStr };
              changed = true;
            }
          }

          if (changed) {
            saveStateRef.current(nextBoard);
            showToast("⚡ Quarter scores auto-updated from live game!");
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch live score:", err);
    } finally {
      setIsFetchingScore(false);
    }
  }, [selectedGameId]);

  // Live score polling: 30s when live, 60s otherwise
  useEffect(() => {
    // If not authenticated and no poolId (i.e. commissioner lock screen), do not poll live score
    if (!poolId && !user) return;

    let isMounted = true;
    const isLive = liveGame?.status?.state === "in";
    const intervalMs = isLive ? 30000 : 60000;

    // Small delay for initial invocation to prevent synchronous setState in effect
    const initialTimer = setTimeout(() => {
      if (isMounted) fetchLiveScore();
    }, 100);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (isMounted) fetchLiveScore();
    }, intervalMs);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [poolId, user, board.topTeam, board.leftTeam, selectedGameId, liveGame?.status?.state, fetchLiveScore]);

  // Refresh when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchLiveScore();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchLiveScore]);

  // 3. Share / Publish Online
  const handleShareOnline = async () => {
    if (poolId) {
      try {
        localStorage.setItem(`squares_owner_${poolId}`, "true");
      } catch {
        // Ignore storage errors
      }
      setIsAuthDenied(false);
      const url = `${window.location.origin}/squares?id=${poolId}&view=1`;
      await navigator.clipboard.writeText(url);
      showToast("Shareable link copied! (View-only for players)");
      return;
    }

    // Require authentication to publish a new pool online
    if (!user) {
      setConfirmModal({
        isOpen: true,
        title: "Account Required to Publish",
        message: "You need a PocketPicks account to publish and manage your Super Bowl Squares pool online so you can access it across devices. Your local draft will be saved.",
        actionLabel: "Log In / Register",
        actionVariant: "primary",
        onConfirm: () => {
          router.push("/auth/login?redirect=/squares");
        },
      });
      return;
    }

    setSyncStatus("saving");
    try {
      const token = await getAuthToken();
      if (!token) {
        showToast("Please sign in again to publish.");
        setSyncStatus("local");
        return;
      }

      let existingKey = "";
      if (poolId && typeof window !== "undefined") {
        try {
          existingKey = localStorage.getItem(`squares_owner_key_${poolId}`) || "";
        } catch {
          existingKey = "";
        }
      }
      const res = await fetch("/api/squares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          ...(existingKey ? { "x-owner-key": existingKey } : {}),
        },
        body: JSON.stringify({
          board,
          creatorName: user.name || user.username || "",
        }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        setPublishedPoolId(data.id);
        if (data.creatorUserId) {
          setPoolCreatorId(data.creatorUserId);
        }
        if (data.creatorName) {
          setPoolCreatorName(data.creatorName);
        }
        if (data.joinCode) {
          setCurrentJoinCode(data.joinCode);
        } else {
          setCurrentJoinCode(data.id.replace(/^sb-/, "").toUpperCase());
        }
        setSyncStatus("synced");
        try {
          if (data.ownerKey) {
            localStorage.setItem(`squares_owner_key_${data.id}`, data.ownerKey);
          }
          localStorage.setItem(`squares_owner_${data.id}`, "true");
        } catch {
          // Ignore storage errors
        }
        setIsAuthDenied(false);
        window.history.replaceState({}, "", `/squares?id=${data.id}`);
        await fetchUserPools();
        setShowShareModal(true);
        showToast("Board published online! Share modal opened.");
      } else {
        throw new Error(data.error || "Failed to publish");
      }
    } catch (err: unknown) {
      console.error("Share online error:", err);
      const msg = err instanceof Error ? err.message : "Could not publish online. Please try again.";
      showToast(msg);
      setSyncStatus("local");
    }
  };

  // Stable callbacks for SquareCell
  const handleSelectCell = useCallback((r: number, c: number) => {
    setSelectedCell({ r, c });
  }, []);

  const handleCellBlur = useCallback(() => {
    setSelectedCell(null);
  }, []);

  // Cell Updates - preserve spaces while typing!
  const handleCellChange = useCallback((r: number, c: number, name: string) => {
    const key = `${r}_${c}`;
    const nextGrid = { ...boardRef.current.grid };
    if (name === "") {
      delete nextGrid[key];
    } else {
      nextGrid[key] = name;
    }
    saveStateRef.current({ ...boardRef.current, grid: nextGrid });
  }, []);

  // Header Updates
  const openHeaderEdit = (type: "top" | "left", index: number) => {
    setEditingHeader({ type, index });
    setHeaderInputValue(type === "top" ? board.topNumbers[index] : board.leftNumbers[index]);
  };

  const saveHeaderEdit = () => {
    if (!editingHeader) return;
    const { type, index } = editingHeader;
    const val = headerInputValue.trim().slice(0, 4);
    if (type === "top") {
      const nextTop = [...board.topNumbers];
      nextTop[index] = val || (index === 9 ? "0" : `${index + 1}`);
      saveState({ ...board, topNumbers: nextTop });
    } else {
      const nextLeft = [...board.leftNumbers];
      nextLeft[index] = val || String.fromCharCode(65 + index);
      saveState({ ...board, leftNumbers: nextLeft });
    }
    setEditingHeader(null);
  };

  // Randomize 0-9
  const randomizeNumbers = (type: "both" | "top" | "left") => {
    const shuffle = () => {
      const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
      for (let i = digits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [digits[i], digits[j]] = [digits[j], digits[i]];
      }
      return digits;
    };

    setConfirmModal({
      isOpen: true,
      title: "Randomize Digits (0-9)?",
      message: "This will randomly draw and shuffle digits 0 through 9 across the selected axis headers. Names on squares will remain intact.",
      actionLabel: "Randomize",
      actionVariant: "primary",
      onConfirm: () => {
        const nextBoard = { ...board };
        if (type === "both" || type === "top") nextBoard.topNumbers = shuffle();
        if (type === "both" || type === "left") nextBoard.leftNumbers = shuffle();
        saveState(nextBoard, true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast("Headers randomized 0-9!");
      },
    });
  };

  // Reset to default headers
  const resetHeadersToDefault = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Headers?",
      message: "This will reset the top row back to 1-0 and the first column back to A-J.",
      actionLabel: "Reset Headers",
      actionVariant: "primary",
      onConfirm: () => {
        saveState(
          {
            ...board,
            topNumbers: [...DEFAULT_TOP_NUMBERS],
            leftNumbers: [...DEFAULT_LEFT_NUMBERS],
          },
          true
        );
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast("Headers reset to 1-0 and A-J.");
      },
    });
  };

  // Clear all names
  const clearAllSquares = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear All Squares?",
      message: "Are you sure you want to remove all player names from this board? This action cannot be undone.",
      actionLabel: "Clear Board",
      actionVariant: "danger",
      onConfirm: () => {
        saveState({ ...board, grid: {} }, true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast("All squares cleared.");
      },
    });
  };

  // Delete board permanently (Owner only)
  const handleDeleteBoard = () => {
    if (!poolId || !isOwner) return;
    setConfirmModal({
      isOpen: true,
      title: "Delete Squares Board?",
      message: `Are you sure you want to permanently delete "${board.title || "this board"}"? All picks, scores, and board data will be deleted for everyone. This cannot be undone.`,
      actionLabel: "Delete Board",
      actionVariant: "danger",
      onConfirm: async () => {
        try {
          const token = await getAuthToken();
          const res = await fetch(`/api/squares/${encodeURIComponent(poolId)}`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();
          if (!res.ok) {
            showToast(data.error || "Failed to delete board");
            return;
          }
          if (typeof window !== "undefined") {
            localStorage.removeItem(`pocketpicks_squares_board_${poolId}`);
            localStorage.removeItem(`squares_owner_${poolId}`);
            localStorage.removeItem(`squares_owner_key_${poolId}`);
            localStorage.removeItem("last_active_squares_board");
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          showToast("Board permanently deleted");
          setUserPools((prev) => prev.filter((p) => p.id !== poolId && p.joinCode !== poolId));
          router.push("/squares");
        } catch (err) {
          console.error("Delete pool error:", err);
          showToast("Failed to delete board");
        }
      },
    });
  };

  // Leave board (Member only)
  const handleLeaveBoard = (targetId?: string) => {
    const idToLeave = targetId || poolId;
    if (!idToLeave) return;
    const targetPool = userPools.find((p) => p.id === idToLeave || p.joinCode === idToLeave);
    const title = targetPool?.title || board.title || "this board";

    setConfirmModal({
      isOpen: true,
      title: "Leave Squares Board?",
      message: `Are you sure you want to leave "${title}"? It will be removed from your boards list.`,
      actionLabel: "Leave Board",
      actionVariant: "danger",
      onConfirm: async () => {
        try {
          const token = await getAuthToken();
          const res = await fetch(`/api/squares/${encodeURIComponent(idToLeave)}/leave`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json();
          if (!res.ok) {
            showToast(data.error || "Failed to leave board");
            return;
          }
          if (typeof window !== "undefined") {
            if (localStorage.getItem("last_active_squares_board") === idToLeave) {
              localStorage.removeItem("last_active_squares_board");
            }
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          showToast(`Left "${title}"`);
          setUserPools((prev) => prev.filter((p) => p.id !== idToLeave && p.joinCode !== idToLeave));
          if (!targetId || targetId === poolId) {
            router.push("/squares");
          }
        } catch (err) {
          console.error("Leave pool error:", err);
          showToast("Failed to leave board");
        }
      },
    });
  };

  // Stats
  const stats = useMemo(() => {
    const claims = Object.values(board.grid).map((n) => n.trim()).filter(Boolean);
    const totalClaimed = claims.length;
    const remaining = 100 - totalClaimed;
    const percentage = Math.round((totalClaimed / 100) * 100);

    const countsByUser: Record<string, number> = {};
    claims.forEach((name) => {
      countsByUser[name] = (countsByUser[name] || 0) + 1;
    });

    const userList = Object.entries(countsByUser)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const cost = board.costPerSquare || 0;
    const totalPot = totalClaimed * cost;
    const fullPot = 100 * cost;

    return { totalClaimed, remaining, percentage, userList, totalPot, fullPot, cost };
  }, [board.grid, board.costPerSquare]);

  const quarterWinners = useMemo(() => {
    const getWinner = (topScoreStr: string, leftScoreStr: string) => {
      if (!topScoreStr || !leftScoreStr) return null;
      const topNum = topScoreStr.trim();
      const leftNum = leftScoreStr.trim();
      const topLastDigit = topNum.charAt(topNum.length - 1);
      const leftLastDigit = leftNum.charAt(leftNum.length - 1);

      const cIndex = board.topNumbers.findIndex((n) => n.trim() === topLastDigit);
      const rIndex = board.leftNumbers.findIndex((n) => n.trim() === leftLastDigit);

      if (cIndex !== -1 && rIndex !== -1) {
        const winnerName = board.grid[`${rIndex}_${cIndex}`];
        return { rIndex, cIndex, winnerName, topDigit: topLastDigit, leftDigit: leftLastDigit };
      }
      return null;
    };

    return {
      q1: getWinner(board.q1Score.top, board.q1Score.left),
      q2: getWinner(board.q2Score.top, board.q2Score.left),
      q3: getWinner(board.q3Score.top, board.q3Score.left),
      final: getWinner(board.finalScore.top, board.finalScore.left),
    };
  }, [board.q1Score, board.q2Score, board.q3Score, board.finalScore, board.topNumbers, board.leftNumbers, board.grid]);

  // Keyboard navigation across cells (memoized)
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (c < 9) {
        setSelectedCell({ r, c: c + 1 });
      } else if (r < 9) {
        setSelectedCell({ r: r + 1, c: 0 });
      } else {
        setSelectedCell(null);
      }
    } else if (e.key === "Escape") {
      setSelectedCell(null);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (c < 9) setSelectedCell({ r, c: c + 1 });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (c > 0) setSelectedCell({ r, c: c - 1 });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (r < 9) setSelectedCell({ r: r + 1, c });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (r > 0) setSelectedCell({ r: r - 1, c });
    }
  }, []);

  if (!mounted || authLoading || (!poolId && user && !poolsFetched) || isLoadingOnline) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading squares board...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
      {/* Global & Print CSS: Strict Single-Page Landscape Print rules */}
      <style jsx global>{`
        /* Remove spinner arrows from number inputs across all browsers */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        input[type="number"] {
          -moz-appearance: textfield !important;
        }

        @media print {
          @page {
            size: letter landscape !important;
            margin: 0.25in !important;
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          nav, header, footer, .no-print, [class*="SiteFooter"] {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .squares-table-wrapper {
            overflow: visible !important;
            width: 100% !important;
            min-width: 0 !important;
          }
          .squares-table-wrapper > div {
            min-width: 0 !important;
            width: 100% !important;
          }
          .squares-grid-table {
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          .squares-grid-table th, .squares-grid-table td {
            border: 1px solid #1e293b !important;
            padding: 1px !important;
            color: black !important;
            background: white !important;
            height: 30px !important;
            max-height: 32px !important;
          }
          .squares-grid-table th {
            background: #f1f5f9 !important;
            font-weight: 900 !important;
            height: 26px !important;
          }
          .squares-grid-table td span {
            font-size: 10px !important;
            line-height: 1.1 !important;
            color: black !important;
            font-weight: 700 !important;
          }
        }
      `}</style>

      {/* Top Header & Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 transition-colors no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <GameSwitcherDropdown currentGame="squares" />
            <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="truncate">{poolId ? (board.title || "Super Bowl Squares") : user ? (board.title || "Super Bowl Squares") : "Super Bowl Squares"}</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5 hidden sm:block">
                  PocketPicks&trade; 100 Squares Pool
                </p>
              </div>
            </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Spectator Preview Toggle for Owner */}
            {isOwner && poolId && (
              <button
                type="button"
                onClick={() => setIsViewerPreview(!isViewerPreview)}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs border shrink-0 ${
                  isViewerPreview
                    ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                    : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                }`}
                title={isViewerPreview ? "Exit preview and return to commissioner editing" : "Preview how players see the shared link"}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isViewerPreview ? "Exit Preview" : "Spectator Preview"}</span>
              </button>
            )}

            {/* Sync status indicator */}
            {poolId && isOwner && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                {syncStatus === "saving" ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>Saving...</span>
                  </>
                ) : syncStatus === "synced" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400">Synced</span>
                  </>
                ) : null}
              </span>
            )}

            {/* Squares Boards Dropdown */}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserPoolsMenu((prev) => !prev)}
                  className="inline-flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer"
                  title="Switch between your squares boards"
                >
                  <Grid className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden sm:inline">{userPools.length > 0 ? `My Boards (${userPools.length})` : "Boards"}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showUserPoolsMenu ? "rotate-180" : ""}`} />
                </button>

                {showUserPoolsMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserPoolsMenu(false)} />
                    <div className="absolute right-0 mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 text-xs max-h-96 overflow-y-auto">
                      {userPools.length === 0 ? (
                        <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                          You haven&apos;t created or joined any squares boards yet.
                        </div>
                      ) : (
                        <>
                          {userPools.filter((p) => p.role === "commissioner").length > 0 && (
                            <div>
                              <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span>Boards You Run</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                  {userPools.filter((p) => p.role === "commissioner").length}
                                </span>
                              </div>
                              {userPools
                                .filter((p) => p.role === "commissioner")
                                .map((p) => {
                                  const cleanCode = (p.joinCode || p.id).replace(/^sb-/, "").toUpperCase();
                                  const currentNorm = (poolId || "").replace(/^sb-/, "").toUpperCase();
                                  const isCurrent = currentNorm === cleanCode;
                                  return (
                                    <Link
                                      key={p.id}
                                      href={`/squares?id=${cleanCode}`}
                                      onClick={() => setShowUserPoolsMenu(false)}
                                      className={`px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                                        isCurrent ? "bg-amber-500/10 font-bold text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <div className="font-bold truncate flex items-center gap-1.5">
                                          <span className="truncate">{p.title}</span>
                                          {cleanCode && (
                                            <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                              {cleanCode}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">
                                          {p.topTeam} vs {p.leftTeam}
                                        </div>
                                      </div>
                                      {isCurrent && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                                    </Link>
                                  );
                                })}
                            </div>
                          )}

                          {userPools.filter((p) => p.role === "member").length > 0 && (
                            <div className={userPools.filter((p) => p.role === "commissioner").length > 0 ? "border-t border-slate-100 dark:border-slate-800 mt-1 pt-1" : ""}>
                              <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span>Joined Boards</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                                  {userPools.filter((p) => p.role === "member").length}
                                </span>
                              </div>
                              {userPools
                                .filter((p) => p.role === "member")
                                .map((p) => {
                                  const cleanCode = (p.joinCode || p.id).replace(/^sb-/, "").toUpperCase();
                                  const currentNorm = (poolId || "").replace(/^sb-/, "").toUpperCase();
                                  const isCurrent = currentNorm === cleanCode;
                                  return (
                                    <div
                                      key={p.id}
                                      className={`px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                                        isCurrent ? "bg-amber-500/10 font-bold text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      <Link
                                        href={`/squares?id=${cleanCode}`}
                                        onClick={() => setShowUserPoolsMenu(false)}
                                        className="min-w-0 pr-2 flex-1"
                                      >
                                        <div className="font-bold truncate flex items-center gap-1.5">
                                          <span className="truncate">{p.title}</span>
                                          {cleanCode && (
                                            <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                              {cleanCode}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">
                                          {p.topTeam} vs {p.leftTeam}
                                        </div>
                                      </Link>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleLeaveBoard(p.id);
                                          }}
                                          title="Leave this board"
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

                      <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserPoolsMenu(false);
                            setShowJoinModal(true);
                          }}
                          className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Join Board with Code</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserPoolsMenu(false);
                            openCreateModal();
                          }}
                          className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold transition cursor-pointer"
                        >
                          <Grid className="w-3.5 h-3.5 shrink-0" />
                          <span>+ Create New Board</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer"
                title="Join a board with code"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Join Board</span>
              </button>
            )}



            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
              title="Toggle Theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Profile / Auth Button */}
            {user ? (
              <div className="relative pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-black text-white shadow-xs shrink-0 ${
                      user.avatarColor || "bg-emerald-600"
                    }`}
                  >
                    {((user.name || user.username || user.email || "U").charAt(0) || "U").toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col items-start leading-none">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[100px] truncate">
                      {user.name || user.username || (user.email ? user.email.split("@")[0] : "User")}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">Account</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userDropdownOpen ? "rotate-180" : ""}`} />
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
                  href={`/auth/login?redirect=${encodeURIComponent(poolId ? `/squares?id=${poolId}` : "/squares")}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href={`/auth/register?redirect=${encodeURIComponent(poolId ? `/squares?id=${poolId}` : "/squares")}`}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-8 w-full flex-1 print-container">
        {poolNotFound ? (
          /* Dedicated Board Not Found Screen when a requested board does not exist online */
          <div className="max-w-md mx-auto my-6 sm:my-16 p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Board Not Found</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              The board &quot;{poolId}&quot; does not exist or has been permanently deleted by its commissioner.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link
                href="/squares"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition active:scale-95"
              >
                <Grid className="w-4 h-4" />
                <span>Go to Squares</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Join with Code</span>
              </button>
            </div>
          </div>
        ) : !user && !poolId ? (
          /* Dedicated Commissioner Lock Screen when visiting /squares without an id and unauthenticated */
          <div className="max-w-lg mx-auto my-6 sm:my-16 p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800/80 shadow-2xs">
                <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Commissioner Access Required</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Super Bowl Squares
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8 max-w-md mx-auto">
              Setting up a 100-cell Squares pool requires a PocketPicks commissioner account. Log in or create a free account to customize your board, manage payouts, and generate shareable links for your pool.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto mb-6">
              <Link
                href="/auth/login?redirect=/squares"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In to Setup</span>
              </Link>
              <Link
                href="/auth/register?redirect=/squares"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-700 transition-all hover:-translate-y-0.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </Link>
            </div>

            <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs text-slate-500">
              <span>Have a code or link from your commissioner?</span>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Enter Code to View Board
              </button>
            </div>
          </div>
        ) : user && !authLoading && poolsFetched && userPools.length === 0 && !poolId && searchParams.get("create") !== "1" ? (
          /* Dedicated 0-Board Onboarding Screen for logged-in users with 0 boards */
          <div className="max-w-md mx-auto my-6 sm:my-14 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center animate-in fade-in duration-300 space-y-6">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
              <Grid className="w-8 h-8" />
            </div>

            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Welcome{user?.name ? `, ${user.name}` : ""}!
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
                You don&apos;t have any active Squares boards yet. Create a brand new board for your game or join an existing board with a code.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">Super Bowl Squares</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">10x10 party grid with live score auto-sync</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Create a Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500 dark:hover:border-amber-500 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-500" />
                  <span>Join with Code</span>
                </button>
              </div>
            </div>

            {/* Quick Links to other games */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-left">
              <Link
                href="/"
                className="group bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 hover:border-emerald-500/50 rounded-xl p-3 transition flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Pick&apos;em</div>
                  <div className="text-[10px] text-slate-400 truncate">Weekly picks</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition shrink-0" />
              </Link>

              <Link
                href="/bracket"
                className="group bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 hover:border-purple-500/50 rounded-xl p-3 transition flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Playoff Bracket</div>
                  <div className="text-[10px] text-slate-400 truncate">14-team pool</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition shrink-0" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Spectator View Mode (When opened via shareable link or previewed by owner) */}
        {isReadOnly ? (
          <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-6 no-print">
            {/* If owner is previewing spectator view, show banner to exit preview */}
            {isOwner && isViewerPreview && (
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Previewing Spectator View (players cannot edit this board)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsViewerPreview(false)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] shadow-2xs"
                >
                  Exit Preview
                </button>
              </div>
            )}

            {/* Spectator Pool Header Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                      {board.title || "Super Bowl Squares Pool"}
                    </h2>
                    {poolId && (
                      <button
                        type="button"
                        onClick={() => setShowShareModal(true)}
                        className="inline-flex items-center text-[11px] font-mono font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition cursor-pointer shrink-0"
                        title="Click to view share code and link"
                      >
                        <span>{currentJoinCode || poolId.replace(/^sb-/, "").toUpperCase()}</span>
                      </button>
                    )}
                    {!isOwner && poolId && user && (
                      <button
                        type="button"
                        onClick={() => handleLeaveBoard()}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition cursor-pointer shrink-0"
                        title="Leave this board"
                      >
                        <LogOut className="w-3 h-3 text-rose-500" />
                        <span>Leave Board</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    100 Squares Pool &bull; {poolCreatorName ? `Commissioner: ${poolCreatorName}` : "View-only board"}
                  </p>
                </div>

                {/* Quick stats pills */}
                <div className="grid grid-cols-3 gap-1 sm:flex sm:items-center sm:gap-2.5 text-[10px] sm:text-xs w-full sm:w-auto shrink-0">
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center gap-1 sm:gap-1.5 min-w-0">
                    <Grid className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-extrabold text-slate-900 dark:text-white truncate">{stats.totalClaimed}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate">/100<span className="hidden sm:inline"> Sq</span></span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/80 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center gap-1 sm:gap-1.5 min-w-0">
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500 shrink-0" />
                    <span className="font-extrabold text-slate-900 dark:text-white truncate">{stats.userList.length}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate"> Players</span>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-950/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-1 sm:gap-1.5 text-emerald-900 dark:text-emerald-300 min-w-0 whitespace-nowrap">
                    {stats.cost > 0 ? (
                      <>
                        <span className="font-black truncate">${stats.totalPot.toLocaleString()}</span>
                        <span className="opacity-80 truncate hidden sm:inline"> Pot (${stats.cost}/sq)</span>
                        <span className="opacity-80 truncate sm:hidden"> Pot</span>
                      </>
                    ) : (
                      <span className="font-bold truncate">Free</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Player Filter Bar */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  placeholder="Type your name to highlight your squares..."
                  className="w-full pl-9 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                {filterUser && (
                  <button
                    type="button"
                    onClick={() => setFilterUser("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Spectator Live Score Banner (if game exists) */}
            {liveGame && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  {/* AFC Team */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end min-w-0">
                    <div className="text-right min-w-0">
                      <div className="text-[9px] sm:text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center justify-end gap-1">
                        <Image
                          src="https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/AFC.svg"
                          alt="AFC"
                          width={12}
                          height={12}
                          className="w-3 h-3 object-contain"
                          unoptimized
                        />
                        AFC
                      </div>
                      <div className="hidden sm:block text-xs sm:text-base font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {liveGame.topTeam.name}
                      </div>
                    </div>
                    <TeamLogo alt={liveGame.topTeam.name} className="w-7 h-7 sm:w-10 sm:h-10 object-contain shrink-0" />
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums px-1">
                      {liveGame.topTeam.score}
                    </div>
                  </div>

                  {/* Status / Quarter clock */}
                  <div className="flex flex-col items-center justify-center shrink-0 px-1 sm:px-2 py-0.5 text-center min-w-[50px] sm:min-w-[80px]">
                    {(() => {
                      const detail = liveGame.status.shortDetail || "VS";
                      if (detail.includes(" - ")) {
                        const [dDate, ...dRest] = detail.split(" - ");
                        const dTime = dRest.join(" - ");
                        return (
                          <div className="flex flex-col items-center leading-tight">
                            <span className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                              {dDate}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              {dTime}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {detail}
                        </span>
                      );
                    })()}
                  </div>

                  {/* NFC Team */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-start min-w-0">
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums px-1">
                      {liveGame.leftTeam.score}
                    </div>
                    <TeamLogo alt={liveGame.leftTeam.name} className="w-7 h-7 sm:w-10 sm:h-10 object-contain shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-[9px] sm:text-[10px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1">
                        <Image
                          src="https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/NFC.svg"
                          alt="NFC"
                          width={12}
                          height={12}
                          className="w-3 h-3 object-contain"
                          unoptimized
                        />
                        NFC
                      </div>
                      <div className="hidden sm:block text-xs sm:text-base font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {liveGame.leftTeam.name}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Commissioner Unified Control Card */
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs mb-3 sm:mb-6 space-y-3 sm:space-y-4 no-print">
            {/* Row 1: Title & Metrics & Price per square */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Pool Title
                  </label>
                  {poolId && (
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="inline-flex items-center text-[11px] font-mono font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition cursor-pointer shrink-0"
                      title="Click to view share code and link"
                    >
                      <span>{currentJoinCode || poolId.replace(/^sb-/, "").toUpperCase()}</span>
                    </button>
                  )}
                  {poolId && isOwner && (
                    <button
                      type="button"
                      onClick={handleDeleteBoard}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition cursor-pointer shrink-0 ml-auto sm:ml-0"
                      title="Permanently delete this board"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span className="hidden sm:inline">Delete Board</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={board.title}
                  onChange={(e) => saveState({ ...board, title: e.target.value })}
                  placeholder="Super Bowl Squares Pool"
                  className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-hidden transition w-full py-0.5 truncate"
                />
              </div>

              {/* Quick Metrics & Price per square - 4 cols on mobile without horizontal scroll */}
              <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-2 text-[10px] sm:text-xs w-full lg:w-auto shrink-0">
                <div className="bg-slate-50 dark:bg-slate-800/80 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center gap-1 sm:gap-1.5 min-w-0">
                  <Grid className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-extrabold text-slate-900 dark:text-white truncate">{stats.totalClaimed}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-xs truncate">/100<span className="hidden sm:inline"> Sq</span></span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center gap-1 sm:gap-1.5 min-w-0">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500 shrink-0" />
                  <span className="font-extrabold text-slate-900 dark:text-white truncate">{stats.userList.length}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-xs truncate hidden min-[370px]:inline"><span className="hidden sm:inline"> Players</span><span className="sm:hidden"> Plyr</span></span>
                </div>

                {/* Price / Square input */}
                <div className="bg-slate-50 dark:bg-slate-800/80 px-1 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center gap-0.5 sm:gap-1 min-w-0" title="Set cost per square">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={board.costPerSquare === 0 ? "" : board.costPerSquare.toString()}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 5);
                      const num = clean === "" ? 0 : parseInt(clean, 10);
                      saveState({ ...board, costPerSquare: num });
                    }}
                    placeholder="0"
                    className="w-7 sm:w-11 text-[11px] sm:text-sm font-black text-center text-slate-900 dark:text-white bg-transparent focus:outline-hidden"
                  />
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">/sq</span>
                </div>

                {/* Pot */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-1 sm:gap-1.5 text-emerald-900 dark:text-emerald-300 min-w-0">
                  {stats.cost > 0 ? (
                    <span className="font-black text-[10px] sm:text-xs truncate">${stats.totalPot.toLocaleString()}<span className="hidden min-[370px]:inline"> Pot</span></span>
                  ) : (
                    <span className="font-bold text-[10px] sm:text-xs truncate">Free</span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Matchup & Scoreboard & Games Selector */}
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  {liveGame?.status?.state === "in" ? (
                    <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      LIVE &bull; {liveGame.status.detail || "In Progress"}
                    </span>
                  ) : liveGame?.status?.completed || liveGame?.status?.state === "post" ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black shrink-0 whitespace-nowrap">
                      <Check className="w-3 h-3" />
                      FINAL
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-[10px] sm:text-xs font-bold shrink-0 whitespace-nowrap">
                      <Radio className="w-3 h-3 text-slate-400" />
                      <span>{liveGame ? (liveGame.status?.shortDetail || "Scheduled") : "NFL Game"}</span>
                    </span>
                  )}
                </div>

                {/* Action Controls: Auto-sync, Sync, and Change Game button */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <label
                    className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none shrink-0 whitespace-nowrap"
                    title="Auto-fill quarter scores from ESPN"
                  >
                    <input
                      type="checkbox"
                      checked={autoSyncScores}
                      onChange={(e) => setAutoSyncScores(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3 h-3 shrink-0"
                    />
                    <span className="hidden sm:inline">Auto-Scores</span>
                    <span className="sm:hidden">Auto</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => fetchLiveScore()}
                    disabled={isFetchingScore}
                    className="inline-flex items-center justify-center p-1 sm:px-2 sm:py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 text-[10px] sm:text-[11px] font-bold transition disabled:opacity-50 shrink-0"
                    title="Sync score from ESPN"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingScore ? "animate-spin text-emerald-500" : ""}`} />
                    <span className="hidden sm:inline ml-1">Sync</span>
                  </button>

                  {availableGames.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowGamePicker(!showGamePicker)}
                      className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-bold transition shadow-2xs shrink-0 whitespace-nowrap"
                      title="Choose NFL game to automatically set board teams"
                    >
                      <Tv className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Change Game</span>
                      <span className="sm:hidden">Game</span>
                      <ChevronDown className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform shrink-0 ${showGamePicker ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Matchup Banner: AFC Team vs NFC Team */}
              <div className="flex items-center justify-between gap-2 sm:gap-4 pt-1">
                {/* AFC Team */}
                <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-end min-w-0">
                  <div className="text-right min-w-0">
                    <div className="text-[9px] sm:text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center justify-end gap-1">
                      <Image
                        src="https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/AFC.svg"
                        alt="AFC"
                        width={12}
                        height={12}
                        className="w-3 h-3 object-contain"
                        unoptimized
                      />
                      AFC
                    </div>
                    <div className="hidden sm:block text-sm sm:text-base font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {board.topTeam}
                    </div>
                  </div>
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <TeamLogo alt={board.topTeam} className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                  </div>
                  {liveGame && (
                    <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums px-0.5">
                      {liveGame.topTeam.score}
                    </div>
                  )}
                </div>

                {/* Center Divider / Clock */}
                <div className="flex flex-col items-center justify-center shrink-0 px-1 sm:px-2 text-center min-w-[50px] sm:min-w-[80px]">
                  {(() => {
                    const detail = liveGame?.status?.shortDetail || "VS";
                    if (detail.includes(" - ")) {
                      const [dDate, ...dRest] = detail.split(" - ");
                      const dTime = dRest.join(" - ");
                      return (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                            {dDate}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {dTime}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {detail}
                      </span>
                    );
                  })()}
                </div>

                {/* NFC Team */}
                <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-start min-w-0">
                  {liveGame && (
                    <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums px-0.5">
                      {liveGame.leftTeam.score}
                    </div>
                  )}
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <TeamLogo alt={board.leftTeam} className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[9px] sm:text-[10px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1">
                      <Image
                        src="https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/NFC.svg"
                        alt="NFC"
                        width={12}
                        height={12}
                        className="w-3 h-3 object-contain"
                        unoptimized
                      />
                      NFC
                    </div>
                    <div className="hidden sm:block text-sm sm:text-base font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {board.leftTeam}
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Game Selector dropdown */}
              {showGamePicker && availableGames.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="text-[11px] sm:text-xs">Click a game to set board teams & score:</span>
                    {selectedGameId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGameId("");
                          fetchLiveScore("");
                          setShowGamePicker(false);
                        }}
                        className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hover:underline"
                      >
                        Reset Game
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2">
                    {availableGames.map((g) => {
                      const isSelected = selectedGameId === g.id || (!selectedGameId && liveGame?.id === g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...board,
                              topTeam: g.awayTeam || board.topTeam,
                              leftTeam: g.homeTeam || board.leftTeam,
                            };
                            saveState(updated);
                            setSelectedGameId(g.id);
                            fetchLiveScore(g.id);
                            setShowGamePicker(false);
                            showToast(`Board updated to ${g.awayTeam} vs ${g.homeTeam}`);
                          }}
                          className={`p-2 rounded-xl text-left border text-xs transition flex flex-col justify-between gap-1 ${
                            isSelected
                              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold truncate">{g.name}</span>
                            {g.state === "in" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{g.status}</span>
                            {(g.state === "in" || g.state === "post") && (
                              <span className="font-black text-slate-900 dark:text-white">
                                {g.awayScore} - {g.homeScore}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Quick Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {/* Filter / Search by name */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  placeholder="Highlight player's squares..."
                  className="w-full pl-9 pr-7 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                {filterUser && (
                  <button
                    type="button"
                    onClick={() => setFilterUser("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action buttons side-by-side */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => randomizeNumbers("both")}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold transition whitespace-nowrap"
                  title="Randomly assign 0-9 digits to rows and columns"
                >
                  <Shuffle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Randomize<span className="hidden md:inline"> (0-9)</span></span>
                </button>

                <button
                  type="button"
                  onClick={resetHeadersToDefault}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold transition whitespace-nowrap"
                  title="Reset Top to 1-0 and First Column to A-J"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>Reset<span className="hidden md:inline"> Headers</span></span>
                </button>

                <button
                  type="button"
                  onClick={clearAllSquares}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold transition whitespace-nowrap"
                  title="Clear all names on the board"
                >
                  <Eraser className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Clear<span className="hidden md:inline"> Names</span></span>
                </button>

                {poolId && isOwner && (
                  <button
                    type="button"
                    onClick={handleDeleteBoard}
                    className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] sm:text-xs font-bold transition whitespace-nowrap"
                    title="Permanently delete this board"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Delete<span className="hidden md:inline"> Board</span></span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRINT HEADER (Visible only when printed) */}
        <div className="hidden print:block mb-2 text-center">
          <h1 className="text-lg font-black text-black leading-tight">{board.title}</h1>
          <p className="text-xs font-semibold text-gray-700">
            AFC: {board.topTeam || "AFC"} &bull; NFC: {board.leftTeam || "NFC"}
            {stats.cost > 0 && ` • $${stats.cost} per square`}
            {isPrintingBlank && " • Blank Grid Sheet"}
          </p>
        </div>

        {/* 10x10 Super Bowl Squares Grid Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
          {/* Top Team Banner (AFC) above grid */}
          <div className="bg-slate-100/90 dark:bg-slate-800/80 px-4 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 sm:gap-2.5 text-center">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border border-red-200/60 dark:border-red-900/60 px-2 py-0.5 rounded-md tracking-wider">
              <Image
                src="https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/AFC.svg"
                alt="AFC"
                width={14}
                height={14}
                className="w-3.5 h-3.5 object-contain"
                unoptimized
              />
              AFC
            </span>
            <TeamLogo alt={board.topTeam} className="w-6 h-6 object-contain shrink-0" />
            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
              {board.topTeam || "AFC Team"}
            </span>
          </div>

          {/* Grid Container with Separate NFC Column (No rowSpan, eliminating table height distortion) */}
          <div className="overflow-x-auto squares-table-wrapper">
            <div className="flex items-stretch min-w-[760px]">
              {/* NFC Team Column on the Left - Flex sibling to table, perfectly matching height */}
              <div className="w-12 sm:w-14 bg-slate-100/90 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center select-none py-4 shrink-0">
                <div className="flex items-center justify-center gap-2.5 [writing-mode:vertical-lr] rotate-180 select-none">
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-900/60 px-2 py-0.5 rounded-md tracking-wider">
                    <Image
                      src="https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/NFC.svg"
                      alt="NFC"
                      width={14}
                      height={14}
                      className="w-3.5 h-3.5 object-contain rotate-90"
                      unoptimized
                    />
                    NFC
                  </span>
                  {/* Rotated logo sideways (rotate-90) to flow along the text direction */}
                  <div className="rotate-90 shrink-0">
                    <TeamLogo alt={board.leftTeam} className="w-6 h-6 object-contain" />
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide truncate max-h-[380px]">
                    {board.leftTeam || "NFC Team"}
                  </span>
                </div>
              </div>

              {/* Table: Standard 10 columns + Row letter column with table-fixed */}
              <div className="flex-1 min-w-0">
                <table className="w-full table-fixed border-collapse squares-grid-table">
                  <colgroup>
                    {/* Row Letter column: 6% */}
                    <col className="w-[6%]" />
                    {/* 10 Grid Square columns: 9.4% each */}
                    {Array.from({ length: 10 }).map((_, i) => (
                      <col key={i} className="w-[9.4%]" />
                    ))}
                  </colgroup>

                  <thead>
                    <tr className="h-11">
                      {/* Junction Cell for Coordinates */}
                      <th className="p-1 bg-slate-100 dark:bg-slate-800/90 border-b border-r border-slate-200 dark:border-slate-700/80 text-center align-middle">
                        <div className="text-[10px] font-extrabold leading-tight">
                          <div className="text-red-600 dark:text-red-400">AFC &rarr;</div>
                          <div className="border-t border-slate-300 dark:border-slate-600 my-0.5" />
                          <div className="text-sky-600 dark:text-sky-400">NFC &darr;</div>
                        </div>
                      </th>

                      {/* Top Row Headers (10 columns: default 1 to 0) */}
                      {board.topNumbers.map((num, cIdx) => (
                        <th
                          key={cIdx}
                          onClick={() => !isReadOnly && openHeaderEdit("top", cIdx)}
                          className={`p-1 bg-slate-100 dark:bg-slate-800/90 border-b border-r border-slate-200 dark:border-slate-700/80 text-center transition select-none group last:border-r-0 ${
                            isReadOnly ? "cursor-default" : "hover:bg-slate-200/80 dark:hover:bg-slate-700/80 cursor-pointer"
                          }`}
                          title={isReadOnly ? `AFC digit: ${num}` : "Click to edit top number"}
                        >
                          <span className={`text-base sm:text-lg font-black text-slate-900 dark:text-white transition ${!isReadOnly ? "group-hover:text-red-500" : ""}`}>
                            {num}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {board.leftNumbers.map((rowLetter, rIdx) => (
                      <tr key={rIdx} className="h-12 sm:h-14">
                        {/* First Column Header (Row letter: default A to J) */}
                        <th
                          onClick={() => !isReadOnly && openHeaderEdit("left", rIdx)}
                          className={`p-1 bg-slate-100 dark:bg-slate-800/90 border-b border-r border-slate-200 dark:border-slate-700/80 text-center transition select-none group ${
                            isReadOnly ? "cursor-default" : "hover:bg-slate-200/80 dark:hover:bg-slate-700/80 cursor-pointer"
                          }`}
                          title={isReadOnly ? `NFC digit: ${rowLetter}` : "Click to edit row letter/number"}
                        >
                          <span className={`text-base sm:text-lg font-black text-slate-900 dark:text-white transition ${!isReadOnly ? "group-hover:text-sky-500" : ""}`}>
                            {rowLetter}
                          </span>
                        </th>

                        {/* 10 Grid Squares for this Row */}
                        {Array.from({ length: 10 }).map((_, cIdx) => {
                          const key = `${rIdx}_${cIdx}`;
                          const name = board.grid[key] || "";
                          const isSelected = !isReadOnly && selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                          const isFilterMatch = Boolean(
                            filterUser.trim() &&
                            name.toLowerCase().includes(filterUser.trim().toLowerCase())
                          );

                          // Check if this square won any quarter
                          const isQ1Winner = quarterWinners.q1?.rIndex === rIdx && quarterWinners.q1?.cIndex === cIdx;
                          const isQ2Winner = quarterWinners.q2?.rIndex === rIdx && quarterWinners.q2?.cIndex === cIdx;
                          const isQ3Winner = quarterWinners.q3?.rIndex === rIdx && quarterWinners.q3?.cIndex === cIdx;
                          const isFinalWinner = quarterWinners.final?.rIndex === rIdx && quarterWinners.final?.cIndex === cIdx;

                          return (
                            <SquareCell
                              key={cIdx}
                              rIdx={rIdx}
                              cIdx={cIdx}
                              name={name}
                              isSelected={isSelected}
                              isReadOnly={isReadOnly}
                              isFilterMatch={isFilterMatch}
                              isQ1Winner={isQ1Winner}
                              isQ2Winner={isQ2Winner}
                              isQ3Winner={isQ3Winner}
                              isFinalWinner={isFinalWinner}
                              isPrintingBlank={isPrintingBlank}
                              topNumber={board.topNumbers[cIdx]}
                              leftNumber={board.leftNumbers[rIdx]}
                              onSelect={handleSelectCell}
                              onChange={handleCellChange}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table Footer Instructions (Desktop only - hidden on mobile since touch users tap to enter) */}
          <div className="hidden sm:flex bg-slate-50 dark:bg-slate-800/40 px-4 py-2 border-t border-slate-200 dark:border-slate-800 items-center justify-between text-xs text-slate-500 dark:text-slate-400 no-print">
            <span className="text-[11px]">
              Click any square or header number to edit. Use <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Arrow Keys</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Tab</kbd>, or <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Enter</kbd> to move between squares.
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {poolId ? "Online Synced" : "Auto-saved to device"}
            </span>
          </div>
        </div>

        {/* Players List & Quarter Winners Tracker with Payout Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          {/* Quarter Score & Winner Calculator with Payouts */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Quarter Winners &amp; Live Score Tracker</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                title="How scoring works / Rules"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">How scoring works</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {[
                {
                  key: "q1" as const,
                  tag: "Q1",
                  label: "1st Quarter",
                  tagClass: "bg-amber-500 text-white",
                  cardBorder: "border-amber-200/80 dark:border-amber-900/60",
                  winnerBg: "bg-amber-100/90 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200",
                  state: board.q1Score,
                  winner: quarterWinners.q1,
                  payout: board.payouts?.q1 || "",
                },
                {
                  key: "q2" as const,
                  tag: "Q2",
                  label: "Halftime (2nd Q)",
                  tagClass: "bg-sky-500 text-white",
                  cardBorder: "border-sky-200/80 dark:border-sky-900/60",
                  winnerBg: "bg-sky-100/90 text-sky-900 dark:bg-sky-950/80 dark:text-sky-200",
                  state: board.q2Score,
                  winner: quarterWinners.q2,
                  payout: board.payouts?.q2 || "",
                },
                {
                  key: "q3" as const,
                  tag: "Q3",
                  label: "3rd Quarter",
                  tagClass: "bg-purple-500 text-white",
                  cardBorder: "border-purple-200/80 dark:border-purple-900/60",
                  winnerBg: "bg-purple-100/90 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200",
                  state: board.q3Score,
                  winner: quarterWinners.q3,
                  payout: board.payouts?.q3 || "",
                },
                {
                  key: "final" as const,
                  tag: "FINAL",
                  label: "Final Score",
                  tagClass: "bg-emerald-600 text-white",
                  cardBorder: "border-emerald-200/80 dark:border-emerald-900/60",
                  winnerBg: "bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200",
                  state: board.finalScore,
                  winner: quarterWinners.final,
                  payout: board.payouts?.final || "",
                },
              ].map(({ key, tag, label, tagClass, cardBorder, winnerBg, state, winner, payout }) => (
                <div
                  key={key}
                  className={`p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border ${cardBorder} flex flex-col justify-between gap-3`}
                >
                  {/* Card Header with Quarter Tag & Payout Input */}
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shadow-2xs shrink-0 ${tagClass}`}>
                        {tag}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white shrink-0 whitespace-nowrap">{label}</span>
                      {liveGame?.quarters?.[key]?.completed && (
                        <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/60 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                          <Check className="w-2.5 h-2.5 shrink-0" />
                          <span>ESPN Live</span>
                        </span>
                      )}
                    </div>

                    {/* Quarter Payout Input / Display */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Payout</span>
                      {isReadOnly ? (
                        <span className="text-xs font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {payout ? `$${Number(payout).toLocaleString()}` : "—"}
                        </span>
                      ) : (
                        <div className="relative flex items-center">
                          <span className="text-xs font-bold text-slate-400 mr-0.5">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={payout}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                              const nextPayouts = { ...(board.payouts || {}), [key]: clean };
                              saveState({ ...board, payouts: nextPayouts });
                            }}
                            className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-black text-right text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Winner Banner if Score is entered */}
                  {winner?.winnerName && (
                    <div className={`px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs font-black ${winnerBg}`}>
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Winner: {winner.winnerName}
                      </span>
                      {payout && (
                        <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-lg text-slate-900 dark:text-white">
                          ${Number(payout).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Score inputs or displays for AFC and NFC */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-red-600 dark:text-red-400 uppercase font-bold block truncate">
                        {getTeamNickname(board.topTeam) || "AFC"}
                      </span>
                      {isReadOnly ? (
                        <div className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-center text-sm text-slate-900 dark:text-white">
                          {state.top !== "" ? state.top : "—"}
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          value={state.top}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                            const next = { ...board, [`${key}Score`]: { ...state, top: val } };
                            saveState(next);
                          }}
                          className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-center text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500"
                        />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 uppercase font-bold block truncate">
                        {getTeamNickname(board.leftTeam) || "NFC"}
                      </span>
                      {isReadOnly ? (
                        <div className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-center text-sm text-slate-900 dark:text-white">
                          {state.left !== "" ? state.left : "—"}
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          value={state.left}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                            const next = { ...board, [`${key}Score`]: { ...state, left: val } };
                            saveState(next);
                          }}
                          className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-center text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                        />
                      )}
                    </div>
                  </div>

                  {winner?.winnerName ? (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Winning square digits:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {winner.topDigit} ({getTeamNickname(board.topTeam) || "AFC"}), {winner.leftDigit} ({getTeamNickname(board.leftTeam) || "NFC"})
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic pt-1">
                      {state.top && state.left ? "No square matching digits" : "Enter scores to calculate winner"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Player Square Leaderboard / Count Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between mb-4">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Participants ({stats.userList.length})</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {stats.totalClaimed} / 100 Squares
              </span>
            </h3>

            {stats.userList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <Users className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-xs font-medium">No squares claimed yet.</p>
                <p className="text-[11px] text-slate-400/80 mt-1">
                  Click any cell in the 10x10 grid above to enter a participant&apos;s name.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
                {stats.userList.map(({ name, count }) => {
                  const isFiltered = filterUser.trim().toLowerCase() === name.toLowerCase();
                  return (
                    <div
                      key={name}
                      onClick={() => setFilterUser(isFiltered ? "" : name)}
                      className={`py-2.5 px-3 rounded-xl flex items-center justify-between cursor-pointer transition ${
                        isFiltered
                          ? "bg-amber-100 dark:bg-amber-950/60 font-black text-amber-900 dark:text-amber-200"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-bold truncate max-w-[150px]">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          {count} {count === 1 ? "sq" : "sqs"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {Math.round((count / 100) * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </main>

      {/* EDIT HEADER POPUP MODAL */}
      {editingHeader && (
        <div
          onClick={() => setEditingHeader(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Edit {editingHeader.type === "top" ? `Column ${editingHeader.index + 1}` : `Row ${editingHeader.index + 1}`} Header
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter a number (0-9) or label for this {editingHeader.type === "top" ? "column" : "row"}.
            </p>
            <input
              type="text"
              autoFocus
              maxLength={4}
              value={headerInputValue}
              onChange={(e) => setHeaderInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveHeaderEdit();
                if (e.key === "Escape") setEditingHeader(null);
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-black text-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingHeader(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveHeaderEdit}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
              >
                Save Header
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SITE MODAL */}
      {confirmModal.isOpen && (
        <div
          onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModal.actionVariant === "danger"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                }`}
              >
                {confirmModal.actionVariant === "danger" ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {confirmModal.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-bold transition shadow-sm ${
                  confirmModal.actionVariant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RULES & HOW IT WORKS MODAL */}
      {showRulesModal && (
        <div
          onClick={() => setShowRulesModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xl shrink-0">
                🏈
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  How Super Bowl Squares Work
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Official pool rules &amp; scoring</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">1.</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Pick Your Squares</span>
                  Players claim squares on the 10x10 grid. Once the board is set, columns (AFC) and rows (NFC) are assigned randomized numbers from 0 to 9.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">2.</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Last-Digit Scoring</span>
                  At the end of Q1, Halftime (Q2), Q3, and the Final score, take the <strong>last digit</strong> of each team&apos;s score.
                  <div className="mt-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                    Example: Bills <strong>17</strong>, 49ers <strong>14</strong><br />
                    Winning square = AFC <strong>7</strong> &bull; NFC <strong>4</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">3.</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Quarter Winners &amp; Payouts</span>
                  Whoever owns the intersecting square wins the prize or bragging rights for that quarter! A single square can win multiple quarters if the numbers hit again.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-xs transition shadow-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-2xl shadow-xl animate-in slide-in-from-bottom-2 duration-200 no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CREATE NEW BOARD MODAL */}
      {showCreateBoardModal && (
        <div
          onClick={() => {
            setShowCreateBoardModal(false);
            setCreateBoardError("");
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Create Squares Board
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Start a fresh, blank 100-square grid for your game.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateBoardModal(false);
                  setCreateBoardError("");
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createBoardError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createBoardError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Board Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Super Bowl LIX Squares"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Game selection dropdown defaulting to first game of the week */}
              {availableGames.length > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    NFL Game
                  </label>
                  <select
                    value={createSelectedGameId || availableGames[0]?.id || ""}
                    onChange={(e) => {
                      const game = availableGames.find((g) => g.id === e.target.value);
                      if (game) {
                        setCreateSelectedGameId(game.id);
                        setNewBoardTopTeam(game.awayTeam);
                        setNewBoardLeftTeam(game.homeTeam);
                        setNewBoardTitle(`${game.awayTeam} vs ${game.homeTeam} Squares`);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                  >
                    {availableGames.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.awayTeam} at {g.homeTeam} {g.status ? `(${g.status})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Columns: {newBoardTopTeam} &bull; Rows: {newBoardLeftTeam}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Default Matchup:</span>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{newBoardTopTeam} vs {newBoardLeftTeam}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Cost Per Square ($)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={newBoardCost}
                  onChange={(e) => setNewBoardCost(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBoardModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBoard}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isCreatingBoard ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Board</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN BOARD MODAL */}
      {showJoinModal && (
        <div
          onClick={() => {
            setShowJoinModal(false);
            setJoinError("");
            setJoinInput("");
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Join Squares Board
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter the 5-character code or full share link.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError("");
                  setJoinInput("");
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {joinError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  5-Digit Code or Share URL
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. K3M9Z or https://.../squares?id=sb-k3m9z"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value.toUpperCase());
                    setJoinError("");
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors uppercase tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:lowercase placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinError("");
                    setJoinInput("");
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining || !joinInput.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <span>Join Board</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE / INVITE MODAL */}
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
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Share Squares Board
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Invite friends to view or add this board to their account.
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

            {/* 5-Digit Board Code Box */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  5-Digit Board Code
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">
                  For PocketPicks users
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-amber-300 dark:border-amber-800/80">
                <span className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
                  {currentJoinCode || poolId.replace(/^sb-/, "").toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const code = currentJoinCode || poolId.replace(/^sb-/, "").toUpperCase();
                    try {
                      await navigator.clipboard.writeText(code);
                      showToast(`Code ${code} copied!`);
                    } catch {
                      showToast("Could not copy code");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Friends with an account can click <strong>Join Board with Code</strong> and enter this code to save it to their profile.
              </p>
            </div>

            {/* Direct Web Link Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Public Direct Link
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  View-only for party guests
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/squares?id=${poolId}&view=1` : ""}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/squares?id=${poolId}&view=1`;
                    try {
                      await navigator.clipboard.writeText(url);
                      showToast("Link copied to clipboard!");
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

      <UserSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default function SquaresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-xs font-bold text-slate-500">Loading squares board...</span>
        </div>
      }
    >
      <SquaresPoolApp />
    </Suspense>
  );
}
