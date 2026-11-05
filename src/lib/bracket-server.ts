import {
  rankBracketParticipants,
  BracketParticipant,
  BracketPool,
  DEFAULT_ROUND_POINTS,
  PlayoffSeeds,
  PlayoffTeam,
  AFC_SEEDS,
  NFC_SEEDS,
  NFL_TEAM_META,
} from "@/lib/playoff-bracket";
import { resolveTeamAbbr } from "@/lib/nfl-teams";

export const DEFAULT_BRACKET_LOCK_TIME = "2027-01-09T21:30:00.000Z";

let cachedLiveSeeds: { seeds: PlayoffSeeds; expiresAt: number } | null = null;

export async function fetchLivePlayoffSeeds(): Promise<PlayoffSeeds> {
  const now = Date.now();
  if (cachedLiveSeeds && now < cachedLiveSeeds.expiresAt) {
    return cachedLiveSeeds.seeds;
  }

  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?type=0&level=2",
      {
        next: { revalidate: 300 },
        headers: { Accept: "application/json" },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const afc: PlayoffTeam[] = [];
      const nfc: PlayoffTeam[] = [];

      for (const child of data.children || []) {
        const confAbbr = String(child.abbreviation || "").toUpperCase();
        if (confAbbr !== "AFC" && confAbbr !== "NFC") continue;

        const entries = child.standings?.entries || [];
        const parsed: Array<{ seed: number; abbr: string; name: string; nickname: string; record?: string }> = [];

        for (const entry of entries) {
          const seedStat = entry.stats?.find(
            (s: any) => s.name === "playoffSeed" || s.type === "playoffseed"
          );
          const recordStat = entry.stats?.find(
            (s: any) => s.name === "overall" || s.type === "total"
          );
          const rawSeed = Number(seedStat?.value);
          if (!rawSeed || rawSeed < 1 || rawSeed > 16) continue;

          const rawAbbr = entry.team?.abbreviation || entry.team?.displayName || "";
          const abbr = resolveTeamAbbr(rawAbbr);
          const meta = NFL_TEAM_META[abbr];

          parsed.push({
            seed: rawSeed,
            abbr,
            name: meta?.name || entry.team?.displayName || abbr,
            nickname: meta?.nickname || entry.team?.shortDisplayName || abbr,
            record: typeof recordStat?.displayValue === "string" ? recordStat.displayValue : undefined,
          });
        }

        parsed.sort((a, b) => a.seed - b.seed);
        const top7 = parsed.slice(0, 7).map((item, idx) => ({
          seed: idx + 1,
          conference: confAbbr as "AFC" | "NFC",
          name: item.name,
          abbr: item.abbr,
          nickname: item.nickname,
          record: item.record,
        }));

        if (confAbbr === "AFC") {
          afc.push(...top7);
        } else {
          nfc.push(...top7);
        }
      }

      if (afc.length === 7 && nfc.length === 7) {
        const seeds: PlayoffSeeds = {
          afc,
          nfc,
          updatedAt: new Date().toISOString(),
          source: "live",
        };
        cachedLiveSeeds = { seeds, expiresAt: now + 5 * 60_000 };
        return seeds;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live ESPN playoff seeds, using fallback:", err);
  }

  return {
    afc: AFC_SEEDS,
    nfc: NFC_SEEDS,
    updatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

export function resolveBracketLockTime(storedLockTime?: string): string {
  if (!storedLockTime) return DEFAULT_BRACKET_LOCK_TIME;
  const d = new Date(storedLockTime);
  if (isNaN(d.getTime()) || d.getFullYear() < 2027) {
    return DEFAULT_BRACKET_LOCK_TIME;
  }
  return storedLockTime;
}

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
  const [userDocs, liveSeeds] = await Promise.all([
    userIds.length > 0
      ? Promise.all(
          userIds.map((uid) => db.collection("users").doc(uid).get().catch(() => null))
        )
      : Promise.resolve([]),
    fetchLivePlayoffSeeds(),
  ]);

  const userMap = new Map<string, { name?: string; username?: string; avatarColor?: string }>();
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

  const lockTime = resolveBracketLockTime(poolData.lockTime);
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

  const activeSeeds: PlayoffSeeds =
    isAutoLocked && poolData.seeds?.afc?.length === 7 && poolData.seeds?.nfc?.length === 7
      ? poolData.seeds
      : liveSeeds;

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
      seeds: activeSeeds,
    },
    seeds: activeSeeds,
    leaderboard,
    currentUserEntry,
    isOwner,
    role: userRole,
  };
}
