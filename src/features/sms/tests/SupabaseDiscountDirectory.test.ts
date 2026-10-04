/**
 * SupabaseDiscountDirectory — the reminders cron's one read of recurring-
 * discount percentages per run, batched through `selectByIds` like the gym
 * names (a GET's URL cannot carry every id at scale).
 */

/* `discounts.discount_percentage` is an integer column (checked 2026-10-04). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseDiscountDirectory } from '../services/SupabaseDiscountDirectory'
import { ID_BATCH_SIZE } from '../services/selectByIds'
import { DatabaseError } from '@/utils/errors'

function mockClient(
  respond: (ids: string[]) => {
    data: unknown
    error: { message: string } | null
  }
) {
  const inCalls: string[][] = []
  const from = jest.fn((table: string) => {
    expect(table).toBe('discounts')
    return {
      select: jest.fn((cols: string) => {
        expect(cols).toBe('id, discount_percentage')
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

const ids = (n: number) => Array.from({ length: n }, (_, i) => `disc-${i}`)

describe('SupabaseDiscountDirectory.findPercentagesByIds', () => {
  it('maps each discount to its percentage', async () => {
    const { client } = mockClient(() => ({
      data: [
        { id: 'disc-10', discount_percentage: 10 },
        { id: 'disc-25', discount_percentage: 25 },
      ],
      error: null,
    }))

    const pcts = await new SupabaseDiscountDirectory(
      client
    ).findPercentagesByIds(['disc-10', 'disc-25'])

    expect([...pcts]).toEqual([
      ['disc-10', 10],
      ['disc-25', 25],
    ])
  })

  it(`reads in batches of ${ID_BATCH_SIZE}`, async () => {
    const { client, inCalls } = mockClient((batch) => ({
      data: batch.map((id) => ({ id, discount_percentage: 5 })),
      error: null,
    }))

    const pcts = await new SupabaseDiscountDirectory(
      client
    ).findPercentagesByIds(ids(150))

    expect(inCalls.map((c) => c.length)).toEqual([100, 50])
    expect(pcts.size).toBe(150)
  })

  it('makes no request for no discounts', async () => {
    const { client, from } = mockClient(() => ({ data: [], error: null }))

    const pcts = await new SupabaseDiscountDirectory(
      client
    ).findPercentagesByIds([])

    expect(pcts.size).toBe(0)
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a row whose percentage is not a number', async () => {
    const { client } = mockClient(() => ({
      data: [{ id: 'disc-10', discount_percentage: 'ten' }],
      error: null,
    }))

    await expect(
      new SupabaseDiscountDirectory(client).findPercentagesByIds(['disc-10'])
    ).rejects.toThrow()
  })

  it('throws a DatabaseError when a read fails', async () => {
    const { client } = mockClient(() => ({
      data: null,
      error: { message: 'db down' },
    }))

    await expect(
      new SupabaseDiscountDirectory(client).findPercentagesByIds(['disc-1'])
    ).rejects.toThrow(DatabaseError)
  })
})
