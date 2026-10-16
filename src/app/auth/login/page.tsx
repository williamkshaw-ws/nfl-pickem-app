"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { extractSquaresCode } from "@/lib/squares-validation";

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [manualJoinCode, setManualJoinCode] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinDetails, setJoinDetails] = useState<{ type: string; title: string } | null>(null);
  const [createParam, setCreateParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("join") || localStorage.getItem("pending_join_code");
      if (code) {
        const clean = extractSquaresCode(code);
        if (clean) {
          setJoinCode(clean);
          // Look up details for nice banner
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

  const navigateToLeagueOrHome = async (uid: string) => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const redirect = params?.get("redirect") || (typeof window !== "undefined" ? localStorage.getItem("pending_redirect_after_auth") : null);
    if (redirect && redirect.startsWith("/")) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_redirect_after_auth");
      }
      router.replace(redirect);
      return;
    }

    const codeToJoin = manualJoinCode.trim() || joinCode || params?.get("join");
    if (codeToJoin) {
      const cleanCode = extractSquaresCode(codeToJoin);
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_join_code");
      }

      try {
        const res = await fetch("/api/auth/resolve-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: cleanCode }),
        });
        const data = await res.json();
        if (data.found && data.type === "squares") {
          // Join squares board for authenticated user
          const token = await auth.currentUser?.getIdToken();
          if (token) {
            await fetch("/api/squares/join", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ code: data.code || cleanCode }),
            }).catch(() => null);
          }
          if (typeof window !== "undefined") {
            try {
              localStorage.removeItem("pending_squares_code");
              localStorage.removeItem("pending_redirect_after_auth");
              localStorage.removeItem("pending_join_code");
            } catch {}
          }
          router.replace(`/squares?id=${encodeURIComponent(data.code || cleanCode)}`);
          return;
        }
      } catch (err) {
        console.error("Resolve code error:", err);
      }

      router.replace(`/?join=${encodeURIComponent(cleanCode)}`);
      return;
    }

    const create = params?.get("create");
    if (create) {
      const name = params?.get("name");
      router.replace(`/?create=true${name ? `&name=${encodeURIComponent(name)}` : ""}`);
      return;
    }

    // Direct lookup of user's league memberships so they go straight to their league
    try {
      const q = query(collection(db, "memberships"), where("userId", "==", uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const lastLeague = typeof window !== "undefined" ? localStorage.getItem("last_active_league") : null;
        const matchingDoc = snapshot.docs.find((d) => d.data().leagueId === lastLeague);
        const targetLeagueId = matchingDoc ? matchingDoc.data().leagueId : snapshot.docs[0].data().leagueId;
        if (typeof window !== "undefined") {
          localStorage.setItem("last_active_league", targetLeagueId);
        }
        router.replace(`/league/${targetLeagueId}`);
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

      // Pre-resolve any join code before sign-in to guarantee redirect priorities
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const codeToJoin = manualJoinCode.trim() || joinCode || params?.get("join");
      if (codeToJoin) {
        const cleanCode = extractSquaresCode(codeToJoin);
        try {
          const res = await fetch("/api/auth/resolve-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: cleanCode }),
          });
          const data = await res.json();
          if (data.found && data.type === "squares") {
            const resolvedSquaresCode = String(data.code || cleanCode);
            try {
              localStorage.setItem("pending_redirect_after_auth", `/squares?id=${encodeURIComponent(resolvedSquaresCode)}`);
              localStorage.setItem("pending_squares_code", resolvedSquaresCode);
              localStorage.removeItem("pending_join_code");
            } catch {}
          } else {
            const resolvedLeagueCode = String(data.code || cleanCode);
            try {
              localStorage.setItem("pending_redirect_after_auth", `/?join=${encodeURIComponent(resolvedLeagueCode)}`);
              localStorage.setItem("pending_join_code", resolvedLeagueCode);
              localStorage.removeItem("pending_squares_code");
            } catch {}
          }
        } catch (err) {
          console.error("Resolve code error:", err);
        }
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
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
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

  const handleForgotPassword = async () => {
    setError("");
    setResetMessage("");
    const raw = identifier.trim();
    if (!raw) {
      setError("Please enter your email or username above first, then click Forgot password.");
      return;
    }

    setResetSending(true);
    try {
      let email = raw;
      if (!email.includes("@")) {
        const lookupRes = await fetch("/api/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email }),
        });
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.email) {
          setError(lookupData.error || "No account found with that username.");
          setResetSending(false);
          return;
        }
        email = lookupData.email;
      }

      await sendPasswordResetEmail(auth, email);
      setResetMessage(`Password reset link sent to ${email}! Check your inbox.`);
    } catch (err: any) {
      setError(err.message ? err.message.replace("Firebase: ", "") : "Failed to send reset email.");
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          Welcome Back
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Log in to your PocketPicks account.</p>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-sm p-3.5 rounded-xl mb-5 border border-rose-100 dark:border-rose-900/50">
            {error}
          </div>
        )}

        {resetMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm p-3.5 rounded-xl mb-5 border border-emerald-200 dark:border-emerald-800/60">
            {resetMessage}
          </div>
        )}

        {joinCode && (
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">
                  Joining {joinDetails?.type || "pool"}: <strong className="font-mono font-black tracking-wider text-slate-900 dark:text-white">{joinCode}</strong>
                </span>
              </div>
              <div className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 font-normal truncate mt-0.5">
                {joinDetails?.title ? `"${joinDetails.title}" • Sign in to enter` : "Sign in to add this to your account."}
              </div>
            </div>
            <button
              type="button"
              onClick={clearJoinCode}
              title="Remove code"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Email or Username
            </label>
            <input
              required
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError("");
                if (resetMessage) setResetMessage("");
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="you@example.com or username"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <button
                type="button"
                disabled={resetSending}
                onClick={handleForgotPassword}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline disabled:opacity-50 cursor-pointer transition-colors"
              >
                {resetSending ? "Sending reset link..." : "Forgot password?"}
              </button>
            </div>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-11 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
          </div>

          {/* Optional Code Input for League or Squares Board */}
          {!joinCode && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Have a Code? <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  League or Squares Board
                </span>
              </div>
              <input
                type="text"
                maxLength={32}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={manualJoinCode}
                onChange={(e) => setManualJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono uppercase"
                placeholder="e.g. U7VUF or 84920"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-sm shadow-sm shadow-emerald-600/30 transition mt-4 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <span>Log In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href={
              manualJoinCode.trim()
                ? `/auth/register?join=${encodeURIComponent(manualJoinCode.trim())}`
                : joinCode
                ? `/auth/register?join=${joinCode}`
                : createParam
                ? `/auth/register${createParam}`
                : "/auth/register"
            }
            className="text-emerald-600 dark:text-emerald-400 font-bold hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
