/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Scope: per serverless instance. On Vercel each warm lambda keeps its own
 * counters, so this is a best-effort abuse dampener for the public
 * registration endpoint rather than a hard global limit — the hard
 * guarantees come from the unguessable token and the duplicate-phone check.
 * Swap for a shared store (Upstash/Redis) if stronger guarantees are needed.
 */

interface WindowEntry {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, WindowEntry>();

/** Prevent unbounded memory growth on long-lived instances */
const MAX_BUCKETS = 10_000;

/**
 * Count a hit against a key and report whether it stays within the limit.
 *
 * @param key - Bucket key (e.g. 'reg:ip:1.2.3.4')
 * @param limit - Max hits per window
 * @param windowMs - Window length in milliseconds
 * @returns True when the hit is allowed
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStartMs >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      buckets.clear();
    }
    buckets.set(key, { count: 1, windowStartMs: now });
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}

/** Test helper: reset all counters */
export function resetRateLimits(): void {
  buckets.clear();
}
