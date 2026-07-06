import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for Bearer secrets (e.g. CRON_SECRET).
 *
 * A plain `===` short-circuits on the first differing byte, leaking secret
 * prefixes through timing. `timingSafeEqual` requires equal lengths, so the
 * length check itself is the only fast-path (length is not secret).
 *
 * @param a - First string (e.g. received header value)
 * @param b - Second string (e.g. expected secret)
 * @returns True when the strings are byte-identical
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
