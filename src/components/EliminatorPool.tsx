"use client";
import Image from "next/image";
import { TeamLogo } from "./TeamLogo";

import React from "react";
import { User, EliminatorStatus, Game } from "@/types/nfl";
import { Target, Skull, Trophy, Check, X } from "lucide-react";

interface EliminatorPoolProps {
  users: User[];
  eliminatorStatus: EliminatorStatus[];
  activeWeek: number;
  availableWeeks: number[];
  currentUserId?: string;
}

export function EliminatorPool({
  users,
  eliminatorStatus,
  activeWeek,
  availableWeeks,
  currentUserId,
}: EliminatorPoolProps) {
  // Sort users: Alive first, then by eliminated week (latest first)
  const sortedUsers = [...users].sort((a, b) => {
    const statusA = eliminatorStatus.find(s => s.userId === a.id);
    const statusB = eliminatorStatus.find(s => s.userId === b.id);
    
    if (statusA?.status === "Alive" && statusB?.status !== "Alive") return -1;
    if (statusB?.status === "Alive" && statusA?.status !== "Alive") return 1;
    
    if (statusA?.eliminatedWeek && statusB?.eliminatedWeek) {
      return statusB.eliminatedWeek - statusA.eliminatedWeek;
    }
    return a.name.localeCompare(b.name);
  });


  const weeksToDisplay = Array.from({ length: 18 }, (_, i) => i + 1);

  const alivePlayers = sortedUsers.filter(u => {
    const s = eliminatorStatus.find(status => status.userId === u.id);
    return s?.status === "Alive";
  });

  let survivorMessage: React.ReactNode = null;
  
  if (alivePlayers.length === 1) {
    survivorMessage = (
      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-xl text-sm font-bold">
        <Trophy className="w-4 h-4 text-amber-500" />
        <span><strong className="font-black">{alivePlayers[0].name}</strong> is the Sole Survivor!</span>
      </div>
    );
  } else if (alivePlayers.length === 0 && sortedUsers.length > 0) {
    const maxWeek = Math.max(...eliminatorStatus.map(s => s.eliminatedWeek || 0));
    const longestSurvivors = sortedUsers.filter(u => {
      const s = eliminatorStatus.find(status => status.userId === u.id);
      return s?.eliminatedWeek === maxWeek;
    });
    
    if (longestSurvivors.length === 1) {
      survivorMessage = (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span><strong className="font-black">{longestSurvivors[0].name}</strong> wins by surviving the longest (Out Wk {maxWeek})!</span>
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Survivor Pool</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Pick one winner every week. Lose or tie and you&apos;re out.</p>
        </div>
      </div>

      {survivorMessage}

      {/* Survivor Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/80">
              <th className="p-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[200px]">
                Player
              </th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider w-[120px]">
                Status
              </th>
              {weeksToDisplay.map((w) => (
                <th key={w} className="p-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider text-center min-w-[90px]">
                  Wk {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
            {sortedUsers.map((user) => {
              const statusObj = eliminatorStatus.find(s => s.userId === user.id);
              const isAlive = statusObj?.status === "Alive";
              const isMe = user.id === currentUserId;

              return (
                <tr
                  key={user.id}
                  className={`group transition-colors ${
                    isMe
                      ? "bg-emerald-100/60 dark:bg-emerald-950/50 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/70"
                      : !isAlive
                      ? "bg-slate-50/30 dark:bg-slate-900/40 opacity-75 grayscale-[0.5]"
                      : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <td className={`p-3 ${isMe ? "border-l-4 border-emerald-500 pl-2" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${user.avatarColor || "bg-emerald-600"} text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-2xs`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    {isAlive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        <Trophy className="w-3 h-3" /> Alive
                      </span>
                    ) : (
                      <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Skull className="w-3 h-3" /> Out Wk {statusObj?.eliminatedWeek}
                      </span>
                    )}
                  </td>
                  {weeksToDisplay.map((w) => {
                    const pick = statusObj?.picksByWeek[w];
                    
                    return (
                      <td key={w} className="p-3 text-center border-l border-slate-100/50 dark:border-slate-800/60 whitespace-nowrap">
                        {pick ? (
                          pick.teamId === "HIDDEN" || pick.abbreviation?.toLowerCase() === "hidden" ? (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                              Hidden
                            </span>
                          ) : (
                            <div className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded font-bold transition-colors ${
                              pick.result === "won" ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/60" : 
                              pick.result === "lost" ? "text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/60" : 
                              "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
                            }`}>
                              <TeamLogo
                                src={pick.logo}
                                alt={pick.abbreviation}
                                width={14}
                                height={14}
                                className="w-3.5 h-3.5 object-contain shrink-0"
                              />
                              <span className="text-xs">{pick.abbreviation}</span>
                              {pick.result === "won" && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
                              {pick.result === "lost" && <X className="w-3 h-3 text-rose-600 dark:text-rose-400 flex-shrink-0" />}
                            </div>
                          )
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
