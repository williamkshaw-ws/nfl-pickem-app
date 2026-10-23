import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError, errorResponse } from "@/lib/server-auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    enforceRateLimit(`reg-ip:${ip}`, 10, 15 * 60 * 1000, "Too many registration attempts from this network. Please wait a few minutes.");

    const caller = await requireUser(request);
    enforceRateLimit(`reg-user:${caller.uid}`, 5, 15 * 60 * 1000, "Too many profile setup attempts.");

    const body = await request.json().catch(() => null);
    const { name, username } = body || {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new HttpError(400, "Name cannot be empty");
    }
    const cleanName = name.trim();
    if (cleanName.length > 50) {
      throw new HttpError(400, "Name must be 50 characters or fewer");
    }

    if (!username || typeof username !== "string") {
      throw new HttpError(400, "Username is required");
    }
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,20}$/.test(cleanUsername)) {
      throw new HttpError(
        400,
        "Username must be 3-20 characters and contain only lowercase letters, numbers, underscores, or dashes"
      );
    }

    const db = adminDb();
    const usernameDocRef = db.collection("usernames").doc(cleanUsername);
    const userDocRef = db.collection("users").doc(caller.uid);

    // Atomically check uniqueness and claim the username
    await db.runTransaction(async (tx) => {
      const usernameSnap = await tx.get(usernameDocRef);
      if (usernameSnap.exists) {
        const ownerUid = usernameSnap.data()?.uid;
        if (ownerUid !== caller.uid) {
          throw new HttpError(409, "That username is already taken. Please choose another.");
        }
      }

      // Check legacy users doc if usernames doc doesn't exist yet
      const legacyQuery = await db
        .collection("users")
        .where("username", "==", cleanUsername)
        .limit(1)
        .get();

      if (!legacyQuery.empty) {
        const legacyOwner = legacyQuery.docs[0];
        if (legacyOwner.id !== caller.uid) {
          throw new HttpError(409, "That username is already taken. Please choose another.");
        }
      }

      const existingUserSnap = await tx.get(userDocRef);
      const now = new Date().toISOString();

      if (existingUserSnap.exists) {
        const oldUsername = existingUserSnap.data()?.username;
        if (typeof oldUsername === "string" && oldUsername && oldUsername !== cleanUsername) {
          tx.delete(db.collection("usernames").doc(oldUsername));
        }
        tx.update(userDocRef, {
          name: cleanName,
          username: cleanUsername,
          updatedAt: now,
        });
      } else {
        tx.set(userDocRef, {
          id: caller.uid,
          name: cleanName,
          username: cleanUsername,
          email: caller.email || "",
          createdAt: now,
        });
      }

      tx.set(usernameDocRef, {
        uid: caller.uid,
        username: cleanUsername,
        createdAt: now,
      });
    });

    return NextResponse.json({
      success: true,
      user: {
        id: caller.uid,
        name: cleanName,
        username: cleanUsername,
      },
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
