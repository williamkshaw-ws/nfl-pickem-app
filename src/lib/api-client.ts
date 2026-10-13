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
