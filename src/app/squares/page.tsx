"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
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
  DollarSign,
  Grid,
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
  q1Score: { top: string; left: string };
  q2Score: { top: string; left: string };
  q3Score: { top: string; left: string };
  finalScore: { top: string; left: string };
}

const DEFAULT_TOP_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const DEFAULT_LEFT_NUMBERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const INITIAL_STATE: SquaresBoardState = {
  title: "Super Bowl Squares Pool",
  topTeam: "Kansas City Chiefs",
  leftTeam: "San Francisco 49ers",
  topNumbers: [...DEFAULT_TOP_NUMBERS],
  leftNumbers: [...DEFAULT_LEFT_NUMBERS],
  grid: {},
  costPerSquare: 10,
  q1Score: { top: "", left: "" },
  q2Score: { top: "", left: "" },
  q3Score: { top: "", left: "" },
  finalScore: { top: "", left: "" },
};

const STORAGE_KEY = "pocketpicks_squares_v1";

export default function SquaresPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Board State
  const [board, setBoard] = useState<SquaresBoardState>(INITIAL_STATE);
  const [mounted, setMounted] = useState(false);
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

  // Load from LocalStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBoard({
          ...INITIAL_STATE,
          ...parsed,
          topNumbers: Array.isArray(parsed.topNumbers) && parsed.topNumbers.length === 10 ? parsed.topNumbers : DEFAULT_TOP_NUMBERS,
          leftNumbers: Array.isArray(parsed.leftNumbers) && parsed.leftNumbers.length === 10 ? parsed.leftNumbers : DEFAULT_LEFT_NUMBERS,
          grid: parsed.grid || {},
          costPerSquare: typeof parsed.costPerSquare === "number" ? parsed.costPerSquare : 10,
        });
      }
    } catch (e) {
      console.error("Failed to load squares from storage:", e);
    }
  }, []);

  // Save to LocalStorage
  const saveState = (updated: SquaresBoardState) => {
    setBoard(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save squares to storage:", e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Cell Updates
  const handleCellChange = (r: number, c: number, name: string) => {
    const key = `${r}_${c}`;
    const nextGrid = { ...board.grid };
    if (!name.trim()) {
      delete nextGrid[key];
    } else {
      nextGrid[key] = name.trim();
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
    const val = headerInputValue.trim().slice(0, 4); // Keep short
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

  // Randomize 0-9 for top and/or left
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
        saveState(nextBoard);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast("Headers randomized 0-9!");
      },
    });
  };

  // Reset to default headers (1-0 and A-J)
  const resetHeadersToDefault = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Headers?",
      message: "This will reset the top row back to 1-0 and the first column back to A-J.",
      actionLabel: "Reset Headers",
      actionVariant: "primary",
      onConfirm: () => {
        saveState({
          ...board,
          topNumbers: [...DEFAULT_TOP_NUMBERS],
          leftNumbers: [...DEFAULT_LEFT_NUMBERS],
        });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast("Headers reset to 1-0 and A-J.");
      },
    });
  };

  // Clear names from grid
  const clearAllSquares = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear All Squares?",
      message: "Are you sure you want to remove all player names from this board? This action cannot be undone.",
      actionLabel: "Clear Board",
      actionVariant: "danger",
      onConfirm: () => {
        saveState({ ...board, grid: {} });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast("All squares cleared.");
      },
    });
  };

  // Stats & Calculations
  const stats = useMemo(() => {
    const claims = Object.values(board.grid);
    const totalClaimed = claims.length;
    const remaining = 100 - totalClaimed;
    const percentage = Math.round((totalClaimed / 100) * 100);

    const countsByUser: Record<string, number> = {};
    claims.forEach((name) => {
      const clean = name.trim();
      if (!clean) return;
      countsByUser[clean] = (countsByUser[clean] || 0) + 1;
    });

    const userList = Object.entries(countsByUser)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const cost = board.costPerSquare || 0;
    const totalPot = totalClaimed * cost;
    const fullPot = 100 * cost;

    return { totalClaimed, remaining, percentage, userList, totalPot, fullPot, cost };
  }, [board.grid, board.costPerSquare]);

  // Scoring / Winner resolution helper
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
      // Move to next cell horizontally
      if (c < 9) {
        setSelectedCell({ r, c: c + 1 });
      } else if (r < 9) {
        setSelectedCell({ r: r + 1, c: 0 });
      } else {
        setSelectedCell(null);
      }
    } else if (e.key === "Escape") {
      setSelectedCell(null);
    } else if (e.key === "ArrowRight" && c < 9) {
      e.preventDefault();
      setSelectedCell({ r, c: c + 1 });
    } else if (e.key === "ArrowLeft" && c > 0) {
      e.preventDefault();
      setSelectedCell({ r, c: c - 1 });
    } else if (e.key === "ArrowDown" && r < 9) {
      e.preventDefault();
      setSelectedCell({ r: r + 1, c });
    } else if (e.key === "ArrowUp" && r > 0) {
      e.preventDefault();
      setSelectedCell({ r: r - 1, c });
    }
  };

  useEffect(() => {
    if (selectedCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [selectedCell]);

  if (!mounted) {
    return (
      <div className="flex-1 min-h-[60vh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
      {/* Global & Print CSS: disables native input spinner arrows */}
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
          nav, header, footer, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .squares-grid-table {
            page-break-inside: avoid;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .squares-grid-table th, .squares-grid-table td {
            border: 1px solid #333 !important;
            font-size: 10px !important;
            padding: 4px 2px !important;
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
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60">
                    Live Grid
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5 hidden sm:block">
                  PocketPicks&trade; 100 Squares Pool &bull; Printable &amp; Interactive
                </p>
              </div>
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition shadow-2xs"
              title="Print or Save PDF"
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
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Pool / Event Title
              </label>
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
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  {stats.cost > 0 ? (
                    <>
                      <span className="font-black">${stats.totalPot.toLocaleString()}</span>
                      <span className="opacity-80"> Pot (${stats.cost}/sq)</span>
                    </>
                  ) : (
                    <span className="font-bold">Free Pool ($0/sq)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Teams Selector & Price Per Square */}
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
                  placeholder="e.g. Kansas City Chiefs"
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

            {/* Price Per Square Input */}
            <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Price / Square
                </span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
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
                  className="w-full pl-7 pr-3 py-1.5 text-sm font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
        <div className="hidden print:block mb-4 text-center">
          <h1 className="text-2xl font-black text-black">{board.title}</h1>
          <p className="text-sm font-semibold text-gray-700">
            AFC: {board.topTeam || "AFC"} &bull; NFC: {board.leftTeam || "NFC"}
            {stats.cost > 0 && ` • $${stats.cost} per square`}
          </p>
        </div>

        {/* 10x10 Super Bowl Squares Grid Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
          {/* Top Team Banner (AFC) above grid */}
          <div className="bg-slate-100/90 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2.5 text-center">
            <TeamLogo alt={board.topTeam} className="w-6 h-6 object-contain" />
            <span className="text-xs uppercase font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider">
              AFC &bull;
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
              {board.topTeam || "AFC Team"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse squares-grid-table">
              <thead>
                <tr>
                  {/* Empty spacer corner cell above the NFC vertical column */}
                  <th className="w-12 p-1 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-center align-middle" />

                  {/* Junction Cell for Coordinates */}
                  <th className="w-20 p-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-center align-middle">
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider leading-tight">
                      <div className="text-emerald-600 dark:text-emerald-400">AFC &rarr;</div>
                      <div className="border-t border-slate-300 dark:border-slate-600 my-1" />
                      <div className="text-sky-600 dark:text-sky-400">NFC &darr;</div>
                    </div>
                  </th>

                  {/* Top Row Headers (10 columns: default 1 to 0) */}
                  {board.topNumbers.map((num, cIdx) => (
                    <th
                      key={cIdx}
                      onClick={() => openHeaderEdit("top", cIdx)}
                      className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 text-center cursor-pointer transition select-none group"
                      title="Click to edit top number"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition">
                          {num}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase hidden sm:block">
                          Col {cIdx + 1}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {board.leftNumbers.map((rowLetter, rIdx) => (
                  <tr key={rIdx}>
                    {/* NFC Team Column spanning all 10 rows on the actual left side */}
                    {rIdx === 0 && (
                      <th
                        rowSpan={10}
                        className="w-12 p-2 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-center align-middle"
                      >
                        <div className="flex flex-col items-center justify-center gap-3 h-full select-none py-4">
                          <TeamLogo alt={board.leftTeam} className="w-7 h-7 object-contain shrink-0" />
                          <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                            NFC
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 truncate max-h-[340px]">
                            {board.leftTeam || "NFC Team"}
                          </span>
                        </div>
                      </th>
                    )}

                    {/* First Column Header (Row letter/number: default A to J) */}
                    <th
                      onClick={() => openHeaderEdit("left", rIdx)}
                      className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 text-center cursor-pointer transition select-none group w-20"
                      title="Click to edit row letter/number"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-sky-500 transition">
                          {rowLetter}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400 hidden sm:inline">
                          R{rIdx + 1}
                        </span>
                      </div>
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

                      return (
                        <td
                          key={cIdx}
                          onClick={() => setSelectedCell({ r: rIdx, c: cIdx })}
                          className={`h-14 sm:h-16 p-1 border border-slate-200 dark:border-slate-700/80 text-center align-middle relative transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-emerald-50 dark:bg-emerald-950/60 ring-2 ring-emerald-500 z-10"
                              : isFilterMatch
                              ? "bg-amber-100/90 dark:bg-amber-950/60 ring-2 ring-amber-400"
                              : isAnyWinner
                              ? "bg-gradient-to-br from-amber-50 to-emerald-50 dark:from-amber-950/40 dark:to-emerald-950/40 ring-2 ring-amber-500"
                              : name
                              ? "bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                          }`}
                        >
                          {isSelected ? (
                            <input
                              ref={cellInputRef}
                              type="text"
                              value={name}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              onBlur={() => setSelectedCell(null)}
                              onKeyDown={(e) => handleCellKeyDown(e, rIdx, cIdx)}
                              placeholder="Name..."
                              className="w-full h-full text-center text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white bg-white dark:bg-slate-900 rounded-lg border border-emerald-500 shadow-inner px-1 focus:outline-hidden"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center px-1">
                              {name ? (
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight break-words">
                                  {name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-300 dark:text-slate-700 font-medium select-none no-print">
                                  {board.leftNumbers[rIdx]},{board.topNumbers[cIdx]}
                                </span>
                              )}

                              {/* Winner Badge on square */}
                              {isAnyWinner && (
                                <div className="absolute top-1 right-1 flex gap-0.5 no-print">
                                  {isQ1Winner && (
                                    <span className="text-[8px] font-black px-1 py-0.2 rounded bg-amber-500 text-white shadow-2xs">
                                      Q1
                                    </span>
                                  )}
                                  {isQ2Winner && (
                                    <span className="text-[8px] font-black px-1 py-0.2 rounded bg-sky-500 text-white shadow-2xs">
                                      Q2
                                    </span>
                                  )}
                                  {isQ3Winner && (
                                    <span className="text-[8px] font-black px-1 py-0.2 rounded bg-purple-500 text-white shadow-2xs">
                                      Q3
                                    </span>
                                  )}
                                  {isFinalWinner && (
                                    <span className="text-[8px] font-black px-1 py-0.2 rounded bg-emerald-600 text-white shadow-2xs">
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

          {/* Table Footer Instructions */}
          <div className="bg-slate-50 dark:bg-slate-800/40 px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">
              Click any square or header number to edit. Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Tab</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Enter</kbd> to move to the next square.
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
              Auto-saved to device
            </span>
          </div>
        </div>

        {/* Players List & Quarter Winners Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          {/* Quarter Score & Winner Calculator */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Quarter Winners &amp; Live Score Tracker</span>
              </h3>
              <span className="text-xs text-slate-400">Last digit of each score</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {[
                { key: "q1", label: "1st Quarter", state: board.q1Score, winner: quarterWinners.q1 },
                { key: "q2", label: "Halftime (2nd Q)", state: board.q2Score, winner: quarterWinners.q2 },
                { key: "q3", label: "3rd Quarter", state: board.q3Score, winner: quarterWinners.q3 },
                { key: "final", label: "Final Score", state: board.finalScore, winner: quarterWinners.final },
              ].map(({ key, label, state, winner }) => (
                <div
                  key={key}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{label}</span>
                    {winner?.winnerName && (
                      <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {winner.winnerName}
                      </span>
                    )}
                  </div>

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
