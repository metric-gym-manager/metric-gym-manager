/**
 * @jest-environment node
 *
 * jsdom provides no `Request` global, and `next/server` reaches for it at
 * import time — the suite fails to load before a single test runs.
 */
import { NextRequest } from 'next/server'

const getUser = jest.fn()
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

import { authMiddleware } from '../auth'

/**
 * Routing decisions for the auth boundary.
 *
 * These four cases were never covered, and the gap hid a break in the entire
 * password-recovery flow: `/reset-password` was listed in `AUTH_ROUTES`, but
 * recovery *requires* a session — `/auth/callback?type=recovery` runs
 * `verifyOtp` (writing the auth cookies) and only then redirects to the reset
 * form. The browser therefore arrived authenticated, `isAuthenticated &&
 * isAuthRoute` matched, and the user was 307'd to `/dashboard` with their
 * password unchanged and no form ever shown.
 *
 * Nothing in the suite could see it: the page component renders fine in
 * isolation, and no test exercised the middleware that stood in front of it.
 */
const visit = async (pathname: string, authed: boolean) => {
  getUser.mockResolvedValue(
    authed
      ? { data: { user: { id: 'u1', email: 'owner@gym.lk' } }, error: null }
      : { data: { user: null }, error: null }
  )
  const res = await authMiddleware(
    new NextRequest(new URL(`http://localhost:3000${pathname}`))
  )
  return {
    status: res.status,
    location: res.headers.get('location'),
    redirected: res.status >= 300 && res.status < 400,
  }
}

beforeEach(() => jest.clearAllMocks())

describe('authMiddleware — auth boundary routing', () => {
  describe('password recovery', () => {
    it('serves /reset-password to the authenticated user recovery creates', async () => {
      // The regression. This MUST NOT redirect: the session is the credential
      // that authorises the reset, not a reason to refuse the page.
      const r = await visit('/reset-password', true)
      expect(r.redirected).toBe(false)
      expect(r.status).toBe(200)
    })

    it('serves /reset-password to an anonymous visitor too', async () => {
      // Someone opening the link in a different browser gets the form and a
      // server-side refusal on submit — not a redirect that explains nothing.
      const r = await visit('/reset-password', false)
      expect(r.redirected).toBe(false)
    })

    it('keeps /forgot-password closed to the already-authenticated', async () => {
      // Unlike reset, this one needs no session and has no legitimate use for
      // someone already signed in.
      const r = await visit('/forgot-password', true)
      expect(r.location).toContain('/dashboard')
    })
  })

  describe('sign-in pages', () => {
    it('sends an authenticated visitor away from /login', async () => {
      const r = await visit('/login', true)
      expect(r.redirected).toBe(true)
      expect(r.location).toContain('/dashboard')
    })

    it('serves /login to an anonymous visitor', async () => {
      const r = await visit('/login', false)
      expect(r.redirected).toBe(false)
    })
  })

  it('serves /verify-email regardless of session — the standing precedent', async () => {
    // Email confirmation is session-bearing in exactly the way recovery is.
    // If this ever starts redirecting, recovery is about to break the same way.
    expect((await visit('/verify-email', true)).redirected).toBe(false)
    expect((await visit('/verify-email', false)).redirected).toBe(false)
  })

  it('sends an anonymous visitor on a protected route to login', async () => {
    const r = await visit('/members', false)
    expect(r.redirected).toBe(true)
    expect(r.location).toContain('/login')
  })

  it('serves a protected route to an authenticated user', async () => {
    expect((await visit('/members', true)).redirected).toBe(false)
  })
})
