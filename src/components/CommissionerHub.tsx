"use client";

import React, { useState, useMemo } from "react";
import {
  Game,
  LeagueSettings,
  User,
  UserPicks,
  TiebreakerPrediction,
  EliminatorStatus,
  SeasonPlayerStanding,
} from "@/types/nfl";
import {
  SlidersHorizontal,
  Key,
  Users,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  UserMinus,
  Ban,
  User as UserIcon,
  Crown,
  Search,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Lock,
  Clock,
  DollarSign,
  CreditCard,
  Trophy,
  Mail,
  ExternalLink,
} from "lucide-react";
import { WeeklyPicks } from "./WeeklyPicks";
import { authFetch } from "@/lib/api-client";
import {
  getPayoutConfig,
  formatMoney,
  describeDues,
  normalizeVenmoHandle,
  buildVenmoPayUrl,
  buildPrizeLedger,
  type PrizeEntry,
} from "@/lib/payouts";

type CommissionerSubTab = "roster" | "payouts" | "overrides" | "settings";

interface CommissionerHubProps {
  leagueId: string;
  games: Game[];
  activeWeek: number;
  settings: LeagueSettings;
  users: User[];
  allPicks: UserPicks[];
  eliminatorStatus?: EliminatorStatus[];
  seasonStandings?: SeasonPlayerStanding[];
  isSeasonOver?: boolean;
  overrideLogs?: any[];
  paidMembers?: Record<string, boolean>;
  payoutRecords?: Record<string, { paidOut: boolean; paidAt?: string | null }>;
  onTogglePaid?: (userId: string, newPaid: boolean) => Promise<void>;
  onTogglePayout?: (key: string, newPaidOut: boolean) => Promise<void>;
  onNudgeUnpaid?: () => Promise<void>;
  onSyncEspn?: (week: number) => Promise<void>;
  isSyncing?: boolean;
  onOverridePicks: (
    userId: string,
    week: number,
    picks: Record<string, string>,
    tiebreaker?: TiebreakerPrediction,
    eliminatorPick?: string
  ) => Promise<void>;
  onUpdateSettings: (newSettings: Partial<LeagueSettings>) => Promise<void>;
  onDeleteLeague: () => Promise<void>;
  onRemoveUser?: (userId: string) => Promise<void>;
  onTransferCommissioner?: (newCommissionerId: string) => Promise<void>;
}

function checkGameLocked(
  game: Game,
  weekGames: Game[],
  lockPolicy: string = "game",
  now: number = Date.now()
): boolean {
  if (
    game.status?.completed ||
    game.status?.state === "in" ||
    new Date(game.date).getTime() <= now
  ) {
    return true;
  }
  if (lockPolicy === "week") {
    const firstGame = Math.min(...weekGames.map((g) => new Date(g.date).getTime()));
    return now >= firstGame;
  }
  if (lockPolicy === "day") {
    const gameDay = new Date(game.date).toDateString();
    const sameDayGames = weekGames.filter(
      (g) => new Date(g.date).toDateString() === gameDay
    );
    const firstGame = Math.min(...sameDayGames.map((g) => new Date(g.date).getTime()));
    return now >= firstGame;
  }
  return false;
}

