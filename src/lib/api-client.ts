"use client";
import { auth } from "@/lib/firebase";

/**
 * fetch() wrapper that attaches the signed-in user's Firebase ID token.
 * All /api/league routes require this.
 */
export async function authFetch(input: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}
