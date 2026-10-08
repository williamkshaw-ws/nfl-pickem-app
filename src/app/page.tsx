"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { PlusCircle, LogIn, Trophy, Loader2, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { authFetch } from "@/lib/api-client";
import { LandingPage } from "@/components/LandingPage";

interface LeagueMembership {
  id: string;
  leagueId: string;
  leagueName: string;
  role: "commissioner" | "member";
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [checking, setChecking] = useState(true);
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);

  // Modals for 0-league onboarding or direct join
  const [showCreate, setShowCreate] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [leagueFormat, setLeagueFormat] = useState("both");
  const [creating, setCreating] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const join = params.get("join");
      if (join && join.length === 5) {
        setJoinCode(join);
        setShowJoin(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && !auth.currentUser) {
      // Unauthenticated visitor: stay on page to view LandingPage
      setChecking(false);
      return;
    }

    const currentUid = user?.id || auth.currentUser?.uid;
    if (!currentUid) return;

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

        const hasJoinParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("join");

        // If user already belongs to leagues and didn't come via a specific ?join= invite
        if (m.length > 0 && !hasJoinParam) {
          const lastLeagueId = typeof window !== "undefined" ? localStorage.getItem("last_active_league") : null;
          const matchingLeague = m.find((l) => l.leagueId === lastLeagueId);
          const targetLeagueId = matchingLeague ? matchingLeague.leagueId : m[0].leagueId;

          if (typeof window !== "undefined") {
            localStorage.setItem("last_active_league", targetLeagueId);
          }

          router.replace(`/league/${targetLeagueId}`);
          return;
        }

        setMemberships(m);
        setChecking(false);
      } catch (err) {
        console.error("Failed to check leagues:", err);
        setChecking(false);
      }
    };

    checkLeagues();
  }, [user, loading, router]);

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
        setCreating(false);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("last_active_league", data.leagueId);
      }
      router.replace(`/league/${data.leagueId}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create league");
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
        window.location.href = "/";
      }
      await signOut(auth);
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  // If loading auth or resolving user league destination, show clean spinner (never flash welcome screen)
  if (loading || (user && (checking || memberships.length > 0))) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Entering league...</p>
      </div>
    );
  }

  // Unauthenticated visitors: show the full landing page!
  if (!user && !auth.currentUser) {
    return <LandingPage />;
  }

  // Onboarding screen for brand new users with 0 leagues
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="font-black text-lg tracking-tight">PocketPicks</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setTheme("light")}
              title="Light theme"
              className={`p-1.5 rounded-lg transition-all ${
                theme === "light"
                  ? "bg-white text-amber-500 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              title="Dark theme"
              className={`p-1.5 rounded-lg transition-all ${
                theme === "dark"
                  ? "bg-slate-700 text-emerald-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("system")}
              title="System theme"
              className={`p-1.5 rounded-lg transition-all ${
                theme === "system"
                  ? "bg-white dark:bg-slate-700 text-blue-500 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <Trophy className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Welcome{user?.name ? `, ${user.name}` : ""}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              You aren&apos;t in any leagues yet. Create your first league or join an existing one to get started making picks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Create League
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 dark:hover:border-emerald-500 font-bold text-sm shadow-sm transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              Join League
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
    </div>
  );
}
