/**
 * What `SupabaseMemberRepository.updateFields` writes, and how it finds a
 * member by phone.
 *
 * The repository used to expose `update()`, which rewrote every column from the
 * entity it was handed. That entity came from an earlier read, so any change
 * another request had made in between (a payment moving `next_due_date`, a
 * profile edit, a status flip, a fingerprint consent) was put back. The only
 * write now names its fields.
 *
 * The fake client below records the payload of `.update()`, applies `.eq()`
 * filters to its rows (so a guard can fail to match, as it does in Postgres),
 * and reproduces the two PostgREST behaviours the phone lookup depends on:
 * `.single()` fails for zero OR several rows, `.maybeSingle()` for several.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMemberRepository } from '@/features/members/services/SupabaseMemberRepository'
import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  PROFILE_FIELDS,
  LIFECYCLE_FIELDS,
  STATUS_FIELDS,
  PLAN_FIELDS,
  PHOTO_FIELDS,
  VERIFICATION_FIELDS,
} from '@/features/members/config/MemberWriteFields'
import { ConflictError, MemberLimitError, NotFoundError } from '@/utils/errors'

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

/** A thenable query builder over `rows`, honouring `.eq()` and `.limit()`. */
function makeClient(rows: Row[], updateError?: { message: string }) {
  const calls = {
    update: [] as Row[],
    limit: [] as number[],
    eq: [] as [string, unknown][],
  }

  const client = {
    from: () => {
      let limitN: number | null = null
      let updating = false
      const filters: [string, unknown][] = []

      const visible = () => {
        const matched = rows.filter((r) =>
          filters.every(([col, val]) => r[col] === val)
        )
        return limitN === null ? matched : matched.slice(0, limitN)
      }

      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (payload: Row) => {
          updating = true
          calls.update.push(payload)
          return builder
        },
        eq: (col: string, val: unknown) => {
          filters.push([col, val])
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
          if (updating && updateError) return { data: null, error: updateError }
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

/**
 * The entity an earlier read produced, deliberately DIFFERENT from what the
 * database holds in `baseRow`. None of the stale values may reach a write that
 * did not name them.
 */
function staleMember(): Member {
  return Member.fromDatabase({
    id: 'member-1',
    gymId: 'gym-1',
    memberNumber: 7,
    name: 'Stale Name',
    phoneNumber: '+94770000009',
    planType: PlanType.Annual,
    planAmount: 30000,
    discountId: 'discount-1',
    recurringDiscount: true,
    status: MemberStatus.Expired,
    registeredDate: new Date('2020-01-01'),
    membershipStartDate: new Date('2020-01-01'),
    nextDueDate: new Date('2020-02-01'),
    createdAt: new Date('2020-01-01T00:00:00Z'),
    updatedAt: new Date('2020-01-01T00:00:00Z'),
    photoPath: 'profiles/stale.webp',
    photoUpdatedAt: new Date('2020-01-01T00:00:00Z'),
    verifiedAt: new Date('2020-01-01T00:00:00Z'),
    remarks: 'stale remark',
    biometricConsentAt: new Date('2020-01-01T00:00:00Z'),
  })
}

const dbRow = () => baseRow('member-1', '+94751230428')

const sorted = (o: Row) => Object.keys(o).sort()

describe('SupabaseMemberRepository.updateFields — which columns are written', () => {
  it.each([
    [
      'profile',
      PROFILE_FIELDS,
      [
        'discount_id',
        'name',
        'phone_number',
        'plan_amount',
        'plan_type',
        'recurring_discount',
      ],
    ],
    ['lifecycle', LIFECYCLE_FIELDS, ['next_due_date', 'status']],
    ['status', STATUS_FIELDS, ['status']],
    ['plan', PLAN_FIELDS, ['plan_amount', 'plan_type']],
    ['photo', PHOTO_FIELDS, ['photo_path', 'photo_updated_at']],
    ['verification', VERIFICATION_FIELDS, ['verified_at']],
  ])(
    '%s group writes its columns and updated_at only',
    async (_n, fields, cols) => {
      const { client, calls } = makeClient([dbRow()])
      const repo = new SupabaseMemberRepository(client)

      await repo.updateFields(staleMember(), fields)

      expect(sorted(calls.update[0])).toEqual([...cols, 'updated_at'].sort())
    }
  )

  it('a payment that switches the plan writes lifecycle and plan columns together', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), [
      ...LIFECYCLE_FIELDS,
      ...PLAN_FIELDS,
    ])

    expect(sorted(calls.update[0])).toEqual(
      [
        'next_due_date',
        'plan_amount',
        'plan_type',
        'status',
        'updated_at',
      ].sort()
    )
  })

  it('a lifecycle write carries no profile column from the stale entity', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), LIFECYCLE_FIELDS)

    for (const column of [
      'name',
      'phone_number',
      'plan_type',
      'plan_amount',
      'discount_id',
      'recurring_discount',
      'photo_path',
      'verified_at',
      'remarks',
      'accepted_terms_at',
      'accepted_gym_rules_at',
      'biometric_consent_at',
      'registration_source',
      'membership_start_date',
      'registered_date',
      'created_at',
      'member_number',
    ]) {
      expect(calls.update[0]).not.toHaveProperty(column)
    }
  })

  it('a profile write carries no lifecycle column from the stale entity', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), PROFILE_FIELDS)

    expect(calls.update[0]).not.toHaveProperty('status')
    expect(calls.update[0]).not.toHaveProperty('next_due_date')
  })

  it('sends the entity values for the columns it was told to write', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), [...PROFILE_FIELDS, 'status'])

    expect(calls.update[0]).toMatchObject({
      name: 'Stale Name',
      phone_number: '+94770000009',
      plan_type: 'annual',
      plan_amount: 30000,
      discount_id: 'discount-1',
      recurring_discount: true,
      status: 'expired',
    })
  })

  it('formats dates and nulls the way the table stores them', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), ['nextDueDate', 'photoUpdatedAt'])
    expect(calls.update[0].next_due_date).toBe('2020-02-01')
    expect(calls.update[0].photo_updated_at).toBe('2020-01-01T00:00:00.000Z')

    const removed = staleMember().removePhoto()
    await repo.updateFields(removed, PHOTO_FIELDS)
    expect(calls.update[1]).toMatchObject({
      photo_path: null,
      photo_updated_at: null,
    })
  })

  it('scopes the write to the member and the gym', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), STATUS_FIELDS)

    expect(calls.eq).toEqual(
      expect.arrayContaining([
        ['id', 'member-1'],
        ['gym_id', 'gym-1'],
      ])
    )
  })

  it('returns the row as stored, so untouched columns are the live ones', async () => {
    const { client } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    const saved = await repo.updateFields(staleMember(), ['phoneNumber'])

    expect(saved.name).toBe('Fathima Herath')
    expect(saved.status).toBe(MemberStatus.Active)
    expect(saved.nextDueDate.toISOString().slice(0, 10)).toBe('2026-12-16')
    expect(saved.phoneNumber).toBe('+94770000009')
  })

  it('writes nothing it was not told to, even with an empty list', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), [])

    expect(Object.keys(calls.update[0])).toEqual(['updated_at'])
  })
})

