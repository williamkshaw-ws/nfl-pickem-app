"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("join") || localStorage.getItem("pending_join_code");
      if (code && code.length === 5) {
        setJoinCode(code.toUpperCase());
        localStorage.setItem("pending_join_code", code.toUpperCase());
      }
    }
  }, []);

  const navigateToLeagueOrHome = async (uid: string) => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const join = params?.get("join") || (typeof window !== "undefined" ? localStorage.getItem("pending_join_code") : null);
    if (join && join.length === 5) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_join_code");
      }
      router.replace(`/?join=${join.toUpperCase()}`);
      return;
    }

    const lastLeague = typeof window !== 'undefined' ? localStorage.getItem("last_active_league") : null;
    if (lastLeague) {
      router.replace(`/league/${lastLeague}`);
      return;
    }

    // Direct lookup of user's league memberships so they go straight to their league
    try {
      const q = query(collection(db, "memberships"), where("userId", "==", uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const firstLeagueId = snapshot.docs[0].data().leagueId;
        if (typeof window !== 'undefined') {
          localStorage.setItem("last_active_league", firstLeagueId);
        }
        router.replace(`/league/${firstLeagueId}`);
        return;
      }
    } catch (err) {
      console.error("Failed to resolve user league on login:", err);
    }

    router.replace("/");
  };

  useEffect(() => {
    if (!authLoading && user) {
      navigateToLeagueOrHome(user.id);
    }
  }, [user, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let loginEmail = identifier.trim();

      // If user provided a username instead of an email, look up the email
      if (!loginEmail.includes("@")) {
        const lookupRes = await fetch("/api/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: loginEmail }),
        });
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.email) {
          setError(lookupData.error || "No account found with that username.");
          setLoading(false);
          return;
        }
        loginEmail = lookupData.email;
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        setError("Please verify your email before logging in.");
        setLoading(false);
        return;
      }

      await navigateToLeagueOrHome(userCredential.user.uid);
    } catch (err: any) {
      if (err.code === "auth/user-disabled") {
        setError("This account has been banned and cannot log in.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email, username, or password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed login attempts. Please try again later.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(err.message.replace("Firebase: ", ""));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Welcome Back</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Log in to your PocketPicks account.</p>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-sm p-3 rounded-lg mb-6 border border-rose-100 dark:border-rose-900/50">
            {error}
          </div>
        )}

        {joinCode && (
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs shrink-0">
              5#
            </span>
            <div>
              <div>Joining League with code: <strong className="font-mono font-black tracking-wider text-slate-900 dark:text-white">{joinCode}</strong></div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-normal">Sign in to add this league to your account.</div>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email or Username</label>
            <input
              required
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="you@example.com or username"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-11 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl font-bold transition mt-4 disabled:opacity-50 shadow-xs"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href={joinCode ? `/auth/register?join=${joinCode}` : "/auth/register"}
            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
