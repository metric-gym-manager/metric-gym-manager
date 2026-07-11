import { AUTH_COOKIE_DOMAIN, AUTH_FAILED_COOKIE, isPublicRoute } from '@/lib/auth-config';
import {
  findCorruptSessionCookieNames,
  isSupabaseAuthCookie,
  type CookiePair,
} from './auth-token-guard';
import { safeListKeys, safeRemoveItem, safeJsonParse, safeGetItem } from './safe-storage';

/**
 * Browser-side session recovery: detects rotten Supabase auth state and wipes
 * it before it can wedge the app. The server-side twin lives in the
 * middleware; this module covers everything the middleware can't see
 * (localStorage, CacheStorage, and failures that happen after hydration).
 */

/** Parse document.cookie into name/value pairs. Never throws. */
export function readBrowserCookies(): CookiePair[] {
  if (typeof document === 'undefined') return [];
  try {
    return document.cookie
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        if (eq === -1) return { name: part, value: '' };
        return { name: part.slice(0, eq), value: decodeCookieValue(part.slice(eq + 1)) };
      });
  } catch {
    return [];
  }
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A value that can't even be URI-decoded is itself a rot symptom;
    // return it raw so the validator flags it.
    return value;
  }
}

/**
 * Expire a cookie under every domain scope it could have been written with:
 * host-only, the configured AUTH_COOKIE_DOMAIN, and each parent domain. This
 * is what actually clears cookies left behind by a sibling subdomain deploy.
 */
export function expireBrowserCookie(name: string): void {
  if (typeof document === 'undefined') return;

  const domains: Array<string | undefined> = [undefined];
  if (AUTH_COOKIE_DOMAIN) domains.push(AUTH_COOKIE_DOMAIN);

  try {
    const parts = window.location.hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      domains.push(parts.slice(i).join('.'));
    }
  } catch {
    // hostname unavailable — host-only expiry still runs.
  }

  const expiry = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/';
  for (const domain of new Set(domains)) {
    try {
      document.cookie = `${name}=; ${expiry}${domain ? `; domain=${domain}` : ''}`;
    } catch {
      // Ignore — an unclearable cookie will be re-flagged on next load.
    }
  }
}

/** Remove every Supabase auth cookie (session tokens, chunks, PKCE verifiers). */
export function purgeSupabaseAuthCookies(): void {
  for (const cookie of readBrowserCookies()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      expireBrowserCookie(cookie.name);
    }
  }
}

/**
 * Remove Supabase auth entries from localStorage. Current builds keep the
 * session in cookies, but older supabase-js versions used localStorage — a
 * rotted leftover there can still confuse a freshly created client.
 */
export function purgeSupabaseLocalStorage(): void {
  for (const key of safeListKeys('local')) {
    if (key.startsWith('sb-') || key.startsWith('supabase.auth.')) {
      safeRemoveItem(key);
    }
  }
  for (const key of safeListKeys('session')) {
    if (key.startsWith('sb-') || key.startsWith('supabase.auth.')) {
      safeRemoveItem(key, 'session');
    }
  }
}

/**
 * JSON-parse catch-all for stored auth state, run before the Supabase client
 * initializes. Malformed cookies and legacy localStorage tokens are wiped on
 * the spot so the client boots from a clean signed-out state instead of
 * choking on rot. Returns true when anything had to be repaired.
 */
export function validateAndRepairAuthState(): boolean {
  if (typeof window === 'undefined') return false;

  let repaired = false;

  const corruptCookieNames = findCorruptSessionCookieNames(readBrowserCookies());
  for (const name of corruptCookieNames) {
    expireBrowserCookie(name);
    repaired = true;
  }

  // Legacy localStorage tokens must parse as JSON; wipe anything that doesn't.
  for (const key of safeListKeys('local')) {
    if (!key.startsWith('sb-') && !key.startsWith('supabase.auth.')) continue;
    const raw = safeGetItem(key);
    const looksBase64 = raw !== null && raw.startsWith('base64-');
    if (!looksBase64 && !safeJsonParse(raw).ok) {
      safeRemoveItem(key);
      repaired = true;
    }
  }

  return repaired;
}

let hardResetInFlight = false;

/**
 * Forcefully sign out on the client: wipe every locally stored auth artifact
 * and send the user to /login with a clean, single client-side navigation
 * (no server redirect chain involved). Used when a refresh-token request
 * comes back 400/"Invalid Refresh Token" — at that point the session is
 * unrecoverable and keeping the files around only breaks the app.
 */
export function hardResetAuthState(options?: { redirectToLogin?: boolean }): void {
  if (typeof window === 'undefined' || hardResetInFlight) return;
  hardResetInFlight = true;

  try {
    purgeSupabaseAuthCookies();
    purgeSupabaseLocalStorage();

    const shouldRedirect = options?.redirectToLogin !== false;
    if (shouldRedirect && !isPublicRoute(window.location.pathname)) {
      // Let the login page explain what happened.
      try {
        document.cookie = `${AUTH_FAILED_COOKIE}=1; max-age=60; path=/`;
      } catch {
        // Cookie write failed — redirect anyway.
      }
      window.location.replace('/login');
      return; // Keep the in-flight latch until navigation unloads the page.
    }
  } catch {
    // Never let recovery itself crash the app.
  }
  hardResetInFlight = false;
}

/**
 * Read-and-clear the "session expired" flag the middleware (or a hard reset)
 * left behind. Returns true exactly once per flag so the caller can show a
 * single user-facing message.
 */
export function consumeAuthFailedFlag(): boolean {
  const flag = readBrowserCookies().find((c) => c.name === AUTH_FAILED_COOKIE);
  if (!flag || flag.value !== '1') return false;
  expireBrowserCookie(AUTH_FAILED_COOKIE);
  return true;
}
