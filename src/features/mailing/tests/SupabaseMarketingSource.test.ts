/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMarketingSource } from '../services/SupabaseMarketingSource'

type Query = { table: string; select: string; filters: unknown[][] }

/** Records each query's table, projection and filters; returns canned rows. */
function client(rows: Record<string, unknown[]>, error: string | null = null) {
  const queries: Query[] = []
  const fake = {
    from(table: string) {
      const query: Query = { table, select: '', filters: [] }
      queries.push(query)
      const builder = {
        select(columns: string) {
          query.select = columns
          return builder
        },
        not(...args: unknown[]) {
          query.filters.push(['not', ...args])
          return builder
        },
        order(...args: unknown[]) {
          query.filters.push(['order', ...args])
          return builder
        },
        then(resolve: (v: unknown) => void) {
          resolve(
            error
              ? { data: null, error: { message: error } }
              : { data: rows[table] ?? [], error: null }
          )
        },
      }
      return builder
    },
  }
  return { supabase: fake as unknown as SupabaseClient, queries }
}

describe('SupabaseMarketingSource', () => {
  it('reads every gym owner with their gym name', async () => {
    const { supabase, queries } = client({
      gyms: [
        {
          id: 'g1',
          email: 'owner@titan.lk',
          gym_name: 'Titan Fitness',
          subscription_status: 'canceled',
        },
      ],
    })
    await expect(
      new SupabaseMarketingSource(supabase).listGymOwners()
    ).resolves.toEqual([
      {
        gymId: 'g1',
        email: 'owner@titan.lk',
        gymName: 'Titan Fitness',
        subscriptionStatus: 'canceled',
      },
    ])
    expect(queries[0]).toMatchObject({
      table: 'gyms',
      select: 'id, email, gym_name, subscription_status',
    })
  })

  it('reads only leads that consented to marketing', async () => {
    const { supabase, queries } = client({
      leads: [{ email: 'nimal@example.lk', name: 'Nimal', gym_name: null }],
    })
    await expect(
      new SupabaseMarketingSource(supabase).listConsentingLeads()
    ).resolves.toEqual([
      { email: 'nimal@example.lk', name: 'Nimal', gymName: null },
    ])
    expect(queries[0].table).toBe('leads')
    expect(queries[0].filters).toContainEqual([
      'not',
      'marketing_consent_at',
      'is',
      null,
    ])
  })

  it('throws when the database refuses the read', async () => {
    const { supabase } = client({}, 'permission denied')
    await expect(
      new SupabaseMarketingSource(supabase).listGymOwners()
    ).rejects.toThrow('permission denied')
  })
})
