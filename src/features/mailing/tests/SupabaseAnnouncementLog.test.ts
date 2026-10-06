/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { AnnouncementKind } from '../config/AnnouncementConfig'
import { SupabaseAnnouncementLog } from '../services/SupabaseAnnouncementLog'

type Call = [string, ...unknown[]]
type Result = {
  data: unknown
  error: { code?: string; message: string } | null
}

/** Records every builder call per query; resolves with the next canned result. */
function client(results: Result[]) {
  const queries: Call[][] = []
  const fake = {
    from(table: string) {
      const calls: Call[] = [['from', table]]
      queries.push(calls)
      const builder: Record<string, unknown> = {}
      for (const method of [
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'neq',
        'order',
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

const ROW = {
  kind: 'release',
  ref: '1.2.0',
  status: 'scheduled',
  broadcast_id: 'bc_1',
  preview_broadcast_id: 'bc_p',
  scheduled_for: '2026-10-22T04:00:00+00:00',
  error: null,
  updated_at: '2026-10-21T04:00:00+00:00',
}

describe('SupabaseAnnouncementLog', () => {
  it('claims by inserting a pending row', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
    ])
    const claimed = await new SupabaseAnnouncementLog(supabase).claim(
      AnnouncementKind.Release,
      '1.2.0'
    )
    expect(claimed).toBe(true)
    expect(queries[0]).toEqual([
      ['from', 'mailing_announcements'],
      ['insert', { kind: 'release', ref: '1.2.0', status: 'pending' }],
      ['select', 'id'],
    ])
  })

  it('loses the claim on a unique violation', async () => {
    const { supabase } = client([
      { data: null, error: { code: '23505', message: 'duplicate key' } },
    ])
    expect(
      await new SupabaseAnnouncementLog(supabase).claim(
        AnnouncementKind.Release,
        '1.2.0'
      )
    ).toBe(false)
  })

  it('throws on any other insert error, rather than reporting a claim it does not hold', async () => {
    const { supabase } = client([
      {
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      },
    ])
    await expect(
      new SupabaseAnnouncementLog(supabase).claim(AnnouncementKind.Release, '1')
    ).rejects.toThrow('relation does not exist')
  })

  it('throws when an insert reports success but wrote nothing', async () => {
    const { supabase } = client([{ data: [], error: null }])
    await expect(
      new SupabaseAnnouncementLog(supabase).claim(AnnouncementKind.Release, '1')
    ).rejects.toThrow()
  })

  it('finds a row and maps it', async () => {
    const { supabase, queries } = client([{ data: ROW, error: null }])
    const found = await new SupabaseAnnouncementLog(supabase).find(
      AnnouncementKind.Release,
      '1.2.0'
    )
    expect(found).toEqual({
      kind: AnnouncementKind.Release,
      ref: '1.2.0',
      status: 'scheduled',
      broadcastId: 'bc_1',
      previewBroadcastId: 'bc_p',
      scheduledFor: '2026-10-22T04:00:00+00:00',
      error: null,
      updatedAt: '2026-10-21T04:00:00+00:00',
    })
    expect(queries[0]).toContainEqual(['eq', 'kind', 'release'])
    expect(queries[0]).toContainEqual(['eq', 'ref', '1.2.0'])
    expect(queries[0]).toContainEqual(['maybeSingle'])
  })

  it('updates in snake_case, stamps updated_at, and confirms a row changed', async () => {
    const { supabase, queries } = client([
      { data: [{ id: 'r1' }], error: null },
    ])
    await new SupabaseAnnouncementLog(
      supabase,
      () => new Date('2026-10-21T04:00:00Z')
    ).update(AnnouncementKind.Policy, 'privacy@2026-10-06', {
      status: 'scheduled',
      broadcastId: 'bc_1',
      scheduledFor: 'x',
      error: null,
    })
    expect(queries[0]).toContainEqual([
      'update',
      {
        status: 'scheduled',
        broadcast_id: 'bc_1',
        scheduled_for: 'x',
        error: null,
        updated_at: '2026-10-21T04:00:00.000Z',
      },
    ])
    expect(queries[0]).toContainEqual(['select', 'id'])
  })

  it('throws when an update changed nothing: a no-op must not pass for a write', async () => {
    const { supabase } = client([{ data: [], error: null }])
    await expect(
      new SupabaseAnnouncementLog(supabase).update(
        AnnouncementKind.Release,
        '1',
        {
          status: 'sent',
        }
      )
    ).rejects.toThrow(/no announcement/i)
  })

  it('releases only a pending claim', async () => {
    const { supabase, queries } = client([{ data: [], error: null }])
    await new SupabaseAnnouncementLog(supabase).release(
      AnnouncementKind.Release,
      '1.2.0'
    )
    expect(queries[0]).toContainEqual(['delete'])
    expect(queries[0]).toContainEqual(['eq', 'status', 'pending'])
  })

  it('takes the newest settled release by version order, not text order', async () => {
    const { supabase, queries } = client([
      {
        data: [{ ref: '1.9.0' }, { ref: '1.10.0' }, { ref: '1.2.0' }],
        error: null,
      },
    ])
    expect(
      await new SupabaseAnnouncementLog(supabase).lastReleaseVersion()
    ).toBe('1.10.0')
    expect(queries[0]).toContainEqual(['eq', 'kind', 'release'])
    expect(queries[0]).toContainEqual(['neq', 'status', 'pending'])
  })

  it('has no last release before the first', async () => {
    const { supabase } = client([{ data: [], error: null }])
    expect(
      await new SupabaseAnnouncementLog(supabase).lastReleaseVersion()
    ).toBeNull()
  })

  it('lists rows by status', async () => {
    const { supabase, queries } = client([{ data: [ROW], error: null }])
    const rows = await new SupabaseAnnouncementLog(supabase).listByStatus(
      'scheduled'
    )
    expect(rows.map((r) => r.ref)).toEqual(['1.2.0'])
    expect(queries[0]).toContainEqual(['eq', 'status', 'scheduled'])
  })
})
