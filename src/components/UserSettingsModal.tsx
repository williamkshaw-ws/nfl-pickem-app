"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User as UserIcon,
  Lock,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Check,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Palette,
  ShieldAlert,
  Bell,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { auth, db } from "@/lib/firebase";
import { updatePassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { authFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

const AVATAR_COLORS = [
  { label: "Emerald", class: "bg-emerald-600" },
  { label: "Indigo", class: "bg-indigo-600" },
  { label: "Blue", class: "bg-blue-600" },
  { label: "Amber", class: "bg-amber-600" },
  { label: "Rose", class: "bg-rose-600" },
  { label: "Purple", class: "bg-purple-600" },
  { label: "Teal", class: "bg-teal-600" },
  { label: "Slate", class: "bg-slate-700" },
];

export function UserSettingsModal({ isOpen, onClose, onProfileUpdated }: UserSettingsModalProps) {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  // Profile fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarColor, setAvatarColor] = useState("bg-emerald-600");
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete user fields
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Initialize values when opened
  useEffect(() => {
    if (!isOpen) return;

    if (user) {
      setName(user.name || "");
      setUsername(user.username || "");
      if (user.avatarColor) setAvatarColor(user.avatarColor);
      setEmailNotifications(user.emailNotifications ?? false);
    }

    // Fetch latest user doc from Firestore if available
    if (auth.currentUser?.uid) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.avatarColor) setAvatarColor(data.avatarColor);
          if (typeof data.emailNotifications === "boolean") setEmailNotifications(data.emailNotifications);
        }
      }).catch(() => {});
    }

    setProfileMessage(null);
    setPasswordMessage(null);
    setNewPassword("");
    setConfirmPassword("");
    setShowDeleteConfirm(false);
    setDeleteConfirmationText("");
    setDeleteError("");
  }, [isOpen, user]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName) {
      setProfileMessage({ type: "error", text: "Name cannot be empty." });
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 20) {
      setProfileMessage({ type: "error", text: "Username must be 3-20 characters." });
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      setProfileMessage({
        type: "error",
        text: "Username can only contain letters, numbers, underscores, or hyphens.",
      });
      return;
    }

    setProfileSaving(true);
    try {
      const res = await authFetch("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: cleanName,
          username: cleanUsername,
          avatarColor,
          emailNotifications,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
      await refreshUser();
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMessage({ type: "error", text: "Password must contain at least one letter and one number." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setPasswordMessage({ type: "error", text: "You must be logged in to update your password." });
      return;
    }

    setPasswordSaving(true);
    try {
      await updatePassword(firebaseUser, newPassword);

      setPasswordMessage({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        setPasswordMessage({
          type: "error",
          text: "For security, this action requires a recent sign in. Please sign out and sign back in to change your password.",
        });
      } else if (err.code === "auth/weak-password") {
        setPasswordMessage({
          type: "error",
          text: "Password is too weak. Please use at least 8 characters with letters and numbers.",
        });
      } else if (err.code === "auth/too-many-requests") {
        setPasswordMessage({ type: "error", text: "Too many attempts. Please try again later." });
      } else {
        setPasswordMessage({ type: "error", text: err.message?.replace("Firebase: ", "") || "Failed to update password." });
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (deleteConfirmationText.trim() !== "DELETE") {
      setDeleteError('Please type "DELETE" to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");

    try {
      const res = await authFetch("/api/user/delete", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account.");
      }

      // Sign out and redirect to home
      if (typeof window !== "undefined") {
        localStorage.removeItem("last_active_league");
        localStorage.removeItem("pending_join_code");
      }
      await signOut(auth);
      window.location.href = "/";
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account. Please try again.");
      setDeleteLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-up"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${avatarColor} text-white font-black flex items-center justify-center text-base shadow-sm`}>
              {name ? name.charAt(0).toUpperCase() : user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                User Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your profile, theme, and security
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          {/* ─────────────────────────────────────────────────────────────
              1. PROFILE SECTION (Name & Username)
          ───────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Profile Information
              </h4>
            </div>

            {profileMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  profileMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {profileMessage.type === "success" ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jimmy"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={20}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="jimmy"
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  <span>Avatar Accent Color</span>
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      key={col.label}
                      type="button"
                      title={col.label}
                      onClick={() => setAvatarColor(col.class)}
                      className={`w-7 h-7 rounded-lg ${col.class} transition-transform flex items-center justify-center text-white ${
                        avatarColor === col.class
                          ? "ring-2 ring-offset-2 ring-emerald-500 scale-110 shadow-sm"
                          : "hover:scale-105 opacity-85 hover:opacity-100"
                      }`}
                    >
                      {avatarColor === col.class && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Address
                </label>
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-sm font-medium">
                  <span>{user?.email || auth.currentUser?.email || "No email"}</span>
                  {user?.emailVerified || auth.currentUser?.emailVerified ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300/60 dark:border-emerald-800/60 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              {/* Email Notifications Preference */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="emailNotifToggle" className="text-xs font-bold text-slate-900 dark:text-white block cursor-pointer">
                      Thursday Kickoff Reminder
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      Receive an automated reminder email 2 hours before Thursday kickoff if your picks haven&apos;t been submitted yet.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    id="emailNotifToggle"
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-2"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>Save Profile Changes</span>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              2. THEME SETTING
          ───────────────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              {resolvedTheme === "dark" ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Theme Setting
              </h4>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose your preferred visual theme across the application.
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-xs font-bold transition-all ${
                  theme === "system"
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500 shadow-xs"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>System</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-xs font-bold transition-all ${
                  theme === "light"
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500 shadow-xs"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-xs font-bold transition-all ${
                  theme === "dark"
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500 shadow-xs"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Dark</span>
              </button>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              3. PASSWORD UPDATE
          ───────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Password Update
              </h4>
            </div>

            {passwordMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  passwordMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {passwordMessage.type === "success" ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 bg-slate-100/70 dark:bg-slate-800/50 rounded-xl space-y-1.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Password Requirements:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${newPassword.length >= 8 ? "opacity-100" : "opacity-30"}`} />
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${/[a-zA-Z]/.test(newPassword) ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${/[a-zA-Z]/.test(newPassword) ? "opacity-100" : "opacity-30"}`} />
                    <span>At least 1 letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${/[0-9]/.test(newPassword) ? "opacity-100" : "opacity-30"}`} />
                    <span>At least 1 number</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${confirmPassword && newPassword === confirmPassword ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${confirmPassword && newPassword === confirmPassword ? "opacity-100" : "opacity-30"}`} />
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={
                    passwordSaving ||
                    newPassword.length < 8 ||
                    !/[a-zA-Z]/.test(newPassword) ||
                    !/[0-9]/.test(newPassword) ||
                    newPassword !== confirmPassword
                  }
                  className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {passwordSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              4. DANGER ZONE (Delete User)
          ───────────────────────────────────────────────────────────── */}
          <section className="pt-2">
            <div className="p-4 sm:p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h4 className="text-sm font-black uppercase tracking-wider">
                  Delete Account
                </h4>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Permanently delete your account, picks, and league memberships. If you are the commissioner of any active leagues, commissioner ownership will automatically be transferred to the next earliest member.
              </p>

              {deleteError && (
                <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-rose-300 dark:border-rose-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{deleteError}</span>
                </div>
              )}

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete My Account</span>
                </button>
              ) : (
                <div className="pt-2 space-y-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-900">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    Are you absolutely sure? Type <span className="font-mono bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded text-rose-900 dark:text-rose-200">DELETE</span> to confirm:
                  </p>
                  <input
                    type="text"
                    autoFocus
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText("");
                        setDeleteError("");
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteLoading || deleteConfirmationText.trim() !== "DELETE"}
                      onClick={handleDeleteUser}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                    >
                      {deleteLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting Account...</span>
                        </>
                      ) : (
                        <span>Permanently Delete</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
