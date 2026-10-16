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
    const poolId = (id || "").toLowerCase().trim();
    if (!poolId) {
      return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
    }

    const db = adminDb();
    const docSnap = await db.collection("squares_pools").doc(poolId).get();

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
    try {
      const caller = await requireUser(request);
      if (caller && caller.uid) {
        const isCreator = data?.creatorUserId === caller.uid;
        const membershipRef = db.collection("squares_memberships").doc(`${caller.uid}_${poolId}`);
        await membershipRef.set(
          {
            userId: caller.uid,
            userEmail: caller.email || "",
            poolId,
            joinCode,
            poolTitle: rawBoard?.title || "Super Bowl Squares",
            topTeam: rawBoard?.topTeam || "Team 1",
            leftTeam: rawBoard?.leftTeam || "Team 2",
            role: isCreator ? "commissioner" : "member",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch {
      // Unauthenticated viewers are permitted
    }

    return NextResponse.json({
      success: true,
      id: poolId,
      joinCode,
      board: safeBoard,
      creatorUserId: data?.creatorUserId || null,
      creatorName: data?.creatorName || null,
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
    const poolId = (id || "").toLowerCase().trim();
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
    const poolRef = db.collection("squares_pools").doc(poolId);
    const docSnap = await poolRef.get();

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
    await poolRef.set(
      {
        id: poolId,
        board,
        updatedAt: now,
      },
      { merge: true }
    );

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
