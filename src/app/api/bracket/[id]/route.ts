import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  extractBracketCode,
  rankBracketParticipants,
  calculateBracketScore,
  BracketParticipant,
  BracketPool,
  BracketPicks,
  BracketGameId,
  TiebreakerPrediction,
  BracketRoundPoints,
  DEFAULT_ROUND_POINTS,
  GAME_ROUNDS,
  TEAM_BY_ABBR,
} from "@/lib/playoff-bracket";
import { loadBracketPoolPayload, DEFAULT_BRACKET_LOCK_TIME } from "@/lib/bracket-server";

const DEFAULT_LOCK_TIME = DEFAULT_BRACKET_LOCK_TIME;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_id_get:${ip}`, 120, 60_000);

    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const db = adminDb();
    let caller: { uid: string; email?: string } | null = null;
    try {
      caller = await requireUser(request);
    } catch {
      // Optional auth on GET
    }

    const payload = await loadBracketPoolPayload(db, cleanId, caller);
    if (!payload) {
      return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...payload,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error in bracket [id] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load pool" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`bracket_post:${caller.uid}`, 60, 60_000, "Too many bracket updates. Please slow down.");

    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const db = adminDb();

    let poolRef = db.collection("bracket_pools").doc(cleanId);
    let poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanId)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        poolDoc = qSnap.docs[0];
        poolRef = poolDoc.ref;
      }
    }

    if (!poolDoc.exists) {
      return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
    }

    const poolData = poolDoc.data() as BracketPool;
    const poolId = poolDoc.id;
    const isOwner = caller.uid === poolData.creatorUserId;

    // ACTION: Rename pool (Commissioner only)
    if (body?.action === "rename") {
      if (!isOwner) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can rename this bracket" },
          { status: 403 }
        );
      }
      const newName = typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 60)
        : poolData.name;
      await poolRef.set({ name: newName, updatedAt: new Date().toISOString() }, { merge: true });

      const memSnap = await db
        .collection("bracket_memberships")
        .where("poolId", "==", poolId)
        .get();
      if (!memSnap.empty) {
        const batch = db.batch();
        memSnap.docs.forEach((mDoc) => {
          batch.update(mDoc.ref, { poolName: newName });
        });
        await batch.commit().catch(() => {});
      }

      return NextResponse.json({ success: true, name: newName });
    }

    // ACTION: Update custom round point values (Commissioner only)
    if (body?.action === "update_scoring") {
      if (!isOwner) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can customize round point values" },
          { status: 403 }
        );
      }
      const rawRP = body.roundPoints || {};
      const newRoundPoints: BracketRoundPoints = {
        wild_card: Math.max(1, Math.min(50, Math.round(Number(rawRP.wild_card) || 1))),
        divisional: Math.max(1, Math.min(50, Math.round(Number(rawRP.divisional) || 1))),
        conference: Math.max(1, Math.min(50, Math.round(Number(rawRP.conference) || 1))),
        super_bowl: Math.max(1, Math.min(50, Math.round(Number(rawRP.super_bowl) || 1))),
      };
      await poolRef.set({ roundPoints: newRoundPoints, updatedAt: new Date().toISOString() }, { merge: true });

      const results = poolData.results || {};

      // Recalculate scores for all memberships in batch
      const membersSnap = await db
        .collection("bracket_memberships")
        .where("poolId", "==", poolId)
        .get();

      const userIds = Array.from(
        new Set(membersSnap.docs.map((d) => d.data().userId).filter(Boolean))
      );
      const userMap = new Map<string, { name?: string; username?: string; avatarColor?: string }>();
      if (userIds.length > 0) {
        const userDocs = await Promise.all(
          userIds.map((uid) => db.collection("users").doc(uid).get().catch(() => null))
        );
        userDocs.forEach((uDoc) => {
          if (uDoc && uDoc.exists) {
            const u = uDoc.data();
            userMap.set(uDoc.id, {
              name: u?.name,
              username: u?.username,
              avatarColor: u?.avatarColor,
            });
          }
        });
      }

      const participantMap = new Map<string, BracketParticipant>();
      const batch = db.batch();

      membersSnap.forEach((doc) => {
        const d = doc.data();
        const uid = d.userId || doc.id;
        const scoreResult = calculateBracketScore(
          d.picks || {},
          results,
          d.tiebreaker || undefined,
          newRoundPoints
        );
        batch.update(doc.ref, { score: scoreResult.score });

        const uProfile = userMap.get(uid);
        const resolvedName = uProfile?.name || uProfile?.username || d.userName || "Participant";
        const resolvedAvatar = uProfile?.avatarColor || d.userAvatar || "bg-emerald-600";
        const p: BracketParticipant = {
          id: uid,
          userId: uid,
          userName: resolvedName,
          userAvatar: resolvedAvatar,
          picks: d.picks || {},
          tiebreaker: d.tiebreaker || undefined,
          score: scoreResult.score,
          superBowlWinner: d.picks?.super_bowl || "",
          updatedAt: d.updatedAt || "",
        };

        const existing = participantMap.get(uid);
        if (!existing) {
          participantMap.set(uid, p);
        } else {
          const existingCount = Object.keys(existing.picks || {}).length;
          const newCount = Object.keys(p.picks || {}).length;
          if (newCount > existingCount || (newCount === existingCount && p.updatedAt > existing.updatedAt)) {
            participantMap.set(uid, p);
          }
        }
      });

      if (!membersSnap.empty) {
        await batch.commit();
      }

      const rawParticipants = Array.from(participantMap.values());
      const rankedLeaderboard = rankBracketParticipants(rawParticipants, results, newRoundPoints);

      return NextResponse.json({
        success: true,
        roundPoints: newRoundPoints,
        leaderboard: rankedLeaderboard,
      });
    }

    // ACTION: Save picks & tiebreaker
    const { picks, tiebreaker, userName, userAvatar } = body || {};
    if (!picks || typeof picks !== "object" || Array.isArray(picks)) {
      return NextResponse.json({ error: "Missing picks payload" }, { status: 400 });
    }

    const validGameIds = new Set<string>(Object.keys(GAME_ROUNDS));
    const safePicks: BracketPicks = {};
    const entries = Object.entries(picks);
    if (entries.length > 20) {
      return NextResponse.json({ error: "Too many picks in payload" }, { status: 400 });
    }
    for (const [gameId, teamAbbr] of entries) {
      if (!validGameIds.has(gameId)) continue;
      if (typeof teamAbbr === "string") {
        const cleanAbbr = teamAbbr.trim().toUpperCase();
        if (TEAM_BY_ABBR[cleanAbbr]) {
          safePicks[gameId as BracketGameId] = cleanAbbr;
        }
      }
    }

    const results = poolData.results || {};
    const lockTime = poolData.lockTime || DEFAULT_LOCK_TIME;

    // Automatic lock check: locks when first game begins, any game is completed, or pool is locked
    const isAutoLocked = Boolean(
      poolData.isSimulated ||
      (results && Object.values(results).some((r: any) => r?.isCompleted)) ||
      (new Date() >= new Date(lockTime)) ||
      poolData.isLocked
    );

    if (isAutoLocked) {
      return NextResponse.json(
        { error: "This bracket is locked. Picks cannot be changed once the first game has started." },
        { status: 403 }
      );
    }

    const roundPoints = poolData.roundPoints || DEFAULT_ROUND_POINTS;

    // Validate tiebreaker if provided (only save non-zero scores)
    let cleanTiebreaker: TiebreakerPrediction | null = null;
    if (tiebreaker && typeof tiebreaker.homeScore === "number" && typeof tiebreaker.awayScore === "number") {
      const h = Math.max(0, Math.min(99, Math.round(tiebreaker.homeScore)));
      const a = Math.max(0, Math.min(99, Math.round(tiebreaker.awayScore)));
      if (h > 0 || a > 0) {
        cleanTiebreaker = {
          homeScore: h,
          awayScore: a,
          totalScore: h + a,
        };
      }
    }

    // Calculate score
    const scoreResult = calculateBracketScore(safePicks, results, cleanTiebreaker || undefined, roundPoints);
    const now = new Date().toISOString();

    let finalUserName = typeof userName === "string" ? userName.trim().slice(0, 50) : "";
    let finalUserAvatar = typeof userAvatar === "string" ? userAvatar.trim().slice(0, 40) : "";
    if (!finalUserName || !finalUserAvatar) {
      try {
        const uDoc = await db.collection("users").doc(caller.uid).get();
        if (uDoc.exists) {
          const u = uDoc.data();
          if (!finalUserName) finalUserName = u?.name || u?.username;
          if (!finalUserAvatar) finalUserAvatar = u?.avatarColor;
        }
      } catch {}
    }
    if (!finalUserName) finalUserName = caller.email?.split("@")[0] || "Participant";
    if (!finalUserAvatar) finalUserAvatar = "bg-emerald-600";

    const membershipId = `${caller.uid}_${poolId}`;
    const memRef = db.collection("bracket_memberships").doc(membershipId);

    await memRef.set(
      {
        userId: caller.uid,
        userEmail: caller.email || "",
        userName: finalUserName,
        userAvatar: finalUserAvatar,
        poolId,
        joinCode: poolData.joinCode || poolId,
        poolName: poolData.name,
        role: isOwner ? "commissioner" : "member",
        picks: safePicks,
        tiebreaker: cleanTiebreaker,
        score: scoreResult.score,
        superBowlWinner: safePicks.super_bowl || "",
        updatedAt: now,
      },
      { merge: true }
    );

    // Fetch and re-rank leaderboard
    const membersSnap = await db
      .collection("bracket_memberships")
      .where("poolId", "==", poolId)
      .get();

    const userIds = Array.from(
      new Set(membersSnap.docs.map((d) => d.data().userId).filter(Boolean))
    );
    const userMap = new Map<string, { name?: string; username?: string; avatarColor?: string }>();
    if (userIds.length > 0) {
      const userDocs = await Promise.all(
        userIds.map((uid) => db.collection("users").doc(uid).get().catch(() => null))
      );
      userDocs.forEach((uDoc) => {
        if (uDoc && uDoc.exists) {
          const u = uDoc.data();
          userMap.set(uDoc.id, {
            name: u?.name,
            username: u?.username,
            avatarColor: u?.avatarColor,
          });
        }
      });
    }

    const participantMap = new Map<string, BracketParticipant>();
    membersSnap.forEach((doc) => {
      const d = doc.data();
      const uid = d.userId || doc.id;
      const uProfile = userMap.get(uid);
      const resolvedName = uProfile?.name || uProfile?.username || d.userName || "Participant";
      const resolvedAvatar = uProfile?.avatarColor || d.userAvatar || "bg-emerald-600";
      const p: BracketParticipant = {
        id: uid,
        userId: uid,
        userName: resolvedName,
        userAvatar: resolvedAvatar,
        picks: d.picks || {},
        tiebreaker: d.tiebreaker || undefined,
        score: d.score || 0,
        superBowlWinner: d.picks?.super_bowl || "",
        updatedAt: d.updatedAt || "",
      };

      const existing = participantMap.get(uid);
      if (!existing) {
        participantMap.set(uid, p);
      } else {
        const existingCount = Object.keys(existing.picks || {}).length;
        const newCount = Object.keys(p.picks || {}).length;
        if (newCount > existingCount || (newCount === existingCount && p.updatedAt > existing.updatedAt)) {
          participantMap.set(uid, p);
        }
      }
    });

    const rawParticipants = Array.from(participantMap.values());
    const rankedLeaderboard = rankBracketParticipants(rawParticipants, results, roundPoints);

    return NextResponse.json({
      success: true,
      entry: {
        id: caller.uid,
        userId: caller.uid,
        userName: finalUserName,
        picks: safePicks,
        tiebreaker: cleanTiebreaker,
        score: scoreResult.score,
        superBowlWinner: safePicks.super_bowl || "",
        updatedAt: now,
      },
      leaderboard: rankedLeaderboard,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error updating bracket [id]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update bracket" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);
    enforceRateLimit(`bracket_delete:${caller.uid}`, 20, 60_000);

    const { id } = await params;
    const cleanId = extractBracketCode(id || "");
    if (!cleanId) {
      return NextResponse.json({ error: "Invalid bracket pool ID" }, { status: 400 });
    }

    const db = adminDb();
    let poolRef = db.collection("bracket_pools").doc(cleanId);
    let poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanId)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        poolDoc = qSnap.docs[0];
        poolRef = poolDoc.ref;
      }
    }

    if (!poolDoc.exists) {
      return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
    }

    const poolData = poolDoc.data() as BracketPool;
    const poolId = poolDoc.id;

    // Verify caller is the commissioner
    if (poolData.creatorUserId !== caller.uid) {
      return NextResponse.json(
        { error: "Unauthorized: only the commissioner who created this bracket can delete it" },
        { status: 403 }
      );
    }

    // 1. Delete the bracket pool
    await poolRef.delete();

    // 2. Delete all memberships in this pool
    const memSnap = await db
      .collection("bracket_memberships")
      .where("poolId", "==", poolId)
      .get();

    const batch = db.batch();
    for (const memDoc of memSnap.docs) {
      batch.delete(memDoc.ref);
    }
    batch.delete(db.collection("bracket_memberships").doc(`${caller.uid}_${poolId}`));
    await batch.commit();

    return NextResponse.json({ success: true, message: "Bracket pool permanently deleted" });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error deleting bracket pool:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete bracket pool" },
      { status: 500 }
    );
  }
}
