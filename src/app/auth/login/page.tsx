"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const lastLeague = typeof window !== 'undefined' ? localStorage.getItem("last_active_league") : null;
      if (lastLeague) {
        router.replace(`/league/${lastLeague}`);
      } else {
        router.replace("/");
      }
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        setError("Please verify your email before logging in.");
        
        // We can optionally trigger a new verification email here or just show a message.
        setLoading(false);
        return;
      }

      const lastLeague = typeof window !== 'undefined' ? localStorage.getItem("last_active_league") : null;
      if (lastLeague) {
        window.location.href = `/league/${lastLeague}`;
      } else {
        window.location.href = "/";
      }
} catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please try again.");
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
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Log in to your Pick&apos;em account.</p>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-sm p-3 rounded-lg mb-6 border border-rose-100 dark:border-rose-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="you@example.com"
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
          <Link href="/auth/register" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
