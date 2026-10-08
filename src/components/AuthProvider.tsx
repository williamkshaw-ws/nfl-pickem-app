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
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, refreshUser: async () => {} });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const docRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: data.name || firebaseUser.displayName || "",
          username: data.username || "",
          emailVerified: firebaseUser.emailVerified,
          avatarColor: data.avatarColor || "bg-emerald-600",
          emailNotifications: data.emailNotifications ?? false,
        });
        return;
      }
    } catch (err) {
      console.error("Error fetching user profile doc:", err);
    }

    setUser({
      id: firebaseUser.uid,
      email: firebaseUser.email || "",
      name: firebaseUser.displayName || "",
      username: "",
      emailVerified: firebaseUser.emailVerified,
      avatarColor: "bg-emerald-600",
      emailNotifications: false,
    });
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await fetchUserProfile(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
