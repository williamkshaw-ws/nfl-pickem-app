import { NextResponse } from "next/server";
import { adminDb, requireUser, requireMember, HttpError } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractBracketCode } from "@/lib/playoff-bracket";

export async function GET(request: Request) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`pool_members:${caller.uid}`, 60, 60_000);

    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get("gameType");
    const rawId = (searchParams.get("id") || "").trim();

    if (!rawId || !gameType || !["pickem", "squares", "bracket"].includes(gameType)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const db = adminDb();
    let memberUserIds: string[] = [];

    if (gameType === "pickem") {
      await requireMember(rawId, caller.uid);
      const snap = await db.collection("memberships").where("leagueId", "==", rawId).get();
      memberUserIds = snap.docs
        .map((d) => d.data().userId)
        .filter((uid): uid is string => Boolean(uid && uid !== caller.uid));
    } else if (gameType === "squares") {
      const upperId = rawId.toUpperCase();
      const lowerId = rawId.toLowerCase();
      const rawJoin = rawId.replace(/^sb-/, "").toUpperCase();

      const [poolSnap, snap] = await Promise.all([
        db.collection("squares_pools").doc(rawId).get(),
        db
          .collection("squares_memberships")
          .where("poolId", "in", [rawId, upperId, lowerId, rawJoin, `sb-${lowerId}`])
          .get(),
      ]);

      let poolData = poolSnap.exists ? poolSnap.data() : null;
      if (!poolData && upperId !== rawId) {
        const altSnap = await db.collection("squares_pools").doc(upperId).get();
        if (altSnap.exists) poolData = altSnap.data();
      }
      const isCreator = poolData?.creatorUserId === caller.uid;
      const isMember = snap.docs.some((d) => d.data().userId === caller.uid);
      if (!isCreator && !isMember) {
        throw new HttpError(403, "You are not a member of this board");
      }

      memberUserIds = snap.docs
        .map((d) => d.data().userId)
        .filter((uid): uid is string => Boolean(uid && uid !== caller.uid));
    } else if (gameType === "bracket") {
      const cleanId = extractBracketCode(rawId);
      const [poolSnap, snap] = await Promise.all([
        db.collection("bracket_pools").doc(cleanId).get(),
        db
          .collection("bracket_memberships")
          .where("poolId", "==", cleanId)
          .get(),
      ]);

      const isCreator = poolSnap.exists && poolSnap.data()?.creatorUserId === caller.uid;
      const isMember = snap.docs.some((d) => d.data().userId === caller.uid);
      if (!isCreator && !isMember) {
        throw new HttpError(403, "You are not a member of this bracket pool");
      }

      memberUserIds = snap.docs
        .map((d) => d.data().userId)
        .filter((uid): uid is string => Boolean(uid && uid !== caller.uid));
    }

    // Deduplicate user IDs
    const uniqueUids = Array.from(new Set(memberUserIds));

    if (uniqueUids.length === 0) {
      return NextResponse.json({ success: true, members: [] });
    }

    // Fetch user profiles for display names
    const userDocs = await Promise.all(
      uniqueUids.slice(0, 50).map((uid) => db.collection("users").doc(uid).get().catch(() => null))
    );

    const members = userDocs
      .filter((d): d is FirebaseFirestore.DocumentSnapshot => Boolean(d && d.exists))
      .map((d) => {
        const u = d.data()!;
        return {
          id: d.id,
          name: u.name || u.displayName || u.username || "Member",
          username: u.username || "",
          avatarColor: u.avatarColor || "bg-emerald-600",
        };
      });

    return NextResponse.json({ success: true, members });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error fetching pool members:", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}
