import fs from 'node:fs'
import path from 'node:path'
import {
  BULK_REGISTER_MAX_ROWS,
  bulkRegisterSchema,
} from '../schemas/member.schemas'

/**
 * The bulk grid and POST /api/members/bulk must agree on two things: how many
 * rows one batch may carry, and what a row looks like. Both drifted before —
 * the grid had no row cap while the route allowed 50, and the route validated
 * each row with addMemberSchema after it gained two required consents the grid
 * never sends.
 */

/** A row exactly as BulkAddMemberModal sends it. */
const gridRow = (i: number) => ({
  name: `Member ${i}`,
  phoneNumber: `07712345${String(i).padStart(2, '0')}`,
  planType: 'monthly',
  planAmount: 4000,
  paymentAmount: 4000,
  membershipStartDate: '2026-09-20',
  discountId: null,
  recurringDiscount: false,
  acceptedTerms: true,
  acceptedGymRules: true,
})

describe('bulkRegisterSchema', () => {
  it('accepts a full batch of rows as the grid sends them', () => {
    const batch = Array.from({ length: BULK_REGISTER_MAX_ROWS }, (_, i) =>
      gridRow(i)
    )
    const parsed = bulkRegisterSchema.safeParse({ members: batch })
    expect(parsed.success ? 'ok' : parsed.error.issues[0]).toBe('ok')
  })

  it('refuses a row without both consents, as single registration does', () => {
    const { acceptedGymRules: _omitted, ...withoutRules } = gridRow(1)
    expect(
      bulkRegisterSchema.safeParse({ members: [withoutRules] }).success
    ).toBe(false)
  })

  it('rejects one row more than a batch holds', () => {
    const batch = Array.from({ length: BULK_REGISTER_MAX_ROWS + 1 }, (_, i) =>
      gridRow(i)
    )
    expect(bulkRegisterSchema.safeParse({ members: batch }).success).toBe(false)
  })

  it('is the schema the bulk route validates with', () => {
    const route = fs.readFileSync(
      path.resolve(__dirname, '../../../app/api/members/bulk/route.ts'),
      'utf8'
    )
    expect(route).toContain('bulkRegisterSchema')
    expect(route).not.toMatch(/\.max\(\s*\d+\s*\)/)
  })
})
