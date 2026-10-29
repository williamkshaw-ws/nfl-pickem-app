import { NextResponse } from "next/server";
import { adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractSquaresCode } from "@/lib/squares-validation";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`resolve-code:${ip}`, 60, 60 * 1000, "Too many code lookups. Please wait a moment.");

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";

    if (!rawCode) {
      throw new HttpError(400, "Code is required");
    }

    const cleanCode = extractSquaresCode(rawCode);
    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
      return NextResponse.json({ found: false, error: "Invalid code format" });
    }

    const db = adminDb();
    const upperCode = cleanCode.toUpperCase();
    const lowerCode = cleanCode.toLowerCase();

    // 1. Check Squares pools
    let poolDoc = null;
    const directUpper = await db.collection("squares_pools").doc(upperCode).get();
    if (directUpper.exists) {
      poolDoc = directUpper;
    } else {
      const directLower = await db.collection("squares_pools").doc(lowerCode).get();
      if (directLower.exists) {
        poolDoc = directLower;
      }
    }

    if (!poolDoc && !lowerCode.startsWith("sb-")) {
      const sbDoc = await db.collection("squares_pools").doc(`sb-${lowerCode}`).get();
      if (sbDoc.exists) poolDoc = sbDoc;
    }

    if (!poolDoc) {
      const querySnap = await db
        .collection("squares_pools")
        .where("joinCode", "==", upperCode)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        poolDoc = querySnap.docs[0];
      }
    }

    if (poolDoc && poolDoc.exists) {
      const data = poolDoc.data()!;
      const displayCode = data.joinCode || poolDoc.id.replace(/^sb-/i, "").toUpperCase();
      return NextResponse.json({
        found: true,
        type: "squares",
        id: poolDoc.id,
        code: displayCode,
        title: data.board?.title || data.title || "Super Bowl Squares",
        creatorName: data.creatorName || null,
        topTeam: data.topTeam || data.board?.topTeam || null,
        leftTeam: data.leftTeam || data.board?.leftTeam || null,
      });
    }

    // 2. Check Bracket pools
    let bracketDoc = null;
    const directBracketUpper = await db.collection("bracket_pools").doc(upperCode).get();
    if (directBracketUpper.exists) {
      bracketDoc = directBracketUpper;
    } else {
      const qSnap = await db
        .collection("bracket_pools")
        .where("joinCode", "==", upperCode)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        bracketDoc = qSnap.docs[0];
      }
    }

    if (bracketDoc && bracketDoc.exists) {
      const data = bracketDoc.data()!;
      const displayCode = data.joinCode || bracketDoc.id.toUpperCase();
      return NextResponse.json({
        found: true,
        type: "bracket",
        id: bracketDoc.id,
        code: displayCode,
        title: data.name || "Playoff Bracket Challenge",
        creatorName: data.creatorName || null,
      });
    }

    // 3. Check Leagues
    let leagueDoc = await db.collection("leagues").doc(upperCode).get();
    if (!leagueDoc.exists) {
      leagueDoc = await db.collection("leagues").doc(cleanCode).get();
    }
    if (!leagueDoc.exists) {
      const leagueSnap = await db
        .collection("leagues")
        .where("inviteCode", "==", upperCode)
        .limit(1)
        .get();
      if (!leagueSnap.empty) {
        leagueDoc = leagueSnap.docs[0];
      }
    }

    if (leagueDoc && leagueDoc.exists) {
      const data = leagueDoc.data()!;
      const leagueTitle = data.name || data.settings?.leagueName || "Pick'em League";
      return NextResponse.json({
        found: true,
        type: "league",
        id: leagueDoc.id,
        code: upperCode,
        name: leagueTitle,
        title: leagueTitle,
        creatorName: data.commissionerName || null,
      });
    }

    return NextResponse.json({
      found: false,
      error: "No league or squares board found with that code",
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
