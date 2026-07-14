import {
  isSupabaseAuthCookie,
  isSupabaseSessionCookie,
  isWellFormedSessionValue,
  findCorruptSessionCookieNames,
  isInvalidRefreshTokenError,
  isRetryableAuthError,
} from '../auth-token-guard';

const SESSION_JSON = JSON.stringify({
  access_token: 'jwt-a',
  refresh_token: 'rt-b',
  user: { id: 'user-1' },
});

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('auth-token-guard', () => {
  describe('cookie name classification', () => {
    it('recognizes Supabase auth cookies', () => {
      expect(isSupabaseAuthCookie('sb-abc-auth-token')).toBe(true);
      expect(isSupabaseAuthCookie('sb-abc-auth-token.0')).toBe(true);
      expect(isSupabaseAuthCookie('sb-abc-auth-token-code-verifier')).toBe(true);
      expect(isSupabaseAuthCookie('remember_session')).toBe(false);
    });

    it('classifies session cookies but not PKCE verifiers', () => {
      expect(isSupabaseSessionCookie('sb-abc-auth-token')).toBe(true);
      expect(isSupabaseSessionCookie('sb-abc-auth-token.1')).toBe(true);
      expect(isSupabaseSessionCookie('sb-abc-auth-token-code-verifier')).toBe(false);
      expect(isSupabaseSessionCookie('other_cookie')).toBe(false);
    });
  });

  describe('isWellFormedSessionValue', () => {
    it('accepts raw JSON sessions', () => {
      expect(isWellFormedSessionValue(SESSION_JSON)).toBe(true);
    });

    it('accepts base64- prefixed sessions', () => {
      expect(isWellFormedSessionValue(`base64-${toBase64Url(SESSION_JSON)}`)).toBe(true);
    });

    it('accepts URI-encoded JSON sessions (legacy format)', () => {
      expect(isWellFormedSessionValue(encodeURIComponent(SESSION_JSON))).toBe(true);
    });

    it('rejects truncated JSON', () => {
      expect(isWellFormedSessionValue(SESSION_JSON.slice(0, 25))).toBe(false);
    });

    it('rejects base64 payloads that decode to garbage', () => {
      expect(isWellFormedSessionValue(`base64-${toBase64Url('not { json')}`)).toBe(false);
    });

    it('rejects empty values', () => {
      expect(isWellFormedSessionValue('')).toBe(false);
    });
  });

  describe('findCorruptSessionCookieNames', () => {
    it('returns empty for a healthy unchunked session', () => {
      expect(
        findCorruptSessionCookieNames([{ name: 'sb-abc-auth-token', value: SESSION_JSON }])
      ).toEqual([]);
    });

    it('returns empty for healthy contiguous chunks', () => {
      const encoded = `base64-${toBase64Url(SESSION_JSON)}`;
      const mid = Math.floor(encoded.length / 2);
      expect(
        findCorruptSessionCookieNames([
          { name: 'sb-abc-auth-token.0', value: encoded.slice(0, mid) },
          { name: 'sb-abc-auth-token.1', value: encoded.slice(mid) },
        ])
      ).toEqual([]);
    });

    it('flags a malformed unchunked cookie', () => {
      expect(
        findCorruptSessionCookieNames([{ name: 'sb-abc-auth-token', value: '{"oops' }])
      ).toEqual(['sb-abc-auth-token']);
    });

    it('flags chunked cookies with a missing chunk (partial overwrite)', () => {
      expect(
        findCorruptSessionCookieNames([
          { name: 'sb-abc-auth-token.0', value: 'base64-abc' },
          { name: 'sb-abc-auth-token.2', value: 'def' },
        ]).sort()
      ).toEqual(['sb-abc-auth-token.0', 'sb-abc-auth-token.2']);
    });

    it('flags overlap corruption: whole cookie AND chunks for the same base name', () => {
      expect(
        findCorruptSessionCookieNames([
          { name: 'sb-abc-auth-token', value: SESSION_JSON },
          { name: 'sb-abc-auth-token.0', value: 'base64-zzz' },
        ]).sort()
      ).toEqual(['sb-abc-auth-token', 'sb-abc-auth-token.0']);
    });

    it('ignores non-Supabase and PKCE-verifier cookies', () => {
      expect(
        findCorruptSessionCookieNames([
          { name: 'remember_session', value: '1' },
          { name: 'sb-abc-auth-token-code-verifier', value: 'plain-string-not-json' },
        ])
      ).toEqual([]);
    });

    it('handles an empty cookie set', () => {
      expect(findCorruptSessionCookieNames([])).toEqual([]);
    });
  });

  describe('isInvalidRefreshTokenError', () => {
    it('matches a 400 with "Invalid Refresh Token" message', () => {
      expect(
        isInvalidRefreshTokenError({ status: 400, message: 'Invalid Refresh Token: Already Used' })
      ).toBe(true);
    });

    it('matches GoTrue error codes regardless of message', () => {
      expect(isInvalidRefreshTokenError({ code: 'refresh_token_not_found' })).toBe(true);
      expect(isInvalidRefreshTokenError({ error_code: 'refresh_token_already_used' })).toBe(true);
    });

    it('matches "Refresh Token Not Found" without a status', () => {
      expect(isInvalidRefreshTokenError({ message: 'Refresh Token Not Found' })).toBe(true);
    });

    it('does not match unrelated 400s', () => {
      expect(isInvalidRefreshTokenError({ status: 400, message: 'Email not confirmed' })).toBe(false);
    });

    it('does not match network errors, null, or non-objects', () => {
      expect(isInvalidRefreshTokenError({ status: 502, message: 'Bad Gateway' })).toBe(false);
      expect(isInvalidRefreshTokenError(null)).toBe(false);
      expect(isInvalidRefreshTokenError(undefined)).toBe(false);
      expect(isInvalidRefreshTokenError('Invalid Refresh Token')).toBe(false);
    });
  });

  describe('isRetryableAuthError', () => {
    it('treats network fetch failures as retryable', () => {
      expect(isRetryableAuthError({ name: 'AuthRetryableFetchError', message: 'fetch failed' })).toBe(true);
      expect(isRetryableAuthError({ message: 'fetch failed' })).toBe(true); // no status
      expect(isRetryableAuthError({ status: 0 })).toBe(true);
      expect(isRetryableAuthError({ status: 503 })).toBe(true);
    });

    it('treats explicit 4xx auth rejections as NOT retryable', () => {
      expect(isRetryableAuthError({ status: 400, message: 'Invalid Refresh Token' })).toBe(false);
      expect(isRetryableAuthError({ status: 401 })).toBe(false);
    });

    it('handles null and non-objects', () => {
      expect(isRetryableAuthError(null)).toBe(false);
      expect(isRetryableAuthError('boom')).toBe(false);
    });
  });
});
