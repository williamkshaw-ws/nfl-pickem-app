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

interface CachedPoolsPayload {
  uid: string;
  pickemPools: UnifiedPoolItem[];
  squaresPools: UnifiedPoolItem[];
  bracketPools: UnifiedPoolItem[];
  fetchedAt: number;
}

let memoryPoolsCache: CachedPoolsPayload | null = null;
const SESSION_CACHE_KEY = "pp_user_all_pools_cache_v1";

function readCachedPools(uid: string | undefined): CachedPoolsPayload | null {
  if (!uid) return null;
  if (memoryPoolsCache && memoryPoolsCache.uid === uid) {
    return memoryPoolsCache;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedPoolsPayload;
        if (parsed && parsed.uid === uid) {
          memoryPoolsCache = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

function writeCachedPools(payload: CachedPoolsPayload) {
  memoryPoolsCache = payload;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload));
    } catch {}
  }
}

export function useUserAllPools(): UserAllPoolsState {
  const { user } = useAuth();
  const initialCache = readCachedPools(user?.id);
  const [pickemPools, setPickemPools] = useState<UnifiedPoolItem[]>(
    () => initialCache?.pickemPools || []
  );
  const [squaresPools, setSquaresPools] = useState<UnifiedPoolItem[]>(
    () => initialCache?.squaresPools || []
  );
  const [bracketPools, setBracketPools] = useState<UnifiedPoolItem[]>(
    () => initialCache?.bracketPools || []
  );
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
      memoryPoolsCache = null;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(SESSION_CACHE_KEY);
        } catch {}
      }
      setPickemPools([]);
      setSquaresPools([]);
      setBracketPools([]);
      setLoading(false);
      return;
    }

    const cached = readCachedPools(user.id);
    if (cached) {
      setPickemPools(cached.pickemPools);
      setSquaresPools(cached.squaresPools);
      setBracketPools(cached.bracketPools);
    } else {
      setLoading(true);
    }

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
        const nextPickem = data.pickemPools || [];
        const nextSquares = data.squaresPools || [];
        const nextBracket = data.bracketPools || [];
        setPickemPools(nextPickem);
        setSquaresPools(nextSquares);
        setBracketPools(nextBracket);
        writeCachedPools({
          uid: user.id,
          pickemPools: nextPickem,
          squaresPools: nextSquares,
          bracketPools: nextBracket,
          fetchedAt: Date.now(),
        });
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
