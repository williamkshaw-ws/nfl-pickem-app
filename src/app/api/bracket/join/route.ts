import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractBracketCode } from "@/lib/playoff-bracket";

export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const ip = getClientIp(request);

    // Rate limit: max 30 join attempts per 10 minutes
    enforceRateLimit(`bracket_join:${caller.uid}`, 30, 10 * 60 * 1000, "Too many join attempts. Please wait a few minutes.");
    enforceRateLimit(`bracket_join_ip:${ip}`, 50, 10 * 60 * 1000, "Too many join attempts. Please wait a few minutes.");

    const body = await request.json().catch(() => null);
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";

    if (!rawCode) {
      return NextResponse.json({ error: "Please enter a valid bracket code or link" }, { status: 400 });
    }

    const cleanCode = extractBracketCode(rawCode);
    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
      return NextResponse.json(
        { error: "Invalid bracket code. Please enter a valid 5-character code or link." },
        { status: 400 }
      );
    }

    const db = adminDb();
    let poolDoc = await db.collection("bracket_pools").doc(cleanCode).get();

    if (!poolDoc.exists) {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", cleanCode)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        poolDoc = qSnap.docs[0];
      }
    }

    if (!poolDoc || !poolDoc.exists) {
      return NextResponse.json(
        { error: "Bracket pool not found. Please check your 5-digit code or link." },
        { status: 404 }
      );
    }

    const poolData = poolDoc.data()!;
    const poolId = poolDoc.id;
    const isCreator = poolData.creatorUserId === caller.uid;
    const now = new Date().toISOString();
    const joinCode = poolData.joinCode || poolId;
    const poolName = poolData.name || "Playoff Bracket Challenge";

    let userName = "";
    let userAvatar = "bg-emerald-600";
    try {
      const userDoc = await db.collection("users").doc(caller.uid).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        userName = u?.name || u?.username || "";
        userAvatar = u?.avatarColor || userAvatar;
      }
    } catch {}
    if (!userName) {
      userName = caller.email?.split("@")[0] || "Participant";
    }

    // Create or update membership
    const membershipId = `${caller.uid}_${poolId}`;
    const memRef = db.collection("bracket_memberships").doc(membershipId);
    const existingMem = await memRef.get();

    if (!existingMem.exists) {
      await memRef.set({
        userId: caller.uid,
        userEmail: caller.email || "",
        userName,
        userAvatar,
        poolId,
        joinCode,
        poolName,
        role: isCreator ? "commissioner" : "member",
        picks: {},
        tiebreaker: null,
        score: 0,
        superBowlWinner: "",
        joinedAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      poolId,
      joinCode,
      name: poolName,
      role: isCreator ? "commissioner" : "member",
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error joining bracket pool:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join bracket pool" },
      { status: 500 }
    );
  }
}
