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
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(leagueId)) throw new HttpError(404, "League not found");
  const db = adminDb();
  const [leagueSnap, memberSnap] = await Promise.all([
    db.collection("leagues").doc(leagueId).get(),
    db.collection("memberships").doc(`${leagueId}_${uid}`).get(),
  ]);
  if (!leagueSnap.exists) throw new HttpError(404, "League not found");
  const league = leagueSnap.data()!;
  const isCommissioner = league.commissionerId === uid;
  if (!memberSnap.exists && !isCommissioner) {
    const legacySnap = await db.collection("memberships")
      .where("leagueId", "==", leagueId)
      .where("userId", "==", uid)
      .limit(1)
      .get();
    if (legacySnap.empty) {
      throw new HttpError(403, "You are not a member of this league");
    }
  }
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

/**
 * Automatically reassigns the commissioner role to the next oldest active member of the league.
 * If no eligible members remain in the league, the league is safely cleaned up.
 */
export async function reassignLeagueCommissioner(
  db: FirebaseFirestore.Firestore,
  leagueId: string,
  currentCommissionerId: string
): Promise<{ newCommissionerId: string | null; leagueDeleted: boolean }> {
  // Find all memberships in the league
  const membersSnap = await db
    .collection("memberships")
    .where("leagueId", "==", leagueId)
    .get();

  const otherMembers = membersSnap.docs
    .filter((doc) => {
      const data = doc.data();
      return data.userId && data.userId !== currentCommissionerId;
    })
    .map((doc) => ({
      docRef: doc.ref,
      userId: doc.data().userId as string,
      joinedAt: doc.data().joinedAt as string | undefined,
    }));

  // Exclude any banned users from being eligible to become commissioner
  const eligibleMembers: typeof otherMembers = [];
  for (const m of otherMembers) {
    const userDoc = await db.collection("users").doc(m.userId).get();
    if (userDoc.exists && userDoc.data()?.banned) {
      continue;
    }
    eligibleMembers.push(m);
  }

  if (eligibleMembers.length > 0) {
    // Sort by joinedAt ascending (earliest joined member becomes new commissioner)
    eligibleMembers.sort((a, b) => {
      const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      return timeA - timeB;
    });

    const nextCommish = eligibleMembers[0];

    const batch = db.batch();
    // 1. Update league document with new commissionerId
    batch.update(db.collection("leagues").doc(leagueId), {
      commissionerId: nextCommish.userId,
    });
    // 2. Promote next member in memberships
    batch.update(nextCommish.docRef, {
      role: "commissioner",
    });
    await batch.commit();

    return { newCommissionerId: nextCommish.userId, leagueDeleted: false };
  } else {
    // No other eligible members remain in this league: delete the empty league
    const batch = db.batch();
    batch.delete(db.collection("leagues").doc(leagueId));

    // Clean up any picks for this league
    const picksSnap = await db
      .collection("picks")
      .where("leagueId", "==", leagueId)
      .get();
    picksSnap.docs.forEach((doc) => batch.delete(doc.ref));

    // Clean up remaining memberships
    membersSnap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
    return { newCommissionerId: null, leagueDeleted: true };
  }
}
