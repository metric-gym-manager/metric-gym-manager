/**
 * Cron-facing repository reads must not silently truncate.
 *
 * A bare PostgREST `.select()` is capped at the project's `db-max-rows`
 * (1000 by default), so the daily status crons only ever saw the first page
 * once a status bucket outgrew the cap. These reads now page with `.range()`
 * until the server returns an empty page.
 */

import { SupabaseMemberRepository } from '@/features/members/services/SupabaseMemberRepository'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'

interface RangeCall {
  from: number
  to: number
}

function makeRow(index: number, status: MemberStatus) {
  return {
    id: `member-${String(index).padStart(5, '0')}`,
    gym_id: 'gym-1',
    name: `Member ${index}`,
    phone_number: '+94771234567',
    plan_type: PlanType.Monthly,
    plan_amount: 2000,
    discount_id: null,
    recurring_discount: false,
    status,
    registered_date: '2026-01-01',
    membership_start_date: '2026-01-01',
    next_due_date: '2026-02-01',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    photo_path: null,
    photo_updated_at: null,
    registration_source: 'manual',
    verified_at: null,
    remarks: null,
    accepted_terms_at: null,
    accepted_gym_rules_at: null,
  }
}

/**
 * Fake Supabase client that serves `total` rows in pages no larger than
 * `serverCap`, mimicking PostgREST's db-max-rows clamp.
 */
function makeSupabase(total: number, status: MemberStatus, serverCap: number) {
  const rangeCalls: RangeCall[] = []
  const allRows = Array.from({ length: total }, (_, i) => makeRow(i, status))

  const client = {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: (from: number, to: number) => {
          rangeCalls.push({ from, to })
          const requested = to - from + 1
          const size = Math.min(requested, serverCap)
          return Promise.resolve({
            data: allRows.slice(from, from + size),
            error: null,
          })
        },
      }
      return builder
    },
  }

  return { client, rangeCalls }
}

describe('SupabaseMemberRepository — paged cron reads', () => {
  it('returns every active member when the set spans multiple pages', async () => {
    const { client, rangeCalls } = makeSupabase(2500, MemberStatus.Active, 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseMemberRepository(client as any)

    const members = await repo.findAllActiveMembers()

    expect(members).toHaveLength(2500)
    expect(rangeCalls.length).toBeGreaterThan(1)
    expect(rangeCalls[0]).toEqual({ from: 0, to: 999 })
  })

  it('walks the whole set even when the server cap is smaller than the page size', async () => {
    const { client } = makeSupabase(1200, MemberStatus.Expired, 500)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseMemberRepository(client as any)

    const members = await repo.findAllExpiredMembers()

    expect(members).toHaveLength(1200)
  })

  it('stops after the first empty page for a small result set', async () => {
    const { client, rangeCalls } = makeSupabase(
      10,
      MemberStatus.Suspended,
      1000
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseMemberRepository(client as any)

    const members = await repo.findAllSuspendedMembers()

    expect(members).toHaveLength(10)
    // One page of data, then one empty page that terminates the loop. The
    // extra round trip is the price of not assuming a short page means EOF.
    expect(rangeCalls).toHaveLength(2)
    expect(rangeCalls[1].from).toBe(10)
  })

  it('returns an empty array when there are no matching members', async () => {
    const { client } = makeSupabase(0, MemberStatus.Active, 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseMemberRepository(client as any)

    await expect(repo.findAllActiveMembers()).resolves.toEqual([])
  })

  it('surfaces a query error', async () => {
    const client = {
      from: () => {
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          range: () =>
            Promise.resolve({ data: null, error: { message: 'boom' } }),
        }
        return builder
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseMemberRepository(client as any)

    await expect(repo.findAllActiveMembers()).rejects.toThrow(
      'Failed to fetch all active members: boom'
    )
  })
})
