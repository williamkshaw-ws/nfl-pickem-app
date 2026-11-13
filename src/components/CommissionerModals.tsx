"use client";

import React from "react";
import { Trash2, Mail, Loader2, AlertCircle } from "lucide-react";

interface DeleteLeagueModalProps {
  leagueName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteLeagueModal({
  leagueName,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteLeagueModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Delete League</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Are you absolutely sure you want to delete{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                {leagueName}
              </strong>
              ?
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
          ⚠️ All player picks, season standings, matchups, and league history will be permanently
          erased. This action cannot be undone.
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? "Deleting..." : "Delete League"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface NudgeUnpaidModalProps {
  unpaidCount: number;
  duesFormatted: string;
  venmoHandle?: string;
  isNudging: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function NudgeUnpaidModal({
  unpaidCount,
  duesFormatted,
  venmoHandle,
  isNudging,
  onClose,
  onConfirm,
}: NudgeUnpaidModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Send Dues Reminders
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Send an email dues reminder to all{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                {unpaidCount} unpaid member{unpaidCount === 1 ? "" : "s"}
              </strong>
              ?
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
          📬 Members who haven&apos;t had their buy-in marked as paid will receive an email reminder with your league dues amount ({duesFormatted}){venmoHandle ? ` and Venmo payment link (@${venmoHandle})` : ""}.
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={isNudging}
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isNudging}
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {isNudging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            <span>{isNudging ? "Sending..." : "Send Reminder"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface CommissionerAlertModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

export function CommissionerAlertModal({
  title,
  message,
  onClose,
}: CommissionerAlertModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold transition shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
