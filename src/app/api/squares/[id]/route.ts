import { NextResponse } from "next/server";
import { adminDb, requireUser, HttpError } from "@/lib/server-auth";
import { validateAndSanitizeBoard, generateOwnerKey } from "@/lib/squares-validation";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`squares_get:${ip}`, 120, 60_000);

    const { id } = await params;
    let poolId = (id || "").trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    const db = adminDb();
    let docSnap = await db.collection("squares_pools").doc(poolId).get();

    if (!docSnap.exists) {
      // Try opposite casing
      const altId = poolId === poolId.toUpperCase() ? poolId.toLowerCase() : poolId.toUpperCase();
      const altSnap = await db.collection("squares_pools").doc(altId).get();
      if (altSnap.exists) {
        docSnap = altSnap;
        poolId = altId;
      } else if (!poolId.toLowerCase().startsWith("sb-")) {
        // Try legacy sb- prefix
        const legacySnap = await db.collection("squares_pools").doc(`sb-${poolId.toLowerCase()}`).get();
        if (legacySnap.exists) {
          docSnap = legacySnap;
          poolId = `sb-${poolId.toLowerCase()}`;
        }
      }
    }

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const data = docSnap.data();

    // NEVER leak the ownerKey in public GET responses
    const rawBoard = data?.board || data;
    let safeBoard;
    try {
      safeBoard = validateAndSanitizeBoard(rawBoard);
    } catch {
      safeBoard = rawBoard;
    }

    // If caller is authenticated, automatically associate this pool with their account
    const joinCode = data?.joinCode || poolId.replace(/^sb-/, "").toUpperCase();
    const headerKey = request.headers.get("x-owner-key") || "";
    let isCreator = false;
    let callerUser = null;
    try {
      callerUser = await requireUser(request);
      if (callerUser && callerUser.uid) {
        if (data?.creatorUserId) {
          isCreator = data.creatorUserId === callerUser.uid;
        } else {
          // Legacy pool fallback
          const isOwnerByStorageKey = Boolean(data?.ownerKey && headerKey && headerKey === data.ownerKey);
          const isOwnerByEmail = Boolean(data?.creatorEmail && callerUser.email && data.creatorEmail === callerUser.email);
          isCreator = isOwnerByStorageKey || isOwnerByEmail;
          if (isCreator) {
            await docSnap.ref.set(
              {
                creatorUserId: callerUser.uid,
                creatorEmail: callerUser.email || data?.creatorEmail || "",
                joinCode,
              },
              { merge: true }
            );
          }
        }

        // Only register a membership if the caller is the CREATOR (so it appears in "Boards You Run").
        // Do NOT silently register regular viewers as members just for viewing a shared link.
        if (isCreator) {
          const membershipRef = db.collection("squares_memberships").doc(`${callerUser.uid}_${poolId}`);
          await membershipRef.set(
            {
              userId: callerUser.uid,
              userEmail: callerUser.email || "",
              poolId,
              joinCode,
              poolTitle: rawBoard?.title || "Super Bowl Squares",
              topTeam: rawBoard?.topTeam || "Team 1",
              leftTeam: rawBoard?.leftTeam || "Team 2",
              role: "commissioner",
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
    } catch {
      // Unauthenticated viewers are permitted
      if (!data?.creatorUserId && data?.ownerKey && headerKey && headerKey === data.ownerKey) {
        isCreator = true;
      }
    }

    let creatorVenmoHandle: string = data?.board?.venmoHandle || data?.venmoHandle || "";
    const creatorUid = data?.creatorUserId || (isCreator && callerUser?.uid ? callerUser.uid : null);
    if (!creatorVenmoHandle && creatorUid) {
      try {
        const creatorDoc = await db.collection("users").doc(creatorUid).get();
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

    return NextResponse.json({
      success: true,
      id: poolId,
      joinCode,
      board: safeBoard,
      creatorUserId: data?.creatorUserId || null,
      creatorName: data?.creatorName || null,
      creatorVenmoHandle: creatorVenmoHandle || null,
      isOwner: isCreator,
      role: isCreator ? "commissioner" : (callerUser ? "member" : "viewer"),
      updatedAt: data?.updatedAt,
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error fetching squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to load pool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let poolId = (id || "").trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    // Rate limit: max 120 updates per minute per IP
    const ip = getClientIp(request);
    try {
      enforceRateLimit(`squares_update:${ip}`, 120, 60_000, "Too many updates. Please wait a moment.");
    } catch (rateErr: unknown) {
      const msg = rateErr instanceof Error ? rateErr.message : "Rate limit exceeded";
      return NextResponse.json({ error: msg }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { board: rawBoard } = body || {};
    if (!rawBoard) {
      return NextResponse.json({ error: "Missing board payload" }, { status: 400 });
    }

    let board;
    try {
      board = validateAndSanitizeBoard(rawBoard);
    } catch (valErr: unknown) {
      const msg = valErr instanceof Error ? valErr.message : "Invalid board data";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const db = adminDb();
    let poolRef = db.collection("squares_pools").doc(poolId);
    let docSnap = await poolRef.get();

    if (!docSnap.exists) {
      const altId = poolId === poolId.toUpperCase() ? poolId.toLowerCase() : poolId.toUpperCase();
      const altSnap = await db.collection("squares_pools").doc(altId).get();
      if (altSnap.exists) {
        docSnap = altSnap;
        poolId = altId;
        poolRef = db.collection("squares_pools").doc(poolId);
      } else if (!poolId.toLowerCase().startsWith("sb-")) {
        const legacySnap = await db.collection("squares_pools").doc(`sb-${poolId.toLowerCase()}`).get();
        if (legacySnap.exists) {
          docSnap = legacySnap;
          poolId = `sb-${poolId.toLowerCase()}`;
          poolRef = db.collection("squares_pools").doc(poolId);
        }
      }
    }

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const docData = docSnap.data();

    // Check caller authentication
    let caller = null;
    try {
      caller = await requireUser(request);
    } catch {
      // Unauthenticated caller - check legacy ownerKey fallback below
    }

    // Authorization checks:
    if (docData?.creatorUserId) {
      // Pool is owned by a user account
      const isCreator = caller && caller.uid === docData.creatorUserId;
      if (!isCreator) {
        // Fallback to legacy owner key if available
        const headerKey = request.headers.get("x-owner-key") || "";
        const bodyKey = typeof body?.ownerKey === "string" ? body.ownerKey : "";
        const providedKey = (headerKey || bodyKey).trim();
        if (!providedKey || !docData.ownerKey || providedKey !== docData.ownerKey) {
          return NextResponse.json(
            { error: "Unauthorized: only the commissioner can edit this board" },
            { status: 403 }
          );
        }
      }
    } else if (docData?.ownerKey) {
      // Legacy pool created before creatorUserId
      const headerKey = request.headers.get("x-owner-key") || "";
      const bodyKey = typeof body?.ownerKey === "string" ? body.ownerKey : "";
      const providedKey = (headerKey || bodyKey).trim();

      if (!providedKey || providedKey !== docData.ownerKey) {
        return NextResponse.json(
          { error: "Unauthorized: only the commissioner can edit this board" },
          { status: 403 }
        );
      }

      // If caller is authenticated, upgrade legacy pool to associate with their account
      if (caller?.uid) {
        await poolRef.set(
          {
            creatorUserId: caller.uid,
            creatorEmail: caller.email || "",
            creatorName: caller.email?.split("@")[0] || "Commissioner",
          },
          { merge: true }
        );
      }
    } else {
      // Legacy pool without key: claim or generate key
      if (caller?.uid) {
        await poolRef.set(
          {
            creatorUserId: caller.uid,
            creatorEmail: caller.email || "",
            creatorName: caller.email?.split("@")[0] || "Commissioner",
          },
          { merge: true }
        );
      } else {
        const newKey = generateOwnerKey();
        await poolRef.set({ ownerKey: newKey }, { merge: true });
      }
    }

    const now = new Date().toISOString();
    const oldTitle = docData?.board?.title || docData?.title || "";
    const newTitle = typeof board?.title === "string" ? board.title.trim() : "";

    await poolRef.set(
      {
        id: poolId,
        board,
        updatedAt: now,
      },
      { merge: true }
    );

    if (newTitle && newTitle !== oldTitle) {
      const joinCode = docData?.joinCode || poolId.replace(/^sb-/, "").toUpperCase();
      const possibleIds = Array.from(
        new Set([poolId, poolId.toUpperCase(), poolId.toLowerCase(), joinCode, `sb-${poolId.toLowerCase()}`])
      );
      const memSnap = await db
        .collection("squares_memberships")
        .where("poolId", "in", possibleIds)
        .get();
      if (!memSnap.empty) {
        const batch = db.batch();
        memSnap.docs.forEach((mDoc) => {
          batch.update(mDoc.ref, { poolTitle: newTitle });
        });
        await batch.commit().catch(() => {});
      }
    }

    return NextResponse.json({ success: true, id: poolId });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error updating squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to update pool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);
    enforceRateLimit(`squares_delete:${caller.uid}`, 20, 60_000);

    const { id } = await params;
    let poolId = (id || "").trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    const db = adminDb();
    let poolRef = db.collection("squares_pools").doc(poolId);
    let docSnap = await poolRef.get();

    if (!docSnap.exists) {
      const altId = poolId === poolId.toUpperCase() ? poolId.toLowerCase() : poolId.toUpperCase();
      const altSnap = await db.collection("squares_pools").doc(altId).get();
      if (altSnap.exists) {
        docSnap = altSnap;
        poolId = altId;
        poolRef = db.collection("squares_pools").doc(poolId);
      } else if (!poolId.toLowerCase().startsWith("sb-")) {
        const legacySnap = await db.collection("squares_pools").doc(`sb-${poolId.toLowerCase()}`).get();
        if (legacySnap.exists) {
          docSnap = legacySnap;
          poolId = `sb-${poolId.toLowerCase()}`;
          poolRef = db.collection("squares_pools").doc(poolId);
        }
      }
    }

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const docData = docSnap.data();

    // Verify caller is the commissioner/owner OR an orphan board with matching ownerKey
    const isOwner = docData?.creatorUserId === caller.uid;
    let isAuthorizedOrphan = false;
    if (!docData?.creatorUserId) {
      if (docData?.ownerKey) {
        const headerKey = request.headers.get("x-owner-key") || "";
        isAuthorizedOrphan = Boolean(headerKey && headerKey === docData.ownerKey);
      } else {
        // True unkeyed legacy board with no owner credentials
        isAuthorizedOrphan = true;
      }
    }

    if (!isOwner && !isAuthorizedOrphan) {
      return NextResponse.json(
        { error: "Unauthorized: only the commissioner who created this board can delete it" },
        { status: 403 }
      );
    }

    // 1. Delete the squares pool document
    await poolRef.delete();

    // 2. Delete all memberships referencing this pool
    const upperId = poolId.toUpperCase();
    const lowerId = poolId.toLowerCase();
    const joinCode = docData?.joinCode || poolId.replace(/^sb-/, "").toUpperCase();

    const membershipsSnap = await db
      .collection("squares_memberships")
      .where("poolId", "in", [poolId, upperId, lowerId, joinCode, `sb-${lowerId}`])
      .get();

    const batch = db.batch();
    for (const memDoc of membershipsSnap.docs) {
      batch.delete(memDoc.ref);
    }
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${poolId}`));
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${upperId}`));
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${lowerId}`));
    batch.delete(db.collection("squares_memberships").doc(`${caller.uid}_${joinCode}`));
    await batch.commit();

    return NextResponse.json({ success: true, message: "Board permanently deleted" });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error deleting squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to delete pool";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
