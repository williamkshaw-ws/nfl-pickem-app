import { NextResponse } from "next/server";
import { requireUser, adminDb, HttpError, errorResponse } from "@/lib/server-auth";
import { adminAuth } from "@/lib/firebase-admin";

export async function PATCH(request: Request) {
  try {
    const caller = await requireUser(request);
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
        "Username must be 3-20 characters and contain only letters, numbers, underscores, or dashes"
      );
    }

    const db = adminDb();

    // Check username uniqueness
    const usernameQuery = await db
      .collection("users")
      .where("username", "==", cleanUsername)
      .get();

    const conflict = usernameQuery.docs.find((d) => d.id !== caller.uid);
    if (conflict) {
      throw new HttpError(409, "That username is already taken. Please choose another.");
    }

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

    await db.collection("users").doc(caller.uid).set(updateData, { merge: true });

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
