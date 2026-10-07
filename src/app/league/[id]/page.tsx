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
import { WeeklyLeaderboard } from "@/components/WeeklyLeaderboard";
import { OverallStandings } from "@/components/OverallStandings";
import { PickMatrix } from "@/components/PickMatrix";
import { EliminatorPool } from "@/components/EliminatorPool";
import { CommissionerHub } from "@/components/CommissionerHub";
import { Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/api-client";

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
}

export default function LeagueHome({ params }: { params: Promise<{ id: string }> }) {
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
    if (!user) return;
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
  }, [leagueId, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user && !auth.currentUser) {
      router.push("/auth/login");
      return;
    }
    loadLeagueData();
  }, [authLoading, user, router, loadLeagueData]);

  // Silently refresh live scores in the background every 45s without flashing loaders
  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(() => {
      loadLeagueData(activeWeek, true);
    }, 45_000);
    return () => clearInterval(interval);
  }, [authLoading, user, activeWeek, loadLeagueData]);

  const handleWeekChange = (week: number) => {
    setActiveWeek(week);
    loadLeagueData(week, true);
  };

  const handleTabChange = (newTab: TabType) => {
    if (newTab === activeTab) return;
    if (activeTab === "picks" && hasUnsavedChanges) {
      setPendingNavigation({ type: "tab", target: newTab });
      setShowUnsavedModal(true);
      return;
    }
    setActiveTab(newTab);
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
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to save picks");
    }
    await loadLeagueData(activeWeek);
  };

  const handleSavePicks = async (
    picks: Record<string, string>,
    tiebreaker?: TiebreakerPrediction,
    eliminatorPick?: string
  ) => {
    if (!data || !user) return;
    try {
      await savePicksFor(user.id, activeWeek, picks, tiebreaker, eliminatorPick, false);
      showToast(data.settings.pickemEnabled === false ? "Survivor pick saved!" : "Picks saved successfully!");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to save picks");
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
      await savePicksFor(targetUserId, week, picks, tiebreaker, eliminatorPick, true);
      showToast("Player pick updated!");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to override pick");
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
      alert(err.message || "Failed to update settings");
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
      alert("Failed to delete league");
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
      alert(err.message || "Failed to transfer commissioner role");
      throw err;
    }
  };

  const handleAddUser = async (name: string) => {
    alert("Users must join using the 5-character invite code.");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user && !auth.currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Failed to load league. It may not exist or you lack access.</p>
        </div>
      </div>
    );
  }

  const isCommissioner = data.settings.commissionerId === user.id;
  const isSurvivorOnly = data.settings.pickemEnabled === false;
  const usedEliminatorTeams = (data.allPicks || [])
    .filter((p: any) => p.userId === user.id && p.week !== activeWeek && p.eliminatorPick)
    .map((p: any) => p.eliminatorPick as string);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        settings={data.settings}
        users={data.users}
        currentActiveUserId={user.id}
        activeWeek={activeWeek}
        availableWeeks={data.availableWeeks}
        currentLeagueId={leagueId}
        onSelectWeek={handleSelectWeek}
        onSwitchUser={() => {}}
        onAddUser={handleAddUser}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
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
              currentUser={{ id: user.id, name: user.name, avatarColor: "bg-emerald-600" } as any}
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
              currentUserId={user.id}
              lockPolicy={data.settings.lockPolicy}
              eliminatorEnabled={data.settings.eliminatorEnabled}
              eliminatorStatus={data.eliminatorStatus}
              weeklyResults={data.weeklyResults}
            />
          )}

          {activeTab === "season" && (
            <OverallStandings 
              standings={data.seasonStandings} 
              seasonYear={data.settings.seasonYear || 2026}
              currentUserId={user.id}
              isSeasonOver={data.isSeasonOver}
            />
          )}

          {activeTab === "eliminator" && (
            <EliminatorPool
              users={data.users}
              eliminatorStatus={data.eliminatorStatus}
              activeWeek={activeWeek}
              availableWeeks={data.availableWeeks}
              currentUserId={user.id}
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
      </main>

      {/* Unsaved Changes Exit Guard Modal */}
      {showUnsavedModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl z-50 animate-in slide-in-from-bottom-5">
          {notification}
        </div>
      )}
    </div>
  );
}