describe('SupabaseMemberRepository.updateFields — guards', () => {
  it('applies only while the member is still due on the date the caller read', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), LIFECYCLE_FIELDS, {
      expectedNextDueDate: new Date('2026-12-16'),
    })

    expect(calls.eq).toContainEqual(['next_due_date', '2026-12-16'])
  })

  it('applies only while the member still has the status the caller read', async () => {
    const { client, calls } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await repo.updateFields(staleMember(), STATUS_FIELDS, {
      expectedStatus: MemberStatus.Active,
    })

    expect(calls.eq).toContainEqual(['status', 'active'])
  })

  it('throws ConflictError when the due date has moved since it was read', async () => {
    const { client } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.updateFields(staleMember(), LIFECYCLE_FIELDS, {
        expectedNextDueDate: new Date('2026-11-01'),
      })
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('throws ConflictError when the status has changed since it was read', async () => {
    const { client } = makeClient([dbRow()])
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.updateFields(staleMember(), STATUS_FIELDS, {
        expectedStatus: MemberStatus.Suspended,
      })
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('throws NotFoundError for a missing member when no guard was given', async () => {
    const { client } = makeClient([])
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.updateFields(staleMember(), STATUS_FIELDS)
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('SupabaseMemberRepository.updateFields — database errors', () => {
  it('maps the quota trigger to MemberLimitError', async () => {
    const { client } = makeClient([dbRow()], {
      message: 'MEMBER_LIMIT_REACHED',
    })
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.updateFields(staleMember(), LIFECYCLE_FIELDS)
    ).rejects.toBeInstanceOf(MemberLimitError)
  })

  it('wraps any other database error', async () => {
    const { client } = makeClient([dbRow()], { message: 'connection reset' })
    const repo = new SupabaseMemberRepository(client)

    await expect(
      repo.updateFields(staleMember(), LIFECYCLE_FIELDS)
    ).rejects.toThrow(/connection reset/)
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
