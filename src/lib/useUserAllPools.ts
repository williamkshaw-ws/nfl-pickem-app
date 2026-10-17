"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface UnifiedPoolItem {
  id: string;
  name: string;
  gameType: "pickem" | "squares" | "bracket";
  role: "commissioner" | "member";
  href: string;
  badge?: string;
  code?: string;
}

export interface UserAllPoolsState {
  pickemPools: UnifiedPoolItem[];
  squaresPools: UnifiedPoolItem[];
  bracketPools: UnifiedPoolItem[];
  allPools: UnifiedPoolItem[];
  totalCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useUserAllPools(): UserAllPoolsState {
  const { user } = useAuth();
  const [pickemPools, setPickemPools] = useState<UnifiedPoolItem[]>([]);
  const [squaresPools, setSquaresPools] = useState<UnifiedPoolItem[]>([]);
  const [bracketPools, setBracketPools] = useState<UnifiedPoolItem[]>([]);
  const [loading, setLoading] = useState(false);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (auth.currentUser) {
      try {
        return (await auth.currentUser.getIdToken()) || null;
      } catch {
        return null;
      }
    }
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        unsub();
        if (u) {
          try {
            const t = await u.getIdToken();
            resolve(t || null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      setTimeout(() => resolve(null), 2500);
    });
  }, []);

  const fetchPools = useCallback(async () => {
    if (!user) {
      setPickemPools([]);
      setSquaresPools([]);
      setBracketPools([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/user/all-pools", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPickemPools(data.pickemPools || []);
        setSquaresPools(data.squaresPools || []);
        setBracketPools(data.bracketPools || []);
      }
    } catch (err) {
      console.error("Error loading user all-pools:", err);
    } finally {
      setLoading(false);
    }
  }, [user, getValidToken]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Also listen for auth changes to ensure mobile picks up authenticated state immediately
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        fetchPools();
      }
    });
    return () => unsub();
  }, [fetchPools]);

  const allPools = [...pickemPools, ...squaresPools, ...bracketPools];

  return {
    pickemPools,
    squaresPools,
    bracketPools,
    allPools,
    totalCount: allPools.length,
    loading,
    refetch: fetchPools,
  };
}
