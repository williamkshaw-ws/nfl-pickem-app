"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Trophy,
  ArrowLeft,
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
  DollarSign,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { TeamLogo } from "@/components/TeamLogo";

interface SquaresBoardState {
  title: string;
  topTeam: string;
  leftTeam: string;
  topNumbers: string[]; // 10 columns
  leftNumbers: string[]; // 10 rows
  grid: Record<string, string>; // "r_c" -> name
  costPerSquare: number;
  payouts: {
    q1: string;
    q2: string;
    q3: string;
    final: string;
  };
  q1Score: { top: string; left: string };
  q2Score: { top: string; left: string };
  q3Score: { top: string; left: string };
  finalScore: { top: string; left: string };
}

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

const STORAGE_KEY = "pocketpicks_squares_v1";

function SquaresPoolApp() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const searchParams = useSearchParams();

  // Board State
  const [board, setBoard] = useState<SquaresBoardState>(INITIAL_STATE);
  const [mounted, setMounted] = useState(false);
  const [poolId, setPoolId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "local">("local");
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [filterUser, setFilterUser] = useState<string>("");
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);

  // Modals & UI state
  const [editingHeader, setEditingHeader] = useState<{ type: "top" | "left"; index: number } | null>(null);
  const [headerInputValue, setHeaderInputValue] = useState("");
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

  const cellInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Initial Load: Check if online pool ID in query param, otherwise local storage
  useEffect(() => {
    setMounted(true);
    const idParam = searchParams.get("id");

    if (idParam) {
      setPoolId(idParam);
      setIsLoadingOnline(true);
      fetch(`/api/squares/${encodeURIComponent(idParam)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Pool not found");
          return res.json();
        })
        .then((data) => {
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
            setSyncStatus("synced");
          }
        })
        .catch((err) => {
          console.error("Failed to load online squares pool:", err);
          showToast("Could not load online pool. Loading local copy.");
          loadFromLocal();
        })
        .finally(() => {
          setIsLoadingOnline(false);
        });
    } else {
      loadFromLocal();
    }
  }, [searchParams]);

  const loadFromLocal = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBoard({
          ...INITIAL_STATE,
          ...parsed,
          topTeam: parsed.topTeam === "Kansas City Chiefs" ? "Buffalo Bills" : (parsed.topTeam || "Buffalo Bills"),
          topNumbers: Array.isArray(parsed.topNumbers) && parsed.topNumbers.length === 10 ? parsed.topNumbers : DEFAULT_TOP_NUMBERS,
          leftNumbers: Array.isArray(parsed.leftNumbers) && parsed.leftNumbers.length === 10 ? parsed.leftNumbers : DEFAULT_LEFT_NUMBERS,
          grid: parsed.grid || {},
          costPerSquare: typeof parsed.costPerSquare === "number" ? parsed.costPerSquare : 10,
          payouts: parsed.payouts || { q1: "", q2: "", q3: "", final: "" },
        });
      }
    } catch (e) {
      console.error("Failed to load squares from storage:", e);
    }
  };

  // 2. Save State: LocalStorage + Online Firestore sync (debounced)
  const saveState = (updated: SquaresBoardState, immediateOnline = false) => {
    setBoard(updated);

    // Save locally
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Local save error:", e);
    }

    // Sync online if this board has an online ID
    if (poolId) {
      setSyncStatus("saving");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const doSync = async () => {
        try {
          const res = await fetch(`/api/squares/${encodeURIComponent(poolId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board: updated }),
          });
          if (res.ok) {
            setSyncStatus("synced");
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

  // 3. Share / Publish Online
  const handleShareOnline = async () => {
    if (poolId) {
      const url = `${window.location.origin}/squares?id=${poolId}`;
      await navigator.clipboard.writeText(url);
      showToast("Online link copied! Anyone with this link can view this board.");
      return;
    }

    setSyncStatus("saving");
    try {
      const res = await fetch("/api/squares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        setPoolId(data.id);
        setSyncStatus("synced");
        const newUrl = `${window.location.origin}/squares?id=${data.id}`;
        window.history.replaceState({}, "", `/squares?id=${data.id}`);
        await navigator.clipboard.writeText(newUrl);
        showToast("Board published online! Shareable link copied to clipboard.");
      } else {
        throw new Error(data.error || "Failed to publish");
      }
    } catch (err: any) {
      console.error("Share online error:", err);
      showToast("Could not publish online. Please try again.");
      setSyncStatus("local");
    }
  };

  // Cell Updates - preserve spaces while typing!
  const handleCellChange = (r: number, c: number, name: string) => {
    const key = `${r}_${c}`;
    const nextGrid = { ...board.grid };
    if (name === "") {
      delete nextGrid[key];
    } else {
      nextGrid[key] = name;
    }
    saveState({ ...board, grid: nextGrid });
  };

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

  // Scoring / Winner calculation
  const getWinnerForScore = (topScoreStr: string, leftScoreStr: string) => {
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

  const quarterWinners = useMemo(() => {
    return {
      q1: getWinnerForScore(board.q1Score.top, board.q1Score.left),
      q2: getWinnerForScore(board.q2Score.top, board.q2Score.left),
      q3: getWinnerForScore(board.q3Score.top, board.q3Score.left),
      final: getWinnerForScore(board.finalScore.top, board.finalScore.left),
    };
  }, [board.q1Score, board.q2Score, board.q3Score, board.finalScore, board.topNumbers, board.leftNumbers, board.grid]);

  // Keyboard navigation across cells
  const handleCellKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
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
  };

  useEffect(() => {
    if (selectedCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [selectedCell]);

  if (!mounted || isLoadingOnline) {
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
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 transition-colors no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Return to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xs">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Super Bowl Squares</span>
                  {poolId ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-800/60 flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" />
                      Live Online
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      Draft Board
                    </span>
                  )}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5 hidden sm:block">
                  PocketPicks&trade; 100 Squares Pool &bull; Printable &amp; Shareable
                </p>
              </div>
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2">
            {/* Share Online Button */}
            <button
              type="button"
              onClick={handleShareOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              title="Share this board online with friends"
            >
              {poolId ? <Copy className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{poolId ? "Copy Share Link" : "Share Online"}</span>
            </button>

            {/* Print / PDF */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition shadow-2xs"
              title="Print or Save PDF (Single Page Landscape)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1 print-container">
        {/* Banner / Title & Event Configuration */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs mb-6 space-y-5 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Pool / Event Title
                </label>
                {poolId && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {poolId}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={board.title}
                onChange={(e) => saveState({ ...board, title: e.target.value })}
                placeholder="Super Bowl Squares Pool"
                className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-hidden transition w-full py-0.5"
              />
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center flex-wrap gap-2.5 sm:gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                <Grid className="w-4 h-4 text-emerald-500" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white">{stats.totalClaimed}</span>
                  <span className="text-slate-500 dark:text-slate-400"> / 100 Squares</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-500" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white">{stats.userList.length}</span>
                  <span className="text-slate-500 dark:text-slate-400"> Players</span>
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
                <div>
                  {stats.cost > 0 ? (
                    <>
                      <span className="font-black">${stats.totalPot.toLocaleString()}</span>
                      <span className="opacity-80"> Pot (${stats.cost}/sq)</span>
                    </>
                  ) : (
                    <span className="font-bold">Free Pool</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Teams Selector & Price Per Square (No dollar sign) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            {/* Top Team (AFC) - Columns */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                <TeamLogo alt={board.topTeam} className="w-8 h-8 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Top Team (Columns)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                    AFC
                  </span>
                </div>
                <input
                  type="text"
                  value={board.topTeam}
                  onChange={(e) => saveState({ ...board, topTeam: e.target.value })}
                  placeholder="e.g. Buffalo Bills"
                  className="w-full text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Left Team (NFC) - Rows */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                <TeamLogo alt={board.leftTeam} className="w-8 h-8 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Left Team (Rows)
                  </span>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md">
                    NFC
                  </span>
                </div>
                <input
                  type="text"
                  value={board.leftTeam}
                  onChange={(e) => saveState({ ...board, leftTeam: e.target.value })}
                  placeholder="e.g. San Francisco 49ers"
                  className="w-full text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Price Per Square Input - Dollar sign removed */}
            <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Price / Square
                </span>
              </div>
              <div>
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
                  placeholder="0 (Free)"
                  className="w-full px-3 py-1.5 text-sm font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Toolbar / Tools Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            {/* Filter / Search by name */}
            <div className="relative min-w-[220px] sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Highlight player's squares..."
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

            {/* Board Buttons */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => randomizeNumbers("both")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                title="Randomly assign 0-9 digits to rows and columns"
              >
                <Shuffle className="w-3.5 h-3.5 text-amber-500" />
                <span>Randomize Digits (0-9)</span>
              </button>

              <button
                type="button"
                onClick={resetHeadersToDefault}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                title="Reset Top to 1-0 and First Column to A-J"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-500" />
                <span>Reset to 1-0 &amp; A-J</span>
              </button>

              <button
                type="button"
                onClick={clearAllSquares}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition"
                title="Clear all names on the board"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Names</span>
              </button>
            </div>
          </div>
        </div>

        {/* PRINT HEADER (Visible only when printed) */}
        <div className="hidden print:block mb-2 text-center">
          <h1 className="text-lg font-black text-black leading-tight">{board.title}</h1>
          <p className="text-xs font-semibold text-gray-700">
            AFC: {board.topTeam || "AFC"} &bull; NFC: {board.leftTeam || "NFC"}
            {stats.cost > 0 && ` • $${stats.cost} per square`}
          </p>
        </div>

        {/* 10x10 Super Bowl Squares Grid Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
          {/* Top Team Banner (AFC) above grid */}
          <div className="bg-slate-100/90 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2.5 text-center">
            <TeamLogo alt={board.topTeam} className="w-6 h-6 object-contain shrink-0" />
            <span className="text-xs uppercase font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider">
              AFC &bull;
            </span>
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
                  {/* Rotated logo sideways (rotate-90) to flow along the text direction */}
                  <div className="rotate-90 shrink-0">
                    <TeamLogo alt={board.leftTeam} className="w-6 h-6 object-contain" />
                  </div>
                  <span className="text-xs uppercase font-extrabold text-sky-600 dark:text-sky-400 tracking-wider">
                    NFC &bull;
                  </span>
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
                          <div className="text-emerald-600 dark:text-emerald-400">AFC &rarr;</div>
                          <div className="border-t border-slate-300 dark:border-slate-600 my-0.5" />
                          <div className="text-sky-600 dark:text-sky-400">NFC &darr;</div>
                        </div>
                      </th>

                      {/* Top Row Headers (10 columns: default 1 to 0) */}
                      {board.topNumbers.map((num, cIdx) => (
                        <th
                          key={cIdx}
                          onClick={() => openHeaderEdit("top", cIdx)}
                          className="p-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/80 border-b border-r border-slate-200 dark:border-slate-700/80 text-center cursor-pointer transition select-none group last:border-r-0"
                          title="Click to edit top number"
                        >
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition">
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
                          onClick={() => openHeaderEdit("left", rIdx)}
                          className="p-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/80 border-b border-r border-slate-200 dark:border-slate-700/80 text-center cursor-pointer transition select-none group"
                          title="Click to edit row letter/number"
                        >
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-sky-500 transition">
                            {rowLetter}
                          </span>
                        </th>

                        {/* 10 Grid Squares for this Row */}
                        {Array.from({ length: 10 }).map((_, cIdx) => {
                          const key = `${rIdx}_${cIdx}`;
                          const name = board.grid[key] || "";
                          const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                          const isFilterMatch =
                            filterUser.trim() &&
                            name.toLowerCase().includes(filterUser.trim().toLowerCase());

                          // Check if this square won any quarter
                          const isQ1Winner = quarterWinners.q1?.rIndex === rIdx && quarterWinners.q1?.cIndex === cIdx;
                          const isQ2Winner = quarterWinners.q2?.rIndex === rIdx && quarterWinners.q2?.cIndex === cIdx;
                          const isQ3Winner = quarterWinners.q3?.rIndex === rIdx && quarterWinners.q3?.cIndex === cIdx;
                          const isFinalWinner = quarterWinners.final?.rIndex === rIdx && quarterWinners.final?.cIndex === cIdx;
                          const isAnyWinner = isQ1Winner || isQ2Winner || isQ3Winner || isFinalWinner;

                          // Color-match winner highlight border to tag color
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
                              key={cIdx}
                              onClick={() => setSelectedCell({ r: rIdx, c: cIdx })}
                              className={`p-0.5 border-b border-r border-slate-200 dark:border-slate-700/80 text-center align-middle relative transition cursor-pointer select-none overflow-hidden last:border-r-0 ${
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
                                    ref={cellInputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                    onBlur={() => setSelectedCell(null)}
                                    onKeyDown={(e) => handleCellKeyDown(e, rIdx, cIdx)}
                                    placeholder="Name"
                                    className="w-full h-7 text-center text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 rounded border border-emerald-500 shadow-2xs px-1 focus:outline-hidden"
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center px-0.5">
                                  {name ? (
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
                                      {board.leftNumbers[rIdx]},{board.topNumbers[cIdx]}
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
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table Footer Instructions */}
          <div className="bg-slate-50 dark:bg-slate-800/40 px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 no-print">
            <span className="text-[11px]">
              Click any square or header number to edit. Use <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Arrow Keys</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Tab</kbd>, or <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Enter</kbd> to move between squares.
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
              {poolId ? "Online Synced" : "Auto-saved to device"}
            </span>
          </div>
        </div>

        {/* Players List & Quarter Winners Tracker with Payout Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          {/* Quarter Score & Winner Calculator with Payouts */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Quarter Winners &amp; Live Score Tracker</span>
              </h3>
              <span className="text-xs text-slate-400">Scores determine last-digit winners</span>
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shadow-2xs ${tagClass}`}>
                        {tag}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{label}</span>
                    </div>

                    {/* Quarter Payout Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Payout</span>
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

                  {/* Score inputs for AFC and NFC */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">
                        {board.topTeam || "AFC"}
                      </span>
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
                        className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-center text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block truncate">
                        {board.leftTeam || "NFC"}
                      </span>
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
                        className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-center text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {winner?.winnerName ? (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Winning square digits:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {winner.topDigit} ({board.topTeam || "AFC"}), {winner.leftDigit} ({board.leftTeam || "NFC"})
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
      </main>

      {/* EDIT HEADER POPUP MODAL */}
      {editingHeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
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

      {/* FEEDBACK TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-2xl shadow-xl animate-in slide-in-from-bottom-2 duration-200 no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
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
