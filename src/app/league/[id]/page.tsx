"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
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
import { Loader2, AlertCircle } from "lucide-react";
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

  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const loadLeagueData = useCallback(async (week?: number) => {
    if (!user) return;
    try {
      const url = week !== undefined
        ? `/api/league/${leagueId}?week=${week}`
        : `/api/league/${leagueId}`;
      const res = await authFetch(url, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      });
      if (!res.ok) throw new Error("Failed to fetch league data");
      const json: LeagueApiResponse = await res.json();
      setData(json);
      setActiveWeek(json.activeWeek);
    } catch (err) {
      console.error("Error loading league data:", err);
    } finally {
      setLoading(false);
    }
  }, [leagueId, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    loadLeagueData();
  }, [authLoading, user, router, loadLeagueData]);

  // Silently refresh live scores in the background every 45s
  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(() => {
      loadLeagueData(activeWeek);
    }, 45_000);
    return () => clearInterval(interval);
  }, [authLoading, user, activeWeek, loadLeagueData]);

  const handleWeekChange = (week: number) => {
    setActiveWeek(week);
    loadLeagueData(week);
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
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Failed to delete league");
    }
  };

  const handleAddUser = async (name: string) => {
    alert("Users must join via the dashboard using the 5-character invite code.");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
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
        onSelectWeek={handleWeekChange}
        onSwitchUser={() => {}}
        onAddUser={handleAddUser}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <NavigationTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
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
              onSavePicks={handleSavePicks}
            />
          )}

          {activeTab === "weekly" && (
            <WeeklyLeaderboard 
              weeklyResults={data.weeklyResults} 
              activeWeek={activeWeek}
              games={data.gamesByWeek[activeWeek] || []}
              currentUserId={user.id}
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
            />
          )}

          {activeTab === "eliminator" && (
            <EliminatorPool
              users={data.users}
              eliminatorStatus={data.eliminatorStatus}
              activeWeek={activeWeek}
              availableWeeks={data.availableWeeks}
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

      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl z-50 animate-in slide-in-from-bottom-5">
          {notification}
        </div>
      )}
    </div>
  );
}
