import { NextResponse } from "next/server";
import { adminDb, errorResponse, HttpError } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Throttle username -> email lookups to blunt account/email enumeration
    const ip = getClientIp(request);
    enforceRateLimit(`lookup-min:${ip}`, 8, 60 * 1000, "Too many attempts. Please wait a minute and try again.");
    enforceRateLimit(`lookup-hour:${ip}`, 40, 60 * 60 * 1000, "Too many attempts. Please try again later.");

    const body = await request.json();
    const { identifier } = body;

    if (!identifier || typeof identifier !== "string") {
      throw new HttpError(400, "Username is required");
    }

    const clean = identifier.trim();
    if (!clean || clean.length > 64) {
      throw new HttpError(400, "Username cannot be empty");
    }

    const db = adminDb();

    let snapshot = await db
      .collection("users")
      .where("username", "==", clean.toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) {
      snapshot = await db
        .collection("users")
        .where("username", "==", clean)
        .limit(1)
        .get();
    }

    // Identical response for "not found", "banned" and "no email" so the endpoint
    // doesn't reveal which usernames exist or which accounts are disabled.
    const notFound = () => new HttpError(404, "No account found with that username");

    if (snapshot.empty) throw notFound();

    const userData = snapshot.docs[0].data();
    if (userData.banned || !userData.email) throw notFound();

    return NextResponse.json({ email: userData.email });
  } catch (err: any) {
    return errorResponse(err);
  }
}
