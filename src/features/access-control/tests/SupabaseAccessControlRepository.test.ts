/**
 * Repository behaviour that would otherwise only surface in production.
 *
 * The first group is the important one. A bare PostgREST `.select()` stops at
 * the project's `db-max-rows` (1000 by default) — this codebase has already
 * shipped that bug once, in the daily status crons. Here the consequence is
 * worse: a truncated reconcile list means members whose access silently never
 * syncs again, with nothing reporting a failure.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseAccessControlRepository } from '@/features/access-control/services/SupabaseAccessControlRepository'
import { AccessSyncStatus } from '@/features/access-control/config/AccessControlConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'

/** A `.range()` call the repository made. */
interface RangeCall {
  from: number
  to: number
}

/**
 * Minimal PostgREST double.
 *
 * Records the ranges requested and serves slices of a fixed row set, so the
 * test can assert the repository kept asking until the pages ran out.
 */
function makePagingClient(rows: unknown[], rangeCalls: RangeCall[]) {
  const builder = {
    eq: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      rangeCalls.push({ from, to })
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    },
  }

  return {
    from: () => ({ select: () => builder }),
  } as unknown as SupabaseClient
}

/** Client that returns a single row from `maybeSingle()`. */
function makeSingleRowClient(row: unknown, error: unknown = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error }),
    single: () => Promise.resolve({ data: row, error }),
  }

  return { from: () => builder } as unknown as SupabaseClient
}

