"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import {
  Game,
  User,
  UserPicks,
  WeeklyPlayerResult,
  SeasonPlayerStanding,
  LeagueSettings,
  TiebreakerPrediction,
  EliminatorStatus,
} from "@/types/nfl";
import { Header } from "@/components/Header";
import { NavigationTabs, TabType } from "@/components/NavigationTabs";
import { WeeklyPicks } from "@/components/WeeklyPicks";
import { OverallStandings } from "@/components/OverallStandings";
import { PickMatrix } from "@/components/PickMatrix";
import { EliminatorPool } from "@/components/EliminatorPool";
import { CommissionerHub } from "@/components/CommissionerHub";
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2, Settings, CreditCard, ArrowRight } from "lucide-react";
import { authFetch } from "@/lib/api-client";
import { UserSettingsModal } from "@/components/UserSettingsModal";
import { getPayoutConfig, formatMoney, describeDues, buildVenmoPayUrl } from "@/lib/payouts";

interface LeagueApiResponse {
  settings: LeagueSettings;
  users: User[];
  gamesByWeek: Record<number, Game[]>;
  activeWeek: number;
  currentUserId: string;
  allPicks: UserPicks[];
  activeUserPicks?: UserPicks;
  weeklyResults: WeeklyPlayerResult[];
  seasonStandings: SeasonPlayerStanding[];
  eliminatorStatus: EliminatorStatus[];
  availableWeeks: number[];
  isSeasonOver?: boolean;
  isCommissioner?: boolean;
  isGuest?: boolean;
  overrideLogs?: any[];
  paidMembers?: Record<string, boolean>;
  payoutRecords?: Record<string, { paidOut: boolean; paidAt?: string | null }>;
  currentUserPaid?: boolean;
}

