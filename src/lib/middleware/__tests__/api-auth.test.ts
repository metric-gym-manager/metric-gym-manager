/**
 * @jest-environment node
 *
 * `next/server` reaches for the `Request` global at import time, which jsdom
 * does not provide.
 */

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

import { getApiGymProfile } from '../api-auth'

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
