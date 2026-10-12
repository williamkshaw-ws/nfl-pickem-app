import { HttpError } from "./server-auth";

/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * NOTE: state lives in the memory of a single server instance. On serverless
 * hosts (e.g. Vercel) each warm instance keeps its own counters, so this is a
 * best-effort brake against brute force / spam, not a hard global guarantee.
 * For a hard limit, back this with a shared store (Upstash Redis / Vercel KV).
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 60 * 60_000) {
      buckets.delete(key);
    }
  }
}

/** Returns the caller's IP as reported by the proxy (first x-forwarded-for hop). */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Throws HttpError(429) if `key` has exceeded `limit` hits within `windowMs`.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number, message?: string) {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    throw new HttpError(429, message || "Too many requests. Please slow down and try again shortly.");
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
}

/** Records a hit only when called (used to count failures, e.g. wrong passwords). */
export function peekRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return false;
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  return bucket.hits.length >= limit;
}

export function recordFailure(key: string) {
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits.push(Date.now());
  buckets.set(key, bucket);
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}
