import {
  safeJsonParse,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeListKeys,
  safeReadJson,
  safeWriteJson,
  namespacedKey,
  appStorage,
} from '../safe-storage';
import { APP_MAJOR_VERSION } from '../app-version';

describe('safe-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    });

    it('returns ok:false for malformed JSON instead of throwing', () => {
      expect(safeJsonParse('{"a":1')).toEqual({ ok: false });
      expect(safeJsonParse('not json at all')).toEqual({ ok: false });
    });

    it('returns ok:false for null, undefined and empty string', () => {
      expect(safeJsonParse(null)).toEqual({ ok: false });
      expect(safeJsonParse(undefined)).toEqual({ ok: false });
      expect(safeJsonParse('')).toEqual({ ok: false });
    });
  });

  describe('guarded storage access', () => {
    it('reads and writes values', () => {
      expect(safeSetItem('k', 'v')).toBe(true);
      expect(safeGetItem('k')).toBe('v');
      safeRemoveItem('k');
      expect(safeGetItem('k')).toBeNull();
    });

    it('lists keys', () => {
      safeSetItem('a', '1');
      safeSetItem('b', '2');
      expect(safeListKeys().sort()).toEqual(['a', 'b']);
    });

    it('returns false instead of throwing when setItem fails (quota/private mode)', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(safeSetItem('k', 'v')).toBe(false);
      spy.mockRestore();
    });

    it('returns null instead of throwing when getItem fails', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(safeGetItem('k')).toBeNull();
      spy.mockRestore();
    });
  });

  describe('safeReadJson (JSON-parse catch-all)', () => {
    it('reads valid JSON values', () => {
      safeSetItem('good', JSON.stringify({ theme: 'dark' }));
      expect(safeReadJson('good')).toEqual({ theme: 'dark' });
    });

    it('wipes a malformed stored value immediately and returns null', () => {
      safeSetItem('rotten', '{"broken": tru');
      expect(safeReadJson('rotten')).toBeNull();
      // The corrupt value must be gone so it can never poison a later read.
      expect(safeGetItem('rotten')).toBeNull();
    });

    it('round-trips through safeWriteJson', () => {
      expect(safeWriteJson('obj', { n: 42 })).toBe(true);
      expect(safeReadJson('obj')).toEqual({ n: 42 });
    });
  });

  describe('namespaced app storage', () => {
    it('prefixes keys with the app major version', () => {
      expect(namespacedKey('user_settings')).toBe(`mgm:v${APP_MAJOR_VERSION}:user_settings`);
    });

    it('stores and retrieves under the namespaced key', () => {
      appStorage.set('user_settings', { locale: 'en' });
      expect(window.localStorage.getItem(`mgm:v${APP_MAJOR_VERSION}:user_settings`)).not.toBeNull();
      expect(appStorage.get('user_settings')).toEqual({ locale: 'en' });
      appStorage.remove('user_settings');
      expect(appStorage.get('user_settings')).toBeNull();
    });
  });
});
