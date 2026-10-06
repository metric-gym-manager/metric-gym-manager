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
        'order',
        'limit',
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

describe('SupabaseOutreachLedger', () => {
  it('adds new addresses, leaving recorded ones untouched, and counts the new', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
    ])
    const added = await new SupabaseOutreachLedger(supabase).addRecipients(
      'intro',
      [
        { email: 'a@gym.lk', gymName: 'Alpha', name: null },
        { email: 'b@gym.lk', gymName: null, name: 'Bo' },
      ],
      'public listing'
    )
    expect(added).toBe(1)
    expect(queries[0]).toContainEqual([
      'upsert',
      [
        {
          campaign: 'intro',
          email: 'a@gym.lk',
          gym_name: 'Alpha',
          name: null,
          source: 'public listing',
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
  })

  it('adds nothing, and asks nothing, for an empty list', async () => {
    const { supabase, queries } = client([])
    expect(
      await new SupabaseOutreachLedger(supabase).addRecipients('intro', [], 'x')
    ).toBe(0)
    expect(queries).toHaveLength(0)
  })

  it('reads the pending addresses oldest first, up to the limit', async () => {
    const { supabase, queries } = client([
      {
        data: [{ email: 'a@gym.lk', gym_name: 'Alpha', name: null }],
        error: null,
      },
    ])
    expect(
      await new SupabaseOutreachLedger(supabase).pending('intro', 50)
    ).toEqual([{ email: 'a@gym.lk', gymName: 'Alpha', name: null }])
    expect(queries[0]).toContainEqual(['eq', 'status', 'pending'])
    expect(queries[0]).toContainEqual([
      'order',
      'created_at',
      { ascending: true },
    ])
    expect(queries[0]).toContainEqual(['limit', 50])
  })

  it('marks a send, stamps updated_at, and confirms a row changed', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
    ])
    await new SupabaseOutreachLedger(
      supabase,
      () => new Date('2026-10-06T10:00:00Z')
    ).mark('intro', 'a@gym.lk', { status: 'sent', resendEmailId: 'em_1' })
    expect(queries[0]).toContainEqual([
      'update',
      {
        status: 'sent',
        resend_email_id: 'em_1',
        error: null,
        updated_at: '2026-10-06T10:00:00.000Z',
      },
    ])
  })

  it('throws when a mark changed nothing', async () => {
    const { supabase } = client([{ data: [], error: null }])
    await expect(
      new SupabaseOutreachLedger(supabase).mark('intro', 'a@gym.lk', {
        status: 'sent',
      })
    ).rejects.toThrow(/no outreach recipient/i)
  })

  it('throws when the database refuses', async () => {
    const { supabase } = client([
      { data: null, error: { message: 'relation does not exist' } },
    ])
    await expect(
      new SupabaseOutreachLedger(supabase).recipients('intro')
    ).rejects.toThrow('relation does not exist')
  })
})