export default function LeagueClient({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("picks");
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [data, setData] = useState<LeagueApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [showFallbackSettings, setShowFallbackSettings] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    { type: "tab"; target: TabType } | { type: "week"; target: number } | null
  >(null);

  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && leagueId) {
      localStorage.setItem("last_active_league", leagueId);
    }
  }, [leagueId]);

  const loadLeagueData = useCallback(async (week?: number, isBackground = false) => {
    try {
      const url = week !== undefined
        ? `/api/league/${leagueId}?week=${week}`
        : `/api/league/${leagueId}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch league data");
      const json: LeagueApiResponse = await res.json();
      setData(json);
      // Only set initial activeWeek if week was not explicitly requested
      if (week === undefined) {
        setActiveWeek(json.activeWeek);
      }
    } catch (err) {
      console.error("Error loading league data:", err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [leagueId]);

  useEffect(() => {
    if (authLoading) return;
    loadLeagueData();
  }, [authLoading, loadLeagueData]);

  // Default guest visitors to the Season Standings tab
  useEffect(() => {
    if (!authLoading && !user && activeTab === "picks") {
      setActiveTab("season");
    }
  }, [authLoading, user, activeTab]);

  // Silently refresh live scores in the background (every 20s during live games, otherwise 60s)
  useEffect(() => {
    if (authLoading) return;

    const games = data?.gamesByWeek[activeWeek] || [];
    const now = Date.now();
    const hasLiveGames = games.some(
      (g: any) =>
        g.status?.state === "in" ||
        (!g.status?.completed &&
          now >= new Date(g.date).getTime() &&
          now <= new Date(g.date).getTime() + 4.5 * 3600 * 1000)
    );
    const pollInterval = hasLiveGames ? 20_000 : 60_000;

    const interval = setInterval(() => {
      loadLeagueData(activeWeek, true);
    }, pollInterval);

    // Immediately fetch latest scores when tab becomes active / device unlocked
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        loadLeagueData(activeWeek, true);
      }
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [authLoading, user, activeWeek, loadLeagueData, data?.gamesByWeek]);

  // Reset scroll to top whenever changing tabs
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const raf = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

  const handleWeekChange = (week: number) => {
    setActiveWeek(week);
    loadLeagueData(week, true);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const handleTabChange = (newTab: TabType) => {
    if (newTab === activeTab) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (activeTab === "picks" && hasUnsavedChanges) {
      setPendingNavigation({ type: "tab", target: newTab });
      setShowUnsavedModal(true);
      return;
    }
    setActiveTab(newTab);
    window.scrollTo(0, 0);
  };

  const handleSelectWeek = (week: number) => {
    if (week === activeWeek) return;
    if (activeTab === "picks" && hasUnsavedChanges) {
      setPendingNavigation({ type: "week", target: week });
      setShowUnsavedModal(true);
      return;
    }
    handleWeekChange(week);
  };

  const handleStayAndSave = () => {
    setShowUnsavedModal(false);
    setPendingNavigation(null);
  };

  const handleDiscardAndLeave = () => {
    const nextNav = pendingNavigation;
    setHasUnsavedChanges(false);
    setShowUnsavedModal(false);
    setPendingNavigation(null);

    if (!nextNav) return;
    if (nextNav.type === "tab") {
      setActiveTab(nextNav.target);
    } else if (nextNav.type === "week") {
      handleWeekChange(nextNav.target);
    }
  };

  const handleSyncToEspn = async (week?: number) => {
    setIsSyncing(true);
    const targetWeek = week ?? activeWeek;
    try {
      const res = await authFetch(`/api/league/${leagueId}/sync`, {
        method: "POST",
        body: JSON.stringify({ week: targetWeek }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to sync scores");
      await loadLeagueData(activeWeek);
      showToast(json.message || "Scores synced from ESPN!");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to sync scores with ESPN");
    } finally {
      setIsSyncing(false);
    }
  };

  const savePicksFor = async (
    targetUserId: string,
    week: number,
    picks: Record<string, string>,
    tiebreaker?: TiebreakerPrediction,
    eliminatorPick?: string,
    isOverride: boolean = false
  ) => {
    const res = await authFetch(`/api/league/${leagueId}/picks`, {
      method: "POST",
      body: JSON.stringify({
        userId: targetUserId,
        week,
        picks,
        tiebreaker,
        // null (not undefined) so clearing a survivor pick actually removes it
        eliminatorPick: eliminatorPick ?? null,
        isOverride,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Failed to save picks");
    }
    await loadLeagueData(activeWeek);
    return json;
  };

  const handleSavePicks = async (
    picks: Record<string, string>,
    tiebreaker?: TiebreakerPrediction,
    eliminatorPick?: string
  ) => {
    if (!data || !user) return;
    try {
      const res = await savePicksFor(user.id, activeWeek, picks, tiebreaker, eliminatorPick, false);
      const timeStr = res.savedAt
        ? new Date(res.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

      if (res.lockedIgnored && res.lockedIgnored.length > 0) {
        showToast(`✓ Picks locked in at ${timeStr}! (Note: ${res.lockedIgnored.join(", ")} already kicked off)`);
      } else {
        showToast(`✓ Picks locked in at ${timeStr}`);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to save picks");
    }
  };

  const handleOverridePicks = async (
    targetUserId: string,
    week: number,
    picks: Record<string, string>,
    tiebreaker?: TiebreakerPrediction,
    eliminatorPick?: string
  ) => {
    try {
      const res = await savePicksFor(targetUserId, week, picks, tiebreaker, eliminatorPick, true);
      const timeStr = res.savedAt
        ? new Date(res.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
      showToast(`✓ Commissioner override saved at ${timeStr}!`);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to override pick");
    }
  };

  const handleUpdateSettings = async (updates: Partial<LeagueSettings>) => {
    try {
      const res = await authFetch(`/api/league/${leagueId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update settings");
      }
      await loadLeagueData(activeWeek);
      showToast("Settings updated successfully!");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to update settings");
    }
  };

  const handleTogglePaid = async (targetUserId: string, newPaid: boolean) => {
    // Optimistically update local state immediately
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paidMembers: {
          ...(prev.paidMembers || {}),
          [targetUserId]: newPaid,
        },
      };
    });

    try {
      const res = await authFetch(`/api/league/${leagueId}/members/paid`, {
        method: "POST",
        body: JSON.stringify({ userId: targetUserId, paid: newPaid }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update paid status");
      }
      const targetUser = data?.users.find((u) => u.id === targetUserId);
      showToast(`✓ Marked ${targetUser?.name || "Player"} as ${newPaid ? "Paid" : "Unpaid"}`);
    } catch (err: any) {
      console.error("Toggle paid error:", err);
      showToast(err.message || "Failed to update payment status");
      await loadLeagueData(activeWeek); // Revert on failure
    }
  };

  const handleTogglePayout = async (key: string, newPaidOut: boolean) => {
    // Optimistically update local state immediately
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        payoutRecords: {
          ...(prev.payoutRecords || {}),
          [key]: {
            paidOut: newPaidOut,
            paidAt: newPaidOut ? new Date().toISOString() : null,
          },
        },
      };
    });

    try {
      const res = await authFetch(`/api/league/${leagueId}/payouts`, {
        method: "POST",
        body: JSON.stringify({ key, paidOut: newPaidOut }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update payout record");
      }
      showToast(newPaidOut ? "✓ Prize marked as Paid Out" : "Prize marked as Pending");
    } catch (err: any) {
      console.error("Toggle payout error:", err);
      showToast(err.message || "Failed to update payout record");
      await loadLeagueData(activeWeek);
    }
  };

  const handleNudgeUnpaid = async () => {
    try {
      const res = await authFetch(`/api/league/${leagueId}/members/nudge`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to send dues reminders");
      }
      showToast(json.message || "Dues reminder emails sent!");
    } catch (err: any) {
      console.error("Nudge unpaid error:", err);
      throw err;
    }
  };

  const handleDeleteLeague = async () => {
    try {
      const res = await authFetch(`/api/league/${leagueId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete league");
      }
      showToast("League deleted successfully!");
      if (typeof window !== "undefined") {
        localStorage.removeItem("last_active_league");
      }
      // Redirect to dashboard router after a short delay
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete league");
    }
  };

  const handleTransferCommissioner = async (newCommissionerId: string) => {
    try {
      const res = await authFetch(`/api/league/${leagueId}/members/transfer`, {
        method: "POST",
        body: JSON.stringify({ newCommissionerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to transfer commissioner role");
      }
      showToast("Commissioner role successfully transferred!");
      await loadLeagueData(activeWeek);
      setActiveTab("picks");
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("last_active_league");
    }
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 max-w-sm w-full bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-700 dark:text-slate-300 font-bold mb-1">League Unavailable</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Failed to load league. It may not exist or is unavailable.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("last_active_league");
                  window.location.href = "/?landing=true";
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Return to Landing Page
            </button>
            {user && (
              <>
                <button
                  onClick={() => setShowFallbackSettings(true)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Account Settings
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("last_active_league");
                      auth.signOut().then(() => {
                        window.location.href = "/";
                      });
                    }
                  }}
                  className="w-full py-2 px-4 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>

        {showFallbackSettings && (
          <UserSettingsModal
            isOpen={showFallbackSettings}
            onClose={() => setShowFallbackSettings(false)}
            onProfileUpdated={() => router.refresh()}
          />
        )}
      </div>
    );
  }

  const isCommissioner = Boolean(user && (data.isCommissioner || data.settings.commissionerId === user.id));
  const isSurvivorOnly = data.settings.pickemEnabled === false;
  const usedEliminatorTeams = (data.allPicks || [])
    .filter((p: any) => user && p.userId === user.id && p.week !== activeWeek && p.eliminatorPick)
    .map((p: any) => p.eliminatorPick as string);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        settings={data.settings}
        users={data.users}
        currentActiveUserId={user?.id || ""}
        activeWeek={activeWeek}
        availableWeeks={data.availableWeeks}
        currentLeagueId={leagueId}
        onSelectWeek={handleSelectWeek}
        onSyncEspn={handleSyncToEspn}
        isSyncing={isSyncing}
      />

      <main className="max-w-7xl mx-auto px-4 pt-4 sm:pt-8 pb-6 sm:pb-8 w-full flex-1">
        {!user ? (
          <OverallStandings 
            standings={data.seasonStandings} 
            seasonYear={data.settings.seasonYear || 2026}
            currentUserId=""
            isSeasonOver={data.isSeasonOver}
          />
        ) : (
          <>
            {/* Unpaid Member Venmo Dues Banner (only shown to unpaid members) */}
            {data.settings.venmoHandle && data.currentUserPaid === false && !isCommissioner && (() => {
              const cfg = getPayoutConfig(data.settings);
              if (cfg.duesPerPlayer <= 0) return null;
              const payUrl = buildVenmoPayUrl(
                data.settings.venmoHandle,
                cfg.duesPerPlayer,
                `PocketPicks dues - ${data.settings.leagueName}`
              );
              return (
                <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#008cff]/10 text-[#008cff] dark:text-[#3ba6ff] flex items-center justify-center shrink-0 border border-[#008cff]/20">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-sky-950 dark:text-sky-100 flex items-center gap-1.5 flex-wrap">
                        <span>League Buy-In: {formatMoney(cfg.duesPerPlayer)}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                          Payment Pending
                        </span>
                      </div>
                      <div className="text-[11px] text-sky-700 dark:text-sky-300/80 mt-0.5">
                        Pay your commissioner @{data.settings.venmoHandle} ({describeDues(cfg)})
                      </div>
                    </div>
                  </div>

                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#008cff] hover:bg-[#0074d9] text-white text-xs font-black rounded-xl transition shadow-xs shrink-0 cursor-pointer"
                  >
                    <span>Pay {formatMoney(cfg.duesPerPlayer)} with Venmo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })()}

            <NavigationTabs 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
              activeWeek={activeWeek}
              picksCount={
                isSurvivorOnly
                  ? (data.activeUserPicks?.eliminatorPick ? 1 : 0)
                  : Object.keys(data.activeUserPicks?.picks || {}).length
              }
              totalGames={(data.gamesByWeek[activeWeek] || []).length}
              hasWeeklyWinner={false}
              isCommissioner={isCommissioner}
              pickemEnabled={!isSurvivorOnly}
              eliminatorEnabled={data.settings.eliminatorEnabled}
            />

            <div className="mt-8">
              {activeTab === "picks" && (
                <WeeklyPicks
                  games={data.gamesByWeek[activeWeek] || []}
                  activeWeek={activeWeek}
                  currentUser={{
                    id: user.id,
                    name: user.name,
                    avatarColor: data.users?.find((u: any) => u.id === user.id)?.avatarColor || user.avatarColor || "bg-emerald-600"
                  } as any}
                  existingPicks={data.activeUserPicks}
                  lockPolicy={data.settings.lockPolicy}
                  eliminatorEnabled={data.settings.eliminatorEnabled}
                  pickemEnabled={!isSurvivorOnly}
                  usedEliminatorTeams={usedEliminatorTeams}
                  eliminatorStatus={data.eliminatorStatus}
                  totalMembersCount={data.users?.length}
                  isCommissionerEditMode={false}
                  onDirtyChange={setHasUnsavedChanges}
                  onSavePicks={handleSavePicks}
                />
              )}

          {activeTab === "matrix" && (
            <PickMatrix
              games={data.gamesByWeek[activeWeek] || []}
              users={data.users}
              allPicks={data.allPicks}
              activeWeek={activeWeek}
              currentUserId={user?.id || ""}
              lockPolicy={data.settings.lockPolicy}
              eliminatorEnabled={data.settings.eliminatorEnabled}
              eliminatorStatus={data.eliminatorStatus}
              weeklyResults={data.weeklyResults}
              settings={data.settings}
            />
          )}

          {activeTab === "season" && (
            <OverallStandings 
              standings={data.seasonStandings} 
              seasonYear={data.settings.seasonYear || 2026}
              currentUserId={user?.id || ""}
              isSeasonOver={data.isSeasonOver}
              settings={data.settings}
            />
          )}

          {activeTab === "eliminator" && (
            <EliminatorPool
              users={data.users}
              eliminatorStatus={data.eliminatorStatus}
              activeWeek={activeWeek}
              availableWeeks={data.availableWeeks}
              currentUserId={user?.id || ""}
              settings={data.settings}
            />
          )}

          {activeTab === "commissioner" && isCommissioner && (
            <CommissionerHub
              leagueId={leagueId}
              games={data.gamesByWeek[activeWeek] || []}
              activeWeek={activeWeek}
              settings={data.settings}
              users={data.users}
              allPicks={data.allPicks}
              eliminatorStatus={data.eliminatorStatus}
              seasonStandings={data.seasonStandings}
              isSeasonOver={data.isSeasonOver}
              overrideLogs={data.overrideLogs}
              paidMembers={data.paidMembers}
              payoutRecords={data.payoutRecords}
              onTogglePaid={handleTogglePaid}
              onTogglePayout={handleTogglePayout}
              onNudgeUnpaid={handleNudgeUnpaid}
              onDeleteLeague={handleDeleteLeague}
              onOverridePicks={handleOverridePicks}
              onUpdateSettings={handleUpdateSettings}
              onSyncEspn={handleSyncToEspn}
              onRemoveUser={async () => {
                await loadLeagueData();
                showToast("Member removed from league.");
              }}
              onTransferCommissioner={handleTransferCommissioner}
              isSyncing={isSyncing}
            />
          )}
          {activeTab === "commissioner" && !isCommissioner && (
            <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">You must be the League Commissioner to view Commissioner Settings.</p>
            </div>
          )}
        </div>
      </>
    )}
  </main>

      {/* Unsaved Changes Exit Guard Modal */}
      {showUnsavedModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleStayAndSave}
        >
          <div 
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200/50 dark:border-amber-900/40">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Unsaved Picks
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
              You have unsaved picks for Week {activeWeek}. If you leave without saving, your draft selections will be lost.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleStayAndSave}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Stay & Save
              </button>
              <button
                type="button"
                onClick={handleDiscardAndLeave}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-xs transition-all border border-slate-200/60 dark:border-slate-700/60 hover:border-rose-200 dark:hover:border-rose-800/60 cursor-pointer"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-800/95 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 sm:slide-in-from-right-3 duration-200 pointer-events-none max-w-sm">
          {notification.toLowerCase().includes("fail") || notification.toLowerCase().includes("error") ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100">{notification}</span>
        </div>
      )}
    </div>
  );
}
