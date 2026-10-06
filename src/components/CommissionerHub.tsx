"use client";

import React, { useState } from "react";
import { Game, LeagueSettings, User, UserPicks, TiebreakerPrediction, EliminatorStatus } from "@/types/nfl";
import {
  SlidersHorizontal,
  Key,
  Users,
  Copy,
  Check,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  User as UserIcon,
  RefreshCw,
  UserMinus,
  Ban,
  Loader2,
} from "lucide-react";
import { WeeklyPicks } from "./WeeklyPicks";
import { authFetch } from "@/lib/api-client";

interface CommissionerHubProps {
  leagueId: string;
  games: Game[];
  activeWeek: number;
  settings: LeagueSettings;
  users: User[];
  allPicks: UserPicks[];
  eliminatorStatus?: EliminatorStatus[];
  onSyncEspn?: (week: number) => Promise<void>;
  isSyncing?: boolean;
  onOverridePicks: (
    userId: string,
    week: number,
    picks: Record<string, string>,
    tiebreaker?: TiebreakerPrediction,
    eliminatorPick?: string
  ) => Promise<void>;
  onUpdateSettings: (newSettings: Partial<LeagueSettings>) => Promise<void>;
  onDeleteLeague: () => Promise<void>;
  onRemoveUser?: (userId: string) => Promise<void>;
}