describe('SupabaseAccessControlRepository', () => {
  describe('paging (the 1000-row truncation hazard)', () => {
    it('reads past the first page instead of stopping at it', async () => {
      // 1,250 members: more than one page, and more than the PostgREST cap
      // would have returned from a bare select.
      const rows = Array.from({ length: 1250 }, (_, i) => ({
        member_id: `member-${String(i).padStart(5, '0')}`,
      }))
      const rangeCalls: RangeCall[] = []

      const repo = new SupabaseAccessControlRepository(
        makePagingClient(rows, rangeCalls)
      )

      const ids = await repo.listMembersNeedingReconcile('gym-1')

      expect(ids).toHaveLength(1250)
      expect(ids[0]).toBe('member-00000')
      expect(ids[1249]).toBe('member-01249')
    })

    it('pages with contiguous, non-overlapping ranges', async () => {
      const rows = Array.from({ length: 1250 }, (_, i) => ({
        member_id: `member-${i}`,
      }))
      const rangeCalls: RangeCall[] = []

      const repo = new SupabaseAccessControlRepository(
        makePagingClient(rows, rangeCalls)
      )
      await repo.listMembersNeedingReconcile('gym-1')

      // Overlapping ranges would duplicate members; gaps would drop them.
      for (let i = 1; i < rangeCalls.length; i++) {
        expect(rangeCalls[i].from).toBe(rangeCalls[i - 1].to + 1)
      }
    })

    it('stops once a page comes back short', async () => {
      const rows = Array.from({ length: 300 }, (_, i) => ({
        member_id: `member-${i}`,
      }))
      const rangeCalls: RangeCall[] = []

      const repo = new SupabaseAccessControlRepository(
        makePagingClient(rows, rangeCalls)
      )
      await repo.listMembersNeedingReconcile('gym-1')

      // One partial page answers the question; asking again is a wasted trip.
      expect(rangeCalls).toHaveLength(1)
    })

    it('handles an empty result without an extra request', async () => {
      const rangeCalls: RangeCall[] = []
      const repo = new SupabaseAccessControlRepository(
        makePagingClient([], rangeCalls)
      )

      expect(await repo.listMembersNeedingReconcile('gym-1')).toEqual([])
      expect(rangeCalls).toHaveLength(1)
    })

    it('pages device serials too', async () => {
      const rows = Array.from({ length: 600 }, (_, i) => ({
        device_serial: `DEV-${i}`,
      }))
      const repo = new SupabaseAccessControlRepository(
        makePagingClient(rows, [])
      )

      expect(await repo.listActiveDeviceSerials('gym-1')).toHaveLength(600)
    })
  })

  describe('date handling', () => {
    it('reads DATE columns as calendar days, not instants', async () => {
      // The bug this guards: `new Date('2026-01-15')` in a non-UTC process
      // can land on the 14th, which would shift every member's access window
      // by a day — the exact failure the domain layer is built to avoid.
      const repo = new SupabaseAccessControlRepository(
        makeSingleRowClient({
          id: 'member-1',
          gym_id: 'gym-1',
          name: 'Nimal Perera',
          status: MemberStatus.Active,
          membership_start_date: '2026-01-01',
          next_due_date: '2026-01-31',
          registration_source: RegistrationSource.Manual,
          verified_at: null,
          member_access_subjects: [],
        })
      )

      const context = await repo.getMemberAccessContext('member-1')

      expect(context?.nextDueDate.toISOString()).toBe(
        '2026-01-31T00:00:00.000Z'
      )
      expect(context?.membershipStartDate.toISOString()).toBe(
        '2026-01-01T00:00:00.000Z'
      )
    })

    it('tolerates a timestamp where a date was expected', async () => {
      const repo = new SupabaseAccessControlRepository(
        makeSingleRowClient({
          id: 'member-1',
          gym_id: 'gym-1',
          name: 'Nimal',
          status: MemberStatus.Active,
          membership_start_date: '2026-01-01T18:30:00+00:00',
          next_due_date: '2026-01-31T18:30:00+00:00',
          registration_source: RegistrationSource.Manual,
          verified_at: null,
          member_access_subjects: null,
        })
      )

      const context = await repo.getMemberAccessContext('member-1')

      // The time component must not drag the day forwards or back.
      expect(context?.nextDueDate.toISOString()).toBe(
        '2026-01-31T00:00:00.000Z'
      )
    })

    it('returns null for a member that does not exist', async () => {
      const repo = new SupabaseAccessControlRepository(
        makeSingleRowClient(null)
      )

      expect(await repo.getMemberAccessContext('nobody')).toBeNull()
    })
  })

  describe('credentials', () => {
    beforeAll(() => {
      process.env.ACCESS_CONTROL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
        'base64'
      )
    })

    it('reports "not configured" when the secrets row is unreachable', async () => {
      // A session client cannot see access_control_secrets — RLS is enabled
      // with no policies. That is the boundary working, not a fault, so it
      // must not throw.
      const client = {
        from: (table: string) => {
          const builder = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: () =>
              Promise.resolve({
                data:
                  table === 'access_control_accounts'
                    ? {
                        id: 'acc-1',
                        gym_id: 'gym-1',
                        base_url: 'https://vft.example',
                        area_id: 1,
                        is_active: true,
                      }
                    : null,
                error: null,
              }),
          }
          return builder
        },
      } as unknown as SupabaseClient

      const repo = new SupabaseAccessControlRepository(client)

      await expect(repo.getCredentials('gym-1')).resolves.toBeNull()
    })

    it('reports "not configured" for a gym with no account at all', async () => {
      const repo = new SupabaseAccessControlRepository(
        makeSingleRowClient(null)
      )

      expect(await repo.getCredentials('gym-1')).toBeNull()
    })

    it('does not return credentials for a deactivated account', async () => {
      const repo = new SupabaseAccessControlRepository(
        makeSingleRowClient({
          id: 'acc-1',
          gym_id: 'gym-1',
          base_url: 'https://vft.example',
          area_id: 1,
          is_active: false,
        })
      )

      expect(await repo.getCredentials('gym-1')).toBeNull()
    })
  })

  describe('subject id allocation', () => {
    it('explains what to do when the identifier range is exhausted', async () => {
      // The raw Postgres message ("reached maximum value of sequence") tells
      // an operator nothing actionable.
      const client = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: 'ACCESS_SUBJECT_ID_EXHAUSTED: ...' },
          }),
      } as unknown as SupabaseClient

      const repo = new SupabaseAccessControlRepository(client)

      await expect(repo.allocateSubjectId()).rejects.toThrow(
        /fully allocated|Recycle ids/i
      )
    })

    it('returns the allocated identifier as a number', async () => {
      const client = {
        rpc: () => Promise.resolve({ data: '100042', error: null }),
      } as unknown as SupabaseClient

      const repo = new SupabaseAccessControlRepository(client)

      expect(await repo.allocateSubjectId()).toBe(100042)
    })
  })

  describe('event idempotency', () => {
    it('reports duplicates rather than counting them as stored', async () => {
      // The device batches and may redeliver. The webhook must stay honest
      // about what it actually wrote.
      const client = {
        from: () => ({
          upsert: () => ({
            select: () =>
              Promise.resolve({ data: [{ id: 'e1' }], error: null }),
          }),
        }),
      } as unknown as SupabaseClient

      const repo = new SupabaseAccessControlRepository(client)

      const result = await repo.recordEvents('gym-1', [
        makeEvent('2026-01-15T08:30:00Z'),
        makeEvent('2026-01-15T08:31:00Z'),
      ])

      expect(result).toEqual({ inserted: 1, duplicates: 1 })
    })

    it('does not call the database for an empty batch', async () => {
      const from = jest.fn()
      const repo = new SupabaseAccessControlRepository({
        from,
      } as unknown as SupabaseClient)

      expect(await repo.recordEvents('gym-1', [])).toEqual({
        inserted: 0,
        duplicates: 0,
      })
      expect(from).not.toHaveBeenCalled()
    })
  })

  describe('job failure handling', () => {
    it('dead-letters a non-retryable failure instead of rescheduling it', async () => {
      const updates: Record<string, unknown>[] = []
      const repo = new SupabaseAccessControlRepository(
        makeJobClient(1, updates)
      )

      await repo.failJob('job-1', 'Device does not support this command', false)

      expect(updates[0].status).toBe(AccessSyncStatus.Dead)
    })

    it('schedules a retry for a transient failure', async () => {
      const updates: Record<string, unknown>[] = []
      const repo = new SupabaseAccessControlRepository(
        makeJobClient(1, updates)
      )

      await repo.failJob('job-1', 'Device did not respond', true)

      expect(updates[0].status).toBe(AccessSyncStatus.Failed)
    })

    it('dead-letters once the retry budget is spent', async () => {
      // Rescheduling forever would hide a job nobody is ever going to fix.
      const updates: Record<string, unknown>[] = []
      const repo = new SupabaseAccessControlRepository(
        makeJobClient(99, updates)
      )

      await repo.failJob('job-1', 'Device did not respond', true)

      expect(updates[0].status).toBe(AccessSyncStatus.Dead)
    })
  })

  describe('device contact never moves backwards', () => {
    it('guards the write with a filter rather than trusting call order', async () => {
      // Contact evidence has two sources at different latencies: a scan hits
      // the webhook instantly, the vendor's device listing can be minutes
      // behind. An unguarded write would let the stale one age a live reader
      // backwards and flip it to offline on the dashboard.
      //
      // The guard belongs in the WHERE clause, not in application code, so two
      // concurrent writers obey it too.
      const filters: string[] = []

      const client = {
        from: () => ({
          update: () => ({
            eq: () => ({
              or: (filter: string) => {
                filters.push(filter)
                return Promise.resolve({ data: null, error: null })
              },
            }),
          }),
        }),
      } as unknown as SupabaseClient

      const repo = new SupabaseAccessControlRepository(client)
      const seenAt = new Date('2026-01-10T09:00:00.000Z')

      await repo.markDeviceSeen('SER-001', seenAt)

      expect(filters).toHaveLength(1)
      expect(filters[0]).toBe(
        'last_seen_at.is.null,last_seen_at.lt.2026-01-10T09:00:00.000Z'
      )
    })

    it('sends a timestamp PostgREST can parse in a filter value', async () => {
      // PostgREST splits `column.operator.value` on the first two dots and
      // takes the rest verbatim, so the dots inside an ISO timestamp are safe
      // — but a comma, bracket or space would need quoting and would silently
      // corrupt the filter. `toISOString()` produces none of those; a locale
      // string would produce all of them.
      const filters: string[] = []

      const client = {
        from: () => ({
          update: () => ({
            eq: () => ({
              or: (filter: string) => {
                filters.push(filter)
                return Promise.resolve({ data: null, error: null })
              },
            }),
          }),
        }),
      } as unknown as SupabaseClient

      await new SupabaseAccessControlRepository(client).markDeviceSeen(
        'SER-001',
        new Date('2026-01-10T09:00:00.000Z')
      )

      const value = filters[0].split('last_seen_at.lt.')[1]

      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
      expect(value).not.toMatch(/[,()\s]/)
    })
  })
})

