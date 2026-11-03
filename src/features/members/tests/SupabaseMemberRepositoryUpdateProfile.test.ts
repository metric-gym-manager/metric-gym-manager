/**
 * What `SupabaseMemberRepository` writes for a profile edit, and how it finds a
 * member by phone.
 *
 * `update()` rewrites every column from the entity it is handed. For a profile
 * edit that entity came from an earlier read, so any change another request had
 * made in between (a payment moving `next_due_date`, a status flip, a
 * fingerprint consent) was put back. `updateProfile()` writes only the columns
 * the edit form can change.
 *
 * The fake client below records the payload of `.update()` and reproduces the
 * two PostgREST behaviours the phone lookup depends on: `.single()` fails for
 * zero OR several rows, and `.maybeSingle()` fails for several.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMemberRepository } from '@/features/members/services/SupabaseMemberRepository'
import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { NotFoundError } from '@/utils/errors'

type Row = Record<string, unknown>

const baseRow = (id: string, phone: string): Row => ({
  id,
  gym_id: 'gym-1',
  member_number: 7,
  name: 'Fathima Herath',
  phone_number: phone,
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: null,
  recurring_discount: false,
  status: 'active',
  registered_date: '2026-08-16',
  membership_start_date: '2026-08-16',
  next_due_date: '2026-12-16',
  created_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  remarks: null,
  accepted_terms_at: null,
  accepted_gym_rules_at: null,
  biometric_consent_at: null,
})

const PGRST116 = {
  code: 'PGRST116',
  message: 'JSON object requested, multiple (or no) rows returned',
}

/** A thenable query builder over `rows`, honouring `.limit()`. */
function makeClient(rows: Row[]) {
  const calls = {
    update: [] as Row[],
    limit: [] as number[],
    eq: [] as [string, unknown][],
  }

  const client = {
    from: () => {
      let limitN: number | null = null
      let updating = false

      const visible = () => (limitN === null ? rows : rows.slice(0, limitN))

      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (payload: Row) => {
          updating = true
          calls.update.push(payload)
          return builder
        },
        eq: (col: string, val: unknown) => {
          calls.eq.push([col, val])
          return builder
        },
        limit: (n: number) => {
          limitN = n
          calls.limit.push(n)
          return builder
        },
        single: async () => {
          const r = visible()
          return r.length === 1
            ? { data: r[0], error: null }
            : { data: null, error: PGRST116 }
        },
        maybeSingle: async () => {
          const r = visible()
          if (r.length === 0) return { data: null, error: null }
          if (r.length === 1) {
            // An update returns the row as it is after the write.
            return {
              data: updating ? { ...r[0], ...calls.update[0] } : r[0],
              error: null,
            }
          }
          return { data: null, error: PGRST116 }
        },
      }
      return builder
    },
  }

  return { client: client as unknown as SupabaseClient, calls }
}

function memberFromRow(row: Row): Member {
  return Member.fromDatabase({
    id: row.id as string,
    gymId: row.gym_id as string,
    memberNumber: 7,
    name: row.name as string,
    phoneNumber: row.phone_number as string,
    planType: PlanType.Annual,
    planAmount: 30000,
    discountId: 'discount-1',
    recurringDiscount: true,
    // Deliberately DIFFERENT from what the database holds below: this is the
    // stale copy an earlier read produced. None of it may reach the write.
    status: MemberStatus.Expired,
    registeredDate: new Date('2020-01-01'),
    membershipStartDate: new Date('2020-01-01'),
    nextDueDate: new Date('2020-02-01'),
    createdAt: new Date('2020-01-01T00:00:00Z'),
    updatedAt: new Date('2020-01-01T00:00:00Z'),
    photoPath: 'profiles/stale.webp',
    remarks: 'stale remark',
    biometricConsentAt: new Date('2020-01-01T00:00:00Z'),
  })
}

