/**
 * The manual member actions — suspend, cancel, reactivate, verify — write only
 * the columns they change, so none of them can revert a profile edit made while
 * they were running.
 *
 * Each used to read a member and write the whole row back. The window is a few
 * milliseconds for these (a person clicking), but the write was a copy of the
 * member as it was read: a phone number or fee edited in between came back as
 * it was.
 */

import { SuspendMember } from '../services/SuspendMember'
import { CancelMember } from '../services/CancelMember'
import { ReactivateMember } from '../services/ReactivateMember'
import { VerifyMember } from '../services/VerifyMember'
import { UpdateMemberProfile } from '../services/UpdateMemberProfile'
import { Member, type MemberProps } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'
import {
  LIFECYCLE_FIELDS,
  STATUS_FIELDS,
  VERIFICATION_FIELDS,
} from '@/features/members/config/MemberWriteFields'
import { createMemberStore } from '@/test-utils/memberStore'
import { ConflictError } from '@/utils/errors'

const GYM_ID = 'gym-1'
const MEMBER_ID = 'member-1'
const OLD_PHONE = '+94770000001'
const NEW_PHONE = '+94771234567'

const daysFromToday = (days: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function member(overrides: Partial<MemberProps> = {}) {
  return Member.fromDatabase({
    id: MEMBER_ID,
    gymId: GYM_ID,
    memberNumber: 7,
    name: 'Fathima Herath',
    phoneNumber: OLD_PHONE,
    planType: PlanType.Monthly,
    planAmount: 3500,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: daysFromToday(-180),
    membershipStartDate: daysFromToday(-180),
    nextDueDate: daysFromToday(3),
    createdAt: daysFromToday(-180),
    updatedAt: daysFromToday(-180),
    ...overrides,
  })
}

const input = { memberId: MEMBER_ID, gymId: GYM_ID }

/** The profile edit that lands while the other action holds its stale copy. */
const profileEdit = (repo: unknown) => async () => {
  await new UpdateMemberProfile(repo as never).execute({
    ...input,
    name: 'Fathima Perera',
    phoneNumber: NEW_PHONE,
    planAmount: 4500,
  })
}

describe('which columns each manual action writes', () => {
  it('suspend writes the status only', async () => {
    const store = createMemberStore(member())
    await new SuspendMember(store.repo as never).execute(input)

    expect(store.repo.updateFields.mock.calls[0][1]).toEqual(STATUS_FIELDS)
  })

  it('cancel writes the status only', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Expired }))
    await new CancelMember(store.repo as never).execute(input)

    expect(store.repo.updateFields.mock.calls[0][1]).toEqual(STATUS_FIELDS)
  })

  it('reactivate writes the status and the due date', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Cancelled }))
    await new ReactivateMember(store.repo as never).execute({
      ...input,
      newDueDate: daysFromToday(30),
    })

    expect(store.repo.updateFields.mock.calls[0][1]).toEqual(LIFECYCLE_FIELDS)
  })

  it('verify writes the verification time only', async () => {
    const store = createMemberStore(
      member({ registrationSource: RegistrationSource.Qr })
    )
    await new VerifyMember(store.repo as never).execute(input)

    expect(store.repo.updateFields.mock.calls[0][1]).toEqual(
      VERIFICATION_FIELDS
    )
  })

  it('verify of an already-verified member writes nothing', async () => {
    const store = createMemberStore(member())
    await new VerifyMember(store.repo as never).execute(input)

    expect(store.repo.updateFields).not.toHaveBeenCalled()
  })
})

