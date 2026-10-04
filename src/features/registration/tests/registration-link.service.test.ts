/**
 * @jest-environment node
 */

/**
 * Unit tests for rotateRegistrationToken — the SaaS-operator "Generate New QR"
 * action. Rotating replaces the token (invalidating printed posters), stamps
 * rotated_at, and re-activates the link; the edge case of a gym with no link
 * falls back to an insert.
 */

// Deterministic token so assertions are stable.
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('0123456789abcdef')),
}))

const NEW_TOKEN = Buffer.from('0123456789abcdef').toString('hex')

let mockAdminClient: unknown
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}))

// buildJoinUrl reads this — set before importing the module under test.
process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'

import {
  getGymRegistrationDetails,
  rotateRegistrationToken,
} from '../services/registration-link.service'

describe('rotateRegistrationToken', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rotates an existing link: new token, rotated_at set, join URL rebuilt', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        token: NEW_TOKEN,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        rotated_at: '2026-07-23T00:00:00Z',
      },
      error: null,
    })
    const select = jest.fn(() => ({ maybeSingle }))
    const eq = jest.fn(() => ({ select }))
    const update = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ update }))
    mockAdminClient = { from }

    const link = await rotateRegistrationToken(
      '11111111-1111-1111-1111-111111111111'
    )

    expect(from).toHaveBeenCalledWith('gym_registration_links')
    // token + is_active + rotated_at are all written
    const updateArg = (update.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(updateArg.token).toBe(NEW_TOKEN)
    expect(updateArg.is_active).toBe(true)
    expect(updateArg.rotated_at).toBeDefined()
    expect(eq).toHaveBeenCalledWith(
      'gym_id',
      '11111111-1111-1111-1111-111111111111'
    )
    expect(link.token).toBe(NEW_TOKEN)
    expect(link.joinUrl).toBe(`https://app.example.com/join/${NEW_TOKEN}`)
  })

  it('falls back to insert when the gym has no link yet', async () => {
    const updateMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const updateSelect = jest.fn(() => ({ maybeSingle: updateMaybeSingle }))
    const eq = jest.fn(() => ({ select: updateSelect }))
    const update = jest.fn(() => ({ eq }))

    const insertSingle = jest.fn().mockResolvedValue({
      data: {
        token: NEW_TOKEN,
        is_active: true,
        created_at: '2026-07-23T00:00:00Z',
        rotated_at: null,
      },
      error: null,
    })
    const insertSelect = jest.fn(() => ({ single: insertSingle }))
    const insert = jest.fn(() => ({ select: insertSelect }))

    const from = jest.fn(() => ({ update, insert }))
    mockAdminClient = { from }

    const link = await rotateRegistrationToken(
      '22222222-2222-2222-2222-222222222222'
    )

    expect(insert).toHaveBeenCalledWith({
      gym_id: '22222222-2222-2222-2222-222222222222',
      token: NEW_TOKEN,
    })
    expect(link.token).toBe(NEW_TOKEN)
  })

  it('throws when the update fails', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db down' } })
    const select = jest.fn(() => ({ maybeSingle }))
    const eq = jest.fn(() => ({ select }))
    const update = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ update }))
    mockAdminClient = { from }

    await expect(
      rotateRegistrationToken('33333333-3333-3333-3333-333333333333')
    ).rejects.toThrow('Failed to rotate registration link: db down')
  })
})

/**
 * getGymRegistrationDetails — what the public QR registration needs from the
 * gym row the token resolved to: the name (the welcome SMS names the gym) and
 * the admission fee to charge. Both come from the database, never the client.
 */
describe('getGymRegistrationDetails', () => {
  function mockGymRow(result: { data: unknown; error: unknown }) {
    const maybeSingle = jest.fn().mockResolvedValue(result)
    const eq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ select }))
    mockAdminClient = { from }
    return { from, select, eq }
  }

  it('returns the gym name and the admission fee when the fee is enabled', async () => {
    const { from, select, eq } = mockGymRow({
      data: {
        gym_name: 'Titan Fitness',
        admission_fee: '1500.00',
        admission_fee_enabled: true,
      },
      error: null,
    })

    await expect(getGymRegistrationDetails('gym-1')).resolves.toEqual({
      gymName: 'Titan Fitness',
      admissionFee: 1500,
    })
    expect(from).toHaveBeenCalledWith('gyms')
    expect(select).toHaveBeenCalledWith(
      'gym_name, admission_fee, admission_fee_enabled'
    )
    expect(eq).toHaveBeenCalledWith('id', 'gym-1')
  })

  it('charges no admission fee when the gym has it switched off', async () => {
    mockGymRow({
      data: {
        gym_name: 'Titan Fitness',
        admission_fee: '1500.00',
        admission_fee_enabled: false,
      },
      error: null,
    })

    await expect(getGymRegistrationDetails('gym-1')).resolves.toEqual({
      gymName: 'Titan Fitness',
      admissionFee: 0,
    })
  })

  it('returns null when the gym row does not exist', async () => {
    mockGymRow({ data: null, error: null })

    await expect(getGymRegistrationDetails('gym-1')).resolves.toBeNull()
  })

  it('throws when the read fails, rather than registering without a fee', async () => {
    mockGymRow({ data: null, error: { message: 'db down' } })

    await expect(getGymRegistrationDetails('gym-1')).rejects.toThrow(
      'Failed to load gym for registration: db down'
    )
  })
})