describe('SupabaseMemberRepository.updateProfile', () => {
  it('writes only the profile columns and updated_at', async () => {
    const { client, calls } = makeClient([baseRow('member-1', '+94751230428')])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateProfile(memberFromRow(baseRow('member-1', '+94771234567')))

    expect(calls.update).toHaveLength(1)
    expect(Object.keys(calls.update[0]).sort()).toEqual(
      [
        'discount_id',
        'name',
        'phone_number',
        'plan_amount',
        'plan_type',
        'recurring_discount',
        'updated_at',
      ].sort()
    )
  })

  it('does not carry any state-owning column from the stale entity', async () => {
    const { client, calls } = makeClient([baseRow('member-1', '+94751230428')])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateProfile(memberFromRow(baseRow('member-1', '+94771234567')))

    for (const column of [
      'status',
      'next_due_date',
      'membership_start_date',
      'registered_date',
      'photo_path',
      'photo_updated_at',
      'verified_at',
      'remarks',
      'accepted_terms_at',
      'accepted_gym_rules_at',
      'biometric_consent_at',
      'registration_source',
      'created_at',
      'member_number',
    ]) {
      expect(calls.update[0]).not.toHaveProperty(column)
    }
  })

  it('sends the edited values', async () => {
    const { client, calls } = makeClient([baseRow('member-1', '+94751230428')])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateProfile(memberFromRow(baseRow('member-1', '+94771234567')))

    expect(calls.update[0]).toMatchObject({
      name: 'Fathima Herath',
      phone_number: '+94771234567',
      plan_type: 'annual',
      plan_amount: 30000,
      discount_id: 'discount-1',
      recurring_discount: true,
    })
  })

  it('scopes the write to the member and the gym', async () => {
    const { client, calls } = makeClient([baseRow('member-1', '+94751230428')])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateProfile(memberFromRow(baseRow('member-1', '+94771234567')))

    expect(calls.eq).toEqual(
      expect.arrayContaining([
        ['id', 'member-1'],
        ['gym_id', 'gym-1'],
      ])
    )
  })

  it('returns the row as stored, so untouched columns are the live ones', async () => {
    const { client } = makeClient([baseRow('member-1', '+94751230428')])
    const repo = new SupabaseMemberRepository(client)

    const saved = await repo.updateProfile(
      memberFromRow(baseRow('member-1', '+94771234567'))
    )

    expect(saved.status).toBe(MemberStatus.Active)
    expect(saved.nextDueDate.toISOString().slice(0, 10)).toBe('2026-12-16')
    expect(saved.phoneNumber).toBe('+94771234567')
  })

  it('throws NotFoundError when no row matched (a refused write is not success)', async () => {
    const { client } = makeClient([])
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.updateProfile(memberFromRow(baseRow('member-1', '+94771234567')))
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('SupabaseMemberRepository.findByPhoneNumber', () => {
  it('returns null when nobody has the number', async () => {
    const { client } = makeClient([])
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.findByPhoneNumber('+94771234567', 'gym-1')
    ).resolves.toBeNull()
  })

  it('returns the member when exactly one has the number', async () => {
    const { client } = makeClient([baseRow('member-1', '+94771234567')])
    const repo = new SupabaseMemberRepository(client)

    const found = await repo.findByPhoneNumber('+94771234567', 'gym-1')
    expect(found?.id).toBe('member-1')
  })

  it('still finds a holder when several members already share the number', async () => {
    // `.single()` reports PGRST116 for several rows exactly as it does for none,
    // and the code read that as "not found" — so the duplicate check passed for
    // the very numbers that were already duplicated.
    const { client } = makeClient([
      baseRow('member-1', '+94771234567'),
      baseRow('member-2', '+94771234567'),
    ])
    const repo = new SupabaseMemberRepository(client)

    const found = await repo.findByPhoneNumber('+94771234567', 'gym-1')
    expect(found).not.toBeNull()
  })
})
