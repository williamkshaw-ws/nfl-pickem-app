import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { adminAuth } from "@/lib/firebase-admin";
import { adminDb, errorResponse } from "@/lib/server-auth";

export interface AdminUserData {
  id: string;
  uid: string;
  username: string;
  name: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  banned: boolean;
  createdAt: string;
  lastSignInTime: string | null;
  leagues: {
    id: string;
    name: string;
    role: "commissioner" | "member";
    joinedAt?: string;
  }[];
}

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const db = adminDb();

    // Fetch auth users, firestore user profiles, leagues, and memberships in parallel
    const [authList, firestoreUsersSnap, leaguesSnap, membershipsSnap] =
      await Promise.all([
        adminAuth.listUsers(1000).catch((err) => {
          console.warn("Failed to list auth users:", err);
          return { users: [] };
        }),
        db.collection("users").get(),
        db.collection("leagues").get(),
        db.collection("memberships").get(),
      ]);

    // Build leagues lookup
    const leaguesMap: Record<string, { name: string; commissionerId: string }> = {};
    leaguesSnap.forEach((doc) => {
      const data = doc.data();
      leaguesMap[doc.id] = {
        name: data.name || data.settings?.leagueName || `League #${doc.id}`,
        commissionerId: data.commissionerId || "",
      };
    });

    // Build memberships lookup grouped by userId
    const userMembershipsMap: Record<
      string,
      { id: string; name: string; role: "commissioner" | "member"; joinedAt?: string }[]
    > = {};

    membershipsSnap.forEach((doc) => {
      const data = doc.data();
      const userId = data.userId;
      const leagueId = data.leagueId;
      if (!userId || !leagueId) return;

      const leagueInfo = leaguesMap[leagueId];
      const leagueName =
        data.leagueName || (leagueInfo ? leagueInfo.name : `League #${leagueId}`);
      const isCommish =
        data.role === "commissioner" ||
        (leagueInfo && leagueInfo.commissionerId === userId);

      if (!userMembershipsMap[userId]) {
        userMembershipsMap[userId] = [];
      }

      userMembershipsMap[userId].push({
        id: leagueId,
        name: leagueName,
        role: isCommish ? "commissioner" : "member",
        joinedAt: data.joinedAt || undefined,
      });
    });

    // Also check if any user is commissioner in leagues collection directly
    leaguesSnap.forEach((doc) => {
      const data = doc.data();
      const commishId = data.commissionerId;
      if (commishId) {
        if (!userMembershipsMap[commishId]) {
          userMembershipsMap[commishId] = [];
        }
        const alreadyListed = userMembershipsMap[commishId].some(
          (m) => m.id === doc.id
        );
        if (!alreadyListed) {
          userMembershipsMap[commishId].push({
            id: doc.id,
            name: data.name || data.settings?.leagueName || `League #${doc.id}`,
            role: "commissioner",
          });
        }
      }
    });

    // Build Firestore users lookup
    const firestoreUsersMap: Record<string, any> = {};
    firestoreUsersSnap.forEach((doc) => {
      firestoreUsersMap[doc.id] = doc.data();
    });

    // Merge Auth Users and Firestore Users
    const processedUids = new Set<string>();
    const usersList: AdminUserData[] = [];

    // 1. Process Auth users
    for (const authUser of authList.users) {
      processedUids.add(authUser.uid);
      const fsUser = firestoreUsersMap[authUser.uid] || {};

      const username = fsUser.username || authUser.email?.split("@")[0] || "unknown";
      const name = fsUser.name || authUser.displayName || username;
      const email = authUser.email || fsUser.email || "No email";
      const createdAt =
        fsUser.createdAt || authUser.metadata.creationTime || new Date().toISOString();
      const isBanned = !!fsUser.banned || authUser.disabled;

      usersList.push({
        id: authUser.uid,
        uid: authUser.uid,
        username,
        name,
        email,
        emailVerified: authUser.emailVerified,
        disabled: authUser.disabled,
        banned: isBanned,
        createdAt,
        lastSignInTime: authUser.metadata.lastSignInTime || null,
        leagues: userMembershipsMap[authUser.uid] || [],
      });
    }

    // 2. Process any Firestore users not in Auth list
    for (const [docId, fsUser] of Object.entries(firestoreUsersMap)) {
      if (!processedUids.has(docId)) {
        processedUids.add(docId);
        const username = fsUser.username || fsUser.email?.split("@")[0] || "unknown";
        const name = fsUser.name || username;
        const email = fsUser.email || "No email";
        const isBanned = !!fsUser.banned;

        usersList.push({
          id: docId,
          uid: docId,
          username,
          name,
          email,
          emailVerified: false,
          disabled: isBanned,
          banned: isBanned,
          createdAt: fsUser.createdAt || new Date().toISOString(),
          lastSignInTime: null,
          leagues: userMembershipsMap[docId] || [],
        });
      }
    }

    // Sort users by newest created first
    usersList.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return NextResponse.json({
      users: usersList,
      total: usersList.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
