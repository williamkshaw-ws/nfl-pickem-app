import { NextResponse } from "next/server";
import { adminDb, errorResponse, HttpError } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier } = body;

    if (!identifier || typeof identifier !== "string") {
      throw new HttpError(400, "Username is required");
    }

    const clean = identifier.trim();
    if (!clean) {
      throw new HttpError(400, "Username cannot be empty");
    }

    const db = adminDb();

    // 1. Direct match on username
    let snapshot = await db
      .collection("users")
      .where("username", "==", clean)
      .limit(1)
      .get();

    // 2. Case-insensitive lowercase match
    if (snapshot.empty) {
      snapshot = await db
        .collection("users")
        .where("username", "==", clean.toLowerCase())
        .limit(1)
        .get();
    }

    // 3. Fallback scan if needed (for small user bases with casing differences)
    if (snapshot.empty) {
      const allUsersSnap = await db.collection("users").limit(100).get();
      const match = allUsersSnap.docs.find(
        (doc: any) => doc.data().username?.toLowerCase() === clean.toLowerCase()
      );
      if (match) {
        const userData = match.data();
        if (userData.email) {
          return NextResponse.json({ email: userData.email });
        }
      }
    }

    if (snapshot.empty) {
      throw new HttpError(404, "No account found with that username");
    }

    const userData = snapshot.docs[0].data();
    if (!userData.email) {
      throw new HttpError(404, "Account does not have an associated email address");
    }

    return NextResponse.json({ email: userData.email });
  } catch (err: any) {
    return errorResponse(err);
  }
}
