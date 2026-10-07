"use client";

import React, { useState, useMemo } from "react";
import {
  Game,
  LeagueSettings,
  User,
  UserPicks,
  TiebreakerPrediction,
  EliminatorStatus,
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
} from "lucide-react";
import { WeeklyPicks } from "./WeeklyPicks";
import { authFetch } from "@/lib/api-client";

type CommissionerSubTab = "roster" | "overrides" | "settings";

interface CommissionerHubProps {
  leagueId: string;
  games: Game[];
  activeWeek: number;
  settings: LeagueSettings;
  users: User[];
  allPicks: UserPicks[];
  eliminatorStatus?: EliminatorStatus[];
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
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "complete">("all");

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

      const pickemDone =
        settings.pickemEnabled !== false
          ? totalGames > 0 && validPicksCount >= totalGames
          : true;
      const survivorDone = settings.eliminatorEnabled ? hasSurvivor : true;

      const isComplete = pickemDone && survivorDone;
      const isMissing = validPicksCount === 0 && !hasSurvivor;
      const isPartial = !isComplete && !isMissing;

      return {
        user: u,
        validPicksCount,
        hasTiebreaker,
        hasSurvivor,
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

  // Filtered members list
  const filteredStatuses = useMemo(() => {
    return memberStatuses.filter(({ user, isComplete, isMissing, isPartial }) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!user.name.toLowerCase().includes(query)) return false;
      }
      if (statusFilter === "missing") return isMissing || isPartial;
      if (statusFilter === "complete") return isComplete;
      return true;
    });
  }, [memberStatuses, searchQuery, statusFilter]);

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
    <div className="space-y-6 pb-16 sm:pb-6">
      {/* Commissioner Control Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60">
                <SlidersHorizontal className="w-3 h-3" />
                Commissioner
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {settings.leagueName || "League Control Room"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Week {activeWeek} roster, pick overrides, and league settings.
            </p>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveSubTab("roster")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === "roster"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Roster &amp; Invites</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("overrides")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === "overrides"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Pick Overrides</span>
              {missingCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {missingCount} missing
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("settings")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === "settings"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Settings</span>
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
                </div>
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
                            className={`w-10 h-10 rounded-full ${
                              u.avatarColor || "bg-slate-800"
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
                                    hasSurvivor
                                      ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      hasSurvivor
                                        ? "bg-purple-600 dark:bg-purple-400"
                                        : "bg-slate-400"
                                    }`}
                                  />
                                  <span>Survivor:</span>
                                  {hasSurvivor ? (
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
                          {/* Quick "Enter Picks" shortcut */}
                          <button
                            type="button"
                            onClick={() => handleEnterPicksForUser(u.id)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                            title="Enter or override picks on behalf of this player"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            <span>Override Picks</span>
                          </button>

                          {/* Member management controls */}
                          {!isCommish ? (
                            <div className="flex items-center gap-1.5 w-[96px] justify-end shrink-0">
                              <button
                                type="button"
                                onClick={() => setUserToTransfer(u)}
                                title={`Transfer Commissioner role to ${u.name}`}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition border border-slate-200 dark:border-slate-700"
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setUserToKick(u)}
                                title={`Kick ${u.name} from league`}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl transition border border-amber-200 dark:border-amber-900/60"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setUserToBan(u)}
                                title={`Ban ${u.name} from platform`}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl transition border border-rose-200 dark:border-rose-900/60"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-[96px] shrink-0" aria-hidden="true" />
                          )}
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
      {/* SUB-TAB 2: PICK OVERRIDES */}
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

          {/* Right Column: Live Data Sync & Danger Zone */}
          <div className="space-y-6">
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