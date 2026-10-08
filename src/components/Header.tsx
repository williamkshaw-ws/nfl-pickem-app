
"use client";

import React, { useState, useEffect, useRef } from "react";
import { User, LeagueSettings } from "@/types/nfl";
import {
  Trophy,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  LogOut,
  PlusCircle,
  LogIn,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Settings,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api-client";
import { UserSettingsModal } from "@/components/UserSettingsModal";

interface HeaderProps {
  settings: LeagueSettings;
  users: User[];
  currentActiveUserId: string;
  activeWeek: number;
  availableWeeks: number[];
  currentLeagueId?: string;
  onSelectWeek: (week: number) => void;
  onSwitchUser: (userId: string) => void;
  onAddUser: (name: string) => Promise<void>;
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
}: HeaderProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuth();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [leagueToLeave, setLeagueToLeave] = useState<LeagueMembership | null>(null);
  const [leaving, setLeaving] = useState(false);
  
  const [showCreate, setShowCreate] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [leagueFormat, setLeagueFormat] = useState("both");
  const [creating, setCreating] = useState(false);
  
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const activeUser = users.find((u) => u.id === currentActiveUserId) || users[0];

  useEffect(() => {
    if (userDropdownOpen && user) {
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
    }
  }, [userDropdownOpen, user]);

  // Close user dropdown when clicking outside
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
        alert(data.error || "Failed to leave league");
        setLeaving(false);
        return;
      }

      if (leagueToLeave.leagueId === currentLeagueId) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("last_active_league");
        }
        window.location.href = "/";
      } else {
        setMemberships((prev) => prev.filter((m) => m.leagueId !== leagueToLeave.leagueId));
        setLeagueToLeave(null);
        setLeaving(false);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to leave league");
      setLeaving(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newLeagueName.trim()) return;
    
    setCreating(true);
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
        alert(data.error || "Failed to create league");
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("last_active_league", data.leagueId);
      }
      router.push(`/league/${data.leagueId}`);
      window.location.href = `/league/${data.leagueId}`;
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create league");
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
        localStorage.setItem("last_active_league", data.leagueId);
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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${activeUser?.avatarColor || user?.avatarColor || "bg-emerald-600"} flex items-center justify-center flex-shrink-0 transition-colors shadow-xs`}>
              <Trophy className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
            </div>
            <div className="flex items-center min-w-0 gap-2">
              <h1 className="font-extrabold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white truncate flex items-center gap-1 sm:gap-1.5">
                {settings.leagueName} <span className="text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">&apos;{settings.seasonYear.toString().slice(2)}</span>
              </h1>
              
              <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />

              <div className="relative flex items-center flex-shrink-0">
                <select
                  value={activeWeek}
                  onChange={(e) => onSelectWeek(Number(e.target.value))}
                  className="appearance-none bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm py-1 sm:py-1.5 pl-2 sm:pl-3 pr-6 sm:pr-8 rounded-md sm:rounded-lg cursor-pointer transition-colors outline-none border border-slate-200/80 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                >
                  {availableWeeks.map((week) => (
                    <option key={week} value={week} className="dark:bg-slate-900 dark:text-white">
                      Week {week}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 dark:text-slate-400 absolute right-1.5 sm:right-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div ref={dropdownRef} className="relative ml-0 sm:ml-2">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 text-left transition-opacity hover:opacity-80"
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${activeUser?.avatarColor || user?.avatarColor || "bg-emerald-600"} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs transition-colors`}
                >
                  {activeUser?.name?.charAt(0) || user?.name?.charAt(0) || "U"}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[100px]">{activeUser?.name || user?.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-tight">Account</span>
                </div>
                <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                    
                    {/* User Profile Header */}
                    <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl mb-3">
                      <div className={`w-10 h-10 ${activeUser?.avatarColor || user?.avatarColor || "bg-emerald-600"} text-white rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 shadow-xs transition-colors`}>
                        {user?.name?.charAt(0).toUpperCase() || activeUser?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-900 dark:text-white leading-tight truncate">{user?.name || activeUser?.name}</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">@{user?.username || activeUser?.name?.toLowerCase().replace(/\s+/g, "")}</span>
                      </div>
                    </div>

                    {/* My Leagues Header (FIRST / AT TOP) */}
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        My Leagues
                      </h4>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setShowJoin(true);
                            setUserDropdownOpen(false);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg text-[10px] font-bold transition-colors shadow-xs"
                        >
                          <LogIn className="w-3 h-3" />
                          Join Code
                        </button>
                        <button
                          onClick={() => {
                            setShowCreate(true);
                            setUserDropdownOpen(false);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-colors shadow-xs"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Create New
                        </button>
                      </div>
                    </div>

                    {/* League List */}
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-3">
                      {loadingLeagues ? (
                        <div className="flex justify-center p-4">
                          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                        </div>
                      ) : memberships.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">No leagues yet.</p>
                      ) : (
                        memberships.map((m) => {
                          const isCurrent = m.leagueId === currentLeagueId;
                          return (
                            <Link
                              key={m.id}
                              href={`/league/${m.leagueId}`}
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  localStorage.setItem("last_active_league", m.leagueId);
                                }
                                setUserDropdownOpen(false);
                              }}
                              className={`block p-2.5 border rounded-2xl transition-all group relative overflow-hidden ${
                                isCurrent
                                  ? "border-emerald-500/80 bg-emerald-50/70 dark:bg-emerald-950/40"
                                  : "border-slate-100 dark:border-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-700/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                              }`}
                            >
                              <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 dark:bg-slate-800/40 rounded-bl-full -mr-4 -mt-4 transition-colors group-hover:bg-emerald-100/50 dark:group-hover:bg-emerald-900/30" />
                              <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <h5 className={`font-bold text-xs truncate ${
                                    isCurrent ? "text-emerald-900 dark:text-emerald-200 font-extrabold" : "text-slate-900 dark:text-white"
                                  }`}>
                                    {m.leagueName}
                                  </h5>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[8px] font-black uppercase tracking-wider rounded flex-shrink-0">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {m.role === 'commissioner' ? (
                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[8px] font-black uppercase tracking-widest rounded flex-shrink-0">
                                      Commissioner
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      title="Leave League"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setLeagueToLeave(m);
                                      }}
                                      className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider rounded border border-rose-200 dark:border-rose-900/60 transition-colors"
                                    >
                                      Leave
                                    </button>
                                  )}
                                </div>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom Actions: Settings link & Sign Out at the bottom */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setShowSettings(true);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            <Settings className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-bold block text-slate-900 dark:text-white">Settings</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Name, username, password, theme & account</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform group-hover:translate-x-0.5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-bold text-xs"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span>Sign Out</span>
                      </button>
                    </div>

                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>

      {/* Modals for Create / Join */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4 py-12">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Create League</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">You will be the Commissioner of this league.</p>
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
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newLeagueName.trim()}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4 py-12">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Join League</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Enter the 5-digit code from your Commissioner.</p>
              
              {joinError && (
                <div className="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-sm p-3 rounded-lg mb-6 border border-rose-100 dark:border-rose-900">
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
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joining || joinCode.trim().length !== 5}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition disabled:opacity-50"
                  >
                    {joining ? "Joining..." : "Join"}
                  </button>
                </div>
              </form>
            </div>
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

    </>
  );
}
