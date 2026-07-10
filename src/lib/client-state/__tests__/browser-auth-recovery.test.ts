import {
  readBrowserCookies,
  purgeSupabaseAuthCookies,
  purgeSupabaseLocalStorage,
  validateAndRepairAuthState,
  consumeAuthFailedFlag,
} from '../browser-auth-recovery';
import { AUTH_FAILED_COOKIE } from '@/lib/auth-config';

const SESSION_JSON = JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: '1' } });

function clearAllCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

describe('browser-auth-recovery', () => {
  beforeEach(() => {
    clearAllCookies();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('readBrowserCookies', () => {
    it('parses cookies into name/value pairs', () => {
      document.cookie = 'alpha=1; path=/';
      document.cookie = 'beta=two; path=/';
      const cookies = readBrowserCookies();
      expect(cookies).toEqual(
        expect.arrayContaining([
          { name: 'alpha', value: '1' },
          { name: 'beta', value: 'two' },
        ])
      );
    });

    it('returns [] when there are no cookies', () => {
      expect(readBrowserCookies()).toEqual([]);
    });
  });

  describe('purgeSupabaseAuthCookies', () => {
    it('removes sb-* cookies and leaves others alone', () => {
      document.cookie = `sb-abc-auth-token=${encodeURIComponent(SESSION_JSON)}; path=/`;
      document.cookie = 'sb-abc-auth-token-code-verifier=xyz; path=/';
      document.cookie = 'remember_session=1; path=/';

      purgeSupabaseAuthCookies();

      const names = readBrowserCookies().map((c) => c.name);
      expect(names).not.toContain('sb-abc-auth-token');
      expect(names).not.toContain('sb-abc-auth-token-code-verifier');
      expect(names).toContain('remember_session');
    });
  });

  describe('purgeSupabaseLocalStorage', () => {
    it('removes legacy Supabase auth entries from both storages', () => {
      window.localStorage.setItem('sb-abc-auth-token', '{}');
      window.localStorage.setItem('supabase.auth.token', '{}');
      window.localStorage.setItem('mgm:v1:user_settings', '{"keep":true}');
      window.sessionStorage.setItem('sb-abc-auth-token', '{}');

      purgeSupabaseLocalStorage();

      expect(window.localStorage.getItem('sb-abc-auth-token')).toBeNull();
      expect(window.localStorage.getItem('supabase.auth.token')).toBeNull();
      expect(window.localStorage.getItem('mgm:v1:user_settings')).toBe('{"keep":true}');
      expect(window.sessionStorage.getItem('sb-abc-auth-token')).toBeNull();
    });
  });

  describe('validateAndRepairAuthState', () => {
    it('leaves a healthy session untouched and reports no repair', () => {
      document.cookie = `sb-abc-auth-token=${encodeURIComponent(SESSION_JSON)}; path=/`;

      expect(validateAndRepairAuthState()).toBe(false);
      expect(readBrowserCookies().map((c) => c.name)).toContain('sb-abc-auth-token');
    });

    it('wipes a malformed session cookie (token rot)', () => {
      document.cookie = 'sb-abc-auth-token=%7B%22broken; path=/';

      expect(validateAndRepairAuthState()).toBe(true);
      expect(readBrowserCookies().map((c) => c.name)).not.toContain('sb-abc-auth-token');
    });

    it('wipes malformed legacy localStorage tokens but keeps parseable and base64 ones', () => {
      window.localStorage.setItem('sb-abc-auth-token', '{"not json');
      window.localStorage.setItem('sb-def-auth-token', '{"valid":true}');
      window.localStorage.setItem('sb-ghi-auth-token', 'base64-eyJvayI6dHJ1ZX0');

      expect(validateAndRepairAuthState()).toBe(true);
      expect(window.localStorage.getItem('sb-abc-auth-token')).toBeNull();
      expect(window.localStorage.getItem('sb-def-auth-token')).toBe('{"valid":true}');
      expect(window.localStorage.getItem('sb-ghi-auth-token')).toBe('base64-eyJvayI6dHJ1ZX0');
    });

    it('reports no repair on a clean browser', () => {
      expect(validateAndRepairAuthState()).toBe(false);
    });
  });

  describe('hardResetAuthState', () => {
    it('purges all auth artifacts and redirects to /login from a protected route', () => {
      jest.isolateModules(() => {
        const replaceMock = jest.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
          value: {
            pathname: '/dashboard',
            hostname: 'localhost',
            replace: replaceMock,
          },
          writable: true,
          configurable: true,
        });

        try {
          document.cookie = 'sb-abc-auth-token=rotten; path=/';
          window.localStorage.setItem('sb-abc-auth-token', 'rotten');

          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const recovery = require('../browser-auth-recovery') as typeof import('../browser-auth-recovery');
          recovery.hardResetAuthState();

          expect(replaceMock).toHaveBeenCalledWith('/login');
          expect(window.localStorage.getItem('sb-abc-auth-token')).toBeNull();
          expect(document.cookie).not.toContain('sb-abc-auth-token=rotten');
          // Leaves the "session expired" flag for the login page to consume.
          expect(document.cookie).toContain(`${AUTH_FAILED_COOKIE}=1`);
        } finally {
          Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
            configurable: true,
          });
        }
      });
    });

    it('does not redirect from a public route', () => {
      jest.isolateModules(() => {
        const replaceMock = jest.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
          value: { pathname: '/login', hostname: 'localhost', replace: replaceMock },
          writable: true,
          configurable: true,
        });

        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const recovery = require('../browser-auth-recovery') as typeof import('../browser-auth-recovery');
          recovery.hardResetAuthState();
          expect(replaceMock).not.toHaveBeenCalled();
        } finally {
          Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
            configurable: true,
          });
        }
      });
    });
  });

  describe('consumeAuthFailedFlag', () => {
    it('returns true exactly once when the middleware left a flag', () => {
      document.cookie = `${AUTH_FAILED_COOKIE}=1; path=/`;
      expect(consumeAuthFailedFlag()).toBe(true);
      expect(consumeAuthFailedFlag()).toBe(false);
    });

    it('returns false when no flag is set', () => {
      expect(consumeAuthFailedFlag()).toBe(false);
    });
  });
});
