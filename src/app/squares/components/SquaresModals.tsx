"use client";

import React from "react";
import { X, Share2, Copy } from "lucide-react";

interface SquaresRulesModalProps {
  onClose: () => void;
}

export function SquaresRulesModal({ onClose }: SquaresRulesModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xl shrink-0">
            🏈
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
              How Super Bowl Squares Work
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Official pool rules &amp; scoring</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">1.</span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Pick Your Squares</span>
              Players claim squares on the 10x10 grid. Once the board is set, columns (AFC) and rows (NFC) are assigned randomized numbers from 0 to 9.
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">2.</span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Last-Digit Scoring</span>
              At the end of Q1, Halftime (Q2), Q3, and the Final score, take the <strong>last digit</strong> of each team&apos;s score.
              <div className="mt-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                Example: Bills <strong>17</strong>, 49ers <strong>14</strong><br />
                Winning square = AFC <strong>7</strong> &bull; NFC <strong>4</strong>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">3.</span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Quarter Winners &amp; Payouts</span>
              Whoever owns the intersecting square wins the prize or bragging rights for that quarter! A single square can win multiple quarters if the numbers hit again.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-xs transition shadow-sm cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
}

interface SquaresShareModalProps {
  poolId: string;
  currentJoinCode: string | null;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export function SquaresShareModal({
  poolId,
  currentJoinCode,
  onClose,
  showToast,
}: SquaresShareModalProps) {
  const boardCode = currentJoinCode || poolId.replace(/^sb-/, "").toUpperCase();
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/squares?id=${poolId}&view=1` : "";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                Share Squares Board
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invite friends to view or add this board to their account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5-Digit Board Code Box */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              5-Digit Board Code
            </span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">
              For PocketPicks users
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-amber-300 dark:border-amber-800/80">
            <span className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
              {boardCode}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(boardCode);
                  showToast(`Code ${boardCode} copied!`);
                } catch {
                  showToast("Could not copy code");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Friends with an account can click <strong>Join Board with Code</strong> and enter this code to save it to their profile.
          </p>
        </div>

        {/* Direct Web Link Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Public Direct Link
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              View-only for party guests
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  showToast("Link copied to clipboard!");
                } catch {
                  showToast("Could not copy link");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </button>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
