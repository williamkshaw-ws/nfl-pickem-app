export const NFL_ABBR_MAP: Record<string, string> = {
  ARI: "ARI", ATL: "ATL", BAL: "BAL", BUF: "BUF", CAR: "CAR", CHI: "CHI",
  CIN: "CIN", CLE: "CLE", DAL: "DAL", DEN: "DEN", DET: "DET", GB: "GB",
  HOU: "HOU", IND: "IND", JAX: "JAX", JAC: "JAX", KC: "KC", LV: "LV",
  LVR: "LV", OAK: "LV", LAC: "LAC", SD: "LAC", LAR: "LAR", LA: "LAR",
  STL: "LAR", MIA: "MIA", MIN: "MIN", NE: "NE", NO: "NO", NYG: "NYG",
  NYJ: "NYJ", PHI: "PHI", PIT: "PIT", SF: "SF", SEA: "SEA", TB: "TB",
  TEN: "TEN", WAS: "WAS", WSH: "WAS",
};

export const TEAM_KEYWORD_MAP: Record<string, string> = {
  cardinals: "ARI", falcons: "ATL", ravens: "BAL", bills: "BUF",
  panthers: "CAR", bears: "CHI", bengals: "CIN", browns: "CLE",
  cowboys: "DAL", broncos: "DEN", lions: "DET", packers: "GB",
  texans: "HOU", colts: "IND", jaguars: "JAX", chiefs: "KC",
  raiders: "LV", chargers: "LAC", rams: "LAR", dolphins: "MIA",
  vikings: "MIN", patriots: "NE", saints: "NO", giants: "NYG",
  jets: "NYJ", eagles: "PHI", steelers: "PIT", "49ers": "SF",
  niners: "SF", seahawks: "SEA", buccaneers: "TB", bucs: "TB",
  titans: "TEN", commanders: "WAS",
};

export function resolveTeamAbbr(input?: string): string {
  if (!input) return "";
  const raw = input.trim().toUpperCase();
  if (NFL_ABBR_MAP[raw]) return NFL_ABBR_MAP[raw];
  const lower = input.toLowerCase();
  for (const [key, val] of Object.entries(TEAM_KEYWORD_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw.slice(0, 3);
}

export function isTeamMatch(teamA?: string, teamB?: string): boolean {
  if (!teamA || !teamB) return false;
  const abbrA = resolveTeamAbbr(teamA);
  const abbrB = resolveTeamAbbr(teamB);
  if (abbrA && abbrB && abbrA === abbrB) return true;
  return teamA.toLowerCase().trim() === teamB.toLowerCase().trim();
}
