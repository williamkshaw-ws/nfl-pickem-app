import type { LeagueSettings, SeasonPlayerStanding, EliminatorStatus, User } from "@/types/nfl";

export const REGULAR_SEASON_WEEKS = 18;

export interface PayoutConfig {
  weeklyFee: number;
  seasonFee: number;
  survivorFee: number;
  weeklyStartWeek: number;
  weeksCount: number;
  /** Which prize pools are active (fee > 0 and the matching game mode is on) */
  weeklyActive: boolean;
  seasonActive: boolean;
  survivorActive: boolean;
  /** Per-player total dues for the season */
  duesPerPlayer: number;
  /** True when the league is still using the old single flat entry fee */
  isLegacyFlatFee: boolean;
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? v : 0);

export function getPayoutConfig(settings: Partial<LeagueSettings>): PayoutConfig {
  const pickemOn = settings.pickemEnabled !== false;
  const survivorOn = settings.eliminatorEnabled !== false;

  const weeklyFee = num(settings.weeklyFee);
  const seasonFee = num(settings.seasonFee);
  const survivorFee = num(settings.survivorFee);
  const weeklyStartWeek = Math.min(
    REGULAR_SEASON_WEEKS,
    Math.max(1, Math.floor(num(settings.weeklyStartWeek) || 1))
  );
  const weeksCount = REGULAR_SEASON_WEEKS - weeklyStartWeek + 1;

  const weeklyActive = pickemOn && weeklyFee > 0;
  const seasonActive = pickemOn && seasonFee > 0;
  const survivorActive = survivorOn && survivorFee > 0;

  const structuredDues =
    (weeklyActive ? weeklyFee * weeksCount : 0) +
    (seasonActive ? seasonFee : 0) +
    (survivorActive ? survivorFee : 0);

  const legacyFee = num(settings.entryFee);
  const isLegacyFlatFee = weeklyFee === 0 && seasonFee === 0 && survivorFee === 0 && legacyFee > 0;

  return {
    weeklyFee,
    seasonFee,
    survivorFee,
    weeklyStartWeek,
    weeksCount,
    weeklyActive,
    seasonActive,
    survivorActive,
    duesPerPlayer: isLegacyFlatFee ? legacyFee : structuredDues,
    isLegacyFlatFee,
  };
}

export function formatMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `$${rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Human-readable breakdown, e.g. "$3 × 18 wks + $5 season + $5 survivor" */
export function describeDues(cfg: PayoutConfig): string {
  if (cfg.isLegacyFlatFee) return `${formatMoney(cfg.duesPerPlayer)} entry`;
  const parts: string[] = [];
  if (cfg.weeklyActive) parts.push(`${formatMoney(cfg.weeklyFee)} × ${cfg.weeksCount} wks`);
  if (cfg.seasonActive) parts.push(`${formatMoney(cfg.seasonFee)} season`);
  if (cfg.survivorActive) parts.push(`${formatMoney(cfg.survivorFee)} survivor`);
  return parts.join(" + ");
}

/** Venmo usernames: 3-30 chars, letters/digits/-/_ (leading @ stripped). */
export function normalizeVenmoHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const handle = raw.trim().replace(/^@+/, "");
  if (!handle) return "";
  return /^[A-Za-z0-9_-]{3,30}$/.test(handle) ? handle : null;
}

export function buildVenmoPayUrl(handle: string, amount: number, note: string): string {
  const params = new URLSearchParams({
    txn: "pay",
    audience: "private",
    recipients: handle,
    note,
  });
  if (amount > 0) params.set("amount", String(Math.round(amount * 100) / 100));
  return `https://venmo.com/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Prize ledger (commissioner only)
// ---------------------------------------------------------------------------

export type PayoutKey = string; // "week_5" | "season" | "survivor"

export const PAYOUT_KEY_REGEX = /^(week_([1-9]|1[0-8])|season|survivor)$/;

export interface PayoutRecord {
  paidOut: boolean;
  paidAt?: string | null;
}

export interface PrizeEntry {
  key: PayoutKey;
  label: string;
  kind: "weekly" | "season" | "survivor";
  winners: { id: string; name: string }[];
  /** Total pot for this prize */
  amount: number;
  /** null until a winner is decided */
  decided: boolean;
}

export function buildPrizeLedger({
  cfg,
  users,
  seasonStandings,
  eliminatorStatus,
  isSeasonOver,
}: {
  cfg: PayoutConfig;
  users: User[];
  seasonStandings: SeasonPlayerStanding[];
  eliminatorStatus: EliminatorStatus[];
  isSeasonOver: boolean;
}): PrizeEntry[] {
  const memberCount = users.length;
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name || "Player";
  const entries: PrizeEntry[] = [];

  if (cfg.weeklyActive) {
    const pot = cfg.weeklyFee * memberCount;
    for (let w = cfg.weeklyStartWeek; w <= REGULAR_SEASON_WEEKS; w++) {
      const winnerIds = seasonStandings
        .filter((s) => s.recentWeeklyScores.some((r) => r.week === w && r.isWinner))
        .map((s) => s.userId);
      if (winnerIds.length === 0) continue; // only list weeks that have been decided
      entries.push({
        key: `week_${w}`,
        label: `Week ${w}`,
        kind: "weekly",
        winners: winnerIds.map((id) => ({ id, name: nameOf(id) })),
        amount: pot,
        decided: true,
      });
    }
  }

  if (cfg.seasonActive) {
    const winners = isSeasonOver ? seasonStandings.filter((s) => s.rank === 1) : [];
    if (isSeasonOver && winners.length > 0) {
      entries.push({
        key: "season",
        label: "Season Overall",
        kind: "season",
        winners: winners.map((s) => ({ id: s.userId, name: s.userName })),
        amount: cfg.seasonFee * memberCount,
        decided: true,
      });
    }
  }

  if (cfg.survivorActive) {
    const alive = eliminatorStatus.filter((s) => s.status === "Alive");
    const anyEliminated = eliminatorStatus.some((s) => s.status === "Eliminated");
    const decided =
      memberCount >= 2 &&
      ((alive.length === 1 && anyEliminated) || (isSeasonOver && alive.length >= 1));
    if (decided && alive.length > 0) {
      entries.push({
        key: "survivor",
        label: "Survivor",
        kind: "survivor",
        winners: alive.map((s) => ({ id: s.userId, name: nameOf(s.userId) })),
        amount: cfg.survivorFee * memberCount,
        decided: true,
      });
    }
  }

  return entries;
}
