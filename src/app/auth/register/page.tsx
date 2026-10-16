"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, X, Sparkles, ArrowRight } from "lucide-react";
import { extractSquaresCode } from "@/lib/squares-validation";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentVerification, setSentVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinDetails, setJoinDetails] = useState<{ type: string; title: string } | null>(null);
  const [createParam, setCreateParam] = useState<string | null>(null);
  const [redirectParam, setRedirectParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        setRedirectParam(redirect);
      }
      const code = params.get("join") || localStorage.getItem("pending_join_code");
      if (code) {
        const clean = extractSquaresCode(code);
        if (clean) {
          setJoinCode(clean);
          fetch("/api/auth/resolve-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: clean }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.found) {
                setJoinDetails({
                  type: data.type === "squares" ? "Squares Board" : "Pick'em League",
                  title: data.title || data.name || clean,
                });
              }
            })
            .catch(() => null);
        }
      }
      const create = params.get("create");
      if (create) {
        const name = params.get("name");
        setCreateParam(`?create=true${name ? `&name=${encodeURIComponent(name)}` : ""}`);
      }
    }
  }, []);

  const clearJoinCode = () => {
    setJoinCode(null);
    setJoinDetails(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("pending_join_code");
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      setLoading(false);
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      setLoading(false);
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError("Password must contain at least one special character.");
      setLoading(false);
      return;
    }

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (cleanName.length === 0 || cleanName.length > 50) {
      setError("Name must be between 1 and 50 characters.");
      setLoading(false);
      return;
    }
    if (!/^[a-z0-9_-]{3,20}$/.test(cleanUsername)) {
      setError("Username must be 3-20 characters and contain only letters, numbers, underscores, or dashes.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();

      // Atomically create profile with unique username check
      const profileRes = await fetch("/api/auth/register-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: cleanName, username: cleanUsername }),
      });

      if (!profileRes.ok) {
        const profileData = await profileRes.json().catch(() => ({}));
        // Clean up newly minted Firebase Auth account so the email isn't stuck
        await user.delete().catch(() => {});
        throw new Error(profileData.error || "Failed to set up account profile.");
      }

      // Trigger custom Resend verification email
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email, name: cleanName }),
      });
      if (!res.ok) {
        throw new Error("Failed to send verification email. Please try again.");
      }
      setSentVerification(true);
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please log in instead.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(err.message.replace("Firebase: ", ""));
      }
    } finally {
      setLoading(false);
    }
  };

  if (sentVerification) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center transition-colors">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Check Your Email</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 text-sm">
            We sent a verification link to <strong className="text-slate-900 dark:text-white">{email}</strong>. Please verify your email to continue.
          </p>
          <button
            onClick={() => {
              const base = joinCode ? `/auth/login?join=${joinCode}` : (createParam ? `/auth/login${createParam}` : "/auth/login");
              const sep = base.includes("?") ? "&" : "?";
              router.push(redirectParam ? `${base}${sep}redirect=${encodeURIComponent(redirectParam)}` : base);
            }}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-black text-sm shadow-md shadow-amber-500/25 transition cursor-pointer"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Create Account</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Create your PocketPicks account.</p>

        {joinCode && (
          <div className="mb-6 p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-300 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">
                  Joining {joinDetails?.type || "pool"}: <strong className="font-mono font-black tracking-wider text-slate-900 dark:text-white">{joinCode}</strong>
                </span>
              </div>
              <div className="text-[11px] text-amber-700/90 dark:text-amber-400/90 font-normal truncate mt-0.5">
                {joinDetails?.title ? `"${joinDetails.title}" • Sign up to enter` : "Your account will be linked upon sign in."}
              </div>
            </div>
            <button
              type="button"
              onClick={clearJoinCode}
              title="Remove code"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-sm p-3.5 rounded-xl mb-5 border border-rose-100 dark:border-rose-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
            <input
              required
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              placeholder="johndoe99"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-11 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-3 space-y-1.5 px-1">
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${password.length >= 8 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  At least 8 characters
                </div>
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/[A-Z]/.test(password) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  At least one uppercase letter
                </div>
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/[0-9]/.test(password) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(password) ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  At least one number
                </div>
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  At least one special character
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                required
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-11 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-black text-sm shadow-md shadow-amber-500/25 transition mt-4 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{loading ? "Creating..." : "Create Account"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Already have an account?{" "}
          <Link
            href={(() => {
              const base = joinCode ? `/auth/login?join=${joinCode}` : (createParam ? `/auth/login${createParam}` : "/auth/login");
              const sep = base.includes("?") ? "&" : "?";
              return redirectParam ? `${base}${sep}redirect=${encodeURIComponent(redirectParam)}` : base;
            })()}
            className="text-amber-600 dark:text-amber-400 font-bold hover:text-amber-700 dark:hover:text-amber-300 hover:underline transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
