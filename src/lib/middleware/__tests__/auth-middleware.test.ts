/**
 * @jest-environment node
 */

/**
 * authMiddleware tests: fail-safe session handling and redirect-loop
 * protection. These guard the fixes for client-side cache corruption /
 * stale state errors (token rot, ERR_TOO_MANY_REDIRECTS).
 */

import { NextRequest } from 'next/server'
import {
  AUTH_FAILED_COOKIE,
  AUTH_FAILED_HEADER,
  AUTH_LOOP_COOKIE,
  AUTH_LOOP_MAX_REDIRECTS,
} from '@/lib/auth-config'

const mockGetUser = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

// Import AFTER mocks are defined
import { authMiddleware } from '../auth'

const SESSION_JSON = JSON.stringify({
  access_token: 'jwt',
  refresh_token: 'rt',
  user: { id: 'user-1' },
})

function makeRequest(
  path: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ')
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
}

function signedOut(status = 401, message = 'invalid claim') {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { status, message, name: 'AuthApiError' },
  })
}

function signedIn() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'gym@example.com' } },
    error: null,
  })
}

describe('authMiddleware', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
  })

  describe('happy paths', () => {
    it('lets an authenticated user through to a protected route', async () => {
      signedIn()
      const res = await authMiddleware(
        makeRequest('/dashboard', { 'sb-abc-auth-token': SESSION_JSON })
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('redirects a clean visitor (no cookies) from a protected route to /login', async () => {
      signedOut(400, 'Auth session missing!')
      const res = await authMiddleware(makeRequest('/dashboard'))
      expect(res.status).toBeGreaterThanOrEqual(300)
      expect(res.status).toBeLessThan(400)
      const location = new URL(res.headers.get('location')!)
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('redirect')).toBe('/dashboard')
      // No token rot: nothing to flag or expire.
      expect(res.headers.get(AUTH_FAILED_HEADER)).toBeNull()
      // Loop guard starts counting.
      expect(res.cookies.get(AUTH_LOOP_COOKIE)?.value).toBe('1')
    })

    it('redirects an authenticated user away from /login to /dashboard', async () => {
      signedIn()
      const res = await authMiddleware(
        makeRequest('/login', { 'sb-abc-auth-token': SESSION_JSON })
      )
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
    })

    it('lets anyone reach public routes', async () => {
      signedOut(400, 'Auth session missing!')
      const res = await authMiddleware(makeRequest('/login'))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    /**
     * These four were behind auth until 2026-08-31, answering
     * `307 → /login?redirect=…` to a logged-out visitor. Payment providers and
     * app stores require terms, privacy and refund policies at URLs a reviewer
     * can open without an account, and `/privacy` publishes the access-event
     * retention period to data subjects who have no login by definition.
     *
     * Pinned per route rather than as one loop over `PUBLIC_ROUTES`, so the
     * test states which documents must stay reachable instead of asserting
     * that a list matches itself.
     */
    it.each(['/terms', '/privacy', '/refund-policy', '/contact'])(
      'serves %s to a signed-out visitor',
      async (pathname) => {
        signedOut(400, 'Auth session missing!')
        const res = await authMiddleware(makeRequest(pathname))
        expect(res.status).toBe(200)
        expect(res.headers.get('location')).toBeNull()
      }
    )

    /**
     * Exact matches, not prefixes: opening `/terms/` would make every future
     * nested route public by accident.
     */
    it.each(['/terms/internal', '/privacy/admin', '/contact/leads'])(
      'still guards %s',
      async (pathname) => {
        signedOut(400, 'Auth session missing!')
        const res = await authMiddleware(makeRequest(pathname))
        expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
      }
    )

    /**
     * The public marketing pages (SEO, 2026-10-01). A page that is not public
     * answers Googlebot — which never has a session — with 307 → /login, so
     * it can never be indexed while every rendering test stays green. These
     * are the pages a search result is most likely to land on; the full set is
     * held to PUBLIC_ROUTES by `features/marketing/tests/pages.test.ts`.
     */
    it.each([
      '/gym-management-software-sri-lanka',
      '/pricing',
      '/features/access-control',
      '/about',
      '/resources/billed-vs-collected-revenue',
    ])(
      'serves the marketing page %s to a signed-out visitor',
      async (pathname) => {
        signedOut(400, 'Auth session missing!')
        const res = await authMiddleware(makeRequest(pathname))
        expect(res.status).toBe(200)
        expect(res.headers.get('location')).toBeNull()
      }
    )

    it.each(['/features', '/pricing/admin', '/resources/drafts'])(
      'still guards the unlisted path %s',
      async (pathname) => {
        signedOut(400, 'Auth session missing!')
        const res = await authMiddleware(makeRequest(pathname))
        expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
      }
    )

    /**
     * A signed-in gym manager must still be able to read the terms they are
     * operating under — these are public documents, not an auth funnel, so
     * they must not join AUTH_ROUTES and bounce to /dashboard.
     */
    it.each(['/terms', '/privacy', '/refund-policy', '/contact'])(
      'serves %s to a signed-in user too',
      async (pathname) => {
        signedIn()
        const res = await authMiddleware(
          makeRequest(pathname, { 'sb-abc-auth-token': SESSION_JSON })
        )
        expect(res.status).toBe(200)
        expect(res.headers.get('location')).toBeNull()
      }
    )
  })

  describe('token rot (corrupt or dead session cookies)', () => {
    it('expires dead session cookies and flags the failure when redirecting', async () => {
      signedOut(401, 'invalid claim: token expired')
      const res = await authMiddleware(
        makeRequest('/dashboard', { 'sb-abc-auth-token': SESSION_JSON })
      )

      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
      expect(res.headers.get(AUTH_FAILED_HEADER)).toBe('true')
      // The rotten cookie is expired so the browser stops resending it.
      const expired = res.cookies.get('sb-abc-auth-token')
      expect(expired?.value).toBe('')
      expect(expired?.maxAge).toBe(0)
      // Client-readable flag for the "session expired" message.
      expect(res.cookies.get(AUTH_FAILED_COOKIE)?.value).toBe('1')
    })

    it('detects a structurally corrupt cookie even before auth runs', async () => {
      signedOut(400, 'Auth session missing!')
      const res = await authMiddleware(
        makeRequest('/dashboard', { 'sb-abc-auth-token': '{"broken' })
      )

      expect(res.headers.get(AUTH_FAILED_HEADER)).toBe('true')
      const expired = res.cookies.get('sb-abc-auth-token')
      expect(expired?.value).toBe('')
      expect(expired?.maxAge).toBe(0)
    })

    it('does NOT expire cookies on transient auth errors (network blip)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: {
          status: 503,
          message: 'fetch failed',
          name: 'AuthRetryableFetchError',
        },
      })
      const res = await authMiddleware(
        makeRequest('/dashboard', { 'sb-abc-auth-token': SESSION_JSON })
      )

      // Still redirected to login, but the (likely valid) session survives.
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
      expect(res.headers.get(AUTH_FAILED_HEADER)).toBeNull()
      expect(res.cookies.get('sb-abc-auth-token')).toBeUndefined()
    })

    it('quietly cleans a corrupt cookie on a public page without redirecting', async () => {
      signedOut(400, 'Auth session missing!')
      const res = await authMiddleware(
        makeRequest('/login', { 'sb-abc-auth-token': '{"broken' })
      )

      expect(res.status).toBe(200)
      const expired = res.cookies.get('sb-abc-auth-token')
      expect(expired?.value).toBe('')
      expect(expired?.maxAge).toBe(0)
    })
  })

  describe('redirect-loop protection', () => {
    it('increments the loop counter on each auth redirect', async () => {
      signedOut(401, 'invalid claim')
      const res = await authMiddleware(
        makeRequest('/dashboard', {
          'sb-abc-auth-token': SESSION_JSON,
          [AUTH_LOOP_COOKIE]: '1',
        })
      )
      expect(res.cookies.get(AUTH_LOOP_COOKIE)?.value).toBe('2')
    })

    it('rewrites to /login instead of redirecting once the loop limit is hit', async () => {
      signedOut(401, 'invalid claim')
      const res = await authMiddleware(
        makeRequest('/dashboard', {
          'sb-abc-auth-token': SESSION_JSON,
          [AUTH_LOOP_COOKIE]: String(AUTH_LOOP_MAX_REDIRECTS),
        })
      )

      // No 3xx hop — the browser gets a page at the current URL.
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('x-middleware-rewrite')).toContain('/login')
      expect(res.headers.get(AUTH_FAILED_HEADER)).toBe('true')
      // Dead cookies wiped, counter reset.
      expect(res.cookies.get('sb-abc-auth-token')?.maxAge).toBe(0)
      expect(res.cookies.get(AUTH_LOOP_COOKIE)?.maxAge).toBe(0)
    })

    it('stops bouncing an authenticated user off auth pages when the loop limit is hit', async () => {
      signedIn()
      const res = await authMiddleware(
        makeRequest('/login', {
          'sb-abc-auth-token': SESSION_JSON,
          [AUTH_LOOP_COOKIE]: String(AUTH_LOOP_MAX_REDIRECTS),
        })
      )

      // Serve the page instead of redirecting to /dashboard again.
      expect(res.headers.get('location')).toBeNull()
      expect(res.cookies.get(AUTH_LOOP_COOKIE)?.maxAge).toBe(0)
    })

    it('resets the loop counter on a successful pass-through', async () => {
      signedIn()
      const res = await authMiddleware(
        makeRequest('/dashboard', {
          'sb-abc-auth-token': SESSION_JSON,
          [AUTH_LOOP_COOKIE]: '2',
        })
      )
      expect(res.cookies.get(AUTH_LOOP_COOKIE)?.maxAge).toBe(0)
    })
  })
})
