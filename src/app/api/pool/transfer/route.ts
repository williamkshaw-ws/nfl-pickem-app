import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractBracketCode } from "@/lib/playoff-bracket";

export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`pool_transfer:${caller.uid}`, 10, 60_000);

    const body = await request.json().catch(() => null);
    const { gameType, poolId, newCommissionerId } = body || {};

    if (
      !gameType ||
      !poolId ||
      !newCommissionerId ||
      !["pickem", "squares", "bracket"].includes(gameType) ||
      typeof poolId !== "string" ||
      typeof newCommissionerId !== "string"
    ) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }

    if (newCommissionerId === caller.uid) {
      return NextResponse.json({ error: "You are already the commissioner" }, { status: 400 });
    }

    const db = adminDb();

    // Verify target user exists
    const targetUserDoc = await db.collection("users").doc(newCommissionerId).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }
    const targetUserData = targetUserDoc.data()!;

    if (gameType === "pickem") {
      const cleanId = poolId.trim();
      const leagueRef = db.collection("leagues").doc(cleanId);
      const leagueDoc = await leagueRef.get();
      if (!leagueDoc.exists) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      const leagueData = leagueDoc.data()!;
      if (leagueData.commissionerId !== caller.uid) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can reassign" },
          { status: 403 }
        );
      }

      const callerMemIdRef = db.collection("memberships").doc(`${cleanId}_${caller.uid}`);
      const targetMemIdRef = db.collection("memberships").doc(`${cleanId}_${newCommissionerId}`);
      const [callerMemSnap, targetMemSnap] = await Promise.all([
        callerMemIdRef.get(),
        targetMemIdRef.get(),
      ]);

      let resolvedTargetRef = targetMemSnap.exists ? targetMemIdRef : null;
      if (!resolvedTargetRef) {
        const legacyTarget = await db
          .collection("memberships")
          .where("leagueId", "==", cleanId)
          .where("userId", "==", newCommissionerId)
          .limit(1)
          .get();
        if (!legacyTarget.empty) {
          resolvedTargetRef = legacyTarget.docs[0].ref;
        }
      }

      if (!resolvedTargetRef) {
        return NextResponse.json(
          { error: "Selected user is not a member of this league" },
          { status: 400 }
        );
      }

      let resolvedCallerRef = callerMemSnap.exists ? callerMemIdRef : null;
      if (!resolvedCallerRef) {
        const legacyCaller = await db
          .collection("memberships")
          .where("leagueId", "==", cleanId)
          .where("userId", "==", caller.uid)
          .limit(1)
          .get();
        if (!legacyCaller.empty) {
          resolvedCallerRef = legacyCaller.docs[0].ref;
        }
      }

      const batch = db.batch();
      batch.update(leagueRef, { commissionerId: newCommissionerId });
      if (resolvedCallerRef) {
        batch.set(resolvedCallerRef, { role: "member" }, { merge: true });
      }
      batch.set(resolvedTargetRef, { role: "commissioner" }, { merge: true });
      await batch.commit();

      return NextResponse.json({ success: true, message: "Commissioner role transferred" });
    } else if (gameType === "squares") {
      let cleanId = poolId.trim();
      let poolRef = db.collection("squares_pools").doc(cleanId);
      let poolDoc = await poolRef.get();

      if (!poolDoc.exists) {
        const altId = cleanId === cleanId.toUpperCase() ? cleanId.toLowerCase() : cleanId.toUpperCase();
        const altDoc = await db.collection("squares_pools").doc(altId).get();
        if (altDoc.exists) {
          poolDoc = altDoc;
          poolRef = altDoc.ref;
          cleanId = altId;
        } else if (!cleanId.toLowerCase().startsWith("sb-")) {
          const legacyDoc = await db.collection("squares_pools").doc(`sb-${cleanId.toLowerCase()}`).get();
          if (legacyDoc.exists) {
            poolDoc = legacyDoc;
            poolRef = legacyDoc.ref;
            cleanId = legacyDoc.id;
          }
        }
      }

      if (!poolDoc.exists) {
        return NextResponse.json({ error: "Squares board not found" }, { status: 404 });
      }

      const poolData = poolDoc.data()!;
      if (poolData.creatorUserId !== caller.uid) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can reassign" },
          { status: 403 }
        );
      }

      const joinCode = poolData.joinCode || cleanId.replace(/^sb-/, "").toUpperCase();
      const poolTitle = poolData.board?.title || poolData.title || "Super Bowl Squares";
      const possibleIds = Array.from(
        new Set([cleanId, cleanId.toUpperCase(), cleanId.toLowerCase(), joinCode, `sb-${cleanId.toLowerCase()}`])
      );

      // Verify target user is a member of this Squares board
      const targetMemQuery = await db
        .collection("squares_memberships")
        .where("userId", "==", newCommissionerId)
        .where("poolId", "in", possibleIds)
        .limit(1)
        .get();

      if (targetMemQuery.empty) {
        return NextResponse.json(
          { error: "Selected user is not a member of this Squares board" },
          { status: 400 }
        );
      }

      const nextCreatorName = targetUserData.name || targetUserData.username || "Commissioner";
      const batch = db.batch();
      batch.update(poolRef, {
        creatorUserId: newCommissionerId,
        creatorEmail: targetUserData.email || "",
        creatorName: nextCreatorName,
      });

      // Update memberships
      const callerMemRef = db.collection("squares_memberships").doc(`${caller.uid}_${cleanId}`);
      const targetMemRef = targetMemQuery.docs[0].ref;
      batch.set(
        callerMemRef,
        {
          userId: caller.uid,
          poolId: cleanId,
          joinCode,
          poolTitle,
          role: "member",
        },
        { merge: true }
      );
      batch.set(
        targetMemRef,
        {
          userId: newCommissionerId,
          poolId: cleanId,
          joinCode,
          poolTitle,
          role: "commissioner",
        },
        { merge: true }
      );

      await batch.commit();
      return NextResponse.json({ success: true, message: "Board ownership transferred" });
    } else if (gameType === "bracket") {
      const cleanId = extractBracketCode(poolId);
      let poolRef = db.collection("bracket_pools").doc(cleanId);
      let poolDoc = await poolRef.get();

      if (!poolDoc.exists) {
        const qSnap = await db.collection("bracket_pools").where("joinCode", "==", cleanId).limit(1).get();
        if (!qSnap.empty) {
          poolDoc = qSnap.docs[0];
          poolRef = poolDoc.ref;
        }
      }

      if (!poolDoc.exists) {
        return NextResponse.json({ error: "Bracket pool not found" }, { status: 404 });
      }

      const poolData = poolDoc.data()!;
      if (poolData.creatorUserId !== caller.uid) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can reassign" },
          { status: 403 }
        );
      }

      const targetMemRef = db.collection("bracket_memberships").doc(`${newCommissionerId}_${poolDoc.id}`);
      const targetMemSnap = await targetMemRef.get();
      let resolvedTargetRef = targetMemSnap.exists ? targetMemRef : null;
      if (!resolvedTargetRef) {
        const qMem = await db
          .collection("bracket_memberships")
          .where("poolId", "==", poolDoc.id)
          .where("userId", "==", newCommissionerId)
          .limit(1)
          .get();
        if (!qMem.empty) {
          resolvedTargetRef = qMem.docs[0].ref;
        }
      }

      if (!resolvedTargetRef) {
        return NextResponse.json(
          { error: "Selected user is not a member of this bracket pool" },
          { status: 400 }
        );
      }

      const nextCreatorName = targetUserData.name || targetUserData.username || "Commissioner";
      const batch = db.batch();
      batch.update(poolRef, {
        creatorUserId: newCommissionerId,
        creatorName: nextCreatorName,
        creatorEmail: targetUserData.email || "",
        commissionerName: nextCreatorName,
      });

      const callerMemRef = db.collection("bracket_memberships").doc(`${caller.uid}_${poolDoc.id}`);
      batch.set(callerMemRef, { role: "member" }, { merge: true });
      batch.set(resolvedTargetRef, { role: "commissioner" }, { merge: true });

      await batch.commit();
      return NextResponse.json({ success: true, message: "Bracket commissioner transferred" });
    }

    return NextResponse.json({ error: "Unsupported game type" }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error transferring commissioner role:", err);
    return NextResponse.json({ error: "Failed to transfer role" }, { status: 500 });
  }
}
