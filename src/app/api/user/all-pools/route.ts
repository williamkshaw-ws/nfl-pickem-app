import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const caller = await requireUser(request);
    const db = adminDb();

    // 1. Fetch Pick'em Leagues
    const pickemPromise = (async () => {
      try {
        const snap = await db.collection("memberships").where("userId", "==", caller.uid).get();
        const items = await Promise.all(
          snap.docs.map(async (doc) => {
            const data = doc.data();
            const leagueId = data.leagueId || doc.id.split("_")[0];
            let canonicalName = data.leagueName || "Pick'em League";
            let isCommish = data.role === "commissioner" || data.role === "admin";
            try {
              const lDoc = await db.collection("leagues").doc(leagueId).get();
              if (!lDoc.exists) return null;
              const lData = lDoc.data();
              canonicalName =
                lData?.settings?.leagueName || lData?.name || canonicalName;
              if (lData?.commissionerId) {
                isCommish = lData.commissionerId === caller.uid;
              }
            } catch {}
            return {
              id: leagueId,
              name: canonicalName,
              gameType: "pickem" as const,
              role: isCommish ? ("commissioner" as const) : ("member" as const),
              href: `/league/${encodeURIComponent(leagueId)}`,
              badge: isCommish ? "Commish" : undefined,
            };
          })
        );
        return items.filter((item): item is NonNullable<typeof item> => item !== null);
      } catch (err) {
        console.error("Error fetching pickem in all-pools:", err);
        return [];
      }
    })();

    // 2. Fetch Squares Boards
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

        // Joined pools from memberships
        await Promise.all(
          memberSnap.docs.map(async (doc) => {
            const data = doc.data();
            const poolId = data.poolId;
            if (!poolId) return;
            const cleanId = poolId.replace(/^sb-/, "").toUpperCase();
            if (map.has(cleanId)) return;

            let canonicalTitle = data.poolTitle || "Super Bowl Squares";
            let isCommish = data.role === "commissioner";
            try {
              let pDoc = await db.collection("squares_pools").doc(poolId).get();
              if (!pDoc.exists && poolId !== cleanId) {
                pDoc = await db.collection("squares_pools").doc(cleanId).get();
              }
              if (pDoc.exists) {
                const pData = pDoc.data();
                canonicalTitle =
                  pData?.board?.title || pData?.title || canonicalTitle;
                if (pData?.creatorUserId) {
                  isCommish = pData.creatorUserId === caller.uid;
                }
              }
            } catch {}

            if (!map.has(cleanId)) {
              map.set(cleanId, {
                id: cleanId,
                name: canonicalTitle,
                gameType: "squares" as const,
                role: isCommish ? ("commissioner" as const) : ("member" as const),
                href: `/squares?id=${encodeURIComponent(cleanId)}`,
                badge: isCommish ? "Commish" : undefined,
              });
            }
          })
        );

        return Array.from(map.values());
      } catch (err) {
        console.error("Error fetching squares in all-pools:", err);
        return [];
      }
    })();

    // 3. Fetch Playoff Brackets
    const bracketPromise = (async () => {
      try {
        const memberSnap = await db
          .collection("bracket_memberships")
          .where("userId", "==", caller.uid)
          .get();

        const poolsMap = new Map<string, any>();

        // For each membership, get canonical pool title and role
        await Promise.all(
          memberSnap.docs.map(async (mDoc) => {
            const mData = mDoc.data();
            const poolId = mData.poolId;
            if (!poolId) return;

            let poolName = mData.poolName;
            let isCommish = mData.role === "commissioner";
            try {
              const pDoc = await db.collection("bracket_pools").doc(poolId).get();
              if (!pDoc.exists) return;
              const pData = pDoc.data();
              poolName = pData?.name || poolName;
              if (pData?.creatorUserId) {
                isCommish = pData.creatorUserId === caller.uid;
              }
            } catch {}

            poolsMap.set(poolId, {
              id: poolId,
              name: poolName || "Playoff Bracket",
              gameType: "bracket" as const,
              role: isCommish ? ("commissioner" as const) : ("member" as const),
              href: `/bracket?id=${encodeURIComponent(poolId)}`,
              badge: isCommish ? "Commish" : undefined,
            });
          })
        );

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
