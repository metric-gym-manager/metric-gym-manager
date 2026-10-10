/**
 * @jest-environment node
 */

/**
 * The entitlement gate for every gym-facing access-control route.
 *
 * This is the check most likely to be forgotten if it were written inline in
 * fourteen handlers, and forgetting it means a Lite gym can drive door
 * hardware. It is also the only place the three preconditions — signed in,
 * owns a gym, entitled — are established, so each one is pinned here.
 */

const mockGetUser = jest.fn()
const mockSingle = jest.fn()
const mockFindByGymId = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
    }),
  }),
}))

jest.mock('@/features/subscriptions', () => ({
  createGymSubscriptionRepository: jest.fn(() => ({
    findByGymId: mockFindByGymId,
  })),
}))

import { requireAccessControlGym } from '../requireAccessControlGym'
import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig'

describe('requireAccessControlGym', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { id: 'gym-1' }, error: null })
    mockFindByGymId.mockResolvedValue({ tier: SaasTier.Enterprise })
  })

  it('admits an Enterprise gym', async () => {
    const { caller, error } = await requireAccessControlGym()

    expect(error).toBeNull()
    expect(caller?.gymId).toBe('gym-1')
    expect(caller?.userId).toBe('user-1')
  })

  it('rejects an unauthenticated caller with 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { caller, error } = await requireAccessControlGym()

    expect(caller).toBeNull()
    expect(error?.status).toBe(401)
    // Never even looked up a subscription.
    expect(mockFindByGymId).not.toHaveBeenCalled()
  })

  it('rejects a user with no gym profile with 404', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'none' } })

    const { error } = await requireAccessControlGym()

    expect(error?.status).toBe(404)
    expect(mockFindByGymId).not.toHaveBeenCalled()
  })

  it.each([
    ['Lite', SaasTier.Lite],
    ['Pro', SaasTier.Pro],
  ])('rejects a %s gym with 403', async (_label, tier) => {
    mockFindByGymId.mockResolvedValue({ tier })

    const { caller, error } = await requireAccessControlGym()

    expect(caller).toBeNull()
    expect(error?.status).toBe(403)
  })

  it('fails closed when the subscription cannot be resolved', async () => {
    // A gym that cannot be shown to be entitled is not entitled. The
    // alternative — treating an unreadable subscription as permission — would
    // turn a database hiccup into door-hardware access.
    mockFindByGymId.mockResolvedValue(null)

    const { error } = await requireAccessControlGym()

    expect(error?.status).toBe(403)
  })
})

/**
 * A corrupted session cookie (remote day, F-06 / AP-02).
 *
 * The Supabase client throws while DECODING the cookie, before it can answer
 * "no user" — so the guard's 401 branch was never reached and the route
 * answered 500. A cookie that cannot be read is still no user: the caller is
 * unauthenticated, which is a client condition, not a server fault.
 */
describe('requireAccessControlGym — an undecodable session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('answers 401, not a thrown error, when the session cannot be decoded', async () => {
    mockGetUser.mockRejectedValue(new Error('Invalid base64'))

    const { caller, error } = await requireAccessControlGym()

    expect(caller).toBeNull()
    expect(error?.status).toBe(401)
    // Rejected before anything else was looked up.
    expect(mockFindByGymId).not.toHaveBeenCalled()
  })

  it('answers 401 exactly as before when the session simply has no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { caller, error } = await requireAccessControlGym()

    expect(caller).toBeNull()
    expect(error?.status).toBe(401)
  })
})
