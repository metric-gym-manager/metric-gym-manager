/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseOutreachCampaigns } from '../services/SupabaseOutreachCampaigns'

type Call = [string, ...unknown[]]
type Result = { data: unknown; error: { message: string } | null }

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
        'is',
        'not',
        'or',
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

const NOW = new Date('2026-10-20T04:30:00Z')
const campaigns = (supabase: SupabaseClient) =>
  new SupabaseOutreachCampaigns(supabase, () => NOW)

describe('SupabaseOutreachCampaigns', () => {
  it('reads a campaign with no row as running', async () => {
    const { supabase } = client([{ data: null, error: null }])
    expect(await campaigns(supabase).state('intro')).toEqual({
      pausedAt: null,
      pauseReason: null,
      pauseAlertedAt: null,
      resumedAt: null,
      lastSummaryAt: null,
    })
  })

  it('reads a paused campaign', async () => {
    const { supabase } = client([
      {
        data: {
          paused_at: '2026-10-19T05:00:00Z',
          pause_reason: '2 spam complaints',
          pause_alerted_at: null,
          resumed_at: null,
          last_summary_at: '2026-10-19T04:30:00Z',
        },
        error: null,
      },
    ])
    expect(await campaigns(supabase).state('intro')).toEqual({
      pausedAt: new Date('2026-10-19T05:00:00Z'),
      pauseReason: '2 spam complaints',
      pauseAlertedAt: null,
      resumedAt: null,
      lastSummaryAt: new Date('2026-10-19T04:30:00Z'),
    })
  })

  it('pauses only a running campaign, so one caller owns the pause', async () => {
    const { supabase, queries } = client([
      { data: null, error: null },
      { data: [{ campaign: 'intro' }], error: null },
      { data: null, error: null },
      { data: [], error: null },
    ])
    expect(
      await campaigns(supabase).pause('intro', '2 spam complaints', NOW, false)
    ).toBe(true)
    expect(await campaigns(supabase).pause('intro', 'again', NOW, false)).toBe(
      false
    )
    // The row exists first, without touching one that does.
    expect(queries[0]).toEqual([
      ['from', 'outreach_campaigns'],
      [
        'upsert',
        { campaign: 'intro' },
        { onConflict: 'campaign', ignoreDuplicates: true },
      ],
    ])
    expect(queries[1]).toEqual([
      ['from', 'outreach_campaigns'],
      [
        'update',
        {
          paused_at: NOW.toISOString(),
          pause_reason: '2 spam complaints',
          pause_alerted_at: null,
          updated_at: NOW.toISOString(),
        },
      ],
      ['eq', 'campaign', 'intro'],
      ['is', 'paused_at', null],
      ['select', 'campaign'],
    ])
  })

  it('records the owner’s own pause as already alerted', async () => {
    const { supabase, queries } = client([
      { data: null, error: null },
      { data: [{ campaign: 'intro' }], error: null },
    ])
    await campaigns(supabase).pause('intro', 'checking', NOW, true)
    expect(queries[1][1]).toEqual([
      'update',
      expect.objectContaining({ pause_alerted_at: NOW.toISOString() }),
    ])
  })

  it('resumes only a paused campaign, and the brake counts from then', async () => {
    const { supabase, queries } = client([
      { data: [{ campaign: 'intro' }], error: null },
      { data: [], error: null },
    ])
    expect(await campaigns(supabase).resume('intro', NOW)).toBe(true)
    expect(await campaigns(supabase).resume('intro', NOW)).toBe(false)
    expect(queries[0]).toEqual([
      ['from', 'outreach_campaigns'],
      [
        'update',
        {
          paused_at: null,
          pause_reason: null,
          pause_alerted_at: null,
          resumed_at: NOW.toISOString(),
          updated_at: NOW.toISOString(),
        },
      ],
      ['eq', 'campaign', 'intro'],
      ['not', 'paused_at', 'is', null],
      ['select', 'campaign'],
    ])
  })

  it('claims the weekly summary only when the last one is old enough', async () => {
    const notSince = new Date('2026-10-14T04:30:00Z')
    const { supabase, queries } = client([
      { data: null, error: null },
      { data: [{ campaign: 'intro' }], error: null },
    ])
    expect(await campaigns(supabase).claimSummary('intro', NOW, notSince)).toBe(
      true
    )
    expect(queries[1]).toEqual([
      ['from', 'outreach_campaigns'],
      [
        'update',
        { last_summary_at: NOW.toISOString(), updated_at: NOW.toISOString() },
      ],
      ['eq', 'campaign', 'intro'],
      [
        'or',
        `last_summary_at.is.null,last_summary_at.lte.${notSince.toISOString()}`,
      ],
      ['select', 'campaign'],
    ])
  })

  it('throws when marking an alert changed nothing', async () => {
    const { supabase } = client([{ data: [], error: null }])
    await expect(
      campaigns(supabase).markPauseAlerted('intro', NOW)
    ).rejects.toThrow(/no outreach campaign/i)
  })

  it('throws when the database refuses', async () => {
    const { supabase } = client([
      { data: null, error: { message: 'permission denied' } },
    ])
    await expect(campaigns(supabase).state('intro')).rejects.toThrow(
      'permission denied'
    )
  })
})
