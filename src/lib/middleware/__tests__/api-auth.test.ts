/**
 * @jest-environment node
 *
 * `next/server` reaches for the `Request` global at import time, which jsdom
 * does not provide.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * `getApiGymProfile` — the shape every authenticated screen receives.
 *
 * This exists because of a gap found by mutation testing. `pending_email` was
 * added here so the security page could tell a pending email CHANGE (two
 * inboxes must confirm, because `double_confirm_changes` makes the current
 * address approve) from an unconfirmed SIGNUP (one inbox). Deleting the field
 * from this function broke nothing: every page test mocks `/api/auth/profile`,
 * so the banner silently fell back to the one-address wording and all ten
 * passed. That is the same shape as the defects this whole area has produced —
 * a mocked boundary hiding the real one.
 */
const getUser = jest.fn()
const single = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}))

import {
  getApiGymProfile,
  requireApiAuth,
  EMAIL_CHANGE_TTL_MS,
} from '../api-auth'

const gymRow = {
  id: 'g1',
  username: 'titan',
  email: 'owner@titan.test',
  email_verified: false,
  phone_number: null,
  gym_name: 'Titan',
  gym_address: null,
  gym_website: null,
  profile_image_url: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  single.mockResolvedValue({ data: gymRow, error: null })
})

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString()

/**
 * A pending change must stop being reported when its links stop working.
 *
 * Supabase clears `new_email` when a change COMPLETES, confirmed against this
 * project's `auth.users`. An ABANDONED change has nothing to clear it, so the
 * field lingers and the settings screen would advertise a pending change
 * forever — pointing at links that died at `otp_expiry` (30 minutes). Expiry is
 * therefore computed from `email_change_sent_at`, not inferred from the
 * presence of the field.
 */
describe('a pending change expires with its links', () => {
  const withChange = (sent_at?: string) => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          new_email: 'new@titan.test',
          ...(sent_at ? { email_change_sent_at: sent_at } : {}),
        },
      },
      error: null,
    })
  }

  it('reports a change requested a minute ago', async () => {
    withChange(minutesAgo(1))
    const { gymProfile } = await getApiGymProfile()
    expect(gymProfile).toHaveProperty('pending_email', 'new@titan.test')
  })

  it('stops reporting one abandoned an hour ago', async () => {
    withChange(minutesAgo(60))
    const { gymProfile } = await getApiGymProfile()
    expect(gymProfile).toHaveProperty('pending_email', null)
  })

  it('holds right up to the boundary, and drops just past it', async () => {
    // The window is the contract; off-by-one here either hides a live change or
    // strands a dead banner.
    withChange(
      new Date(Date.now() - (EMAIL_CHANGE_TTL_MS - 5_000)).toISOString()
    )
    expect((await getApiGymProfile()).gymProfile).toHaveProperty(
      'pending_email',
      'new@titan.test'
    )

    withChange(
      new Date(Date.now() - (EMAIL_CHANGE_TTL_MS + 5_000)).toISOString()
    )
    expect((await getApiGymProfile()).gymProfile).toHaveProperty(
      'pending_email',
      null
    )
  })

  it('drops a change abandoned 45 minutes ago', async () => {
    // A FIXED duration, deliberately. The boundary test above derives its input
    // from EMAIL_CHANGE_TTL_MS, so it moves with the constant and cannot detect
    // the window being widened. Mutation testing caught that: doubling the
    // window to an hour passed every test. 45 minutes is dead under a 30-minute
    // window and alive under a 60-minute one.
    withChange(minutesAgo(45))
    expect((await getApiGymProfile()).gymProfile).toHaveProperty(
      'pending_email',
      null
    )
  })

  it('matches the link lifetime Supabase is configured with', async () => {
    // The constant's doc comment promises it mirrors `auth.email.otp_expiry`.
    // Nothing enforced that, so the two could drift and the banner would either
    // outlive the links or vanish while they still worked. Read the real value.
    const toml = fs.readFileSync(
      path.join(process.cwd(), 'supabase/config.toml'),
      'utf8'
    )
    const match = toml.match(/^otp_expiry\s*=\s*(\d+)/m)
    expect(match).not.toBeNull()

    const otpExpirySeconds = Number(match![1])
    expect(EMAIL_CHANGE_TTL_MS).toBe(otpExpirySeconds * 1000)
  })

  it('shows it when the timestamp is missing or unparseable', async () => {
    // Cannot tell whether it is live. A stale banner the user can dismiss by
    // completing or reissuing beats hiding a change that is genuinely pending.
    withChange(undefined)
    expect((await getApiGymProfile()).gymProfile).toHaveProperty(
      'pending_email',
      'new@titan.test'
    )

    withChange('not-a-date')
    expect((await getApiGymProfile()).gymProfile).toHaveProperty(
      'pending_email',
      'new@titan.test'
    )
  })
})

describe('getApiGymProfile', () => {
  it('surfaces the address awaiting confirmation during an email change', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', new_email: 'new@titan.test' } },
      error: null,
    })

    const { gymProfile } = await getApiGymProfile()

    expect(gymProfile).toMatchObject({
      email: 'owner@titan.test',
      pending_email: 'new@titan.test',
    })
  })

  it('reports null when no change is in flight, not undefined', async () => {
    // The screen branches on this value. `undefined` and `null` behave the same
    // in a truthiness check today, but only one of them is a stated contract.
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })

    const { gymProfile } = await getApiGymProfile()

    expect(gymProfile).toHaveProperty('pending_email', null)
  })

  it('still returns the gym row itself', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', new_email: 'new@titan.test' } },
      error: null,
    })

    const { gymProfile, error } = await getApiGymProfile()

    expect(error).toBeNull()
    expect(gymProfile).toMatchObject({ username: 'titan', gym_name: 'Titan' })
  })

  it('refuses when there is no session', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'nope' },
    })

    const { gymProfile, error } = await getApiGymProfile()

    expect(gymProfile).toBeNull()
    expect(error).not.toBeNull()
  })

  it('reports a missing gym row rather than a half-built profile', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    single.mockResolvedValue({ data: null, error: { message: 'no rows' } })

    const { gymProfile, error } = await getApiGymProfile()

    expect(gymProfile).toBeNull()
    expect(error).not.toBeNull()
  })
})

/**
 * A corrupted session cookie (remote day, F-06 / AP-02).
 *
 * The Supabase client throws while decoding the cookie, before it can answer
 * "no user", so the 401 branch was never reached and the route answered 500.
 * A cookie that cannot be read is still no user.
 */
describe('requireApiAuth — an undecodable session', () => {
  let log: jest.SpyInstance

  beforeEach(() => {
    log = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    log.mockRestore()
  })

  it('answers 401, not a thrown error, when the session cannot be decoded', async () => {
    getUser.mockRejectedValue(new Error('Invalid base64'))

    const { user, error } = await requireApiAuth()

    expect(user).toBeNull()
    expect(error?.status).toBe(401)
    await expect(error?.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
    })
  })

  it('answers 401 exactly as before when the session simply has no user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const { user, error } = await requireApiAuth()

    expect(user).toBeNull()
    expect(error?.status).toBe(401)
  })

  it('still returns the user for a valid session', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })

    const { user, error } = await requireApiAuth()

    expect(error).toBeNull()
    expect(user).toEqual({ id: 'u1' })
  })
})