export function CommissionerHub({
  leagueId,
  games,
  activeWeek,
  settings,
  users,
  allPicks,
  eliminatorStatus,
  seasonStandings = [],
  isSeasonOver = false,
  overrideLogs,
  paidMembers = {},
  payoutRecords = {},
  onTogglePaid,
  onTogglePayout,
  onNudgeUnpaid,
  onOverridePicks,
  onUpdateSettings,
  onDeleteLeague,
  onRemoveUser,
  onTransferCommissioner,
  onSyncEspn,
  isSyncing,
}: CommissionerHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<CommissionerSubTab>("roster");
  const [leagueNameInput, setLeagueNameInput] = useState(settings.leagueName);
  const [entryFeeInput, setEntryFeeInput] = useState<string>(
    typeof settings.entryFee === "number" ? settings.entryFee.toString() : "0"
  );
  const [weeklyFeeInput, setWeeklyFeeInput] = useState<string>(
    typeof settings.weeklyFee === "number" ? settings.weeklyFee.toString() : ""
  );
  const [seasonFeeInput, setSeasonFeeInput] = useState<string>(
    typeof settings.seasonFee === "number" ? settings.seasonFee.toString() : ""
  );
  const [survivorFeeInput, setSurvivorFeeInput] = useState<string>(
    typeof settings.survivorFee === "number" ? settings.survivorFee.toString() : ""
  );
  const [venmoHandleInput, setVenmoHandleInput] = useState<string>(
    settings.venmoHandle || ""
  );
  const [isNudging, setIsNudging] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || "");
  const [leaguePassword, setLeaguePassword] = useState(settings.leaguePassword || "");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Modals state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToKick, setUserToKick] = useState<User | null>(null);
  const [userToBan, setUserToBan] = useState<User | null>(null);
  const [userToTransfer, setUserToTransfer] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Roster search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "complete" | "paid" | "unpaid">("all");

  const totalGames = games.length;

  // Build team lookup map from games
  const teamsMap = useMemo(() => {
    const map = new Map<string, { abbreviation: string; name: string; logo?: string }>();
    for (const g of games) {
      if (g.homeTeam) {
        map.set(g.homeTeam.id, {
          abbreviation: g.homeTeam.abbreviation || g.homeTeam.name,
          name: g.homeTeam.name,
          logo: g.homeTeam.logo,
        });
      }
      if (g.awayTeam) {
        map.set(g.awayTeam.id, {
          abbreviation: g.awayTeam.abbreviation || g.awayTeam.name,
          name: g.awayTeam.name,
          logo: g.awayTeam.logo,
        });
      }
    }
    return map;
  }, [games]);

  // Compute submission statistics per user for active week
  const memberStatuses = useMemo(() => {
    const now = Date.now();
    return users.map((u) => {
      const userPickObj = allPicks?.find(
        (p) => p.userId === u.id && p.week === activeWeek
      );
      const picksMap = userPickObj?.picks || {};
      const validPicksCount = Object.keys(picksMap).filter(
        (gid) => !!picksMap[gid] && picksMap[gid] !== "HIDDEN"
      ).length;

      const hasTiebreaker =
        !!userPickObj?.tiebreaker &&
        typeof userPickObj.tiebreaker.totalScore === "number" &&
        userPickObj.tiebreaker.totalScore > 0;

      const elimPick = userPickObj?.eliminatorPick;
      const hasSurvivor = !!elimPick;

      const elimGame =
        elimPick && elimPick !== "HIDDEN"
          ? games.find(
              (g) => g.homeTeam.id === elimPick || g.awayTeam.id === elimPick
            )
          : undefined;

      const isElimGameLocked = elimGame
        ? checkGameLocked(elimGame, games, settings.lockPolicy, now)
        : false;

      const pickedTeam =
        elimPick && elimPick !== "HIDDEN" ? teamsMap.get(elimPick) : undefined;

      // Only reveal the actual team name if that specific game has kicked off or if it is the commissioner's own account
      const isSurvivorRevealed =
        elimPick !== "HIDDEN" &&
        (isElimGameLocked || u.id === settings.commissionerId);

      const userElimStatus = eliminatorStatus?.find((s) => s.userId === u.id);
      const isUserEliminated =
        userElimStatus?.status === "Eliminated" &&
        (userElimStatus.eliminatedWeek === undefined || userElimStatus.eliminatedWeek < activeWeek || !hasSurvivor);

      const pickemDone =
        settings.pickemEnabled !== false
          ? totalGames > 0 && validPicksCount >= totalGames
          : true;

      // If user was eliminated from Survivor, they cannot make picks, so survivor is considered satisfied
      const survivorDone = settings.eliminatorEnabled
        ? (hasSurvivor || isUserEliminated)
        : true;

      const isComplete = pickemDone && survivorDone;
      const isMissing =
        (settings.pickemEnabled !== false ? validPicksCount === 0 : true) &&
        !hasSurvivor &&
        !isUserEliminated;
      const isPartial = !isComplete && !isMissing;

      return {
        user: u,
        validPicksCount,
        hasTiebreaker,
        hasSurvivor,
        isUserEliminated,
        survivorPick: elimPick,
        survivorTeam: pickedTeam,
        isSurvivorRevealed,
        isComplete,
        isPartial,
        isMissing,
      };
    });
  }, [
    users,
    allPicks,
    activeWeek,
    totalGames,
    teamsMap,
    games,
    eliminatorStatus,
    settings.lockPolicy,
    settings.commissionerId,
    settings.pickemEnabled,
    settings.eliminatorEnabled,
  ]);

  const completeCount = memberStatuses.filter((s) => s.isComplete).length;
  const missingCount = memberStatuses.filter((s) => s.isMissing).length;
  const partialCount = memberStatuses.filter((s) => s.isPartial).length;
  const completionPercentage =
    users.length > 0 ? Math.round((completeCount / users.length) * 100) : 0;

  const paidCount = users.filter((u) => !!paidMembers[u.id]).length;
  const unpaidCount = users.length - paidCount;

  const cfg = useMemo(() => getPayoutConfig(settings), [settings]);
  const duesPerMember = cfg.duesPerPlayer;
  const totalPot = duesPerMember * users.length;
  const collectedDues = duesPerMember * paidCount;
  const unpaidDues = duesPerMember * unpaidCount;

  const prizeLedger = useMemo(() => {
    return buildPrizeLedger({
      cfg,
      users,
      seasonStandings: seasonStandings || [],
      eliminatorStatus: eliminatorStatus || [],
      isSeasonOver: !!isSeasonOver,
    });
  }, [cfg, users, seasonStandings, eliminatorStatus, isSeasonOver]);

  const totalPaidOut = useMemo(() => {
    return prizeLedger
      .filter((p) => !!payoutRecords?.[p.key]?.paidOut)
      .reduce((sum, p) => sum + p.amount, 0);
  }, [prizeLedger, payoutRecords]);

  const balanceRemaining = collectedDues - totalPaidOut;

  // Compute per-member prize totals and payout status for season
  const userWinnings = useMemo(() => {
    const map = new Map<
      string,
      {
        user: User;
        totalWon: number;
        totalPaidOut: number;
        pending: number;
        winsCount: number;
        winItems: { label: string; amount: number; isPaidOut: boolean }[];
      }
    >();

    users.forEach((u) => {
      map.set(u.id, {
        user: u,
        totalWon: 0,
        totalPaidOut: 0,
        pending: 0,
        winsCount: 0,
        winItems: [],
      });
    });

    prizeLedger.forEach((prize) => {
      if (!prize.decided || prize.winners.length === 0) return;
      const share = Math.round((prize.amount / prize.winners.length) * 100) / 100;
      const isPaid = !!payoutRecords?.[prize.key]?.paidOut;

      prize.winners.forEach((w) => {
        const item = map.get(w.id);
        if (item) {
          item.totalWon += share;
          if (isPaid) {
            item.totalPaidOut += share;
          } else {
            item.pending += share;
          }
          item.winsCount += 1;
          item.winItems.push({
            label: prize.label,
            amount: share,
            isPaidOut: isPaid,
          });
        }
      });
    });

    return Array.from(map.values())
      .filter((item) => item.totalWon > 0)
      .sort((a, b) => {
        if (b.totalWon !== a.totalWon) return b.totalWon - a.totalWon;
        if (b.pending !== a.pending) return b.pending - a.pending;
        return a.user.name.localeCompare(b.user.name);
      });
  }, [users, prizeLedger, payoutRecords]);

  const handleNudgeUnpaidClick = async () => {
    if (unpaidCount === 0) return;
    if (!confirm(`Send an email dues reminder to all ${unpaidCount} unpaid member(s)?`)) return;
    setIsNudging(true);
    try {
      await onNudgeUnpaid?.();
    } finally {
      setIsNudging(false);
    }
  };

  const handleSavePayoutSettings = async () => {
    const w = Number(weeklyFeeInput) || 0;
    const s = Number(seasonFeeInput) || 0;
    const sv = Number(survivorFeeInput) || 0;
    const ef = Number(entryFeeInput) || 0;
    const handle = normalizeVenmoHandle(venmoHandleInput);
    if (venmoHandleInput.trim() && handle === null) {
      alert("Please enter a valid Venmo handle (3-30 letters, numbers, - or _)");
      return;
    }
    await onUpdateSettings({
      weeklyFee: w,
      seasonFee: s,
      survivorFee: sv,
      entryFee: ef,
      venmoHandle: handle || "",
    });
  };

  // Filtered members list
  const filteredStatuses = useMemo(() => {
    return memberStatuses.filter(({ user, isComplete, isMissing, isPartial }) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!user.name.toLowerCase().includes(query)) return false;
      }
      if (statusFilter === "missing") return isMissing || isPartial;
      if (statusFilter === "complete") return isComplete;
      if (statusFilter === "paid") return !!paidMembers[user.id];
      if (statusFilter === "unpaid") return !paidMembers[user.id];
      return true;
    });
  }, [memberStatuses, searchQuery, statusFilter, paidMembers]);

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];
  const picksForSelectedUser = allPicks?.find(
    (p) => p.userId === selectedUser?.id && p.week === activeWeek
  );

  const handleKickUser = async () => {
    if (!userToKick) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/league/${leagueId}/members/kick`, {
        method: "POST",
        body: JSON.stringify({ userId: userToKick.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to kick member");
        setActionLoading(false);
        return;
      }
      const kickedId = userToKick.id;
      setUserToKick(null);
      if (onRemoveUser) {
        await onRemoveUser(kickedId);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to kick member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!userToBan) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/league/${leagueId}/members/ban`, {
        method: "POST",
        body: JSON.stringify({ userId: userToBan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to ban user");
        setActionLoading(false);
        return;
      }
      const bannedId = userToBan.id;
      setUserToBan(null);
      if (onRemoveUser) {
        await onRemoveUser(bannedId);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to ban user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!userToTransfer) return;
    setActionLoading(true);
    try {
      if (onTransferCommissioner) {
        await onTransferCommissioner(userToTransfer.id);
      } else {
        const res = await authFetch(`/api/league/${leagueId}/members/transfer`, {
          method: "POST",
          body: JSON.stringify({ newCommissionerId: userToTransfer.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Failed to transfer commissioner role");
          setActionLoading(false);
          return;
        }
      }
      setUserToTransfer(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to transfer commissioner role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnterPicksForUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveSubTab("overrides");
  };

  return (
    <div className="space-y-6">
      {/* Commissioner Control Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60 shrink-0">
                <SlidersHorizontal className="w-3 h-3" />
                Commissioner
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {settings.leagueName || "League Control Room"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Week {activeWeek} roster, pick overrides, and league settings.
            </p>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 sm:border-0 sm:bg-transparent sm:dark:bg-transparent sm:p-0">
            <button
              type="button"
              onClick={() => setActiveSubTab("roster")}
              className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeSubTab === "roster"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-transparent sm:bg-slate-100 dark:sm:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700/40"
              }`}
            >
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Roster &amp; Invites</span>
              <span className="sm:hidden truncate">Roster</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("payouts")}
              className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeSubTab === "payouts"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-transparent sm:bg-slate-100 dark:sm:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700/40"
              }`}
            >
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Payouts &amp; Ledger</span>
              <span className="sm:hidden truncate">Payouts</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("overrides")}
              className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeSubTab === "overrides"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-transparent sm:bg-slate-100 dark:sm:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700/40"
              }`}
            >
              <FileEdit className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Pick Overrides</span>
              <span className="sm:hidden truncate">Overrides</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("settings")}
              className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeSubTab === "settings"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-transparent sm:bg-slate-100 dark:sm:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700/40"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: ROSTER & INVITES */}
      {/* ========================================================================= */}
      {activeSubTab === "roster" && (
        <div className="space-y-6">
          {/* Quick Invites & Code Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  League Invite &amp; Code
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Share this 5-digit code or direct link with friends to invite them.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* 5-Digit Code */}
                <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-2">
                    Code:
                  </span>
                  <span className="font-mono font-black text-sm tracking-widest text-slate-900 dark:text-white mr-2">
                    {leagueId}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(leagueId);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition text-slate-600 dark:text-slate-300"
                    title="Copy league code"
                  >
                    {copiedCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Direct Link */}
                <button
                  onClick={() => {
                    const link =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/?join=${leagueId}`
                        : "";
                    navigator.clipboard.writeText(link);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Link Copied!" : "Copy Invite Link"}</span>
                </button>

                {settings.leaguePassword && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Password Protected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Members Roster & Submission Tracking */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Member Roster &amp; Pick Tracker
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Live Week {activeWeek} submission status for every player in your league.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search member..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 w-[140px] sm:w-[170px]"
                  />
                </div>

                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      statusFilter === "all"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("missing")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      statusFilter === "missing"
                        ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Pending ({missingCount + partialCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("complete")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      statusFilter === "complete"
                        ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Done ({completeCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("paid")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      statusFilter === "paid"
                        ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Paid ({paidCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("unpaid")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      statusFilter === "unpaid"
                        ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Unpaid ({unpaidCount})
                  </button>
                </div>

                {unpaidCount > 0 && onNudgeUnpaid && (
                  <button
                    type="button"
                    onClick={handleNudgeUnpaidClick}
                    disabled={isNudging}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                    title="Send email reminder to all unpaid members"
                  >
                    {isNudging ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    <span>Nudge Unpaid</span>
                  </button>
                )}
              </div>
            </div>

            {/* Members Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStatuses.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No members match your search or filter.
                </div>
              ) : (
                filteredStatuses.map(
                  ({
                    user: u,
                    validPicksCount,
                    hasTiebreaker,
                    hasSurvivor,
                    isUserEliminated,
                    survivorPick,
                    survivorTeam,
                    isSurvivorRevealed,
                    isComplete,
                    isPartial,
                    isMissing,
                  }) => {
                    const isCommish = settings.commissionerId === u.id;

                    return (
                      <div
                        key={u.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition gap-3"
                      >
                        {/* Member Identity & Status */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl ${
                              u.avatarColor || "bg-emerald-600"
                            } text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-2xs`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                              <span className="truncate">{u.name}</span>
                              {isCommish && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] rounded-full font-black uppercase tracking-wider border border-amber-300/80 dark:border-amber-800/60">
                                  <Crown className="w-2.5 h-2.5" />
                                  Commissioner
                                </span>
                              )}

                              {/* Paid / Unpaid Tag Toggle (Visible only in Commissioner Hub) */}
                              {(() => {
                                const isPaid = !!paidMembers[u.id];
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onTogglePaid?.(u.id, !isPaid);
                                    }}
                                    title={`Click to mark ${u.name} as ${isPaid ? "Unpaid" : "Paid"}`}
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer select-none active:scale-95 ${
                                      isPaid
                                        ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                        : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-emerald-500" : "bg-amber-500"}`} />
                                    <span>{isPaid ? "Paid" : "Unpaid"}</span>
                                  </button>
                                );
                              })()}
                            </div>

                            {/* Pick submission badge */}
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {isComplete && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/60">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Picks In ({validPicksCount}/{totalGames})
                                </span>
                              )}

                              {isPartial && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  Partial ({validPicksCount}/{totalGames})
                                </span>
                              )}

                              {isMissing && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/60">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  No Picks (0/{totalGames})
                                </span>
                              )}

                              {settings.eliminatorEnabled && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    isUserEliminated
                                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60"
                                      : hasSurvivor
                                      ? "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/60"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isUserEliminated
                                        ? "bg-rose-500"
                                        : hasSurvivor
                                        ? "bg-orange-500 dark:bg-orange-400"
                                        : "bg-slate-400"
                                    }`}
                                  />
                                  <span>Survivor:</span>
                                  {isUserEliminated ? (
                                    <span className="font-extrabold text-rose-600 dark:text-rose-400">Eliminated</span>
                                  ) : hasSurvivor ? (
                                    isSurvivorRevealed ? (
                                      <>
                                        {survivorTeam?.logo && (
                                          <img
                                            src={survivorTeam.logo}
                                            alt=""
                                            className="w-3.5 h-3.5 object-contain"
                                          />
                                        )}
                                        <span className="font-extrabold">
                                          {survivorTeam?.abbreviation || survivorTeam?.name || "Picked"}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-extrabold">Hidden</span>
                                    )
                                  ) : (
                                    <span>Missing</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          {/* Member management controls for non-commissioners */}
                          {!isCommish && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setUserToTransfer(u)}
                                title={`Transfer Commissioner role to ${u.name}`}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setUserToKick(u)}
                                title={`Kick ${u.name} from league`}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl transition border border-amber-200 dark:border-amber-900/60 cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setUserToBan(u)}
                                title={`Ban ${u.name} from platform`}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl transition border border-rose-200 dark:border-rose-900/60 cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Quick "Enter Picks" shortcut - placed last so it is consistently flush right on all rows */}
                          <button
                            type="button"
                            onClick={() => handleEnterPicksForUser(u.id)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            title="Enter or override picks on behalf of this player"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            <span>Override Picks</span>
                          </button>
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: PAYOUTS & PRIZE LEDGER */}
      {/* ========================================================================= */}
      {activeSubTab === "payouts" && (
        <div className="space-y-6">
          {/* Pot & Dues Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  League Pot &amp; Dues Ledger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track member dues collected, active prize payouts, and remaining pool balance.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {duesPerMember > 0 && unpaidCount > 0 && onNudgeUnpaid && (
                  <button
                    type="button"
                    onClick={handleNudgeUnpaidClick}
                    disabled={isNudging}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
                    title="Send email reminder to all unpaid members"
                  >
                    {isNudging ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    <span>Nudge Unpaid ({unpaidCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSubTab("settings")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Configure Fees</span>
                </button>
              </div>
            </div>

            {/* 4-Stat Metric Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Pot</div>
                <div className="font-black text-lg text-slate-900 dark:text-white mt-1">
                  ${totalPot.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {formatMoney(duesPerMember)} / player
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Collected</div>
                <div className="font-black text-lg text-emerald-700 dark:text-emerald-300 mt-1">
                  ${collectedDues.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-600/80 mt-0.5">
                  {paidCount} of {users.length} paid
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-900/40">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">Paid Out</div>
                <div className="font-black text-lg text-sky-700 dark:text-sky-300 mt-1">
                  ${totalPaidOut.toLocaleString()}
                </div>
                <div className="text-[10px] text-sky-600/80 mt-0.5">
                  {prizeLedger.filter((p) => !!payoutRecords?.[p.key]?.paidOut).length} prizes settled
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/40">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">Remaining Balance</div>
                <div className="font-black text-lg text-purple-700 dark:text-purple-300 mt-1">
                  ${balanceRemaining.toLocaleString()}
                </div>
                <div className="text-[10px] text-purple-600/80 mt-0.5">
                  {unpaidCount > 0 ? `$${unpaidDues.toLocaleString()} outstanding` : "Fully collected"}
                </div>
              </div>
            </div>

            {/* Dues Structure & Venmo Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="font-bold">Structure:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {describeDues(cfg) || "No fees configured"}
                </span>
              </div>

              {settings.venmoHandle && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Venmo:</span>
                  <a
                    href={buildVenmoPayUrl(settings.venmoHandle, duesPerMember, `PocketPicks dues - ${settings.leagueName}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#008cff] hover:underline"
                  >
                    <span>@{settings.venmoHandle}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Prize Ledger Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Prize Ledger &amp; Payout Records
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Decided weekly, season, and survivor prizes. Mark prizes as paid out when distributed to members.
                </p>
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                {prizeLedger.length} Prize{prizeLedger.length === 1 ? "" : "s"}
              </span>
            </div>

            {prizeLedger.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Trophy className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="font-bold text-slate-600 dark:text-slate-400">No prizes decided yet</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  Weekly winners are crowned once all games for each week go final. Season overall and Survivor winners appear here when decided.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {prizeLedger.map((prize) => {
                  const isPaidOut = !!payoutRecords?.[prize.key]?.paidOut;
                  return (
                    <div
                      key={prize.key}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-900/40">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {prize.label}
                            </span>
                            <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-900/50">
                              ${prize.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Winner: <strong className="text-slate-700 dark:text-slate-300">{prize.winners.map((w) => w.name).join(", ") || "None"}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isPaidOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3.5 h-3.5" />
                            <span>Paid Out</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Payout</span>
                          </span>
                        )}

                        {onTogglePayout && (
                          <button
                            type="button"
                            onClick={() => onTogglePayout(prize.key, !isPaidOut)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              isPaidOut
                                ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                            }`}
                          >
                            {isPaidOut ? "Mark Unpaid" : "Mark Paid Out"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Member Winnings & Payout Totals Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Member Winnings &amp; Payout Totals</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total prizes won per player this season, amounts settled, and balances pending.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-extrabold text-slate-500 dark:text-slate-400">Total Awarded:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-900/50">
                  ${userWinnings.reduce((sum, u) => sum + u.totalWon, 0).toLocaleString()}
                </span>
              </div>
            </div>

            {userWinnings.length === 0 ? (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Trophy className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="font-bold text-slate-600 dark:text-slate-400">No member winnings yet</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  As weekly winners are crowned, season standings finalize, or survivor pools conclude, each player&apos;s prize totals and payout status will appear here.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {userWinnings.map((w) => (
                  <div
                    key={w.user.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                          w.user.avatarColor || "bg-emerald-600"
                        }`}
                      >
                        {w.user.name.charAt(0)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {w.user.name}
                          </span>
                          {w.pending > 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Owed ${w.pending.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              All Settled
                            </span>
                          )}
                        </div>

                        {/* Breakdown of won events */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {w.winItems.map((item, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                item.isPaidOut
                                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50"
                                  : "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50"
                              }`}
                            >
                              {item.label}: ${item.amount.toLocaleString()} {item.isPaidOut ? "✓" : "⏳"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Financial Totals */}
                    <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto shrink-0 text-right">
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-400">Total Won</div>
                        <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          ${w.totalWon.toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-400">Paid Out</div>
                        <div className="font-bold text-sm text-slate-700 dark:text-slate-300">
                          ${w.totalPaidOut.toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-400">Pending</div>
                        <div className={`font-black text-sm ${w.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
                          ${w.pending.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outstanding Dues Card */}
          {duesPerMember > 0 && unpaidCount > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <Users className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Outstanding Dues</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                    Members who have not yet had their buy-in marked as paid.
                  </p>
                </div>

                {onNudgeUnpaid && (
                  <button
                    type="button"
                    onClick={handleNudgeUnpaidClick}
                    disabled={isNudging}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
                    title="Send email reminder to all unpaid members"
                  >
                    {isNudging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    <span>Nudge Unpaid</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {users
                  .filter((u) => !paidMembers[u.id])
                  .map((u) => (
                    <div
                      key={u.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-black flex items-center justify-center text-xs">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                          <div className="text-[11px] text-slate-400">Owes {formatMoney(duesPerMember)}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onTogglePaid?.(u.id, true)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                      >
                        Mark Paid
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: PICK OVERRIDES */}
      {/* ========================================================================= */}
      {activeSubTab === "overrides" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            {/* Header with Player Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Override Player Picks for Week {activeWeek}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select a player below to view and submit picks on their behalf, bypassing lock restrictions.
                </p>
              </div>

              {/* Player Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Player:
                </span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 min-w-[180px]"
                >
                  {users.map((u) => {
                    const status = memberStatuses.find((s) => s.user.id === u.id);
                    const tag = status?.isComplete
                      ? "✓"
                      : status?.isPartial
                      ? `(${status.validPicksCount}/${totalGames})`
                      : "(Missing)";
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name} {tag}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Commissioner Override Info Callout */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200/60 dark:border-amber-900/50 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>Commissioner Override Active:</strong> You are editing picks for{" "}
                <span className="font-bold underline">{selectedUser?.name}</span>. Any picks or
                tiebreakers saved will be locked in for their account regardless of whether the
                game has already begun.
              </div>
            </div>

            {/* Embedded WeeklyPicks Component */}
            {selectedUser && (
              <div className="relative commissioner-picks-wrapper pt-2">
                <WeeklyPicks
                  key={`${selectedUser.id}_${activeWeek}`}
                  games={games}
                  activeWeek={activeWeek}
                  currentUser={selectedUser}
                  existingPicks={picksForSelectedUser}
                  lockPolicy={settings.lockPolicy}
                  eliminatorEnabled={settings.eliminatorEnabled}
                  pickemEnabled={settings.pickemEnabled !== false}
                  usedEliminatorTeams={allPicks
                    .filter(
                      (p) =>
                        p.userId === selectedUser.id &&
                        p.week !== activeWeek &&
                        p.eliminatorPick
                    )
                    .map((p) => p.eliminatorPick || "")}
                  eliminatorStatus={eliminatorStatus}
                  totalMembersCount={users.length}
                  isCommissionerEditMode={true}
                  embedded
                  onSavePicks={async (picks, tiebreaker, eliminatorPick) => {
                    await onOverridePicks(
                      selectedUser.id,
                      activeWeek,
                      picks,
                      tiebreaker,
                      eliminatorPick
                    );
                  }}
                />
              </div>
            )}
          </div>

          {/* Timestamped Audit Logs Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Override Audit Log &amp; Timestamp History
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Permanent timestamped records of commissioner adjustments made on behalf of players.
                </p>
              </div>
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                {overrideLogs?.length || 0} Record{overrideLogs?.length === 1 ? "" : "s"}
              </span>
            </div>

            {(!overrideLogs || overrideLogs.length === 0) ? (
              <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No commissioner overrides have been logged for this league yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                {overrideLogs.map((log: any) => {
                  const targetUser = users.find((u) => u.id === log.targetUserId);
                  const targetName = targetUser?.name || "Player";
                  const dateStr = new Date(log.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  const pickCount = log.newPicks ? Object.keys(log.newPicks).length : 0;
                  return (
                    <div key={log.id} className="p-3.5 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <span>{targetName}</span>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                            Week {log.week}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {log.reason || "Kickoff override"} • {pickCount} picks recorded
                          {log.newEliminatorPick && ` • Survivor: ${log.newEliminatorPick}`}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 sm:text-right shrink-0">
                        {dateStr}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: SETTINGS & TOOLS */}
      {/* ========================================================================= */}
      {activeSubTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* League Rules & Format */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              League Settings &amp; Rules
            </h3>

            {/* League Name */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                League Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leagueNameInput}
                  onChange={(e) => setLeagueNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
                <button
                  onClick={() => onUpdateSettings({ leagueName: leagueNameInput })}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex-shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            {/* League Format */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                League Format
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                    settings.pickemEnabled !== false && settings.eliminatorEnabled
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={settings.pickemEnabled !== false && settings.eliminatorEnabled}
                    onChange={() =>
                      onUpdateSettings({ pickemEnabled: true, eliminatorEnabled: true })
                    }
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      Standard + Survivor
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Pick every game each week, plus pick one survivor team.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                    settings.pickemEnabled !== false && !settings.eliminatorEnabled
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={settings.pickemEnabled !== false && !settings.eliminatorEnabled}
                    onChange={() =>
                      onUpdateSettings({ pickemEnabled: true, eliminatorEnabled: false })
                    }
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      Pick&apos;em Only
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Just pick the winners of every game each week.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                    settings.pickemEnabled === false
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={settings.pickemEnabled === false}
                    onChange={() =>
                      onUpdateSettings({ pickemEnabled: false, eliminatorEnabled: true })
                    }
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      Survivor Only
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Pick one team to win each week. If they lose, you&apos;re out.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Pick Lock Policy */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pick Lock Policy
              </label>
              <select
                value={settings.lockPolicy || "game"}
                onChange={(e) =>
                  onUpdateSettings({ lockPolicy: e.target.value as "game" | "week" | "day" })
                }
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="game">Individual Kickoff (Lock game-by-game as each begins)</option>
                <option value="week">First Game of Week (Locks all games at Thursday kickoff)</option>
                <option value="day">First Game of Day (Locks all games on that day)</option>
              </select>
            </div>

            {/* League Password */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                League Password (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leaguePassword}
                  onChange={(e) => setLeaguePassword(e.target.value)}
                  placeholder="Leave blank for public"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                />
                <button
                  onClick={() => onUpdateSettings({ leaguePassword })}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex-shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: League Dues Tracker, Live Data Sync & Danger Zone */}
          <div className="space-y-6">
            {/* League Buy-In & Payout Structure Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  League Buy-In &amp; Payout Structure
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Configure your league buy-in structure (weekly winner, overall season champion, and survivor pool) and set your Venmo handle so members can pay you directly.
              </p>

              {/* Fee Inputs Grid */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                      Weekly Prize ($/wk)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="0.5"
                        value={weeklyFeeInput}
                        onChange={(e) => setWeeklyFeeInput(e.target.value)}
                        placeholder="3"
                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">Winner takes all</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                      Season Prize ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min="0"
                        max="5000"
                        value={seasonFeeInput}
                        onChange={(e) => setSeasonFeeInput(e.target.value)}
                        placeholder="5"
                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">1st place overall</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                      Survivor Prize ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min="0"
                        max="5000"
                        value={survivorFeeInput}
                        onChange={(e) => setSurvivorFeeInput(e.target.value)}
                        placeholder="5"
                        disabled={settings.eliminatorEnabled === false}
                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">Last one standing</span>
                  </div>
                </div>

                {/* Venmo Handle Input */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Commissioner Venmo Username
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">@</span>
                      <input
                        type="text"
                        value={venmoHandleInput}
                        onChange={(e) => setVenmoHandleInput(e.target.value)}
                        placeholder="username"
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSavePayoutSettings}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex-shrink-0 cursor-pointer shadow-xs"
                    >
                      Save Structure
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Shown to unpaid members on their league dashboard banner and in dues reminder emails so they can pay in 1 tap.
                  </span>
                </div>

                {/* Dues Breakdown Pill */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                  <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white">
                    <span>Dues Per Player:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(duesPerMember)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {describeDues(cfg) || "No buy-in configured"}
                  </div>
                </div>
              </div>

              {/* Dues Summary Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Total Pot</div>
                  <div className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                    ${totalPot.toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Collected</div>
                  <div className="font-black text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                    ${collectedDues.toLocaleString()}
                    <span className="text-[10px] font-medium text-emerald-600/70 ml-1">({paidCount})</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40">
                  <div className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Unpaid</div>
                  <div className="font-black text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                    ${unpaidDues.toLocaleString()}
                    <span className="text-[10px] font-medium text-amber-600/70 ml-1">({unpaidCount})</span>
                  </div>
                </div>
              </div>

              {/* Quick Jump to Payouts Subtab */}
              <button
                type="button"
                onClick={() => setActiveSubTab("payouts")}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span>View Payouts &amp; Prize Ledger &rarr;</span>
              </button>
            </div>

            {/* Live Data Sync */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ESPN Live Sync
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  Automated
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Scores and game statuses automatically refresh every 45-60 seconds when games are
                active. You can also trigger an immediate sync manually.
              </p>
              <button
                onClick={() => onSyncEspn?.(activeWeek)}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-95 text-white transition disabled:opacity-50 shadow-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`}
                />
                <span>
                  {isSyncing ? "Syncing ESPN Scores..." : `Sync Week ${activeWeek} Scores Now`}
                </span>
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 shadow-xs">
              <h3 className="font-extrabold text-base text-rose-900 dark:text-rose-200 flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                Danger Zone
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 mb-4 leading-relaxed">
                Deleting this league permanently erases all player picks, season standings, matchups,
                and member records. This action cannot be reversed.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete League</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Transfer Commissioner Confirmation Modal */}
      {userToTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Transfer Commissioner Role
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Are you sure you want to transfer Commissioner control of{" "}
                  <strong>{settings.leagueName}</strong> to{" "}
                  <strong className="text-slate-900 dark:text-white">{userToTransfer.name}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
              👑 You will step down to a standard member. {userToTransfer.name} will immediately gain
              full administrative privileges to manage settings, members, and pick overrides.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUserToTransfer(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleTransfer}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                <span>{actionLoading ? "Transferring..." : "Confirm Transfer"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kick Member Confirmation Modal */}
      {userToKick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Kick Member
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Remove <strong className="text-slate-900 dark:text-white">{userToKick.name}</strong>{" "}
                  from {settings.leagueName}?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
              This will remove their membership and picks from this league. Their global account
              remains active.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUserToKick(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleKickUser}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                <span>{actionLoading ? "Kicking..." : "Kick Member"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Member Confirmation Modal */}
      {userToBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Ban User
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Ban <strong className="text-slate-900 dark:text-white">{userToBan.name}</strong> from
                  the platform?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              🚫 This will permanently disable their account in Firebase Auth, remove them from this
              league, and prevent them from logging in.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUserToBan(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleBanUser}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                <span>{actionLoading ? "Banning..." : "Ban User"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete League Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Delete League</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Are you absolutely sure you want to delete{" "}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {settings.leagueName}
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              ⚠️ All player picks, season standings, matchups, and league history will be permanently
              erased. This action cannot be undone.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteLeague();
                  } catch (err) {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? "Deleting..." : "Delete League"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}