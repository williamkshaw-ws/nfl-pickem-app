"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { LogOut, Trash2, Shield, Loader2, AlertTriangle, ArrowLeft, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { UnifiedPoolItem } from "@/lib/useUserAllPools";

interface MemberOption {
  id: string;
  name: string;
  username: string;
  avatarColor?: string;
}

interface PoolLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: UnifiedPoolItem | null;
  onSuccess: () => void;
}

export function PoolLeaveModal({ isOpen, onClose, pool, onSuccess }: PoolLeaveModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedNewCommish, setSelectedNewCommish] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);

  const isCommissioner = pool?.role === "commissioner";

  const fetchMembers = useCallback(async () => {
    if (!pool || !isCommissioner) return;

    setLoadingMembers(true);
    setErrorMsg("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch(
        `/api/pool/members?gameType=${encodeURIComponent(pool.gameType)}&id=${encodeURIComponent(pool.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load pool members");
      }

      setMembers(data.members || []);
      if (data.members && data.members.length > 0) {
        setSelectedNewCommish(data.members[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load members for commissioner leave:", err);
      setErrorMsg(err.message || "Failed to load pool members");
    } finally {
      setLoadingMembers(false);
    }
  }, [pool, isCommissioner]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && pool) {
      setDeleteMode(false);
      setErrorMsg("");
      setSelectedNewCommish("");
      setMembers([]);

      if (pool.role === "commissioner") {
        fetchMembers();
      }
    }
  }, [isOpen, pool, fetchMembers]);

  if (!isOpen || !pool || !mounted) return null;

  const gameLabel =
    pool.gameType === "pickem"
      ? "Pick'em League"
      : pool.gameType === "squares"
      ? "Squares Board"
      : "Bracket Pool";

  const cleanStorageAndRedirect = () => {
    if (typeof window === "undefined") return;

    try {
      if (pool.gameType === "pickem") {
        if (localStorage.getItem("last_active_league") === pool.id) {
          localStorage.removeItem("last_active_league");
        }
      } else if (pool.gameType === "squares") {
        if (localStorage.getItem("last_active_squares_board") === pool.id) {
          localStorage.removeItem("last_active_squares_board");
        }
      } else if (pool.gameType === "bracket") {
        if (localStorage.getItem("last_active_bracket_pool") === pool.id) {
          localStorage.removeItem("last_active_bracket_pool");
        }
      }
    } catch {}

    const currentPath = window.location.pathname;
    const isCurrentPool =
      (pool.gameType === "pickem" && currentPath.includes(pool.id)) ||
      (pool.gameType === "squares" && window.location.search.includes(pool.id)) ||
      (pool.gameType === "bracket" && window.location.search.includes(pool.id));

    if (isCurrentPool) {
      const fallbackUrl =
        pool.gameType === "pickem" ? "/" : pool.gameType === "squares" ? "/squares" : "/bracket";
      window.location.href = fallbackUrl;
    } else {
      onSuccess();
      onClose();
    }
  };

  // 1. Regular Member: Leave Pool
  const handleMemberLeave = async () => {
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in to leave");

      const endpoint =
        pool.gameType === "pickem"
          ? `/api/league/${encodeURIComponent(pool.id)}/leave`
          : pool.gameType === "squares"
          ? `/api/squares/${encodeURIComponent(pool.id)}/leave`
          : `/api/bracket/${encodeURIComponent(pool.id)}/leave`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave pool");

      cleanStorageAndRedirect();
    } catch (err: any) {
      console.error("Leave pool error:", err);
      setErrorMsg(err.message || "Failed to leave pool");
      setIsSubmitting(false);
    }
  };

  // 2. Commissioner: Transfer role, then Leave
  const handleTransferAndLeave = async () => {
    if (!selectedNewCommish) {
      setErrorMsg("Please select a member to transfer the commissioner role to");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in");

      // Step A: Transfer commissioner role
      const transferRes = await fetch("/api/pool/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameType: pool.gameType,
          poolId: pool.id,
          newCommissionerId: selectedNewCommish,
        }),
      });

      const transferData = await transferRes.json();
      if (!transferRes.ok) {
        throw new Error(transferData.error || "Failed to transfer commissioner role");
      }

      // Step B: Leave the pool as demoted member
      const endpoint =
        pool.gameType === "pickem"
          ? `/api/league/${encodeURIComponent(pool.id)}/leave`
          : pool.gameType === "squares"
          ? `/api/squares/${encodeURIComponent(pool.id)}/leave`
          : `/api/bracket/${encodeURIComponent(pool.id)}/leave`;

      const leaveRes = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const leaveData = await leaveRes.json();
      if (!leaveRes.ok) {
        throw new Error(leaveData.error || "Transferred commissioner role, but failed to leave");
      }

      cleanStorageAndRedirect();
    } catch (err: any) {
      console.error("Transfer and leave error:", err);
      setErrorMsg(err.message || "Failed to transfer and leave");
      setIsSubmitting(false);
    }
  };

  // 3. Commissioner: Permanently Delete Pool (or sole member leaving)
  const handleDeletePool = async () => {
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in");

      const endpoint =
        pool.gameType === "pickem"
          ? `/api/league/${encodeURIComponent(pool.id)}`
          : pool.gameType === "squares"
          ? `/api/squares/${encodeURIComponent(pool.id)}`
          : `/api/bracket/${encodeURIComponent(pool.id)}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete pool");

      cleanStorageAndRedirect();
    } catch (err: any) {
      console.error("Delete pool error:", err);
      setErrorMsg(err.message || "Failed to delete pool");
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto overscroll-none animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md my-auto max-h-[90dvh] bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 sm:space-y-5 overflow-y-auto"
      >
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {errorMsg}
          </div>
        )}

        {/* --- VIEW 1: REGULAR MEMBER LEAVE --- */}
        {!isCommissioner && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Leave {gameLabel}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 truncate">
                    Are you sure you want to leave <strong className="text-slate-900 dark:text-white">{pool.name}</strong>?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -mr-1 -mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              ⚠️ Your entries, picks, and standings for this {gameLabel.toLowerCase()} will be removed. You will need an invite code to rejoin.
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleMemberLeave}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                {isSubmitting ? "Leaving..." : "Leave Pool"}
              </button>
            </div>
          </>
        )}

        {/* --- VIEW 2: COMMISSIONER DELETE CONFIRMATION MODE --- */}
        {isCommissioner && deleteMode && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Permanently Delete Pool?
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 truncate">
                    Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{pool.name}</strong>?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -mr-1 -mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              ⚠️ <strong>Warning:</strong> This cannot be undone! All participants&apos; data, picks, scores, and standings will be permanently deleted for everyone.
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeleteMode(false)}
                className="flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeletePool}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isSubmitting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </>
        )}

        {/* --- VIEW 3: COMMISSIONER LEAVE & REASSIGN MODE --- */}
        {isCommissioner && !deleteMode && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Commissioner Role
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Leave & Reassign Commish
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 truncate">
                    Pool: <strong className="text-slate-900 dark:text-white">{pool.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -mr-1 -mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingMembers ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span className="text-xs">Checking eligible pool members...</span>
              </div>
            ) : members.length === 0 ? (
              // Sole member in pool
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <div>
                      You are the commissioner and the <strong>only member</strong> in this {gameLabel.toLowerCase()}. Leaving will permanently delete this pool.
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleDeletePool}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {isSubmitting ? "Deleting..." : "Delete & Leave Pool"}
                  </button>
                </div>
              </div>
            ) : (
              // Multiple members exist: choose successor
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select New Commissioner
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Before you leave, select another active member to take over commissioner duties for this {gameLabel.toLowerCase()}:
                  </p>
                  <select
                    value={selectedNewCommish}
                    onChange={(e) => setSelectedNewCommish(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-amber-500"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.username ? `(@${m.username})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !selectedNewCommish}
                    onClick={handleTransferAndLeave}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    {isSubmitting ? "Transferring & Leaving..." : "Transfer & Leave"}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setDeleteMode(true)}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Or permanently delete this pool instead
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
