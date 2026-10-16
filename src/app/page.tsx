"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { PlusCircle, LogIn, Trophy, Loader2, LogOut, Settings, ArrowRight } from "lucide-react";
import { authFetch } from "@/lib/api-client";
import { LandingPage } from "@/components/LandingPage";
import { UserSettingsModal } from "@/components/UserSettingsModal";
import { GameSwitcherDropdown } from "@/components/GameSwitcherDropdown";
import { extractSquaresCode } from "@/lib/squares-validation";

interface LeagueMembership {
  id: string;
  leagueId: string;
  leagueName: string;
  role: "commissioner" | "member";
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [leagueChecked, setLeagueChecked] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modals for 0-league onboarding or direct join
  const [showCreate, setShowCreate] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [leagueFormat, setLeagueFormat] = useState("both");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [showJoin, setShowJoin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const join = params.get("join");
      if (join) {
        const clean = extractSquaresCode(join);
        fetch("/api/auth/resolve-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: clean }),
        })
          .then((r) => r.json())
          .then(async (data) => {
            if (data.found && data.type === "squares") {
              const token = await auth.currentUser?.getIdToken();
              if (token) {
                await fetch("/api/squares/join", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ code: data.code || clean }),
                }).catch(() => null);
              }
              window.location.href = `/squares?id=${encodeURIComponent(data.code || clean)}`;
            } else {
              setJoinCode(clean);
              setShowJoin(true);
            }
          })
          .catch(() => {
            setJoinCode(clean);
            setShowJoin(true);
          });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const create = params.get("create");
      if (create) {
        setShowCreate(true);
        const nameParam = params.get("name") || (typeof window !== "undefined" ? localStorage.getItem("pending_create_league_name") : null);
        if (nameParam) {
          setNewLeagueName(nameParam);
          if (typeof window !== "undefined") localStorage.removeItem("pending_create_league_name");
        }
        const formatParam = typeof window !== "undefined" ? localStorage.getItem("pending_create_league_format") : null;
        if (formatParam) {
          setLeagueFormat(formatParam);
          if (typeof window !== "undefined") localStorage.removeItem("pending_create_league_format");
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const currentUid = user?.id || auth.currentUser?.uid;
    if (!currentUid) {
      setLeagueChecked(false);
      setIsRedirecting(false);
      return;
    }

    const hasLandingParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("landing");
    if (hasLandingParam) {
      setLeagueChecked(true);
      setIsRedirecting(false);
      return;
    }

    const pendingRedirect = typeof window !== "undefined" ? localStorage.getItem("pending_redirect_after_auth") : null;
    if (pendingRedirect && pendingRedirect.startsWith("/")) {
      localStorage.removeItem("pending_redirect_after_auth");
      setIsRedirecting(true);
      router.replace(pendingRedirect);
      return;
    }

    const hasJoinParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("join");
    const hasCreateParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("create");

    const checkLeagues = async () => {
      try {
        const q = query(collection(db, "memberships"), where("userId", "==", currentUid));
        const snapshot = await getDocs(q);

        const m: LeagueMembership[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          m.push({
            id: docSnap.id,
            leagueId: data.leagueId,
            leagueName: data.leagueName,
            role: data.role,
          });
        });

        // If user already belongs to leagues and didn't come via a specific ?join= or ?create= invite
        if (m.length > 0 && !hasJoinParam && !hasCreateParam) {
          const lastLeagueId = typeof window !== "undefined" ? localStorage.getItem("last_active_league") : null;
          const matchingLeague = m.find((l) => l.leagueId === lastLeagueId);
          const targetLeagueId = matchingLeague ? matchingLeague.leagueId : m[0].leagueId;

          if (typeof window !== "undefined") {
            localStorage.setItem("last_active_league", targetLeagueId);
          }

          setIsRedirecting(true);
          router.replace(`/league/${targetLeagueId}`);
          return;
        }

        setMemberships(m);
        setLeagueChecked(true);
      } catch (err) {
        console.error("Failed to check leagues:", err);
        setLeagueChecked(true);
      }
    };

    checkLeagues();
  }, [user, loading, router]);

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
        setCreating(false);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("last_active_league", data.leagueId);
      }
      router.replace(`/league/${data.leagueId}`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to create league");
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
        setJoining(false);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("last_active_league", data.leagueId);
      }
      router.replace(`/league/${data.leagueId}`);
    } catch (err: any) {
      console.error(err);
      setJoinError(err.message || "Failed to join league.");
      setJoining(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("last_active_league");
        localStorage.removeItem("pending_join_code");
        window.location.href = "/";
      }
      await signOut(auth);
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  const isAuthenticated = !!(user || auth.currentUser);

  const hasLandingParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("landing");

  // SSR or before client mount, or if ?landing is passed: render LandingPage so server and client initial HTML match 100%
  if (!mounted || hasLandingParam) {
    return <LandingPage />;
  }

  // 1. Unauthenticated visitors: show the full landing page!
  if (!isAuthenticated && !loading) {
    return <LandingPage />;
  }

  // 2. If authenticated (or auth still resolving): ALWAYS show clean spinner while checking or redirecting
  if (loading || !leagueChecked || isRedirecting || memberships.length > 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Entering league...</p>
      </div>
    );
  }

  // Onboarding screen for brand new users with 0 leagues
  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GameSwitcherDropdown currentGame="pickem" />
          <span className="font-black text-lg tracking-tight">PocketPicks</span>
        </div>

        <div className="flex items-center gap-3">
          {/* User Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            title="Account Settings"
            className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <div className={`w-5 h-5 rounded-md ${user?.avatarColor || "bg-emerald-600"} text-white font-black flex items-center justify-center text-[10px] shrink-0`}>
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <span>Settings</span>
            <Settings className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Welcome{user?.name ? `, ${user.name}` : ""}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              Choose a game mode below to get started.
            </p>
          </div>

          <div className="space-y-3 pt-1 text-left">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">NFL Pick&apos;em &amp; Survivor</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Weekly confidence picks &amp; knockout leagues</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Create League
                </button>
                <button
                  onClick={() => setShowJoin(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 dark:hover:border-emerald-500 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Join League
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/bracket"
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 rounded-2xl p-4 shadow-xs transition-all flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">Playoff Bracket</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">14-team tournament</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>

              <Link
                href="/squares"
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-xs transition-all flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">Super Bowl Squares</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">10x10 party grid</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Account Settings &amp; Preferences</span>
            </button>
          </div>
        </div>
      </main>

      {/* Create League Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Create New League</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Start a private league for your friends or coworkers.</p>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">League Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Champions Club"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Pick Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeagueFormat("spread")}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      leagueFormat === "spread"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Against Spread
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeagueFormat("straight_up")}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      leagueFormat === "straight_up"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Straight Up
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeagueFormat("both")}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      leagueFormat === "both"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Both Formats
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Join a League</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Enter the 5-character invite code and optional password.</p>
            </div>

            {joinError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinLeague} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Invite Code</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="e.g. A1B2C"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-center tracking-widest text-lg font-black text-slate-900 dark:text-white uppercase focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave empty if none"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                  Join League
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onProfileUpdated={() => router.refresh()}
      />
    </div>
  );
}
