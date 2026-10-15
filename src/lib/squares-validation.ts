export interface SquaresBoardState {
  title: string;
  topTeam: string;
  leftTeam: string;
  topNumbers: string[];
  leftNumbers: string[];
  grid: Record<string, string>;
  costPerSquare: number;
  payouts: {
    q1: string;
    q2: string;
    q3: string;
    final: string;
  };
  q1Score: { top: string; left: string };
  q2Score: { top: string; left: string };
  q3Score: { top: string; left: string };
  finalScore: { top: string; left: string };
}

const DEFAULT_TOP_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const DEFAULT_LEFT_NUMBERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function sanitizeString(val: unknown, maxLen: number, fallback = ""): string {
  if (typeof val !== "string" && typeof val !== "number") return fallback;
  const s = String(val).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val === "number" && !isNaN(val)) {
    return Math.max(min, Math.min(max, val));
  }
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }
  return fallback;
}

function sanitizeNumbersArray(arr: unknown, defaultArr: string[]): string[] {
  if (!Array.isArray(arr) || arr.length !== 10) {
    return [...defaultArr];
  }
  return arr.map((item, idx) => sanitizeString(item, 4, defaultArr[idx] || ""));
}

const GRID_KEY_REGEX = /^[0-9]_[0-9]$/;

export function validateAndSanitizeBoard(raw: unknown): SquaresBoardState {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid board payload: expected an object");
  }

  const obj = raw as Record<string, unknown>;

  // Grid sanitization: only allow valid 0_0 to 9_9 coordinates, max 60 chars per cell
  const cleanGrid: Record<string, string> = {};
  if (obj.grid && typeof obj.grid === "object") {
    const rawGrid = obj.grid as Record<string, unknown>;
    for (const [key, val] of Object.entries(rawGrid)) {
      if (GRID_KEY_REGEX.test(key) && val !== undefined && val !== null) {
        const text = sanitizeString(val, 60, "");
        if (text) {
          cleanGrid[key] = text;
        }
      }
    }
  }

  // Payouts
  const rawPayouts = (obj.payouts && typeof obj.payouts === "object" ? obj.payouts : {}) as Record<string, unknown>;
  const cleanPayouts = {
    q1: sanitizeString(rawPayouts.q1, 10, ""),
    q2: sanitizeString(rawPayouts.q2, 10, ""),
    q3: sanitizeString(rawPayouts.q3, 10, ""),
    final: sanitizeString(rawPayouts.final, 10, ""),
  };

  // Scores
  const parseScore = (s: unknown) => {
    const sc = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    return {
      top: sanitizeString(sc.top, 5, ""),
      left: sanitizeString(sc.left, 5, ""),
    };
  };

  return {
    title: sanitizeString(obj.title, 100, "Super Bowl Squares Pool"),
    topTeam: sanitizeString(obj.topTeam, 60, "Buffalo Bills"),
    leftTeam: sanitizeString(obj.leftTeam, 60, "San Francisco 49ers"),
    topNumbers: sanitizeNumbersArray(obj.topNumbers, DEFAULT_TOP_NUMBERS),
    leftNumbers: sanitizeNumbersArray(obj.leftNumbers, DEFAULT_LEFT_NUMBERS),
    grid: cleanGrid,
    costPerSquare: sanitizeNumber(obj.costPerSquare, 0, 100000, 10),
    payouts: cleanPayouts,
    q1Score: parseScore(obj.q1Score),
    q2Score: parseScore(obj.q2Score),
    q3Score: parseScore(obj.q3Score),
    finalScore: parseScore(obj.finalScore),
  };
}

export function generateOwnerKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "ok_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