function makeEvent(occurredAt: string) {
  return {
    deviceSerial: 'DEV-1',
    subjectId: 100042,
    memberId: 'member-1',
    occurredAt: new Date(occurredAt),
    verifyType: 1,
    checkingStatus: 0,
    eventCode: '0',
    raw: {},
  }
}

/** Client whose job read reports `attempts` and captures the update patch. */
function makeJobClient(attempts: number, updates: Record<string, unknown>[]) {
  return {
    from: () => {
      const builder = {
        select: () => builder,
        // Chainable, so `.select().eq().maybeSingle()` resolves the way
        // PostgREST does.
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: { attempts }, error: null }),
        update: (patch: Record<string, unknown>) => {
          updates.push(patch)
          return { eq: () => Promise.resolve({ data: null, error: null }) }
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
}

/**
 * Serial matching.
 *
 * The serial is the entire routing key for an inbound scan: `findDeviceBySerial`
 * decides which gym an event belongs to, and a miss is counted as another
 * company's traffic and dropped. Nothing retries — the reader has had its 200.
 *
 * The serial reaches us two ways that need not agree: typed into a form by a
 * person reading a label, and sent by the vendor. A case difference between
 * those two loses every scan from that reader, forever, with no error anywhere
 * and a dashboard that shows the reader registered and fine.
 */
describe('SupabaseAccessControlRepository — serial matching', () => {
  interface Query {
    method: string
    value: string
  }

  /**
   * Double over a single stored device row.
   *
   * `eq` matches exactly; `ilike` matches case-insensitively, as Postgres
   * does. Modelling the difference is the whole point — a double where both
   * behave the same could not fail the way production does.
   */
  function makeDeviceClient(storedSerial: string, queries: Query[]) {
    const row = {
      id: 'device-1',
      gym_id: 'gym-1',
      device_serial: storedSerial,
      is_active: true,
    }

    const builder = {
      select: () => builder,
      eq: (_column: string, value: string) => {
        queries.push({ method: 'eq', value })
        return {
          ...builder,
          maybeSingle: () =>
            Promise.resolve({
              data: value === storedSerial ? row : null,
              error: null,
            }),
        }
      },
      ilike: (_column: string, value: string) => {
        queries.push({ method: 'ilike', value })
        const matches =
          value.toLowerCase() === storedSerial.toLowerCase() ? [row] : []
        return {
          ...builder,
          limit: () => Promise.resolve({ data: matches, error: null }),
        }
      },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    }

    return { from: () => builder } as unknown as SupabaseClient
  }

  it('finds the reader when the serial matches exactly', async () => {
    const queries: Query[] = []
    const repo = new SupabaseAccessControlRepository(
      makeDeviceClient('NYU7251900066', queries)
    )

    const device = await repo.findDeviceBySerial('NYU7251900066')

    expect(device?.id).toBe('device-1')
    // The common case must stay one round trip.
    expect(queries).toEqual([{ method: 'eq', value: 'NYU7251900066' }])
  })

  it('finds the reader when the stored serial differs only in case', async () => {
    const queries: Query[] = []
    const repo = new SupabaseAccessControlRepository(
      makeDeviceClient('nyu7251900066', queries)
    )

    // What the vendor sends. The gym registered it lowercase, off the label.
    const device = await repo.findDeviceBySerial('NYU7251900066')

    expect(device?.id).toBe('device-1')
    expect(queries.map((q) => q.method)).toEqual(['eq', 'ilike'])
  })

  it('does not match a different reader through an underscore wildcard', async () => {
    const queries: Query[] = []
    const repo = new SupabaseAccessControlRepository(
      makeDeviceClient('NYU-7251900066', queries)
    )

    // `_` is a single-character wildcard in LIKE, and the serial charset
    // allows it. A candidate row must still be confirmed in JS, or one gym's
    // scan could be attributed to another gym's reader.
    const device = await repo.findDeviceBySerial('NYU_7251900066')

    expect(device).toBeNull()
  })

  it('refuses to choose when two readers differ only in case', async () => {
    const rows = [
      { id: 'device-1', gym_id: 'gym-1', device_serial: 'abc123' },
      { id: 'device-2', gym_id: 'gym-2', device_serial: 'ABC123' },
    ]

    const builder = {
      select: () => builder,
      eq: () => ({
        ...builder,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
      ilike: () => ({
        ...builder,
        limit: () => Promise.resolve({ data: rows, error: null }),
      }),
    }

    const repo = new SupabaseAccessControlRepository({
      from: () => builder,
    } as unknown as SupabaseClient)

    // Two gyms, one ambiguous serial. Dropping the scan costs one event;
    // guessing files it under the wrong gym.
    expect(await repo.findDeviceBySerial('AbC123')).toBeNull()
  })

  it('ignores whitespace around the serial', async () => {
    const queries: Query[] = []
    const repo = new SupabaseAccessControlRepository(
      makeDeviceClient('NYU7251900066', queries)
    )

    expect(await repo.findDeviceBySerial(' NYU7251900066 ')).not.toBeNull()
  })
})
