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
  venmoHandle?: string;
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
    venmoHandle: obj.venmoHandle ? sanitizeString(obj.venmoHandle, 30).replace(/^@+/, "").trim() : undefined,
  };
}

export function generateOwnerKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "ok_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Safely extracts a clean squares board join code or pool ID from:
 * - A 5-letter join code (e.g. "U7VUF", "sb-u7vuf")
 * - A full URL (e.g. "https://pocketpicks.app/squares?id=U7VUF", "HTTPS://POCKETPICKS.APP/SQUARES?ID=U7VUF")
 * - A relative URL (e.g. "/squares?id=U7VUF", "?id=U7VUF")
 * - A bare domain URL (e.g. "pocketpicks.app/squares?id=U7VUF")
 */
export function extractSquaresCode(input: string): string {
  if (!input || typeof input !== "string") return "";
  let clean = input.trim();

  // 1. Check for ?id= or &id= anywhere (case-insensitive)
  const idMatch = clean.match(/[?&]id=([A-Za-z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1].replace(/^sb-/i, "").toUpperCase().trim();
  }

  // 2. Try URL parsing
  try {
    const hasProtocol = /^[a-zA-Z]+:\/\//.test(clean);
    const url = new URL(hasProtocol ? clean : `https://${clean}`);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return idFromQuery.replace(/^sb-/i, "").toUpperCase().trim();
    }
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts.pop();
    if (lastPart && lastPart.toLowerCase() !== "squares") {
      return lastPart.replace(/^sb-/i, "").toUpperCase().trim();
    }
  } catch {
    // Ignore URL parse failure
  }

  // 3. Strip any URL/path or query artifacts if slashes or ? remain
  if (clean.includes("/")) {
    clean = clean.split("/").filter(Boolean).pop() || clean;
  }
  clean = clean.split("?")[0].split("&")[0];

  // 4. Return clean uppercase code without sb- prefix
  return clean.replace(/^sb-/i, "").toUpperCase().trim();
}
