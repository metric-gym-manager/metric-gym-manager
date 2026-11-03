/**
 * @jest-environment node
 */

/**
 * updateGymPhone — what the gym-phone save reports for each database outcome.
 *
 * There is no "is it taken?" pre-check, deliberately: under RLS a gym session
 * sees only its own gym row, so a session-client lookup of another gym's number
 * finds nothing whether or not it exists. The UNIQUE constraint
 * (`gyms_phone_number_key`) is the authority, and its violation is `taken`.
 */

const single = jest.fn()
const calls = {
  update: [] as Record<string, unknown>[],
  eq: [] as [string, unknown][],
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== 'gyms') throw new Error(`unexpected table ${table}`)
      const builder = {
        update: (payload: Record<string, unknown>) => {
          calls.update.push(payload)
          return builder
        },
        eq: (col: string, val: unknown) => {
          calls.eq.push([col, val])
          return builder
        },
        select: () => builder,
        single,
      }
      return builder
    },
  }),
}))

import { updateGymPhone } from '../services/settings.service'

beforeEach(() => {
  single.mockReset()
  calls.update = []
  calls.eq = []
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('updateGymPhone', () => {
  it('writes the number to the caller’s own gym and returns the stored row', async () => {
    single.mockResolvedValue({
      data: { id: 'gym-1', phone_number: '+94771234567' },
      error: null,
    })

    const result = await updateGymPhone('gym-1', '+94771234567')

    expect(result).toEqual({
      status: 'ok',
      profile: { id: 'gym-1', phone_number: '+94771234567' },
    })
    expect(calls.update[0]).toMatchObject({ phone_number: '+94771234567' })
    expect(calls.eq).toEqual([['id', 'gym-1']])
  })

  it('reports `taken` when another gym already holds the number', async () => {
    single.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "gyms_phone_number_key"',
      },
    })

    await expect(updateGymPhone('gym-1', '+94771234567')).resolves.toEqual({
      status: 'taken',
    })
  })

  it('reports `error` for any other failure, including a write RLS refused', async () => {
    single.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      },
    })

    await expect(updateGymPhone('gym-1', '+94771234567')).resolves.toEqual({
      status: 'error',
    })
  })
})