export function CommissionerHub({
  leagueId,
  games,
  activeWeek,
  settings,
  users,
  allPicks,
  eliminatorStatus,
  onOverridePicks,
  onUpdateSettings,
  onDeleteLeague,
  onRemoveUser,
  onSyncEspn,
  isSyncing,
}: CommissionerHubProps) {
  const [leagueNameInput, setLeagueNameInput] = useState(settings.leagueName);
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || "");
  const [leaguePassword, setLeaguePassword] = useState(settings.leaguePassword || "");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [userToKick, setUserToKick] = useState<User | null>(null);
  const [userToBan, setUserToBan] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const selectedUser = users.find(u => u.id === selectedUserId);
  const picksForSelectedUser = allPicks?.find(p => p.userId === selectedUserId && p.week === activeWeek);

  const handleKickUser = async () => {
    if (!userToKick) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/league/${leagueId}/members/kick`, {
        method: "POST",
        body: JSON.stringify({ userId: userToKick.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to kick member");
        setActionLoading(false);
        return;
      }
      const kickedId = userToKick.id;
      setUserToKick(null);
      if (onRemoveUser) {
        await onRemoveUser(kickedId);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to kick member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!userToBan) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/league/${leagueId}/members/ban`, {
        method: "POST",
        body: JSON.stringify({ userId: userToBan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to ban user");
        setActionLoading(false);
        return;
      }
      const bannedId = userToBan.id;
      setUserToBan(null);
      if (onRemoveUser) {
        await onRemoveUser(bannedId);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to ban user");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Commissioner Header Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-slate-50 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border border-amber-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 mb-2">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Commissioner Control Room
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              League &amp; Settings Management
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Adjust league settings, invite players, and manage picks.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* League Settings Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              League Settings
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">League Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leagueNameInput}
                  onChange={(e) => setLeagueNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => onUpdateSettings({ leagueName: leagueNameInput })}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex-shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">League Format</label>
              <div className="space-y-2">
                <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${settings.pickemEnabled !== false && settings.eliminatorEnabled ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}>
                  <input type="radio" name="format" checked={settings.pickemEnabled !== false && settings.eliminatorEnabled} onChange={() => onUpdateSettings({ pickemEnabled: true, eliminatorEnabled: true })} className="hidden" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">Standard + Survivor</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Pick every game each week, plus pick one survivor team.</div>
                  </div>
                </label>
                <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${settings.pickemEnabled !== false && !settings.eliminatorEnabled ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}>
                  <input type="radio" name="format" checked={settings.pickemEnabled !== false && !settings.eliminatorEnabled} onChange={() => onUpdateSettings({ pickemEnabled: true, eliminatorEnabled: false })} className="hidden" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">Pick'em Only</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Just pick the winners of every game each week.</div>
                  </div>
                </label>
                <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${settings.pickemEnabled === false ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}>
                  <input type="radio" name="format" checked={settings.pickemEnabled === false} onChange={() => onUpdateSettings({ pickemEnabled: false, eliminatorEnabled: true })} className="hidden" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">Survivor Only</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Pick one team to win each week. If they lose, you're out.</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pick Lock Policy</label>
              <select
                value={settings.lockPolicy || "game"}
                onChange={(e) => onUpdateSettings({ lockPolicy: e.target.value as "game" | "week" | "day" })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="game">Individual Kickoff (Lock game-by-game as each begins)</option>
                <option value="week">First Game of Week (Locks all games at Thursday kickoff)</option>
                <option value="day">First Game of Day (Locks all games on that day)</option>
              </select>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Controls when players&apos; picks and survivor selections lock and become visible to opponents.
              </p>
            </div>
          </div>

          {/* ESPN Live Scores Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ESPN Live Scores
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                Auto-Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Scores automatically update when players open the site. You can also manually force a live sync from ESPN for Week {activeWeek}.
            </p>
            <button
              onClick={() => onSyncEspn?.(activeWeek)}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-95 text-white transition disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
              <span>{isSyncing ? "Syncing with ESPN..." : `Sync Week ${activeWeek} Scores Now`}</span>
            </button>
          </div>

          {/* Invite & Access Control */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-400" />
              Invite & Access Control
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Manage how people join your league.</p>
            
            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">League Join Code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono font-bold tracking-widest text-slate-700 dark:text-slate-200 text-center uppercase">
                    {leagueId}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(leagueId);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex-shrink-0"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? "Copied" : "Copy Code"}
                  </button>
                </div>
                
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 mt-4">Or share a direct Invite Link</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 truncate select-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/?join=${leagueId}` : "..."}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(typeof window !== 'undefined' ? `${window.location.origin}/?join=${leagueId}` : "");
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex-shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Link
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                  Users can enter the code in their league switcher or simply click the link to join.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">League Password (Optional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={leaguePassword}
                    onChange={(e) => setLeaguePassword(e.target.value)}
                    placeholder="Leave blank for public"
                    className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => onUpdateSettings({ leaguePassword })}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors flex-shrink-0"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Member Management */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  Member Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">View and remove users from your league.</p>
              </div>
              <div className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg whitespace-nowrap flex-shrink-0">
                {users.length} Members
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${u.avatarColor || "bg-slate-800"} text-white font-bold flex items-center justify-center text-sm flex-shrink-0`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        {u.name}
                        {settings.commissionerId === u.id && <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] rounded font-black uppercase tracking-wider">Admin</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active Member'}
                      </div>
                    </div>
                  </div>

                  {settings.commissionerId !== u.id && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setUserToKick(u)}
                        title={`Kick ${u.name} from this league`}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl border border-amber-200 dark:border-amber-900/50 transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Kick</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserToBan(u)}
                        title={`Ban ${u.name} from the platform`}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900/50 transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Ban</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-3xl p-6 shadow-xs mt-8">
            <h3 className="font-extrabold text-base text-red-900 dark:text-red-200 flex items-center gap-2 mb-4">
              Danger Zone
            </h3>
            <p className="text-xs text-red-700 dark:text-red-300 mb-4">
              Once you delete a league, there is no going back. Please be certain.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete League
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Edit User Picks Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="truncate">Override Player Picks</span>
              </h3>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 w-[140px] sm:w-auto flex-shrink-0 truncate"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/50 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <strong className="block mb-1">Commissioner Override Active</strong>
                As commissioner, you can submit picks on behalf of another user at any time, ignoring all standard lock policies. This is useful if a player missed the deadline or needs manual adjustments.
              </div>
            </div>

            {selectedUser && (
              <div className="relative commissioner-picks-wrapper">
                <WeeklyPicks
                  key={`${selectedUserId}_${activeWeek}`}
                  games={games}
                  activeWeek={activeWeek}
                  currentUser={selectedUser}
                  existingPicks={picksForSelectedUser}
                  lockPolicy={settings.lockPolicy}
                  eliminatorEnabled={settings.eliminatorEnabled}
                  pickemEnabled={settings.pickemEnabled !== false}
                  usedEliminatorTeams={allPicks.filter(p => p.userId === selectedUserId && p.week !== activeWeek && p.eliminatorPick).map(p => p.eliminatorPick || "")}
                  eliminatorStatus={eliminatorStatus}
                  totalMembersCount={users.length}
                  isCommissionerEditMode={true}
                  embedded
                  onSavePicks={async (picks, tiebreaker, eliminatorPick) => {
                    await onOverridePicks(selectedUserId, activeWeek, picks, tiebreaker, eliminatorPick);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete League Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Delete League</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Are you absolutely sure you want to delete <strong className="text-slate-900 dark:text-white font-bold">{settings.leagueName}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
              ⚠️ All player picks, season standings, matchups, and league history will be permanently erased. This action cannot be undone.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteLeague();
                  } catch (err) {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Deleting..." : "Delete League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kick User Modal */}
      {userToKick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Kick Member</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Are you sure you want to kick <strong className="text-slate-900 dark:text-white font-bold">{userToKick.name}</strong> from this league?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
              ⚠️ They will be removed from <strong className="font-bold">{settings.leagueName}</strong> and their picks in this league will be cleared. Their account will remain active, but they will only be able to rejoin if given an invite code.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUserToKick(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleKickUser}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                {actionLoading ? "Kicking..." : "Kick Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {userToBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Ban Account</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Are you sure you want to ban <strong className="text-slate-900 dark:text-white font-bold">{userToBan.name}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              ⛔ Their account will be permanently disabled and their email will no longer be allowed to log into PocketPicks. They will also be immediately removed from this league.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUserToBan(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleBanUser}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {actionLoading ? "Banning..." : "Ban Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}