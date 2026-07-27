/**
 * @jest-environment node
 */

/**
 * Unit tests for the public /join/{token} data load.
 *
 * Regression guard: a valid, active token must keep resolving even when an
 * OPTIONAL part of the gym row cannot be read (e.g. the admission-fee columns
 * are absent because their migration has not been applied yet). That failure
 * previously bubbled up as "this link is no longer active", which told every
 * gym with a printed poster that their QR code had been replaced.
 */

let mockAdminClient: unknown
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}))

process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'

import {
  getPublicGymInfo,
  getGymAdmissionFee,
  lookupRegistrationToken,
} from '../services/registration-link.service'

const TOKEN = '67b3cbf27225d43ac1aa0d50d06ddad6'
const GYM_ID = '481599f6-5134-4152-83b2-6e2dd10e3018'

/** PostgREST error for selecting a column that does not exist. */
const MISSING_COLUMN_ERROR = {
  code: '42703',
  message: 'column gyms.admission_fee does not exist',
}

interface TableBehaviour {
  /** Result for the gym_registration_links token lookup */
  link?: { data: unknown; error: unknown }
  /** Result for a `gyms` select, keyed by the selected column list */
  gyms?: Record<string, { data: unknown; error: unknown }>
  /** Result for the plan_types select */
  plans?: { data: unknown; error: unknown }
}

/**
 * Minimal Supabase query-builder stub: every chain link returns `this`, and
 * the terminal `single`/`maybeSingle`/`then` resolves the configured result.
 */
function makeClient(behaviour: TableBehaviour) {
  return {
    from(table: string) {
      let selected = ''

      const resolve = (): { data: unknown; error: unknown } => {
        if (table === 'gym_registration_links') {
          return behaviour.link ?? { data: null, error: null }
        }
        if (table === 'gyms') {
          return (
            behaviour.gyms?.[selected] ?? {
              data: null,
              error: { message: `unexpected select: ${selected}` },
            }
          )
        }
        return behaviour.plans ?? { data: [], error: null }
      }

      const builder = {
        select(columns: string) {
          selected = columns
          return builder
        },
        eq: () => builder,
        order: () => builder,
        single: () => Promise.resolve(resolve()),
        maybeSingle: () => Promise.resolve(resolve()),
        // `await`ing the builder directly (the plan_types list query)
        then: (
          onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
      }

      return builder
    },
  }
}

const ACTIVE_LINK = {
  data: { gym_id: GYM_ID, is_active: true },
  error: null,
}

const PLANS = {
  data: [{ plan_type: 'monthly', default_amount: 3000 }],
  error: null,
}

describe('getPublicGymInfo', () => {
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    jest.clearAllMocks()
  })

  it('returns the gym, plans and fee for a valid active token', async () => {
    mockAdminClient = makeClient({
      link: ACTIVE_LINK,
      gyms: {
        gym_name: { data: { gym_name: 'Prime Gym' }, error: null },
        'admission_fee, admission_fee_enabled': {
          data: { admission_fee: 500, admission_fee_enabled: true },
          error: null,
        },
      },
      plans: PLANS,
    })

    const result = await getPublicGymInfo(TOKEN)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.gym.gymName).toBe('Prime Gym')
    expect(result.gym.plans).toEqual([
      { planType: 'monthly', label: expect.any(String), amount: 3000 },
    ])
    expect(result.gym.admissionFee).toBe(500)
    expect(result.gym.admissionFeeEnabled).toBe(true)
  })

  it('still serves the form when the admission-fee columns are missing', async () => {
    mockAdminClient = makeClient({
      link: ACTIVE_LINK,
      gyms: {
        gym_name: { data: { gym_name: 'Prime Gym' }, error: null },
        'admission_fee, admission_fee_enabled': {
          data: null,
          error: MISSING_COLUMN_ERROR,
        },
      },
      plans: PLANS,
    })

    const result = await getPublicGymInfo(TOKEN)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.gym.gymName).toBe('Prime Gym')
    // Fee degrades to "not charged" rather than killing the link
    expect(result.gym.admissionFee).toBe(0)
    expect(result.gym.admissionFeeEnabled).toBe(false)
  })

  it('reports not_found for an unknown token', async () => {
    mockAdminClient = makeClient({ link: { data: null, error: null } })

    await expect(getPublicGymInfo(TOKEN)).resolves.toEqual({
      status: 'not_found',
    })
  })

  it('reports not_found for a deactivated link', async () => {
    mockAdminClient = makeClient({
      link: { data: { gym_id: GYM_ID, is_active: false }, error: null },
    })

    await expect(getPublicGymInfo(TOKEN)).resolves.toEqual({
      status: 'not_found',
    })
  })

  it('reports not_found for a malformed token without querying', async () => {
    const from = jest.fn()
    mockAdminClient = { from }

    await expect(getPublicGymInfo('not-a-token')).resolves.toEqual({
      status: 'not_found',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('reports error (not a dead link) when the token lookup fails', async () => {
    mockAdminClient = makeClient({
      link: { data: null, error: { message: 'connection reset' } },
    })

    await expect(getPublicGymInfo(TOKEN)).resolves.toEqual({ status: 'error' })
  })

  it('reports error (not a dead link) when the gym row cannot be read', async () => {
    mockAdminClient = makeClient({
      link: ACTIVE_LINK,
      gyms: {
        gym_name: { data: null, error: { message: 'connection reset' } },
        'admission_fee, admission_fee_enabled': { data: null, error: null },
      },
      plans: PLANS,
    })

    await expect(getPublicGymInfo(TOKEN)).resolves.toEqual({ status: 'error' })
  })

  it('reports error when the plan list cannot be read', async () => {
    mockAdminClient = makeClient({
      link: ACTIVE_LINK,
      gyms: {
        gym_name: { data: { gym_name: 'Prime Gym' }, error: null },
        'admission_fee, admission_fee_enabled': { data: null, error: null },
      },
      plans: { data: null, error: { message: 'connection reset' } },
    })

    await expect(getPublicGymInfo(TOKEN)).resolves.toEqual({ status: 'error' })
  })
})

describe('lookupRegistrationToken', () => {
  it('accepts an uppercase token (QR scanners may upcase the URL)', async () => {
    mockAdminClient = makeClient({ link: ACTIVE_LINK })

    await expect(lookupRegistrationToken(TOKEN.toUpperCase())).resolves.toEqual(
      { status: 'ok', gymId: GYM_ID }
    )
  })
})

describe('getGymAdmissionFee', () => {
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => errorSpy.mockRestore())

  it('returns the fee when enabled', async () => {
    mockAdminClient = makeClient({
      gyms: {
        'admission_fee, admission_fee_enabled': {
          data: { admission_fee: 500, admission_fee_enabled: true },
          error: null,
        },
      },
    })

    await expect(getGymAdmissionFee(GYM_ID)).resolves.toBe(500)
  })

  it('returns 0 when disabled', async () => {
    mockAdminClient = makeClient({
      gyms: {
        'admission_fee, admission_fee_enabled': {
          data: { admission_fee: 500, admission_fee_enabled: false },
          error: null,
        },
      },
    })

    await expect(getGymAdmissionFee(GYM_ID)).resolves.toBe(0)
  })

  it('returns 0 when the columns cannot be read', async () => {
    mockAdminClient = makeClient({
      gyms: {
        'admission_fee, admission_fee_enabled': {
          data: null,
          error: MISSING_COLUMN_ERROR,
        },
      },
    })

    await expect(getGymAdmissionFee(GYM_ID)).resolves.toBe(0)
  })
})
