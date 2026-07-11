/**
 * In-memory, per-IP rate limiting for API routes.
 *
 * Known limitation: on serverless (Vercel) each instance keeps its own
 * counters, so this is best-effort burst protection rather than a global
 * limit. Accepted trade-off to stay free of external services; server-side
 * input validation and Gemini quotas are the real backstops.
 */

import { NextRequest } from 'next/server';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20; // one full diagnosis flow ≈ 5-6 requests
const MAX_TRACKED_CLIENTS = 1000;

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

/**
 * Client IP for rate limiting. Only proxy-set headers are trusted — never
 * client-supplied values like x-pb-client-id (trivially spoofable).
 */
export function getClientIp(request: NextRequest): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'local';
}

export function checkRateLimit(key: string, now = Date.now()): boolean {
  if (buckets.size >= MAX_TRACKED_CLIENTS) {
    buckets.forEach((bucket, k) => {
      if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(k);
    });
    // Still full after pruning expired entries: evict oldest-inserted
    if (buckets.size >= MAX_TRACKED_CLIENTS) {
      const excess = buckets.size - MAX_TRACKED_CLIENTS + 1;
      Array.from(buckets.keys())
        .slice(0, excess)
        .forEach((k) => buckets.delete(k));
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count++;
  return bucket.count <= MAX_REQUESTS_PER_WINDOW;
}

/** Test-only: clear all buckets. */
export function resetRateLimit(): void {
  buckets.clear();
}
