"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface AppUser {
  id: string;
  email: string;
  name: string;
  username: string;
  emailVerified: boolean;
  avatarColor?: string;
  emailNotifications?: boolean;
  venmoHandle?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, refreshUser: async () => {} });

export const useAuth = () => useContext(AuthContext);

const PROFILE_CACHE_PREFIX = "user_profile_v1:";
const LEAGUE_CACHE_PREFIX = "league_cache_v1:";
const LAST_AUTH_UID_KEY = "last_auth_uid";

function readCachedProfile(uid: string): Partial<AppUser> | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    return raw ? (JSON.parse(raw) as Partial<AppUser>) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: AppUser) {
  try {
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.id}`, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable; non-critical
  }
}

/** Removes cached profiles and signed-in league snapshots (keeps guest snapshots). */
function clearSignedInCaches() {
  try {
    localStorage.removeItem(LAST_AUTH_UID_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(PROFILE_CACHE_PREFIX)) toRemove.push(key);
      if (key.startsWith(LEAGUE_CACHE_PREFIX) && !key.endsWith(":guest")) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const docRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      // Ignore stale results if the user signed out / switched accounts meanwhile
      if (auth.currentUser?.uid !== firebaseUser.uid) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile: AppUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: data.name || firebaseUser.displayName || "",
          username: data.username || "",
          emailVerified: firebaseUser.emailVerified,
          avatarColor: data.avatarColor || "bg-emerald-600",
          emailNotifications: data.emailNotifications ?? false,
          venmoHandle: data.venmoHandle || "",
        };
        setUser((prev) => {
          // Keep the same object reference when nothing changed so effects depending on `user` don't re-run
          if (prev && JSON.stringify(prev) === JSON.stringify(profile)) return prev;
          return profile;
        });
        writeCachedProfile(profile);
        return;
      }
    } catch (err) {
      console.error("Error fetching user profile doc:", err);
    }

    // Profile doc missing or unreadable: fall back to auth basics (only if nothing set yet)
    if (auth.currentUser?.uid !== firebaseUser.uid) return;
    setUser((prev) =>
      prev && prev.id === firebaseUser.uid
        ? prev
        : {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "",
            username: "",
            emailVerified: firebaseUser.emailVerified,
            avatarColor: "bg-emerald-600",
            emailNotifications: false,
            venmoHandle: "",
          }
    );
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await fetchUserProfile(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        try {
          localStorage.setItem(LAST_AUTH_UID_KEY, firebaseUser.uid);
        } catch {}
        const cached = readCachedProfile(firebaseUser.uid);
        // Unblock the app immediately using cached profile or auth basics,
        // then refresh the full Firestore profile in the background.
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: cached?.name || firebaseUser.displayName || "",
          username: cached?.username || "",
          emailVerified: firebaseUser.emailVerified,
          avatarColor: cached?.avatarColor || "bg-emerald-600",
          emailNotifications: cached?.emailNotifications ?? false,
          venmoHandle: cached?.venmoHandle || "",
        });
        setLoading(false);
        fetchUserProfile(firebaseUser);
      } else {
        setUser(null);
        clearSignedInCaches();
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
