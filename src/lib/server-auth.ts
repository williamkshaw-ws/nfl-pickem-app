import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase-admin";

/** Error carrying an HTTP status so route handlers can return a clean response. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function adminDb() {
  return getFirestore();
}

/**
 * Verifies the Firebase ID token in `Authorization: Bearer <token>`.
 * Never trust a userId sent in the request body or query string.
 */
export async function requireUser(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) throw new HttpError(401, "Not signed in");
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    return { uid: decoded.uid, email: decoded.email, emailVerified: !!decoded.email_verified };
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }
}

/** Loads the league and the caller's membership. Throws 404 / 403 as appropriate. */
export async function requireMember(leagueId: string, uid: string) {
  if (!/^\d{5}$/.test(leagueId)) throw new HttpError(404, "League not found");
  const db = adminDb();
  const [leagueSnap, memberSnap] = await Promise.all([
    db.collection("leagues").doc(leagueId).get(),
    db.collection("memberships").doc(`${leagueId}_${uid}`).get(),
  ]);
  if (!leagueSnap.exists) throw new HttpError(404, "League not found");
  const league = leagueSnap.data()!;
  const isCommissioner = league.commissionerId === uid;
  if (!memberSnap.exists && !isCommissioner) throw new HttpError(403, "You are not a member of this league");
  return { league, isCommissioner };
}

export async function requireCommissioner(leagueId: string, uid: string) {
  const ctx = await requireMember(leagueId, uid);
  if (!ctx.isCommissioner) throw new HttpError(403, "Only the commissioner can do that");
  return ctx;
}

/** Converts thrown errors to JSON responses without leaking internal details. */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/** A game is locked once it has kicked off (or is live/final). */
export function isGameStarted(game: any, now = Date.now()) {
  return !!game?.status?.completed || game?.status?.state === "in" || new Date(game?.date).getTime() <= now;
}

/** Applies the league's lock policy (game/day/week) to decide if a game is locked. */
export function isGameLocked(game: any, weekGames: any[], lockPolicy: string, now = Date.now()) {
  if (isGameStarted(game, now)) return true;
  if (lockPolicy === "week") {
    const first = Math.min(...weekGames.map((g) => new Date(g.date).getTime()));
    return now >= first;
  }
  if (lockPolicy === "day") {
    const day = new Date(game.date).toDateString();
    const first = Math.min(
      ...weekGames.filter((g) => new Date(g.date).toDateString() === day).map((g) => new Date(g.date).getTime())
    );
    return now >= first;
  }
  return false;
}
