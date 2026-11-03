/**
 * The consent column has to survive an ordinary member edit.
 *
 * It used to depend on a round trip: `update()` wrote the *whole* row that
 * `toDatabase()` produced, so if `toDatabase` wrote `biometric_consent_at` but
 * the read side ever stopped populating it, every rename, plan change and
 * payment collection silently overwrote a member's consent record with null.
 * That failure has no symptom anyone would notice: the member keeps their
 * fingerprint, the door keeps working, and the only thing lost is the proof
 * they ever agreed to it, discovered, if ever, by someone asking.
 *
 * Member writes now name their fields, and none of them names this one, so an
 * edit cannot touch the consent at all. The consent is written only by the
 * access-control enrolment path. These tests pin that, and the read side.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMemberRepository } from '@/features/members/services/SupabaseMemberRepository'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import {
  LIFECYCLE_FIELDS,
  PHOTO_FIELDS,
  PROFILE_FIELDS,
} from '@/features/members/config/MemberWriteFields'

const CONSENTED_AT = '2026-02-01T09:00:00.000Z'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    gym_id: 'gym-1',
    name: 'Nimal Perera',
    phone_number: '+94771234567',
    plan_type: PlanType.Monthly,
    plan_amount: 2000,
    discount_id: null,
    recurring_discount: false,
    status: MemberStatus.Active,
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
    biometric_consent_at: CONSENTED_AT,
    ...overrides,
  }
}

/** Records the payload a write sends and echoes a row back. */
function makeSupabase(row: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = []

  const client = {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload)
          return builder
        },
      }

      return builder
    },
  } as unknown as SupabaseClient

  return { client, updates }
}

describe('biometric consent persistence', () => {
  it('reads the consent timestamp back off the row', async () => {
    const { client } = makeSupabase(makeRow())
    const repo = new SupabaseMemberRepository(client)

    const member = await repo.findById('member-1', 'gym-1')

    expect(member?.biometricConsentAt).toEqual(new Date(CONSENTED_AT))
  })

  it('leaves the consent column out of every member write', async () => {
    const { client, updates } = makeSupabase(makeRow())
    const repo = new SupabaseMemberRepository(client)

    const member = await repo.findById('member-1', 'gym-1')
    // A rename touches nothing to do with biometrics, so the write must not
    // carry the consent at all: not the stored value, not a stale one.
    await repo.updateFields(member!.updateName('Nimal P'), PROFILE_FIELDS)
    await repo.updateFields(member!, LIFECYCLE_FIELDS)
    await repo.updateFields(member!, PHOTO_FIELDS)

    expect(updates).toHaveLength(3)
    for (const payload of updates) {
      expect(payload).not.toHaveProperty('biometric_consent_at')
    }
  })

  it('keeps a member without consent at null rather than inventing one', async () => {
    const { client, updates } = makeSupabase(
      makeRow({ biometric_consent_at: null })
    )
    const repo = new SupabaseMemberRepository(client)

    const member = await repo.findById('member-1', 'gym-1')
    expect(member?.biometricConsentAt).toBeNull()

    await repo.updateFields(member!.updateName('Nimal P'), PROFILE_FIELDS)
    expect(updates[0]).not.toHaveProperty('biometric_consent_at')
  })

  it('defaults to null for a member built without the field', () => {
    const member = Member.create({
      gymId: 'gym-1',
      name: 'Nimal Perera',
      phoneNumber: '+94771234567',
      planType: PlanType.Monthly,
      planAmount: 2000,
      discountId: null,
      recurringDiscount: false,
      status: MemberStatus.Active,
      registeredDate: new Date('2026-01-01'),
      membershipStartDate: new Date('2026-01-01'),
      nextDueDate: new Date('2026-02-01'),
    })

    // Never asked is the same as no permission, and a freshly registered
    // member has never been asked — registration deliberately does not
    // collect this.
    expect(member.biometricConsentAt).toBeNull()
  })
})
