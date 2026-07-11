import { enforceClientStateVersion } from '../version-guard';
import { APP_VERSION, APP_VERSION_STORAGE_KEY, CURRENT_SW_CACHE_NAME } from '../app-version';

describe('version-guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('stamps the version on first visit without purging anything', async () => {
    window.localStorage.setItem('some_existing_key', 'keep-me');

    const result = await enforceClientStateVersion();

    expect(result.migrated).toBe(false);
    expect(result.previousVersion).toBeNull();
    expect(result.currentVersion).toBe(APP_VERSION);
    expect(window.localStorage.getItem(APP_VERSION_STORAGE_KEY)).toBe(APP_VERSION);
    // First visit must not wipe anything — there is no stale state yet.
    expect(window.localStorage.getItem('some_existing_key')).toBe('keep-me');
  });

  it('is a no-op when the stored version matches', async () => {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    window.localStorage.setItem('app_state', '{"page":3}');

    const result = await enforceClientStateVersion();

    expect(result.migrated).toBe(false);
    expect(window.localStorage.getItem('app_state')).toBe('{"page":3}');
  });

  it('purges app-owned state on version mismatch but preserves the Supabase session', async () => {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, '0.0.1-old');
    window.localStorage.setItem('stale_app_state', '{"old":"shape"}');
    window.localStorage.setItem('sb-abc-auth-token', '{"access_token":"keep"}');
    window.localStorage.setItem('supabase.auth.token', '{"legacy":"keep"}');
    window.sessionStorage.setItem('stale_session_state', 'old');

    const result = await enforceClientStateVersion();

    expect(result.migrated).toBe(true);
    expect(result.previousVersion).toBe('0.0.1-old');
    // Stale app state gone
    expect(window.localStorage.getItem('stale_app_state')).toBeNull();
    expect(window.sessionStorage.getItem('stale_session_state')).toBeNull();
    // A deploy must never log the user out
    expect(window.localStorage.getItem('sb-abc-auth-token')).toBe('{"access_token":"keep"}');
    expect(window.localStorage.getItem('supabase.auth.token')).toBe('{"legacy":"keep"}');
    // New stamp written
    expect(window.localStorage.getItem(APP_VERSION_STORAGE_KEY)).toBe(APP_VERSION);
  });

  it('deletes zombie CacheStorage entries from older deployments', async () => {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, '0.0.1-old');

    const deleted: string[] = [];
    const cachesMock = {
      keys: jest.fn().mockResolvedValue(['saas-app-v0.0.1-old', CURRENT_SW_CACHE_NAME]),
      delete: jest.fn().mockImplementation((name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      }),
    };
    Object.defineProperty(globalThis, 'caches', { value: cachesMock, configurable: true });

    try {
      await enforceClientStateVersion();
      expect(deleted).toEqual(['saas-app-v0.0.1-old']);
    } finally {
      delete (globalThis as Record<string, unknown>).caches;
    }
  });

  it('survives CacheStorage throwing (private mode)', async () => {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, '0.0.1-old');
    Object.defineProperty(globalThis, 'caches', {
      value: { keys: jest.fn().mockRejectedValue(new Error('SecurityError')) },
      configurable: true,
    });

    try {
      const result = await enforceClientStateVersion();
      expect(result.migrated).toBe(true);
      expect(window.localStorage.getItem(APP_VERSION_STORAGE_KEY)).toBe(APP_VERSION);
    } finally {
      delete (globalThis as Record<string, unknown>).caches;
    }
  });
});
