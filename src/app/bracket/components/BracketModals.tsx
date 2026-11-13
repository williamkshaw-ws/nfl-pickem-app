"use client";

import React from "react";
import {
  Share2,
  X,
  Copy,
  HelpCircle,
  SlidersHorizontal,
  Loader2,
  Check,
} from "lucide-react";
import {
  BracketRoundPoints,
  calculateTotalBracketPoints,
} from "@/lib/playoff-bracket";

interface BracketShareModalProps {
  cleanDisplayCode: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export function BracketShareModal({
  cleanDisplayCode,
  onClose,
  showToast,
}: BracketShareModalProps) {
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/bracket?id=${cleanDisplayCode}`
      : `https://pocketpicks.app/bracket?id=${cleanDisplayCode}`;

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
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                Share Bracket Pool
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invite friends to join this playoff bracket challenge.
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

        {/* 5-Digit Bracket Code Box */}
        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-800 dark:text-purple-300">
              5-Character Bracket Code
            </span>
            <span className="text-[10px] text-purple-700/80 dark:text-purple-400/80 font-medium">
              For PocketPicks users
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 border border-purple-300 dark:border-purple-800/80">
            <span className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
              {cleanDisplayCode}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cleanDisplayCode);
                  showToast(`Code ${cleanDisplayCode} copied!`);
                } catch {
                  showToast("Could not copy code");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Friends with an account can click <strong>Join With Code</strong> in the brackets menu and enter this code.
          </p>
        </div>

        {/* Direct Web Link Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Direct Invite Link
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              One-click join link
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
              {typeof window !== "undefined" ? inviteUrl : ""}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteUrl);
                  showToast("Invite link copied to clipboard!");
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
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Send this link directly to friends. When they open it, they will be taken straight to this bracket.
          </p>
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

interface BracketRulesModalProps {
  isOwner: boolean;
  roundPoints?: BracketRoundPoints;
  totalPoolPoints: number;
  onEditScoring: () => void;
  onClose: () => void;
}

export function BracketRulesModal({
  isOwner,
  roundPoints,
  totalPoolPoints,
  onEditScoring,
  onClose,
}: BracketRulesModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Rules &amp; Scoring
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold text-slate-900 dark:text-white">
                1. How Scoring Works
              </h4>
              {isOwner && (
                <button
                  type="button"
                  onClick={onEditScoring}
                  className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  Edit Point Values &rarr;
                </button>
              )}
            </div>
            <p className="mb-2">
              Points are awarded for each correct game pick across all 13 postseason games:
            </p>
            <div className="grid grid-cols-2 gap-2 my-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                Wild Card: <strong className="text-purple-600 dark:text-purple-400">{roundPoints?.wild_card ?? 1} pt</strong> each (6 games)
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                Divisional: <strong className="text-purple-600 dark:text-purple-400">{roundPoints?.divisional ?? 1} pt{(roundPoints?.divisional ?? 1) === 1 ? "" : "s"}</strong> each (4 games)
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                Conference: <strong className="text-purple-600 dark:text-purple-400">{roundPoints?.conference ?? 1} pt{(roundPoints?.conference ?? 1) === 1 ? "" : "s"}</strong> each (2 games)
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                Super Bowl: <strong className="text-purple-600 dark:text-purple-400">{roundPoints?.super_bowl ?? 1} pt{(roundPoints?.super_bowl ?? 1) === 1 ? "" : "s"}</strong> (1 game)
              </div>
            </div>
            <p className="mt-1 text-slate-500">
              The maximum possible score in this pool is <strong>{totalPoolPoints} points</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">
              2. Official NFL Reseeding
            </h4>
            <p>
              In the Divisional round, the #1 seed ALWAYS hosts the lowest remaining seed. The two middle winners play each other. Your bracket automatically updates with dynamic reseeding as you make your picks.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">
              3. 3-Tier Super Bowl Tiebreaker
            </h4>
            <p>If participants are tied in points, ties are broken sequentially:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><strong>Tier 1:</strong> Closest combined total score to the actual Super Bowl.</li>
              <li><strong>Tier 2:</strong> Closest predicted score for the home team.</li>
              <li><strong>Tier 3:</strong> Closest predicted score for the away team.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

interface BracketScoringModalProps {
  scoringForm: BracketRoundPoints;
  setScoringForm: React.Dispatch<React.SetStateAction<BracketRoundPoints>>;
  scoringError: string;
  savingScoring: boolean;
  scoringSuccess: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function BracketScoringModal({
  scoringForm,
  setScoringForm,
  scoringError,
  savingScoring,
  scoringSuccess,
  onSave,
  onClose,
}: BracketScoringModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Round Point Values
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          Set the point value for correct picks in each round. Scores and max possible points for all participants will update automatically.
        </p>

        {/* Quick Presets */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
            Quick Presets
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setScoringForm({ wild_card: 1, divisional: 1, conference: 1, super_bowl: 1 })}
              className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                scoringForm.wild_card === 1 && scoringForm.divisional === 1 && scoringForm.conference === 1 && scoringForm.super_bowl === 1
                  ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              <div>Standard (1-1-1-1)</div>
              <div className="text-[10px] text-slate-400 font-normal">13 total pts</div>
            </button>
            <button
              type="button"
              onClick={() => setScoringForm({ wild_card: 1, divisional: 2, conference: 4, super_bowl: 8 })}
              className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                scoringForm.wild_card === 1 && scoringForm.divisional === 2 && scoringForm.conference === 4 && scoringForm.super_bowl === 8
                  ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              <div>Progressive (1-2-4-8)</div>
              <div className="text-[10px] text-slate-400 font-normal">30 total pts</div>
            </button>
            <button
              type="button"
              onClick={() => setScoringForm({ wild_card: 1, divisional: 2, conference: 3, super_bowl: 5 })}
              className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                scoringForm.wild_card === 1 && scoringForm.divisional === 2 && scoringForm.conference === 3 && scoringForm.super_bowl === 5
                  ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              <div>Fibonacci (1-2-3-5)</div>
              <div className="text-[10px] text-slate-400 font-normal">25 total pts</div>
            </button>
            <button
              type="button"
              onClick={() => setScoringForm({ wild_card: 1, divisional: 2, conference: 3, super_bowl: 4 })}
              className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                scoringForm.wild_card === 1 && scoringForm.divisional === 2 && scoringForm.conference === 3 && scoringForm.super_bowl === 4
                  ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              <div>Stepped (1-2-3-4)</div>
              <div className="text-[10px] text-slate-400 font-normal">24 total pts</div>
            </button>
          </div>
        </div>

        {/* Inputs for each round */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Wild Card Round</div>
              <div className="text-[11px] text-slate-400">6 games • {6 * (scoringForm.wild_card || 0)} pts total</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={scoringForm.wild_card}
                onChange={(e) => setScoringForm({ ...scoringForm, wild_card: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 py-1 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-xs font-semibold text-slate-500">pts</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Divisional Round</div>
              <div className="text-[11px] text-slate-400">4 games • {4 * (scoringForm.divisional || 0)} pts total</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={scoringForm.divisional}
                onChange={(e) => setScoringForm({ ...scoringForm, divisional: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 py-1 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-xs font-semibold text-slate-500">pts</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Conference Championships</div>
              <div className="text-[11px] text-slate-400">2 games • {2 * (scoringForm.conference || 0)} pts total</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={scoringForm.conference}
                onChange={(e) => setScoringForm({ ...scoringForm, conference: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 py-1 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-xs font-semibold text-slate-500">pts</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Super Bowl</div>
              <div className="text-[11px] text-slate-400">1 game • {1 * (scoringForm.super_bowl || 0)} pts total</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={scoringForm.super_bowl}
                onChange={(e) => setScoringForm({ ...scoringForm, super_bowl: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 py-1 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-xs font-semibold text-slate-500">pts</span>
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between mb-5">
          <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
            Total Available Points:
          </span>
          <span className="text-sm font-black font-mono text-purple-700 dark:text-purple-400">
            {calculateTotalBracketPoints(scoringForm)} pts
          </span>
        </div>

        {scoringError && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-3">{scoringError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={savingScoring || scoringSuccess}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            {savingScoring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : scoringSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Point Values</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