describe('a manual action racing a profile edit keeps both', () => {
  it('suspend', async () => {
    const store = createMemberStore(member())
    store.duringNextRead(profileEdit(store.repo))

    await new SuspendMember(store.repo as never).execute(input)

    expect(store.current.status).toBe(MemberStatus.Suspended)
    expect(store.current.name).toBe('Fathima Perera')
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
    expect(store.current.planAmount).toBe(4500)
  })

  it('cancel', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Expired }))
    store.duringNextRead(profileEdit(store.repo))

    await new CancelMember(store.repo as never).execute(input)

    expect(store.current.status).toBe(MemberStatus.Cancelled)
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
    expect(store.current.planAmount).toBe(4500)
  })

  it('reactivate', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Cancelled }))
    store.duringNextRead(profileEdit(store.repo))
    const newDue = daysFromToday(30)

    await new ReactivateMember(store.repo as never).execute({
      ...input,
      newDueDate: newDue,
    })

    expect(store.current.status).toBe(MemberStatus.Active)
    expect(store.current.nextDueDate.getTime()).toBe(newDue.getTime())
    expect(store.current.name).toBe('Fathima Perera')
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
  })

  it('verify', async () => {
    const store = createMemberStore(
      member({ registrationSource: RegistrationSource.Qr })
    )
    store.duringNextRead(profileEdit(store.repo))

    await new VerifyMember(store.repo as never).execute(input)

    expect(store.current.verifiedAt).toBeInstanceOf(Date)
    expect(store.current.name).toBe('Fathima Perera')
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
  })
})

/**
 * A manual action is computed from the status it read. If another request
 * changed that status in the moment between the read and the write — the
 * expiry cron, a payment on another device — the action no longer means what
 * the operator chose, so it is refused (409) instead of applied on top.
 */
describe('a manual action is refused when the status it read has changed', () => {
  it('passes the status it read as the guard', async () => {
    const cases: [() => Promise<unknown>, MemberStatus][] = []
    const repo = {
      findById: jest.fn(),
      updateFields: jest.fn().mockImplementation(async (m: Member) => m),
    }

    repo.findById.mockResolvedValueOnce(member({ status: MemberStatus.Active }))
    cases.push([
      () => new SuspendMember(repo as never).execute(input),
      MemberStatus.Active,
    ])
    repo.findById.mockResolvedValueOnce(
      member({ status: MemberStatus.Expired })
    )
    cases.push([
      () => new CancelMember(repo as never).execute(input),
      MemberStatus.Expired,
    ])
    repo.findById.mockResolvedValueOnce(
      member({ status: MemberStatus.Cancelled })
    )
    cases.push([
      () =>
        new ReactivateMember(repo as never).execute({
          ...input,
          newDueDate: daysFromToday(30),
        }),
      MemberStatus.Cancelled,
    ])

    for (const [run, read] of cases) {
      repo.updateFields.mockClear()
      await run()
      expect(repo.updateFields.mock.calls[0][2]).toEqual({
        expectedStatus: read,
      })
    }
  })

  it('suspend, after the expiry cron moved the member to expired', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Active }))
    store.duringNextRead(async () => {
      await store.repo.updateFields(store.current.expire(), STATUS_FIELDS)
    })

    await expect(
      new SuspendMember(store.repo as never).execute(input)
    ).rejects.toBeInstanceOf(ConflictError)
    expect(store.current.status).toBe(MemberStatus.Expired)
  })

  it('cancel, after a payment brought the member back', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Expired }))
    const paidThrough = daysFromToday(30)
    store.duringNextRead(async () => {
      await store.repo.updateFields(
        store.current.activate(paidThrough),
        LIFECYCLE_FIELDS
      )
    })

    await expect(
      new CancelMember(store.repo as never).execute(input)
    ).rejects.toBeInstanceOf(ConflictError)
    expect(store.current.status).toBe(MemberStatus.Active)
    expect(store.current.nextDueDate.getTime()).toBe(paidThrough.getTime())
  })

  it('reactivate, after a payment already reactivated the member', async () => {
    const store = createMemberStore(member({ status: MemberStatus.Cancelled }))
    const paidThrough = daysFromToday(30)
    store.duringNextRead(async () => {
      await store.repo.updateFields(
        store.current.activate(paidThrough),
        LIFECYCLE_FIELDS
      )
    })

    await expect(
      new ReactivateMember(store.repo as never).execute({
        ...input,
        newDueDate: daysFromToday(7),
      })
    ).rejects.toBeInstanceOf(ConflictError)
    // The paid-through date stands; the hand-picked one is not written over it.
    expect(store.current.nextDueDate.getTime()).toBe(paidThrough.getTime())
  })
})
