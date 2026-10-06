"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { applyActionCode, signInWithEmailAndPassword } from "firebase/auth";
import { CheckCircle2, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

function VerifyHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode");

  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState("");
  
  // Login states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!oobCode) {
      setError("Invalid or missing verification code.");
      setVerifying(false);
      return;
    }

    if (hasAttempted.current) return;
    hasAttempted.current = true;

    applyActionCode(auth, oobCode)
      .then(() => {
        setVerifying(false);
      })
      .catch((err) => {
        if (err.code === "auth/invalid-action-code") {
          setError("This verification link has expired or already been used.");
        } else {
          setError(err.message.replace("Firebase: ", ""));
        }
        setVerifying(false);
      });
  }, [oobCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      const lastLeague = typeof window !== 'undefined' ? localStorage.getItem("last_active_league") : null;
      if (lastLeague) {
        window.location.href = `/league/${lastLeague}`;
      } else {
        window.location.href = "/";
      }
} catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setLoginError("Invalid email or password. Please try again.");
      } else {
        setLoginError(err.message.replace("Firebase: ", ""));
      }
    } finally {

      setLoggingIn(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center transition-colors">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verifying Email...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
          <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Verification Failed</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">{error}</p>
          <Link href="/auth/login" className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-xs">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Email Verified!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Your account is ready. Log in to continue.</p>
        </div>

        {loginError && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-sm p-3 rounded-lg mb-6 border border-rose-100 dark:border-rose-900/50">
            {loginError}
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
            disabled={loggingIn}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition mt-4 disabled:opacity-50 shadow-xs"
          >
            {loggingIn ? "Logging in..." : "Log In & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyHandler />
    </Suspense>
  );
}
