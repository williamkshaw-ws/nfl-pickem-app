import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const caller = await requireUser(request);
    const db = adminDb();

    // 1. Fetch Pick'em Leagues (batched with db.getAll)
    const pickemPromise = (async () => {
      try {
        const snap = await db.collection("memberships").where("userId", "==", caller.uid).get();
        if (snap.empty) return [];

        const rawEntries = snap.docs.map((doc) => {
          const data = doc.data();
          const leagueId = String(data.leagueId || doc.id.split("_")[0] || "").trim();
          return { data, leagueId };
        }).filter((e) => Boolean(e.leagueId));

        const uniqueIds = Array.from(new Set(rawEntries.map((e) => e.leagueId)));
        const leagueMap = new Map<string, FirebaseFirestore.DocumentData>();
        if (uniqueIds.length > 0) {
          const refs = uniqueIds.map((id) => db.collection("leagues").doc(id));
          const docs = await db.getAll(...refs);
          docs.forEach((d) => {
            if (d.exists) {
              leagueMap.set(d.id, d.data() || {});
            }
          });
        }

        const results: any[] = [];
        const seen = new Set<string>();
        for (const { data, leagueId } of rawEntries) {
          if (seen.has(leagueId)) continue;
          const lData = leagueMap.get(leagueId);
          if (!lData) continue;
          seen.add(leagueId);

          const canonicalName =
            lData.settings?.leagueName || lData.name || data.leagueName || "Pick'em League";
          const isCommish = lData.commissionerId
            ? lData.commissionerId === caller.uid
            : data.role === "commissioner" || data.role === "admin";

          results.push({
            id: leagueId,
            name: canonicalName,
            gameType: "pickem" as const,
            role: isCommish ? ("commissioner" as const) : ("member" as const),
            href: `/league/${encodeURIComponent(leagueId)}`,
            badge: isCommish ? "Commish" : undefined,
          });
        }
        return results;
      } catch (err) {
        console.error("Error fetching pickem in all-pools:", err);
        return [];
      }
    })();

    // 2. Fetch Squares Boards (batched with db.getAll)
    const squaresPromise = (async () => {
      try {
        const [createdSnap, memberSnap] = await Promise.all([
          db.collection("squares_pools").where("creatorUserId", "==", caller.uid).get(),
          db.collection("squares_memberships").where("userId", "==", caller.uid).get(),
        ]);

        const map = new Map<string, any>();

        // Created pools
        createdSnap.docs.forEach((doc) => {
          const data = doc.data();
          const poolId = doc.id;
          const joinCode = data.joinCode || poolId.replace(/^sb-/, "").toUpperCase();
          const board = data.board || {};
          map.set(joinCode, {
            id: joinCode,
            name: board.title || data.title || "Super Bowl Squares",
            gameType: "squares" as const,
            role: "commissioner" as const,
            href: `/squares?id=${encodeURIComponent(joinCode)}`,
            badge: "Commish",
          });
        });

        // Joined pools from memberships not already in createdSnap
        const pendingMemberships = memberSnap.docs
          .map((doc) => doc.data())
          .filter((data) => {
            if (!data.poolId) return false;
            const cleanId = String(data.poolId).replace(/^sb-/, "").toUpperCase();
            return !map.has(cleanId);
          });

        if (pendingMemberships.length > 0) {
          const candidateRefs: FirebaseFirestore.DocumentReference[] = [];
          const seenRefIds = new Set<string>();
          for (const data of pendingMemberships) {
            const rawPoolId = String(data.poolId);
            const cleanId = rawPoolId.replace(/^sb-/, "").toUpperCase();
            for (const candidateId of [rawPoolId, cleanId]) {
              if (!seenRefIds.has(candidateId)) {
                seenRefIds.add(candidateId);
                candidateRefs.push(db.collection("squares_pools").doc(candidateId));
              }
            }
          }

          const poolMap = new Map<string, FirebaseFirestore.DocumentData>();
          if (candidateRefs.length > 0) {
            const poolDocs = await db.getAll(...candidateRefs);
            poolDocs.forEach((d) => {
              if (d.exists) {
                const pData = d.data() || {};
                const cleanKey = (pData.joinCode || d.id.replace(/^sb-/, "")).toUpperCase();
                poolMap.set(d.id, pData);
                poolMap.set(cleanKey, pData);
              }
            });
          }

          for (const data of pendingMemberships) {
            const rawPoolId = String(data.poolId);
            const cleanId = rawPoolId.replace(/^sb-/, "").toUpperCase();
            if (map.has(cleanId)) continue;

            const pData = poolMap.get(rawPoolId) || poolMap.get(cleanId);
            const canonicalTitle =
              pData?.board?.title || pData?.title || data.poolTitle || "Super Bowl Squares";
            const isCommish = pData?.creatorUserId
              ? pData.creatorUserId === caller.uid
              : data.role === "commissioner";

            map.set(cleanId, {
              id: cleanId,
              name: canonicalTitle,
              gameType: "squares" as const,
              role: isCommish ? ("commissioner" as const) : ("member" as const),
              href: `/squares?id=${encodeURIComponent(cleanId)}`,
              badge: isCommish ? "Commish" : undefined,
            });
          }
        }

        return Array.from(map.values());
      } catch (err) {
        console.error("Error fetching squares in all-pools:", err);
        return [];
      }
    })();

    // 3. Fetch Playoff Brackets (batched with db.getAll)
    const bracketPromise = (async () => {
      try {
        const memberSnap = await db
          .collection("bracket_memberships")
          .where("userId", "==", caller.uid)
          .get();

        if (memberSnap.empty) return [];

        const rawMemberships = memberSnap.docs
          .map((d) => d.data())
          .filter((d) => Boolean(d.poolId));

        const uniquePoolIds = Array.from(new Set(rawMemberships.map((d) => String(d.poolId))));
        const bracketMap = new Map<string, FirebaseFirestore.DocumentData>();
        if (uniquePoolIds.length > 0) {
          const refs = uniquePoolIds.map((id) => db.collection("bracket_pools").doc(id));
          const docs = await db.getAll(...refs);
          docs.forEach((d) => {
            if (d.exists) {
              bracketMap.set(d.id, d.data() || {});
            }
          });
        }

        const poolsMap = new Map<string, any>();
        for (const mData of rawMemberships) {
          const poolId = String(mData.poolId);
          if (poolsMap.has(poolId)) continue;
          const pData = bracketMap.get(poolId);
          if (!pData) continue;

          const poolName = pData.name || mData.poolName || "Playoff Bracket";
          const isCommish = pData.creatorUserId
            ? pData.creatorUserId === caller.uid
            : mData.role === "commissioner";

          poolsMap.set(poolId, {
            id: poolId,
            name: poolName,
            gameType: "bracket" as const,
            role: isCommish ? ("commissioner" as const) : ("member" as const),
            href: `/bracket?id=${encodeURIComponent(poolId)}`,
            badge: isCommish ? "Commish" : undefined,
          });
        }

        return Array.from(poolsMap.values());
      } catch (err) {
        console.error("Error fetching brackets in all-pools:", err);
        return [];
      }
    })();

    const [pickemPools, squaresPools, bracketPools] = await Promise.all([
      pickemPromise,
      squaresPromise,
      bracketPromise,
    ]);

    const allPools = [...pickemPools, ...squaresPools, ...bracketPools];

    return NextResponse.json({
      success: true,
      pickemPools,
      squaresPools,
      bracketPools,
      allPools,
      totalCount: allPools.length,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error in all-pools API:", err);
    return NextResponse.json({ error: "Failed to load pools" }, { status: 500 });
  }
}
