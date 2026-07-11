import { APP_VERSION, APP_VERSION_STORAGE_KEY, CURRENT_SW_CACHE_NAME } from './app-version';
import { safeGetItem, safeSetItem, safeListKeys, safeRemoveItem } from './safe-storage';

/**
 * Local state invalidation: when a new deployment ships, state written by an
 * older build (localStorage shapes, sessionStorage, CacheStorage entries from
 * a previous service worker) may no longer match the current schema. On every
 * app mount we compare the stored version stamp with the running version and
 * purge stale client state on mismatch.
 */

export interface VersionGuardResult {
  /** True when a version change was detected and stale state was purged. */
  migrated: boolean;
  previousVersion: string | null;
  currentVersion: string;
}

/** Keys that must survive a version purge (auth session and the stamp itself). */
function isPreservedKey(key: string): boolean {
  return (
    key.startsWith('sb-') || // Supabase auth tokens — a deploy must not log users out
    key.startsWith('supabase.auth.') ||
    key === APP_VERSION_STORAGE_KEY
  );
}

function clearStaleLocalState(): void {
  for (const key of safeListKeys('local')) {
    if (!isPreservedKey(key)) safeRemoveItem(key);
  }
  for (const key of safeListKeys('session')) {
    if (!isPreservedKey(key)) safeRemoveItem(key, 'session');
  }
}

/**
 * Delete every CacheStorage cache that doesn't belong to the current version's
 * service worker. The SW does this in its own activate handler, but doing it
 * eagerly here also kills zombie caches when a stale worker never activates.
 */
async function clearZombieCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name !== CURRENT_SW_CACHE_NAME).map((name) => caches.delete(name))
    );
  } catch {
    // CacheStorage unavailable (private mode, permissions) — nothing to purge.
  }
}

/**
 * Compare the running APP_VERSION with the version that last wrote client
 * state. On mismatch: wipe app-owned localStorage/sessionStorage (preserving
 * the Supabase session), purge stale CacheStorage entries, then stamp the new
 * version. Safe to call on every mount; a no-op when versions match.
 */
export async function enforceClientStateVersion(): Promise<VersionGuardResult> {
  const currentVersion = APP_VERSION;

  if (typeof window === 'undefined') {
    return { migrated: false, previousVersion: null, currentVersion };
  }

  const previousVersion = safeGetItem(APP_VERSION_STORAGE_KEY);

  if (previousVersion === currentVersion) {
    return { migrated: false, previousVersion, currentVersion };
  }

  // First visit (no stamp) still gets stamped, but only an actual version
  // change purges state — a brand-new browser has nothing stale to clear.
  const migrated = previousVersion !== null;
  if (migrated) {
    clearStaleLocalState();
    await clearZombieCaches();
  }

  safeSetItem(APP_VERSION_STORAGE_KEY, currentVersion);
  return { migrated, previousVersion, currentVersion };
}
