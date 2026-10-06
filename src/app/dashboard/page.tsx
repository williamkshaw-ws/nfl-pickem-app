"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { PlusCircle, LogIn, Trophy, User as UserIcon, Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/api-client";

interface LeagueMembership {
  id: string;
  leagueId: string;
  leagueName: string;
  role: "commissioner" | "member";
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [fetching, setFetching] = useState(true);
  
  // Modals
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const join = params.get("join");
      if (join && join.length === 5) {
        setJoinCode(join);
        setShowJoin(true);
        // Clean up URL without reloading page
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && !auth.currentUser) {
      router.push("/auth/login");
      return;
    }

    const currentUid = user?.id || auth.currentUser?.uid;
    if (!currentUid) return;

    const fetchLeagues = async () => {
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
        setMemberships(m);
      } catch (err) {
        console.error("Failed to fetch leagues:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchLeagues();
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
      router.push(`/league/${data.leagueId}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create league");
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (err) {
      console.error("Failed to log out", err);
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
      router.push(`/league/${data.leagueId}`);
    } catch (err: any) {
      console.error(err);
      setJoinError(err.message || "Failed to join league.");
      setJoining(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-2xl font-black">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">{user?.name}</h1>
              <p className="text-slate-500 font-medium">@{user?.username}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </header>

        {/* Leagues List */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              My Leagues
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-blue-500 text-slate-700 hover:text-blue-600 rounded-xl font-bold text-sm transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Join Code
              </button>
              <button 
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Create New
              </button>
            </div>
          </div>
          
          {memberships.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
              <p className="text-slate-500">You haven't joined any leagues yet.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {memberships.map((m) => (
                <Link 
                  key={m.id}
                  href={`/league/${m.leagueId}`}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-colors group-hover:bg-emerald-50" />
                  <h3 className="text-lg font-black text-slate-900 mb-1 relative z-10 truncate">{m.leagueName}</h3>
                  <div className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest relative z-10">
                    {m.role}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4 py-12">            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Create League</h2>
            <p className="text-slate-500 text-sm mb-6">You will be the Commissioner of this league.</p>
            <form onSubmit={handleCreateLeague}>
                            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">League Name</label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 mb-4"
                  placeholder="e.g. Office Pick'em 2026"
                />

                <label className="block text-xs font-bold text-slate-700 mb-2">League Format</label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${leagueFormat === 'both' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                    <input type="radio" name="format" value="both" checked={leagueFormat === 'both'} onChange={() => setLeagueFormat('both')} className="hidden" />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Standard + Survivor</div>
                      <div className="text-xs text-slate-500">Pick every game each week, plus pick one survivor team.</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${leagueFormat === 'pickem' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                    <input type="radio" name="format" value="pickem" checked={leagueFormat === 'pickem'} onChange={() => setLeagueFormat('pickem')} className="hidden" />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Pick'em Only</div>
                      <div className="text-xs text-slate-500">Just pick the winners of every game each week.</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${leagueFormat === 'survivor' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                    <input type="radio" name="format" value="survivor" checked={leagueFormat === 'survivor'} onChange={() => setLeagueFormat('survivor')} className="hidden" />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Survivor Only</div>
                      <div className="text-xs text-slate-500">Pick one team to win each week. If they lose, you're out.</div>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
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

{/* Join Modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4 py-12">            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Join League</h2>
            <p className="text-slate-500 text-sm mb-6">Enter the 5-character code from your Commissioner.</p>
            
            {joinError && (
              <div className="bg-rose-50 text-rose-600 text-sm p-3 rounded-lg mb-6 border border-rose-100">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinLeague}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">League Code</label>
                <input
                  required
                  autoFocus
                  type="text"
                  maxLength={5}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-2xl tracking-[0.2em] font-black text-center focus:outline-none focus:border-blue-500 uppercase"
                  placeholder="83921"
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">League Password (optional)</label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
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
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
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

    </div>
  );
}
