/**
 * SupabaseGymDirectory — the reminders cron's one read of gym names per run.
 *
 * `.in('id', ids)` travels in the URL of a GET, so one request naming every
 * gym grows with the customer count until the gateway refuses it — and a
 * refused read is fatal to the whole reminder run. The read is therefore
 * batched; these tests pin the batching and the merge.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  GYM_NAME_BATCH_SIZE,
  SupabaseGymDirectory,
} from '../services/SupabaseGymDirectory'
import { DatabaseError } from '@/utils/errors'

function mockClient(
  respond: (ids: string[]) => {
    data: unknown
    error: { message: string } | null
  }
) {
  const inCalls: string[][] = []
  const from = jest.fn((table: string) => {
    expect(table).toBe('gyms')
    return {
      select: jest.fn((cols: string) => {
        expect(cols).toBe('id, gym_name')
        return {
          in: jest.fn((col: string, ids: string[]) => {
            expect(col).toBe('id')
            inCalls.push(ids)
            return Promise.resolve(respond(ids))
          }),
        }
      }),
    }
  })
  return { client: { from } as unknown as SupabaseClient, inCalls, from }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `gym-${i}`)
const rows = (batch: string[]) =>
  batch.map((id) => ({ id, gym_name: `Name of ${id}` }))

describe('SupabaseGymDirectory.findNamesByIds', () => {
  it(`reads in batches of ${GYM_NAME_BATCH_SIZE} and merges every name`, async () => {
    const { client, inCalls } = mockClient((batch) => ({
      data: rows(batch),
      error: null,
    }))

    const names = await new SupabaseGymDirectory(client).findNamesByIds(
      ids(250)
    )

    expect(inCalls.map((c) => c.length)).toEqual([100, 100, 50])
    expect(inCalls.flat()).toEqual(ids(250))
    expect(names.size).toBe(250)
    expect(names.get('gym-0')).toBe('Name of gym-0')
    expect(names.get('gym-249')).toBe('Name of gym-249')
  })

  it('reads a small set in one request', async () => {
    const { client, inCalls } = mockClient((batch) => ({
      data: rows(batch),
      error: null,
    }))

    await new SupabaseGymDirectory(client).findNamesByIds(ids(12))

    expect(inCalls).toHaveLength(1)
  })

  it('makes no request for no gyms', async () => {
    const { client, from } = mockClient(() => ({ data: [], error: null }))

    const names = await new SupabaseGymDirectory(client).findNamesByIds([])

    expect(names.size).toBe(0)
    expect(from).not.toHaveBeenCalled()
  })

  it('leaves out an id with no row', async () => {
    const { client } = mockClient(() => ({
      data: [{ id: 'gym-0', gym_name: 'Titan Fitness' }],
      error: null,
    }))

    const names = await new SupabaseGymDirectory(client).findNamesByIds([
      'gym-0',
      'gym-gone',
    ])

    expect([...names]).toEqual([['gym-0', 'Titan Fitness']])
  })

  it('throws a DatabaseError when any batch fails', async () => {
    const { client } = mockClient((batch) =>
      batch.includes('gym-150')
        ? { data: null, error: { message: 'URI too long' } }
        : { data: rows(batch), error: null }
    )

    await expect(
      new SupabaseGymDirectory(client).findNamesByIds(ids(250))
    ).rejects.toThrow(DatabaseError)
  })
})
