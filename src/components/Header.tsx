
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { User, LeagueSettings } from "@/types/nfl";
import {
  Trophy,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PlusCircle,
  LogIn,
  UserPlus,
  Loader2,
  Settings,
  AlertCircle,
  Sun,
  Moon,
  Share2,
  Copy,
  CheckCircle2,
  X,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api-client";
import { GameSwitcherDropdown } from "@/components/GameSwitcherDropdown";
import { FootballIcon } from "@/components/FootballIcon";
import { buildVenmoPayUrl, getPayoutConfig } from "@/lib/payouts";

const UserSettingsModal = dynamic(
  () => import("@/components/UserSettingsModal").then((m) => m.UserSettingsModal),
  { ssr: false }
);

interface HeaderProps {
  settings: LeagueSettings;
  users: User[];
  currentActiveUserId: string;
  activeWeek: number;
  availableWeeks: number[];
  currentLeagueId?: string;
  onSelectWeek: (week: number) => void;
  onSyncEspn?: (week?: number) => void | Promise<void>;
  isSyncing?: boolean;
}

interface LeagueMembership {
  id: string;
  leagueId: string;
  leagueName: string;
  role: string;
}

export function Header({
  settings,
  users,
  currentActiveUserId,
  activeWeek,
  availableWeeks,
  currentLeagueId,
  onSelectWeek,
  onSyncEspn,
  isSyncing,
}: HeaderProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  const isCommissioner = Boolean(user && settings.commissionerId && user.id === settings.commissionerId);
  const effectiveVenmoHandle = (isCommissioner && user?.venmoHandle)
    ? user.venmoHandle
    : (settings.venmoHandle || (isCommissioner ? (user?.venmoHandle || "") : ""));
  const payoutConfig = useMemo(() => getPayoutConfig(settings), [settings]);
  
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [leagueToLeave, setLeagueToLeave] = useState<LeagueMembership | null>(null);
  const [leaving, setLeaving] = useState(false);
  
  const [showCreate, setShowCreate] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [leagueFormat, setLeagueFormat] = useState("both");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const activeUser = currentActiveUserId ? users.find((u) => u.id === currentActiveUserId) || null : null;

  useEffect(() => {
    if (!user) {
      setMemberships([]);
      return;
    }
    const fetchLeagues = async () => {
      setLoadingLeagues(true);
      try {
        const q = query(collection(db, "memberships"), where("userId", "==", user.id));
        const querySnapshot = await getDocs(q);
        const m: LeagueMembership[] = [];
        querySnapshot.forEach((doc) => {
          m.push(doc.data() as LeagueMembership);
        });
        setMemberships(m);
      } catch (err) {
        console.error("Failed to fetch leagues:", err);
      } finally {
        setLoadingLeagues(false);
      }
    };
    fetchLeagues();
  }, [user, userDropdownOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [userDropdownOpen]);

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("last_active_league");
        localStorage.removeItem("pending_join_code");
      }
      await signOut(auth);
    } catch (err) {
      console.error("Failed to log out", err);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  };

  const handleLeaveLeague = async () => {
    if (!leagueToLeave) return;
    setLeaving(true);
    try {
      const res = await authFetch(`/api/league/${leagueToLeave.leagueId}/leave`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertModal({
          title: "Leave League Failed",
          message: data.error || "Failed to leave league",
        });
        setLeaving(false);
        return;
      }

      if (leagueToLeave.leagueId === currentLeagueId) {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("last_active_league");
          } catch {
            // Ignore storage errors
          }
        }
        window.location.href = "/";
      } else {
        setMemberships((prev) => prev.filter((m) => m.leagueId !== leagueToLeave.leagueId));
        setLeagueToLeave(null);
        setLeaving(false);
      }
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        title: "Leave League Failed",
        message: err.message || "Failed to leave league",
      });
      setLeaving(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newLeagueName.trim()) return;
    
    setCreating(true);
    setCreateError("");
    try {
      const res = await authFetch("/api/league/create", {
        method: "POST",
        body: JSON.stringify({
          name: newLeagueName.trim(),
          leagueFormat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create league");
        return;
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("last_active_league", data.leagueId);
        } catch {
          // Ignore storage errors
        }
      }
      router.push(`/league/${data.leagueId}`);
      window.location.href = `/league/${data.leagueId}`;
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to create league");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;
    
    setJoinError("");
    setJoining(true);
    
    try {
      const res = await authFetch("/api/league/join", {
        method: "POST",
        body: JSON.stringify({
          code: joinCode.trim(),
          password: joinPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || "Failed to join league.");
        return;
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("last_active_league", data.leagueId);
        } catch {
          // Ignore storage errors
        }
      }
      router.push(`/league/${data.leagueId}`);
      window.location.href = `/league/${data.leagueId}`;
    } catch (err: any) {
      console.error(err);
      setJoinError(err.message || "Failed to join league.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-[1920px] 2xl:max-w-[2200px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-4">
          
          <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
            <GameSwitcherDropdown
              currentGame="pickem"
              currentLeagueId={currentLeagueId}
              onJoin={() => setShowJoin(true)}
              onCreate={() => setShowCreate(true)}
            />
            <div className="flex items-center min-w-0 gap-1 sm:gap-2">
              <h1 className="font-black text-xs sm:text-lg tracking-tight text-slate-900 dark:text-white truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none flex items-center gap-1 shrink-0 sm:shrink">
                <span className="truncate">{settings.leagueName}</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">&apos;{settings.seasonYear.toString().slice(2)}</span>
              </h1>

              {currentLeagueId && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="inline-flex items-center text-[10px] sm:text-[11px] font-mono font-black tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 transition cursor-pointer shrink-0"
                  title="Click to view share code and link"
                >
                  <span>{currentLeagueId.toUpperCase()}</span>
                </button>
              )}

              {effectiveVenmoHandle && (
                <a
                  href={buildVenmoPayUrl(
                    effectiveVenmoHandle,
                    payoutConfig.duesPerPlayer > 0 ? payoutConfig.duesPerPlayer : 0,
                    `PocketPicks - ${settings.leagueName}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-[#008cff]/10 hover:bg-[#008cff]/20 text-[#008cff] border border-[#008cff]/30 transition shrink-0 cursor-pointer"
                  title={`Pay commissioner on Venmo (@${effectiveVenmoHandle})`}
                >
                  <CreditCard className="w-3 h-3 text-[#008cff] shrink-0" />
                  <span>Venmo</span>
                  <span className="hidden sm:inline font-mono font-semibold">@{effectiveVenmoHandle}</span>
                </a>
              )}
              
              {user && (
                <div className="hidden sm:flex items-center shrink-0 gap-1 sm:gap-2">
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 sm:mx-1 shrink-0" />

                  <div className="relative flex items-center shrink-0">
                    <select
                      value={activeWeek}
                      onChange={(e) => onSelectWeek(Number(e.target.value))}
                      className="h-7 sm:h-[34px] appearance-none bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm pl-2 sm:pl-3 pr-5 sm:pr-8 rounded-lg cursor-pointer transition-colors outline-none border border-slate-200/80 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 flex items-center"
                    >
                      {availableWeeks.map((week) => (
                        <option key={week} value={week} className="dark:bg-slate-900 dark:text-white">
                          Week {week}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 dark:text-slate-400 absolute right-1 sm:right-2.5 pointer-events-none" />
                  </div>

                  {onSyncEspn && (
                    <button
                      type="button"
                      onClick={() => onSyncEspn(activeWeek)}
                      disabled={isSyncing}
                      title={isSyncing ? "Syncing ESPN scores..." : `Refresh Week ${activeWeek} scores from ESPN`}
                      aria-label="Refresh ESPN scores"
                      className="h-7 w-7 sm:h-[34px] sm:w-[34px] rounded-lg bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0 active:scale-95"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSyncing ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
              title="Toggle Theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {!user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/auth/register"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </Link>
              </div>
            ) : (
              <div ref={dropdownRef} className="relative pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${activeUser?.avatarColor || user?.avatarColor || "bg-emerald-600"} flex items-center justify-center text-white font-black text-xs sm:text-sm flex-shrink-0 shadow-xs transition-colors`}
                >
                  {((activeUser?.name || user?.name || user?.username || user?.email || "U").charAt(0) || "U").toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col items-start leading-none">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">{activeUser?.name || user?.name || user?.username}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Account</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name || user.username || activeUser?.name}</p>
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
            )}
          </div>
        </div>
      </div>

      {/* Mobile Week Selector & ESPN Sync Sub-bar */}
      {user && (
        <div className="sm:hidden flex items-center justify-between px-3 py-1.5 bg-slate-50/90 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectWeek(Math.max(1, activeWeek - 1))}
              disabled={activeWeek <= 1}
              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="relative flex items-center">
              <select
                value={activeWeek}
                onChange={(e) => onSelectWeek(Number(e.target.value))}
                className="h-7 appearance-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs pl-2.5 pr-6 rounded-lg transition-colors outline-none border border-slate-200 dark:border-slate-700 flex items-center shadow-2xs cursor-pointer"
              >
                {availableWeeks.map((week) => (
                  <option key={week} value={week} className="dark:bg-slate-900 dark:text-white">
                    Week {week}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400 absolute right-1.5 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => onSelectWeek(Math.min(18, activeWeek + 1))}
              disabled={activeWeek >= 18}
              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {onSyncEspn && (
            <button
              type="button"
              onClick={() => onSyncEspn(activeWeek)}
              disabled={isSyncing}
              title={isSyncing ? "Syncing ESPN scores..." : `Refresh Week ${activeWeek} scores from ESPN`}
              className="h-7 px-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
              <span className="text-[11px] font-semibold">Sync ESPN</span>
            </button>
          )}
        </div>
      )}
    </header>

      {/* Modals for Create / Join */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative my-auto">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Create League</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">You will be the Commissioner of this league.</p>
            
            {createError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl mb-4">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateLeague}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">League Name</label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 mb-4"
                  placeholder="e.g. Office League 2026"
                />

                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">League Format</label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${leagueFormat === 'both' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}>
                    <input type="radio" name="format" value="both" checked={leagueFormat === 'both'} onChange={() => setLeagueFormat('both')} className="hidden" />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Standard + Survivor</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Pick every game each week, plus pick one survivor team.</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${leagueFormat === 'pickem' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}>
                    <input type="radio" name="format" value="pickem" checked={leagueFormat === 'pickem'} onChange={() => setLeagueFormat('pickem')} className="hidden" />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Pick'em Only</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Just pick the winners of every game each week.</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${leagueFormat === 'survivor' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}>
                    <input type="radio" name="format" value="survivor" checked={leagueFormat === 'survivor'} onChange={() => setLeagueFormat('survivor')} className="hidden" />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Survivor Only</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Pick one team to win each week. If they lose, you're out.</div>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError("");
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newLeagueName.trim()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative my-auto">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Join League</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Enter the 5-digit code from your Commissioner.</p>
            
            {joinError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl mb-4">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinLeague}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">League Code</label>
                <input
                  required
                  autoFocus
                  type="text"
                  maxLength={5}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-2xl tracking-[0.2em] font-black text-center focus:outline-none focus:border-blue-500 uppercase"
                  placeholder="83921"
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">League Password (optional)</label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Leave empty if not required"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoin(false);
                    setJoinError("");
                    setJoinCode("");
                    setJoinPassword("");
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || joinCode.trim().length !== 5}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {joining ? "Joining..." : "Join"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave League Confirmation Modal */}
      {leagueToLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Leave League</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Are you sure you want to leave <strong className="text-slate-900 dark:text-white font-bold">{leagueToLeave.leagueName}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              ⚠️ Your picks, standings, and history for this league will be removed. You will need an invite code to rejoin.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={leaving}
                onClick={() => setLeagueToLeave(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={handleLeaveLeague}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                {leaving ? "Leaving..." : "Leave League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onProfileUpdated={() => router.refresh()}
      />

      {/* Alert / Notice Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {alertModal.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  {alertModal.message}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold transition shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Share League Modal */}
      {showShareModal && currentLeagueId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setShowShareModal(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Share League
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Invite friends to join {settings.leagueName}.
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

            {/* 5-Character League Code Box */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  5-Character League Code
                </span>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                  For PocketPicks users
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-emerald-300 dark:border-emerald-800/80">
                <span className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
                  {currentLeagueId.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const code = currentLeagueId.toUpperCase();
                    try {
                      await navigator.clipboard.writeText(code);
                      showToast(`Code ${code} copied!`);
                    } catch {
                      showToast("Could not copy code");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Friends with an account can enter this code in the league switcher or login to join your league.
              </p>
            </div>

            {/* Direct Web Link Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Direct League Link
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  One-click view & join
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/league/${currentLeagueId.toUpperCase()}` : `https://pocketpicks.app/league/${currentLeagueId.toUpperCase()}`}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const url = typeof window !== "undefined"
                      ? `${window.location.origin}/league/${currentLeagueId.toUpperCase()}`
                      : `https://pocketpicks.app/league/${currentLeagueId.toUpperCase()}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      showToast("Direct link copied to clipboard!");
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
                Send this link directly to friends. When they open it, they will see this league&apos;s standings and results.
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

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-2xl shadow-xl animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
