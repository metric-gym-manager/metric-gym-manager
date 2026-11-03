import {
  PROFILE_FIELDS,
  LIFECYCLE_FIELDS,
  STATUS_FIELDS,
  PLAN_FIELDS,
  PHOTO_FIELDS,
  VERIFICATION_FIELDS,
  type MemberWritableField,
} from '../config/MemberWriteFields'

/**
 * The field groups are the contract that stops one writer reverting another.
 *
 * A payment and a profile edit were both whole-row writes from an earlier read,
 * so whichever landed second put the other's columns back. They stay safe only
 * while the columns they write are different, which is what these pin.
 */

const overlap = (
  a: readonly MemberWritableField[],
  b: readonly MemberWritableField[]
) => a.filter((field) => b.includes(field))

describe('member write field groups', () => {
  it('a profile edit and a payment never write the same column', () => {
    expect(overlap(PROFILE_FIELDS, LIFECYCLE_FIELDS)).toEqual([])
  })

  it('a profile edit never writes status or the due date', () => {
    expect(PROFILE_FIELDS).not.toContain('status')
    expect(PROFILE_FIELDS).not.toContain('nextDueDate')
  })

  it('a payment writes only status and the due date, plus plan columns on a switch', () => {
    expect([...LIFECYCLE_FIELDS].sort()).toEqual(['nextDueDate', 'status'])
    expect([...PLAN_FIELDS].sort()).toEqual(['planAmount', 'planType'])
  })

  it('the only columns profile and plan groups share are the plan columns', () => {
    // A reactivation that switches the plan and a concurrent plan edit really
    // do want the same columns; that is last-writer-wins by intent.
    expect(overlap(PROFILE_FIELDS, PLAN_FIELDS).sort()).toEqual([
      'planAmount',
      'planType',
    ])
  })

  it('status transitions write status and nothing else', () => {
    expect(STATUS_FIELDS).toEqual(['status'])
  })

  it('photo and verification writes never touch status or the due date', () => {
    for (const group of [PHOTO_FIELDS, VERIFICATION_FIELDS]) {
      expect(group).not.toContain('status')
      expect(group).not.toContain('nextDueDate')
    }
  })

  it('no group lists a field twice', () => {
    for (const group of [
      PROFILE_FIELDS,
      LIFECYCLE_FIELDS,
      STATUS_FIELDS,
      PLAN_FIELDS,
      PHOTO_FIELDS,
      VERIFICATION_FIELDS,
    ]) {
      expect(new Set(group).size).toBe(group.length)
    }
  })
})
