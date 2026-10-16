import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractSquaresCode } from "@/lib/squares-validation";

export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);

    // Rate limit: max 30 join attempts per 10 minutes per user/IP
    enforceRateLimit(`squares_join:${caller.uid}`, 30, 10 * 60 * 1000, "Too many join attempts. Please wait a few minutes.");
    enforceRateLimit(`squares_join_ip:${ip}`, 50, 10 * 60 * 1000, "Too many join attempts. Please wait a few minutes.");

    const body = await request.json().catch(() => null);
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";

    if (!rawCode) {
      return NextResponse.json({ error: "Please enter a valid Squares code or link" }, { status: 400 });
    }

    const cleanCode = extractSquaresCode(rawCode);

    if (!cleanCode || cleanCode.includes("/") || !/^[A-Za-z0-9_-]{3,32}$/.test(cleanCode)) {
      return NextResponse.json(
        { error: "Invalid board code or link. Please enter a 5-digit code or valid link." },
        { status: 400 }
      );
    }

    const upperCode = cleanCode.toUpperCase();
    const lowerCode = cleanCode.toLowerCase();

    const db = adminDb();
    let poolDoc = null;

    // 1. Try exact ID (uppercase or lowercase)
    const directUpper = await db.collection("squares_pools").doc(upperCode).get();
    if (directUpper.exists) {
      poolDoc = directUpper;
    } else {
      const directLower = await db.collection("squares_pools").doc(lowerCode).get();
      if (directLower.exists) {
        poolDoc = directLower;
      }
    }

    // 2. Try prefixing with "sb-"
    if (!poolDoc && !lowerCode.startsWith("sb-")) {
      const sbDoc = await db.collection("squares_pools").doc(`sb-${lowerCode}`).get();
      if (sbDoc.exists) {
        poolDoc = sbDoc;
      }
    }

    // 3. Try lookup by joinCode (uppercase 5 chars)
    if (!poolDoc) {
      const querySnap = await db
        .collection("squares_pools")
        .where("joinCode", "==", cleanCode.toUpperCase())
        .limit(1)
        .get();
      if (!querySnap.empty) {
        poolDoc = querySnap.docs[0];
      }
    }

    if (!poolDoc || !poolDoc.exists) {
      return NextResponse.json(
        { error: "Squares board not found. Please check your 5-digit code or link." },
        { status: 404 }
      );
    }

    const poolData = poolDoc.data()!;
    const poolId = poolDoc.id;
    const board = poolData.board || {};
    const isCreator = poolData.creatorUserId === caller.uid;
    const now = new Date().toISOString();

    const joinCode = poolData.joinCode || poolId.replace(/^sb-/, "").toUpperCase();

    // Ensure joinCode is stored on pool
    if (!poolData.joinCode) {
      await poolDoc.ref.set({ joinCode }, { merge: true });
    }

    // Save membership
    const membershipId = `${caller.uid}_${poolId}`;
    await db.collection("squares_memberships").doc(membershipId).set(
      {
        userId: caller.uid,
        userEmail: caller.email || "",
        poolId,
        joinCode,
        poolTitle: board.title || "Super Bowl Squares",
        topTeam: board.topTeam || "Team 1",
        leftTeam: board.leftTeam || "Team 2",
        role: isCreator ? "commissioner" : "member",
        joinedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      poolId,
      joinCode,
      title: board.title || "Super Bowl Squares",
      role: isCreator ? "commissioner" : "member",
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error joining squares pool:", err);
    const msg = err instanceof Error ? err.message : "Failed to join board";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
