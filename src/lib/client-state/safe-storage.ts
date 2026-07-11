import { APP_MAJOR_VERSION } from './app-version';

/**
 * Fail-safe wrappers around Web Storage and JSON parsing.
 *
 * Browsers can and do hand us broken state: quota errors, Safari private
 * mode throwing on setItem, partially written values, and values from a
 * previous deployment whose shape no longer parses. Nothing in this module
 * ever throws — a corrupt value is treated as an absent value and wiped.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

/** JSON.parse that never throws. */
export function safeJsonParse<T = unknown>(raw: string | null | undefined): ParseResult<T> {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false };
  }
}

function getStorage(kind: 'local' | 'session'): Storage | null {
  // Accessing window.localStorage itself can throw (e.g. blocked cookies,
  // sandboxed iframes), so even the lookup is guarded.
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Read a raw string value; returns null instead of throwing. */
export function safeGetItem(key: string, kind: 'local' | 'session' = 'local'): string | null {
  const storage = getStorage(kind);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Write a value; returns false instead of throwing (quota, private mode). */
export function safeSetItem(key: string, value: string, kind: 'local' | 'session' = 'local'): boolean {
  const storage = getStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Remove a key; never throws. */
export function safeRemoveItem(key: string, kind: 'local' | 'session' = 'local'): void {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Removal failures are non-fatal — the value will be ignored anyway.
  }
}

/** List all keys currently in storage; returns [] instead of throwing. */
export function safeListKeys(kind: 'local' | 'session' = 'local'): string[] {
  const storage = getStorage(kind);
  if (!storage) return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/**
 * Read and JSON-parse a stored value. If the stored value is malformed it is
 * wiped immediately so it can never poison a later read (JSON-parse catch-all).
 */
export function safeReadJson<T = unknown>(key: string, kind: 'local' | 'session' = 'local'): T | null {
  const raw = safeGetItem(key, kind);
  if (raw === null) return null;
  const parsed = safeJsonParse<T>(raw);
  if (!parsed.ok) {
    safeRemoveItem(key, kind);
    return null;
  }
  return parsed.value;
}

/** JSON-stringify and store a value; returns false on failure. */
export function safeWriteJson(key: string, value: unknown, kind: 'local' | 'session' = 'local'): boolean {
  try {
    return safeSetItem(key, JSON.stringify(value), kind);
  } catch {
    return false;
  }
}

/**
 * Namespace a storage key by app major version, e.g. `user_settings` →
 * `mgm:v1:user_settings`. Keys from an older release line simply stop being
 * read after a major upgrade instead of feeding stale shapes into new code.
 */
export function namespacedKey(base: string): string {
  return `mgm:v${APP_MAJOR_VERSION}:${base}`;
}

/** Versioned, fail-safe app storage. Use this instead of raw localStorage. */
export const appStorage = {
  get<T = unknown>(base: string): T | null {
    return safeReadJson<T>(namespacedKey(base));
  },
  set(base: string, value: unknown): boolean {
    return safeWriteJson(namespacedKey(base), value);
  },
  remove(base: string): void {
    safeRemoveItem(namespacedKey(base));
  },
};
