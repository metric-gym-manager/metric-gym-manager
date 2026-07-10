/**
 * Pure helpers for detecting "token rot": Supabase auth cookies that are
 * malformed, partially overwritten, or chunk-incomplete. Shared by the Edge
 * middleware and the browser, so this module must stay free of DOM and Node
 * APIs at module scope.
 *
 * @supabase/ssr stores the session in cookies named `sb-<ref>-auth-token`,
 * optionally split into ordered chunks (`.0`, `.1`, …) and optionally encoded
 * with a `base64-` prefix. A cookie that no longer decodes to JSON is rot: the
 * server keeps rejecting it, the browser keeps resending it, and the app hangs
 * in a broken state until the cookie is wiped.
 */

export interface CookiePair {
  name: string;
  value: string;
}

const AUTH_TOKEN_COOKIE_RE = /^sb-[^.]+-auth-token(?:\.(\d+))?$/;
const CODE_VERIFIER_COOKIE_RE = /^sb-[^.]+-auth-token-code-verifier(?:\.\d+)?$/;

/** True for any Supabase auth-related cookie (session token or PKCE verifier). */
export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-');
}

/** True for session-token cookies specifically (the ones that must be valid JSON). */
export function isSupabaseSessionCookie(name: string): boolean {
  return AUTH_TOKEN_COOKIE_RE.test(name) && !CODE_VERIFIER_COOKIE_RE.test(name);
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof atob === 'function') {
      return atob(padded);
    }
    // Node fallback (Jest); Edge and browsers always have atob.
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

function parsesAsJsonObject(raw: string): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
}

/**
 * Check whether a joined session-cookie value decodes to JSON via any format
 * @supabase/ssr has ever used: `base64-` prefixed base64url, raw JSON, or
 * URI-encoded JSON. Lenient on purpose — we only declare rot when every known
 * decoding fails, so a valid session is never wiped by mistake.
 */
export function isWellFormedSessionValue(joinedValue: string): boolean {
  if (!joinedValue) return false;

  if (joinedValue.startsWith('base64-')) {
    const decoded = decodeBase64Url(joinedValue.slice('base64-'.length));
    return decoded !== null && parsesAsJsonObject(decoded);
  }

  if (parsesAsJsonObject(joinedValue)) return true;

  try {
    return parsesAsJsonObject(decodeURIComponent(joinedValue));
  } catch {
    return false;
  }
}

interface CookieGroup {
  /** Base name without the chunk suffix. */
  baseName: string;
  /** Unchunked cookie value, if present. */
  whole?: string;
  /** Chunk index → value. */
  chunks: Map<number, string>;
  /** Every raw cookie name that belongs to this group. */
  memberNames: string[];
}

function groupSessionCookies(cookies: CookiePair[]): CookieGroup[] {
  const groups = new Map<string, CookieGroup>();

  for (const cookie of cookies) {
    if (!isSupabaseSessionCookie(cookie.name)) continue;

    const match = AUTH_TOKEN_COOKIE_RE.exec(cookie.name);
    if (!match) continue;

    const chunkIndex = match[1] === undefined ? null : Number(match[1]);
    const baseName = chunkIndex === null ? cookie.name : cookie.name.slice(0, -(`.${match[1]}`.length));

    let group = groups.get(baseName);
    if (!group) {
      group = { baseName, chunks: new Map(), memberNames: [] };
      groups.set(baseName, group);
    }
    group.memberNames.push(cookie.name);
    if (chunkIndex === null) {
      group.whole = cookie.value;
    } else {
      group.chunks.set(chunkIndex, cookie.value);
    }
  }

  return Array.from(groups.values());
}

function joinChunks(group: CookieGroup): string | null {
  const indexes = Array.from(group.chunks.keys()).sort((a, b) => a - b);
  // Chunks must be contiguous starting at 0 — a missing chunk means the
  // cookie was partially overwritten (classic subdomain-overlap corruption).
  for (let i = 0; i < indexes.length; i++) {
    if (indexes[i] !== i) return null;
  }
  return indexes.map((i) => group.chunks.get(i) ?? '').join('');
}

/**
 * Scan a cookie set and return the names of every Supabase session cookie
 * that is structurally corrupt and must be deleted. Returns an empty array
 * when everything is healthy.
 *
 * Corruption cases detected:
 * - value (or joined chunk value) fails every known decoding → malformed JSON
 * - chunked cookie with missing/non-contiguous chunks → partial overwrite
 * - both a whole cookie AND chunks for the same base name → two deployments
 *   (e.g. staging + production on sibling subdomains) fighting over storage
 */
export function findCorruptSessionCookieNames(cookies: CookiePair[]): string[] {
  const corrupt: string[] = [];

  for (const group of groupSessionCookies(cookies)) {
    const hasWhole = group.whole !== undefined;
    const hasChunks = group.chunks.size > 0;

    if (hasWhole && hasChunks) {
      // Overlapping formats can never both be current — wipe the group.
      corrupt.push(...group.memberNames);
      continue;
    }

    const joined = hasChunks ? joinChunks(group) : (group.whole ?? null);
    if (joined === null || !isWellFormedSessionValue(joined)) {
      corrupt.push(...group.memberNames);
    }
  }

  return corrupt;
}

/** Shape-agnostic view of an auth error coming from supabase-js or GoTrue. */
interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
  error_code?: string;
  name?: string;
}

const INVALID_REFRESH_MESSAGE_RE =
  /invalid refresh token|refresh token not found|already used|refresh_token_not_found|flow_state_(not_found|expired)/i;

/**
 * True when an auth failure means the stored refresh token is permanently
 * dead (revoked, rotated away, or unknown to the server) — the only sane
 * response is to wipe local session state and re-authenticate.
 */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as AuthErrorLike;

  const code = err.code ?? err.error_code ?? '';
  if (/^(refresh_token_not_found|refresh_token_already_used|flow_state_not_found|flow_state_expired)$/.test(code)) {
    return true;
  }

  const message = err.message ?? '';
  if (err.status === 400 || err.status === 401) {
    return INVALID_REFRESH_MESSAGE_RE.test(message);
  }
  // Some supabase-js paths surface the message without a status.
  return INVALID_REFRESH_MESSAGE_RE.test(message);
}

/**
 * True when an auth failure is transient (network blip, 5xx from Supabase).
 * Transient failures must NOT wipe cookies — the session is likely still
 * valid and will recover on the next request.
 */
export function isRetryableAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as AuthErrorLike;
  if (err.name === 'AuthRetryableFetchError') return true;
  if (err.status === undefined || err.status === 0) return true;
  return err.status >= 500;
}
