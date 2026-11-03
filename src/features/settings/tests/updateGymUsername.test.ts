/**
 * @jest-environment node
 */

/**
 * updateGymUsername — what the username save reports for each database outcome.
 *
 * It used to look for another gym with the username first, through the
 * caller's session. Under RLS a gym session sees only its own row, so that
 * lookup never found anyone: a taken username fell through to the update, hit
 * `gyms_username_key`, and was reported as a general failure. The UNIQUE
 * constraint is the authority, and its violation is `taken`.
 */

const single = jest.fn()
const calls = {
  update: [] as Record<string, unknown>[],
  eq: [] as [string, unknown][],
  neq: [] as [string, unknown][],
  select: [] as unknown[],
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
        neq: (col: string, val: unknown) => {
          calls.neq.push([col, val])
          return builder
        },
        select: (cols?: unknown) => {
          calls.select.push(cols)
          return builder
        },
        single,
      }
      return builder
    },
  }),
}))

import { updateGymUsername } from '../services/settings.service'

beforeEach(() => {
  single.mockReset()
  calls.update = []
  calls.eq = []
  calls.neq = []
  calls.select = []
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('updateGymUsername', () => {
  it('writes the username to the caller’s own gym and returns the stored row', async () => {
    single.mockResolvedValue({
      data: { id: 'gym-1', username: 'iron-house' },
      error: null,
    })

    const result = await updateGymUsername('gym-1', 'iron-house')

    expect(result).toEqual({
      status: 'ok',
      profile: { id: 'gym-1', username: 'iron-house' },
    })
    expect(calls.update[0]).toMatchObject({ username: 'iron-house' })
    expect(calls.eq).toEqual([['id', 'gym-1']])
  })

  it('reports `taken` when another gym already holds the username', async () => {
    single.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "gyms_username_key"',
      },
    })

    await expect(updateGymUsername('gym-1', 'titan')).resolves.toEqual({
      status: 'taken',
    })
  })

  it('does not look for other gyms first: the session cannot see them', async () => {
    single.mockResolvedValue({
      data: { id: 'gym-1', username: 'iron-house' },
      error: null,
    })

    await updateGymUsername('gym-1', 'iron-house')

    expect(single).toHaveBeenCalledTimes(1)
    expect(calls.neq).toEqual([])
  })

  it('reports `error` for any other failure, including a write RLS refused', async () => {
    single.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      },
    })

    await expect(updateGymUsername('gym-1', 'iron-house')).resolves.toEqual({
      status: 'error',
    })
  })
})
