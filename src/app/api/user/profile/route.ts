import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError, errorResponse } from "@/lib/server-auth";
import { adminAuth } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function PATCH(request: Request) {
  try {
    const caller = await requireUser(request);
    enforceRateLimit(`profile-update:${caller.uid}`, 10, 10 * 60 * 1000, "Too many profile updates. Please wait a few minutes.");

    const body = await request.json();
    const { name, username, avatarColor, emailNotifications } = body || {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new HttpError(400, "Name cannot be empty");
    }
    if (name.trim().length > 50) {
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
    const userDocRef = db.collection("users").doc(caller.uid);
    const newUsernameDocRef = db.collection("usernames").doc(cleanUsername);

    const updateData: Record<string, any> = {
      name: name.trim(),
      username: cleanUsername,
      updatedAt: new Date().toISOString(),
    };

    if (typeof emailNotifications === "boolean") {
      updateData.emailNotifications = emailNotifications;
    }

    if (avatarColor && typeof avatarColor === "string") {
      updateData.avatarColor = avatarColor.trim();
    }

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userDocRef);
      const currentUsername = userSnap.data()?.username;

      if (currentUsername !== cleanUsername) {
        // Check new username doc
        const newUsernameSnap = await tx.get(newUsernameDocRef);
        if (newUsernameSnap.exists && newUsernameSnap.data()?.uid !== caller.uid) {
          throw new HttpError(409, "That username is already taken. Please choose another.");
        }

        // Check legacy users
        const legacyQuery = await db
          .collection("users")
          .where("username", "==", cleanUsername)
          .limit(1)
          .get();

        if (!legacyQuery.empty && legacyQuery.docs[0].id !== caller.uid) {
          throw new HttpError(409, "That username is already taken. Please choose another.");
        }

        // Remove old username reservation if present
        if (currentUsername) {
          const oldUsernameDocRef = db.collection("usernames").doc(currentUsername);
          tx.delete(oldUsernameDocRef);
        }

        tx.set(newUsernameDocRef, {
          uid: caller.uid,
          username: cleanUsername,
          createdAt: new Date().toISOString(),
        });
      }

      tx.set(userDocRef, updateData, { merge: true });
    });

    // Update Firebase Auth display name
    await adminAuth
      .updateUser(caller.uid, { displayName: name.trim() })
      .catch((err) => console.warn("Firebase Auth display name update warning:", err));

    return NextResponse.json({
      success: true,
      user: {
        id: caller.uid,
        name: name.trim(),
        username: cleanUsername,
        avatarColor: updateData.avatarColor || undefined,
        emailNotifications: updateData.emailNotifications ?? false,
      },
    });
  } catch (err: any) {
    return errorResponse(err);
  }
}
