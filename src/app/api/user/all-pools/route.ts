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
        return snap.docs.map((doc) => {
          const data = doc.data();
          const leagueId = data.leagueId || doc.id.split("_")[0];
          return {
            id: leagueId,
            name: data.leagueName || "Pick'em League",
            gameType: "pickem" as const,
            role: data.role === "commissioner" || data.role === "admin" ? ("commissioner" as const) : ("member" as const),
            href: `/league/${encodeURIComponent(leagueId)}`,
            badge: data.role === "commissioner" || data.role === "admin" ? "Commish" : undefined,
          };
        });
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
        memberSnap.docs.forEach((doc) => {
          const data = doc.data();
          const poolId = data.poolId;
          if (!poolId) return;
          const cleanId = poolId.replace(/^sb-/, "").toUpperCase();
          if (!map.has(cleanId)) {
            map.set(cleanId, {
              id: cleanId,
              name: data.poolTitle || "Super Bowl Squares",
              gameType: "squares" as const,
              role: data.role === "commissioner" ? ("commissioner" as const) : ("member" as const),
              href: `/squares?id=${encodeURIComponent(cleanId)}`,
              badge: data.role === "commissioner" ? "Commish" : undefined,
            });
          }
        });

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

        // For each membership, get pool title
        await Promise.all(
          memberSnap.docs.map(async (mDoc) => {
            const mData = mDoc.data();
            const poolId = mData.poolId;
            if (!poolId) return;

            let poolName = mData.poolName;
            if (!poolName) {
              const pDoc = await db.collection("bracket_pools").doc(poolId).get();
              if (pDoc.exists) {
                poolName = pDoc.data()?.name;
              }
            }

            poolsMap.set(poolId, {
              id: poolId,
              name: poolName || "Playoff Bracket",
              gameType: "bracket" as const,
              role: mData.role === "commissioner" ? ("commissioner" as const) : ("member" as const),
              href: `/bracket?id=${encodeURIComponent(poolId)}`,
              badge: mData.role === "commissioner" ? "Commish" : undefined,
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
