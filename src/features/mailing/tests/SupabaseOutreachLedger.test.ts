/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseOutreachLedger } from '../services/SupabaseOutreachLedger'

type Call = [string, ...unknown[]]
type Result = {
  data: unknown
  error: { code?: string; message: string } | null
}

/** Records each query's builder calls; resolves with the next canned result. */
function client(results: Result[]) {
  const queries: Call[][] = []
  const fake = {
    from(table: string) {
      const calls: Call[] = [['from', table]]
      queries.push(calls)
      const builder: Record<string, unknown> = {}
      for (const method of [
        'select',
        'upsert',
        'update',
        'eq',
        'lt',
        'or',
        'order',
        'limit',
        'maybeSingle',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method, ...args])
          return builder
        }
      }
      builder.then = (resolve: (r: Result) => void) =>
        resolve(results.shift() ?? { data: [], error: null })
      return builder
    },
  }
  return { supabase: fake as unknown as SupabaseClient, queries }
}

const NOW = new Date('2026-10-13T04:30:00Z')
const ledger = (supabase: SupabaseClient) =>
  new SupabaseOutreachLedger(supabase, () => NOW)

describe('SupabaseOutreachLedger', () => {
  it('adds new addresses with their own source or the default, and returns the new ones', async () => {
    const { supabase, queries } = client([
      { data: [{ email: 'a@gym.lk' }], error: null },
    ])
    const added = await ledger(supabase).addRecipients(
      'intro',
      [
        {
          email: 'a@gym.lk',
          gymName: 'Alpha',
          name: null,
          source: 'www.alpha.lk',
        },
        { email: 'b@gym.lk', gymName: null, name: 'Bo', source: null },
      ],
      'public listing'
    )
    expect(added).toEqual(['a@gym.lk'])
    expect(queries[0]).toContainEqual([
      'upsert',
      [
        {
          campaign: 'intro',
          email: 'a@gym.lk',
          gym_name: 'Alpha',
          name: null,
          source: 'www.alpha.lk',
        },
        {
          campaign: 'intro',
          email: 'b@gym.lk',
          gym_name: null,
          name: 'Bo',
          source: 'public listing',
        },
      ],
      { onConflict: 'campaign,email', ignoreDuplicates: true },
    ])
    expect(queries[0]).toContainEqual(['select', 'email'])
  })

  it('asks nothing for an empty list', async () => {
    const { supabase, queries } = client([])
    expect(await ledger(supabase).addRecipients('intro', [], 'x')).toEqual([])
    expect(queries).toHaveLength(0)
  })

  it('finds active addresses with emails left that were not written to recently, oldest first', async () => {
    const { supabase, queries } = client([
      {
        data: [{ email: 'a@gym.lk', gym_name: null, name: null, step: 1 }],
        error: null,
      },
    ])
    const due = await ledger(supabase).due(
      'intro',
      new Date('2026-10-07T04:30:00Z'),
      150
    )
    expect(due).toEqual([
      { email: 'a@gym.lk', gymName: null, name: null, step: 1 },
    ])
    const q = queries[0]
    expect(q).toContainEqual(['eq', 'status', 'active'])
    expect(q).toContainEqual(['lt', 'step', 4])
    expect(q).toContainEqual([
      'or',
      'last_sent_at.is.null,last_sent_at.lte.2026-10-07T04:30:00.000Z',
    ])
    expect(q).toContainEqual(['order', 'created_at', { ascending: true }])
    expect(q).toContainEqual(['limit', 150])
  })

  it('claims the next step only while the address is still active at the step read', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
    ])
    expect(await ledger(supabase).claim('intro', 'a@gym.lk', 1, NOW)).toBe(true)
    const q = queries[0]
    expect(q).toContainEqual([
      'update',
      {
        step: 2,
        last_sent_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      },
    ])
    expect(q).toContainEqual(['eq', 'step', 1])
    expect(q).toContainEqual(['eq', 'status', 'active'])
  })

  it('loses the claim when another run already moved the address on', async () => {
    const { supabase } = client([{ data: [], error: null }])
    expect(await ledger(supabase).claim('intro', 'a@gym.lk', 1, NOW)).toBe(
      false
    )
  })

  it('records a send, and the fourth finishes the series', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
      { data: [{ id: 'r1' }], error: null },
    ])
    await ledger(supabase).recordSent('intro', 'a@gym.lk', 2, 'em_2')
    await ledger(supabase).recordSent('intro', 'a@gym.lk', 4, 'em_4')
    expect(queries[0]).toContainEqual([
      'update',
      {
        resend_email_id: 'em_2',
        error: null,
        failures: 0,
        updated_at: NOW.toISOString(),
      },
    ])
    expect(queries[1]).toContainEqual([
      'update',
      {
        resend_email_id: 'em_4',
        error: null,
        failures: 0,
        updated_at: NOW.toISOString(),
        status: 'done',
      },
    ])
  })

  it('undoes a failed claim and stops the address after repeated failures', async () => {
    const { supabase, queries } = client([
      { data: { failures: 2 }, error: null },
      { data: [{ id: 'r1' }], error: null },
    ])
    await ledger(supabase).recordFailure(
      'intro',
      'a@gym.lk',
      1,
      'Resend said no'
    )
    expect(queries[1]).toContainEqual([
      'update',
      {
        step: 1,
        error: 'Resend said no',
        failures: 3,
        updated_at: NOW.toISOString(),
        status: 'failed',
      },
    ])
  })

  it('marks an address unsubscribed, and says when it is not in the campaign', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
      { data: [], error: null },
    ])
    expect(await ledger(supabase).markUnsubscribed('intro', 'a@gym.lk')).toBe(
      true
    )
    expect(await ledger(supabase).markUnsubscribed('intro', 'x@gym.lk')).toBe(
      false
    )
    expect(queries[0]).toContainEqual([
      'update',
      { status: 'unsubscribed', updated_at: NOW.toISOString() },
    ])
  })

  it('throws when a write it must make changed nothing', async () => {
    const { supabase } = client([{ data: [], error: null }])
    await expect(
      ledger(supabase).recordSent('intro', 'a@gym.lk', 1, 'em')
    ).rejects.toThrow(/no outreach recipient/i)
  })

  it('throws when the database refuses', async () => {
    const { supabase } = client([
      { data: null, error: { message: 'relation does not exist' } },
    ])
    await expect(ledger(supabase).recipients('intro')).rejects.toThrow(
      'relation does not exist'
    )
  })
})
