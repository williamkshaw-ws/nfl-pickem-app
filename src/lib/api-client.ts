"use client";
import { auth } from "@/lib/firebase";

/**
 * fetch() wrapper that attaches the signed-in user's Firebase ID token.
 * All /api/league routes require this.
 */
export async function authFetch(input: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  const headers = new Headers(init.headers);
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (e) {
      console.warn("Could not retrieve auth token:", e);
    }
  }
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

/**
 * Pre-fetches a league's initial payload into localStorage before navigating to /league/[id],
 * so LeagueClient renders immediately with zero skeleton flash after login or home redirect.
 */
export async function prefetchLeagueIntoCache(leagueId: string): Promise<void> {
  if (typeof window === "undefined" || !leagueId) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    localStorage.setItem("last_auth_uid", user.uid);
    const cacheKey = `league_cache_v1:${leagueId}:${user.uid}`;
    const existing = localStorage.getItem(cacheKey);
    if (existing) {
      const parsed = JSON.parse(existing) as { savedAt?: number };
      if (parsed?.savedAt && Date.now() - parsed.savedAt < 30_000) {
        return;
      }
    }
    const res = await authFetch(`/api/league/${leagueId}`);
    if (!res.ok) return;
    const json = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: json }));
  } catch {
    // Non-critical optimization; LeagueClient will still fetch on mount
  }
}
