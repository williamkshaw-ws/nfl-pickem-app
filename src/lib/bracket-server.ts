import {
  rankBracketParticipants,
  BracketParticipant,
  BracketPool,
  DEFAULT_ROUND_POINTS,
} from "@/lib/playoff-bracket";

export const DEFAULT_BRACKET_LOCK_TIME = "2026-01-10T21:30:00.000Z";

export async function loadBracketPoolPayload(
  db: FirebaseFirestore.Firestore,
  cleanId: string,
  caller: { uid: string; email?: string } | null
) {
  let poolDoc = await db.collection("bracket_pools").doc(cleanId).get();
  if (!poolDoc.exists) {
    const qSnap = await db
      .collection("bracket_pools")
      .where("joinCode", "==", cleanId)
      .limit(1)
      .get();
    if (!qSnap.empty) {
      poolDoc = qSnap.docs[0];
    }
  }

  if (!poolDoc.exists) {
    return null;
  }

  const poolData = poolDoc.data() as BracketPool;
  const poolId = poolDoc.id;
  const results = poolData.results || {};
  const isOwner = caller ? caller.uid === poolData.creatorUserId : false;

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
  let currentUserEntry: BracketParticipant | null = null;
  let userRole: "commissioner" | "member" | "viewer" = "viewer";

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
    if (!existing || (p.updatedAt && (!existing.updatedAt || p.updatedAt > existing.updatedAt))) {
      participantMap.set(uid, p);
    }

    if (caller && uid === caller.uid) {
      userRole = d.role === "commissioner" || isOwner ? "commissioner" : "member";
    }
  });

  if (caller) {
    currentUserEntry = participantMap.get(caller.uid) || null;
    if (isOwner && userRole === "viewer") {
      userRole = "commissioner";
    }
  }

  const rawParticipants = Array.from(participantMap.values());
  const roundPoints = poolData.roundPoints || DEFAULT_ROUND_POINTS;
  const leaderboard = rankBracketParticipants(rawParticipants, results, roundPoints);

  const lockTime = poolData.lockTime || DEFAULT_BRACKET_LOCK_TIME;
  const isAutoLocked = Boolean(
    poolData.isSimulated ||
    (results && Object.values(results).some((r: any) => r?.isCompleted)) ||
    (new Date() >= new Date(lockTime)) ||
    poolData.isLocked
  );

  let creatorVenmoHandle = poolData.creatorVenmoHandle || poolData.venmoHandle || "";
  if (!creatorVenmoHandle && poolData.creatorUserId) {
    try {
      const creatorDoc = await db.collection("users").doc(poolData.creatorUserId).get();
      if (creatorDoc.exists) {
        const profileVenmo = (creatorDoc.data()?.venmoHandle || "").trim();
        if (profileVenmo) {
          creatorVenmoHandle = profileVenmo;
        }
      }
    } catch {
      // Non-blocking
    }
  }

  return {
    pool: {
      id: poolId,
      joinCode: poolData.joinCode || poolId,
      name: poolData.name || "Playoff Bracket Challenge",
      creatorUserId: poolData.creatorUserId,
      creatorName: poolData.creatorName,
      creatorVenmoHandle: creatorVenmoHandle || undefined,
      isLocked: isAutoLocked,
      lockTime,
      results,
      isSimulated: !!poolData.isSimulated,
      simulatedAt: poolData.simulatedAt || null,
      roundPoints,
    },
    leaderboard,
    currentUserEntry,
    isOwner,
    role: userRole,
  };
}
