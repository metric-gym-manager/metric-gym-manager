/**
 * @jest-environment node
 *
 * `next/server` reaches for the `Request` global at import time, which jsdom
 * does not provide.
 */
import { NextRequest } from 'next/server'

/**
 * The auth callback had no test of any kind, and that is precisely how password
 * recovery stayed broken: the route read `token_hash` while the project was
 * configured for PKCE (`?code=`), so it could never have verified a real link.
 * Nothing in the suite reached it, because every other auth test mocks Supabase
 * one layer above.
 *
 * These tests pin the branch selection and the redirect targets — the decisions
 * this route actually owns.
 */
const verifyOtp = jest.fn()
const exchangeCodeForSession = jest.fn()
const signOut = jest.fn()
const single = jest.fn()
const update = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { verifyOtp, exchangeCodeForSession, signOut },
  }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
      update: (...args: unknown[]) => {
        update(...args)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

import { GET } from '../route'

const user = { id: 'u1', email: 'owner@gym.lk' }

const visit = async (query: string) => {
  const res = await GET(
    new NextRequest(new URL(`http://localhost:3000/auth/callback${query}`))
  )
  return {
    status: res.status,
    location: new URL(res.headers.get('location')!).pathname,
    search: new URL(res.headers.get('location')!).search,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  verifyOtp.mockResolvedValue({ data: { user }, error: null })
  exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null })
  signOut.mockResolvedValue({ error: null })
  single.mockResolvedValue({ data: { id: 'g1', email_verified: false } })
})

describe('auth callback — flow selection', () => {
  it('exchanges a PKCE ?code=', async () => {
    const r = await visit('?code=abc123')

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(r.location).toBe('/members')
  })

  it('verifies a ?token_hash= + &type=', async () => {
    const r = await visit('?token_hash=tok&type=signup')

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'signup',
      token_hash: 'tok',
    })
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(r.location).toBe('/members')
  })

  it('rejects a link carrying neither', async () => {
    const r = await visit('')
    expect(r.search).toContain('error=missing_code')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('rejects a token_hash with no type rather than guessing one', async () => {
    const r = await visit('?token_hash=tok')
    expect(r.search).toContain('error=missing_code')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('sends the user to login when verification fails', async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'expired' },
    })
    const r = await visit('?token_hash=stale&type=signup')
    expect(r.search).toContain('error=verification_failed')
  })

  it('treats a success-shaped response with no user as a failure', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const r = await visit('?code=abc123')
    expect(r.search).toContain('error=verification_failed')
  })
})

describe('auth callback — legacy recovery links', () => {
  it('signs out and explains, instead of leaving the user logged in', async () => {
    // Verifying spends the token, so there is none left to pass on. Leaving the
    // session live would turn a password reset into a silent login — which is
    // exactly what happened in production on 2026-09-11.
    const r = await visit('?token_hash=tok&type=recovery')

    expect(signOut).toHaveBeenCalled()
    expect(r.location).toBe('/reset-password')
  })

  it('never touches the gym profile on a recovery link', async () => {
    await visit('?token_hash=tok&type=recovery')
    expect(update).not.toHaveBeenCalled()
  })
})

describe('auth callback — destination is decided server-side', () => {
  it('sends an email change to the security settings', async () => {
    const r = await visit('?token_hash=tok&type=email_change')
    expect(r.location).toBe('/settings/security')
  })

  it('sends a signup confirmation to the default landing page', async () => {
    const r = await visit('?token_hash=tok&type=signup')
    expect(r.location).toBe('/members')
  })

  it('falls back to the default for a PKCE code, which carries no type', async () => {
    const r = await visit('?code=abc123')
    expect(r.location).toBe('/members')
  })

  it.each([
    ['an internal path', '/dashboard'],
    ['a protocol-relative URL', '//evil.com'],
    ['an absolute external URL', 'https://evil.com'],
  ])('ignores a client-supplied ?next= carrying %s', async (_name, target) => {
    // Routing is a server-side fact now. `next` used to be honoured — which
    // meant it had to be sanitised on every use — and is simply not read.
    // Ignoring it outright is a stronger property than sanitising it.
    const r = await visit(
      `?token_hash=tok&type=signup&next=${encodeURIComponent(target)}`
    )
    expect(r.location).toBe('/members')
    expect(r.location).not.toContain('evil.com')
  })
})
