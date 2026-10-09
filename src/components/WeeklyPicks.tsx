"use client";
import { TeamLogo } from "./TeamLogo";

import React, { useState, useEffect } from "react";
import {
  Game,
  User,
  UserPicks,
  TiebreakerPrediction,
} from "@/types/nfl";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Save,
  Target,
  Lock,
  Skull,
  Shield,
} from "lucide-react";
import { EliminatorStatus } from "@/types/nfl";

interface WeeklyPicksProps {
  games: Game[];
  activeWeek: number;
  currentUser: User;
  existingPicks?: UserPicks;
  lockPolicy: "week" | "day" | "game";
  eliminatorEnabled?: boolean;
  pickemEnabled?: boolean;
  usedEliminatorTeams?: string[];
  eliminatorStatus?: EliminatorStatus[];
  totalMembersCount?: number;
  isCommissionerEditMode?: boolean;
  /** Render the save bar inline (e.g. inside the Commissioner Hub) instead of floating */
  embedded?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavePicks: (picks: Record<string, string>, tiebreaker?: TiebreakerPrediction, eliminatorPick?: string) => Promise<void>;
}

export function WeeklyPicks({
  games,
  activeWeek,
  currentUser,
  existingPicks,
  lockPolicy,
  eliminatorEnabled,
  pickemEnabled = true,
  usedEliminatorTeams,
  eliminatorStatus,
  totalMembersCount,
  isCommissionerEditMode,
  embedded = false,
  onDirtyChange,
  onSavePicks,
}: WeeklyPicksProps) {
  const isSurvivorOnly = !pickemEnabled && !!eliminatorEnabled;

  const [selectedPicks, setSelectedPicks] = useState<Record<string, string>>({});
  const [homeScoreInput, setHomeScoreInput] = useState<string>("");
  const [awayScoreInput, setAwayScoreInput] = useState<string>("");
  const [eliminatorPick, setEliminatorPick] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (existingPicks) {
      setSelectedPicks(existingPicks.picks || {});
      if (existingPicks.tiebreaker) {
        setHomeScoreInput(existingPicks.tiebreaker.homeScore.toString());
        setAwayScoreInput(existingPicks.tiebreaker.awayScore.toString());
      } else {
        setHomeScoreInput("");
        setAwayScoreInput("");
      }
      setEliminatorPick(existingPicks.eliminatorPick || "");
    } else {
      setSelectedPicks({});
      setHomeScoreInput("");
      setAwayScoreInput("");
      setEliminatorPick("");
    }
    setSaveSuccess(false);
  }, [existingPicks, activeWeek]);

  const isDirty = React.useMemo(() => {
    const origPicks = existingPicks?.picks || {};
    const origHome = existingPicks?.tiebreaker ? existingPicks.tiebreaker.homeScore.toString() : "";
    const origAway = existingPicks?.tiebreaker ? existingPicks.tiebreaker.awayScore.toString() : "";
    const origElim = existingPicks?.eliminatorPick || "";

    // 1. Survivor pick comparison (if eliminator enabled)
    if (eliminatorEnabled) {
      if ((eliminatorPick || "") !== origElim) return true;
    }

    // 2. Pick'em & Tiebreaker comparison (if pick'em enabled and not survivor only)
    if (!isSurvivorOnly) {
      if (homeScoreInput !== origHome) return true;
      if (awayScoreInput !== origAway) return true;

      const allGameIds = new Set([...Object.keys(selectedPicks), ...Object.keys(origPicks)]);
      for (const gid of allGameIds) {
        if ((selectedPicks[gid] || "") !== (origPicks[gid] || "")) {
          return true;
        }
      }
    }

    return false;
  }, [
    existingPicks,
    eliminatorPick,
    eliminatorEnabled,
    isSurvivorOnly,
    homeScoreInput,
    awayScoreInput,
    selectedPicks,
  ]);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [isDirty, onDirtyChange]);

  // Guard against accidental tab/browser close or refresh
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const tiebreakerGame =
    games.find((g) => g.isTiebreakerGame) ||
    [...games].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

  const parsedHome = parseInt(homeScoreInput, 10);
  const parsedAway = parseInt(awayScoreInput, 10);
  const calculatedTotal =
    !isNaN(parsedHome) && !isNaN(parsedAway) ? parsedHome + parsedAway : null;

  const handlePickSelect = (gameId: string, teamId: string, isGameLocked: boolean) => {
    // Survivor-only leagues don't pick game winners at all
    if (isSurvivorOnly) return;
    if (isGameLocked && !isCommissionerEditMode) return;

    setSelectedPicks((prev) => ({
      ...prev,
      [gameId]: teamId,
    }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let tiebreaker: TiebreakerPrediction | undefined = undefined;
      if (!isSurvivorOnly && !isNaN(parsedHome) && !isNaN(parsedAway)) {
        tiebreaker = {
          homeScore: parsedHome,
          awayScore: parsedAway,
          totalScore: parsedHome + parsedAway,
        };
      }

      await onSavePicks(isSurvivorOnly ? {} : selectedPicks, tiebreaker, eliminatorPick || undefined);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSurvivorButton = (teamId: string, isSelected: boolean, isGameLocked: boolean) => {
    if (!eliminatorEnabled) return null;

    const isUsed = usedEliminatorTeams?.includes(teamId);
    const isCurrentElimPick = eliminatorPick === teamId;

    // In combined mode, only offer the button on teams picked to win.
    // In survivor-only mode, every team gets the button.
    if (!isSurvivorOnly && !isSelected && !isCurrentElimPick) return null;

    if (isGameLocked && !isCommissionerEditMode) {
      if (isCurrentElimPick) {
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-fuchsia-600 text-white shadow-xs whitespace-nowrap">
            <Target className="w-3 h-3" />
            <span>Survivor</span>
          </div>
        );
      }
      return null;
    }

    const disabled = !isCommissionerEditMode && isUsed && !isCurrentElimPick;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setEliminatorPick(isCurrentElimPick ? "" : teamId);
          setSaveSuccess(false);
        }}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm whitespace-nowrap
          ${isCurrentElimPick
            ? "bg-fuchsia-600 text-white shadow-fuchsia-200 dark:shadow-none hover:bg-fuchsia-500"
            : isUsed
              ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              : "bg-white dark:bg-slate-800 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-900/80 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/40"
          }`}
      >
        <Target className="w-3 h-3" />
        {isCurrentElimPick ? "Survivor" : isUsed ? "Used" : "Make Survivor"}
      </button>
    );
  };

  const totalGamesCount = games.length;
  const pickedCount = games.filter((g) => selectedPicks[g.id]).length;

  const survivorTeam = (() => {
    if (!eliminatorPick) return null;
    for (const g of games) {
      if (g.homeTeam.id === eliminatorPick) return g.homeTeam;
      if (g.awayTeam.id === eliminatorPick) return g.awayTeam;
    }
    return null;
  })();

  const formatGameDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    } catch {
      return dateStr;
    }
  };

  const sortedGames = [...games].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const now = Date.now();
  const allGamesLocked = games.length > 0 && games.every((g) => {
    return g.status.completed || g.status.state === "in" || now >= new Date(g.date).getTime();
  });

  const userElimStatus = eliminatorStatus?.find((s) => s.userId === currentUser.id);
  const isUserEliminated = userElimStatus?.status === "Eliminated";
  const eliminatedWeek = userElimStatus?.eliminatedWeek;
  const aliveCount = eliminatorStatus?.filter((s) => s.status === "Alive").length ?? 0;
  const totalCount = totalMembersCount || eliminatorStatus?.length || 0;

  const upcomingGames = sortedGames.filter(
    (g) => !g.status.completed && g.status.state !== "in" && new Date(g.date).getTime() > now
  );
  const nextGame = upcomingGames[0];

  return (
    <div className="space-y-4 pb-2 sm:pb-0">
      {/* Week Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Week {activeWeek} {isSurvivorOnly ? "Survivor Pick" : "Picks"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Picking as <strong className="text-slate-800 dark:text-slate-200">{currentUser.name}</strong></p>
        </div>

        {nextGame && !eliminatorEnabled && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Next kickoff: <strong className="text-slate-800 dark:text-slate-200">{formatGameDate(nextGame.date)}</strong></span>
          </div>
        )}
      </div>

      {allGamesLocked && !isCommissionerEditMode && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 font-semibold shadow-xs">
          <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span>Week {activeWeek} is closed. All games have already started or concluded.</span>
        </div>
      )}

      {/* Survivor Pool Health & Status Banner */}
      {eliminatorEnabled && (
        <div
          className={`rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-colors ${
            isUserEliminated
              ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              : "bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-800/60"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Player Status & Remaining Survivors */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white shadow-xs">
                <Target className="w-3.5 h-3.5 text-fuchsia-400" />
                Survivor
              </span>

              <div
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                  isUserEliminated
                    ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                    : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                }`}
              >
                {isUserEliminated ? (
                  <>
                    <Skull className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>
                      {isCommissionerEditMode ? `${currentUser.name} Eliminated` : "Eliminated"}
                      {eliminatedWeek ? ` (Wk ${eliminatedWeek})` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isCommissionerEditMode ? `${currentUser.name} is Alive` : "You are Alive"}</span>
                  </>
                )}
              </div>

              {totalCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1 rounded-full">
                  <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>
                    <strong className="text-slate-900 dark:text-white">{aliveCount}</strong> of {totalCount} survivors alive
                  </span>
                </div>
              )}
            </div>

            {/* Right: Kickoff / Deadline */}
            <div className="flex items-center gap-2 text-xs">
              {nextGame ? (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium bg-white/60 dark:bg-slate-800/60 sm:bg-transparent px-2 sm:px-0 py-1 sm:py-0 rounded-lg sm:rounded-none">
                  <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>
                    Next kickoff: <strong className="text-slate-800 dark:text-slate-200">{formatGameDate(nextGame.date)}</strong>
                  </span>
                </div>
              ) : allGamesLocked ? (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>All Week {activeWeek} games locked</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Matchups Grid */}
      <div className="flex flex-col gap-3">
        {sortedGames.map((game) => {
          const isTiebreaker = !isSurvivorOnly && game.isTiebreakerGame;
          const isCompleted = game.status.completed;
          const isLive = game.status.state === "in";

          const gameTime = new Date(game.date).getTime();
          let isGameLocked = isCompleted || isLive || now >= gameTime;
          if (!isGameLocked && lockPolicy !== "game") {
            if (lockPolicy === "week") {
              const firstGameOfWeek = Math.min(...games.map(g => new Date(g.date).getTime()));
              if (now >= firstGameOfWeek) isGameLocked = true;
            } else if (lockPolicy === "day") {
              const gameDateStr = new Date(game.date).toDateString();
              const firstGameOfDay = Math.min(...games.filter(g => new Date(g.date).toDateString() === gameDateStr).map(g => new Date(g.date).getTime()));
              if (now >= firstGameOfDay) isGameLocked = true;
            }
          }

          if (isCommissionerEditMode) isGameLocked = false;

          // In survivor-only mode, the only "pick" in a game is the survivor team (if it's in this game).
          const survivorInGame =
            eliminatorPick === game.homeTeam.id || eliminatorPick === game.awayTeam.id
              ? eliminatorPick
              : undefined;
          const userPick = isSurvivorOnly ? survivorInGame : selectedPicks[game.id];

          const awaySelected = userPick === game.awayTeam.id;
          const homeSelected = userPick === game.homeTeam.id;

          const isAwayWinner = isCompleted && game.winnerTeamId === game.awayTeam.id;
          const isHomeWinner = isCompleted && game.winnerTeamId === game.homeTeam.id;

          const userPickedWinner = isCompleted && userPick === game.winnerTeamId;
          const userPickedLoser = isCompleted && userPick && userPick !== game.winnerTeamId;

          // Row highlight: green for pick'em selections, rose for the survivor team in survivor-only mode
          const selectedRowClass = isSurvivorOnly
            ? "bg-rose-50/80 dark:bg-rose-950/40"
            : "bg-emerald-50/80 dark:bg-emerald-950/40";
          const selectedTextClass = isSurvivorOnly
            ? "text-rose-900 dark:text-rose-200"
            : "text-emerald-900 dark:text-emerald-200";
          const rowInteractive = !isSurvivorOnly && !(isGameLocked && lockPolicy);

          return (
            <div
              key={game.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-xs flex flex-col transition-colors ${
                isTiebreaker
                  ? "border-amber-300 dark:border-amber-700 ring-1 ring-amber-300/50 dark:ring-amber-700/50"
                  : isLive
                  ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-300/30 dark:ring-emerald-700/30"
                  : userPickedWinner
                  ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/10 dark:bg-emerald-950/10"
                  : userPickedLoser
                  ? "border-rose-300 dark:border-rose-900 bg-rose-50/10 dark:bg-rose-950/10"
                  : isSurvivorOnly && survivorInGame
                  ? "border-rose-300 dark:border-rose-800"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Game Status Header */}
              <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatGameDate(game.date)}</span>
                  {game.odds?.details && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span>{game.odds.details}</span>
                    </>
                  )}
                  {isGameLocked && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isTiebreaker && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> TB
                    </span>
                  )}
                  {isCompleted ? (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Final</span>
                  ) : isLive ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300/60 dark:border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{game.status.detail || "Live"}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Teams Matchup Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
                {[
                  { team: game.awayTeam, score: game.awayScore, selected: awaySelected, isWinner: isAwayWinner, fallback: "Away" },
                  { team: game.homeTeam, score: game.homeScore, selected: homeSelected, isWinner: isHomeWinner, fallback: "Home" },
                ].map(({ team, score, selected, isWinner, fallback }) => (
                  <div
                    key={team.id}
                    role={rowInteractive ? "button" : undefined}
                    tabIndex={rowInteractive ? 0 : undefined}
                    onClick={() => handlePickSelect(game.id, team.id, isGameLocked)}
                    className={`flex-1 min-w-0 p-3 flex items-center justify-between transition-colors ${
                      selected ? selectedRowClass : rowInteractive ? "hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""
                    } ${rowInteractive ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TeamLogo
                        src={team.logo}
                        alt={team.abbreviation || team.name}
                        width={28}
                        height={28}
                        className="w-7 h-7 object-contain shrink-0"
                      />
                      <div className="text-left min-w-0">
                        <div className={`text-sm font-bold leading-tight truncate ${selected ? selectedTextClass : "text-slate-900 dark:text-white"}`}>
                          {team.displayName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{team.record || fallback}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {renderSurvivorButton(team.id, selected, isGameLocked)}
                      {selected && !isSurvivorOnly && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      {(isCompleted || isLive) && typeof score === "number" && (
                        <span className={`text-lg font-black min-w-[28px] text-right tabular-nums ${isWinner ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
                          {score}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Completed Game Result Status */}
              {isCompleted && userPick && (
                <div className="bg-slate-50 dark:bg-slate-800/70 px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center text-xs">
                  {userPickedWinner ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {isSurvivorOnly ? "Survived" : "Correct"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                      <XCircle className="w-3.5 h-3.5" /> {isSurvivorOnly ? "Eliminated" : "Incorrect"}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tiebreaker Section (Pick'em only) */}
      {!isSurvivorOnly && tiebreakerGame && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 shadow-xs mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">Tiebreaker Prediction</h3>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                {tiebreakerGame.awayTeam.displayName} @ {tiebreakerGame.homeTeam.displayName}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/60 shadow-xs">
                <div className="flex items-center gap-2">
                  <TeamLogo
                    src={tiebreakerGame.awayTeam.logo}
                    alt={tiebreakerGame.awayTeam.abbreviation}
                    width={22}
                    height={22}
                    className="w-5.5 h-5.5 object-contain shrink-0"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-8 text-right">{tiebreakerGame.awayTeam.abbreviation}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={awayScoreInput}
                    onChange={(e) => { setAwayScoreInput(e.target.value); setSaveSuccess(false); }}
                    className="w-12 h-8 text-center text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>
                <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={homeScoreInput}
                    onChange={(e) => { setHomeScoreInput(e.target.value); setSaveSuccess(false); }}
                    className="w-12 h-8 text-center text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-8">{tiebreakerGame.homeTeam.abbreviation}</span>
                  <TeamLogo
                    src={tiebreakerGame.homeTeam.logo}
                    alt={tiebreakerGame.homeTeam.abbreviation}
                    width={22}
                    height={22}
                    className="w-5.5 h-5.5 object-contain shrink-0"
                  />
                </div>
                <div className="border-l border-slate-100 dark:border-slate-800 pl-3 ml-1 flex flex-col items-center justify-center min-w-[40px]">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Total</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{calculatedTotal ?? '--'}</span>
                </div>
              </div>
            </div>
          </div>

          {tiebreakerGame.status.completed && calculatedTotal !== null && typeof tiebreakerGame.homeScore === "number" && typeof tiebreakerGame.awayScore === "number" && (
            <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-900/40 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-600 dark:text-slate-400">
              <div>
                Actual: <strong className="text-slate-900 dark:text-white">{tiebreakerGame.awayScore} - {tiebreakerGame.homeScore}</strong> (Total: {tiebreakerGame.awayScore + tiebreakerGame.homeScore})
              </div>
              <div className="flex gap-3">
                <span>Total Diff: <strong className="text-amber-700 dark:text-amber-400">±{Math.abs(calculatedTotal - (tiebreakerGame.awayScore + tiebreakerGame.homeScore))}</strong></span>
                <span>Home Diff: <strong className="text-slate-900 dark:text-white">±{Math.abs(parsedHome - tiebreakerGame.homeScore)}</strong></span>
                <span>Away Diff: <strong className="text-slate-900 dark:text-white">±{Math.abs(parsedAway - tiebreakerGame.awayScore)}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick-Save Bar */}
      {(!allGamesLocked || isCommissionerEditMode) && (
        <div className={`z-40 w-full max-w-md mx-auto ${embedded ? "mt-6" : "fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom-2 duration-150 w-[calc(100%-24px)]"}`}>
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white rounded-full p-2 pl-4 flex items-center justify-between shadow-2xl border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {isSurvivorOnly ? (
                <>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${survivorTeam ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
                  {survivorTeam && (
                    <TeamLogo
                      src={survivorTeam.logo}
                      alt={survivorTeam.abbreviation}
                      width={18}
                      height={18}
                      className="w-4.5 h-4.5 object-contain shrink-0"
                    />
                  )}
                  <div className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                    {survivorTeam ? `Survivor: ${survivorTeam.displayName}` : "No survivor selected"}
                  </div>
                </>
              ) : (
                <>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    pickedCount === totalGamesCount && (!eliminatorEnabled || isUserEliminated || !!survivorTeam)
                      ? "bg-emerald-500"
                      : "bg-amber-400 animate-pulse"
                  }`} />
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap">
                    {pickedCount} / {totalGamesCount} Picks
                  </div>
                  {eliminatorEnabled && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 text-xs select-none">|</span>
                      {isUserEliminated && !isCommissionerEditMode ? (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                          Eliminated
                        </span>
                      ) : survivorTeam ? (
                        <div
                          className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/40 px-2 py-0.5 rounded-full text-rose-700 dark:text-rose-300 text-xs font-bold truncate"
                          title={`Survivor: ${survivorTeam.displayName}`}
                        >
                          <TeamLogo
                            src={survivorTeam.logo}
                            alt={survivorTeam.abbreviation}
                            width={15}
                            height={15}
                            className="w-3.5 h-3.5 object-contain shrink-0"
                          />
                          <span className="truncate">{survivorTeam.abbreviation}</span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold whitespace-nowrap"
                          title="No survivor team selected for this week"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                          <span>No Survivor</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm transition shadow-sm flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
