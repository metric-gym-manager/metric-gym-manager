/**
 * The nightly status crons against changes made while they run.
 *
 * Each cron reads every member it cares about ONCE, then writes each one back
 * in a loop that runs for seconds to minutes. A payment, a reactivation or a
 * profile edit recorded during that loop used to be reverted: the cron wrote
 * back the member as it had read it, so a member who had just paid ended up
 * expired again (and, with a status-only write, would have been left expired
 * with a future due date).
 *
 * The crons now write the status only, and only if the member is still in the
 * status and due on the date the cron read. A member who changed meanwhile is
 * skipped and counted, not overwritten and not reported as an error.
 */

import { UpdateExpiredStatus } from '../services/UpdateExpiredStatus'
import { CancelOverdueMembers } from '../services/CancelOverdueMembers'
import { ExpireSuspendedMembers } from '../services/ExpireSuspendedMembers'
import { UpdateMemberProfile } from '../services/UpdateMemberProfile'
import { Member, type MemberProps } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  LIFECYCLE_FIELDS,
  STATUS_FIELDS,
} from '@/features/members/config/MemberWriteFields'
import { createMemberStore } from '@/test-utils/memberStore'

const GYM_ID = 'gym-1'
const MEMBER_ID = 'member-1'
const NEW_PHONE = '+94771234567'

const daysFromToday = (days: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function member(status: MemberStatus, dueInDays: number, id = MEMBER_ID) {
  const props: MemberProps = {
    id,
    gymId: GYM_ID,
    memberNumber: 7,
    name: 'Fathima Herath',
    phoneNumber: '+94770000001',
    planType: PlanType.Monthly,
    planAmount: 3500,
    discountId: null,
    recurringDiscount: false,
    status,
    registeredDate: daysFromToday(-200),
    membershipStartDate: daysFromToday(-200),
    nextDueDate: daysFromToday(dueInDays),
    createdAt: daysFromToday(-200),
    updatedAt: daysFromToday(-200),
  }
  return Member.fromDatabase(props)
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('UpdateExpiredStatus (active → expired)', () => {
  const overdueActive = () => member(MemberStatus.Active, -2)

  it('expires an overdue member and skips nobody', async () => {
    const store = createMemberStore(overdueActive())

    const summary = await new UpdateExpiredStatus(store.repo as never).execute()

    expect(summary.totalUpdated).toBe(1)
    expect(summary.skippedChanged).toBe(0)
    expect(store.current.status).toBe(MemberStatus.Expired)
  })

  it('writes the status only, guarded by the status and due date it read', async () => {
    const original = overdueActive()
    const store = createMemberStore(original)

    await new UpdateExpiredStatus(store.repo as never).execute()

    const [, fields, options] = store.repo.updateFields.mock.calls[0]
    expect(fields).toEqual(STATUS_FIELDS)
    expect(options).toEqual({
      expectedStatus: MemberStatus.Active,
      expectedNextDueDate: original.nextDueDate,
    })
  })

  it('does not undo a payment recorded while it runs', async () => {
    const original = overdueActive()
    const store = createMemberStore(original)
    const paidDue = daysFromToday(28)

    // The desk records the member's payment after the cron has read its list.
    store.duringNextRead(async () => {
      await store.repo.updateFields(
        Member.fromDatabase({
          ...original.toDatabase(),
          status: MemberStatus.Active,
          nextDueDate: paidDue,
        }),
        LIFECYCLE_FIELDS
      )
    })

    const summary = await new UpdateExpiredStatus(store.repo as never).execute()

    expect(store.current.status).toBe(MemberStatus.Active)
    expect(store.current.nextDueDate.getTime()).toBe(paidDue.getTime())
    expect(summary.totalUpdated).toBe(0)
    expect(summary.skippedChanged).toBe(1)
    expect(summary.errors).toEqual([])
  })

  it('does not overwrite a suspension made while it runs', async () => {
    const original = overdueActive()
    const store = createMemberStore(original)

    store.duringNextRead(async () => {
      await store.repo.updateFields(original.suspend(), STATUS_FIELDS)
    })

    const summary = await new UpdateExpiredStatus(store.repo as never).execute()

    expect(store.current.status).toBe(MemberStatus.Suspended)
    expect(summary.skippedChanged).toBe(1)
    expect(summary.errors).toEqual([])
  })

  it('keeps a profile edit made while it runs, and still expires the member', async () => {
    const store = createMemberStore(overdueActive())

    store.duringNextRead(async () => {
      await new UpdateMemberProfile(store.repo as never).execute({
        memberId: MEMBER_ID,
        gymId: GYM_ID,
        phoneNumber: NEW_PHONE,
        planAmount: 4500,
      })
    })

    const summary = await new UpdateExpiredStatus(store.repo as never).execute()

    expect(store.current.status).toBe(MemberStatus.Expired)
    expect(store.current.phoneNumber).toBe(NEW_PHONE)
    expect(store.current.planAmount).toBe(4500)
    expect(summary.totalUpdated).toBe(1)
    expect(summary.skippedChanged).toBe(0)
  })

  it('still reports a real failure as an error, not as a skip', async () => {
    const store = createMemberStore(overdueActive())
    store.repo.updateFields.mockRejectedValueOnce(new Error('db down'))

    const summary = await new UpdateExpiredStatus(store.repo as never).execute()

    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0]).toContain('db down')
    expect(summary.skippedChanged).toBe(0)
  })
})

describe('CancelOverdueMembers (expired → cancelled)', () => {
  const longExpired = () => member(MemberStatus.Expired, -20)

  it('cancels a member 20 days overdue', async () => {
    const store = createMemberStore(longExpired())

    const summary = await new CancelOverdueMembers(
      store.repo as never
    ).execute()

    expect(summary.totalCancelled).toBe(1)
    expect(summary.skippedChanged).toBe(0)
    expect(store.current.status).toBe(MemberStatus.Cancelled)
  })

  it('writes the status only, guarded by the status and due date it read', async () => {
    const original = longExpired()
    const store = createMemberStore(original)

    await new CancelOverdueMembers(store.repo as never).execute()

    const [, fields, options] = store.repo.updateFields.mock.calls[0]
    expect(fields).toEqual(STATUS_FIELDS)
    expect(options).toEqual({
      expectedStatus: MemberStatus.Expired,
      expectedNextDueDate: original.nextDueDate,
    })
  })

  it('does not cancel a member who pays while it runs', async () => {
    const original = longExpired()
    const store = createMemberStore(original)
    const paidDue = daysFromToday(28)

    store.duringNextRead(async () => {
      await store.repo.updateFields(
        original.activate(paidDue),
        LIFECYCLE_FIELDS
      )
    })

    const summary = await new CancelOverdueMembers(
      store.repo as never
    ).execute()

    expect(store.current.status).toBe(MemberStatus.Active)
    expect(store.current.nextDueDate.getTime()).toBe(paidDue.getTime())
    expect(summary.totalCancelled).toBe(0)
    expect(summary.skippedChanged).toBe(1)
    expect(summary.errors).toEqual([])
  })
})

describe('ExpireSuspendedMembers (suspended → expired)', () => {
  const overdueSuspended = () => member(MemberStatus.Suspended, -3)

  it('expires an overdue suspended member', async () => {
    const store = createMemberStore(overdueSuspended())

    const summary = await new ExpireSuspendedMembers(
      store.repo as never
    ).execute()

    expect(summary.totalExpired).toBe(1)
    expect(summary.skippedChanged).toBe(0)
    expect(store.current.status).toBe(MemberStatus.Expired)
  })

  it('writes the status only, guarded by the status and due date it read', async () => {
    const original = overdueSuspended()
    const store = createMemberStore(original)

    await new ExpireSuspendedMembers(store.repo as never).execute()

    const [, fields, options] = store.repo.updateFields.mock.calls[0]
    expect(fields).toEqual(STATUS_FIELDS)
    expect(options).toEqual({
      expectedStatus: MemberStatus.Suspended,
      expectedNextDueDate: original.nextDueDate,
    })
  })

  it('does not expire a member who is reactivated while it runs', async () => {
    const original = overdueSuspended()
    const store = createMemberStore(original)
    const newDue = daysFromToday(28)

    store.duringNextRead(async () => {
      await store.repo.updateFields(original.activate(newDue), LIFECYCLE_FIELDS)
    })

    const summary = await new ExpireSuspendedMembers(
      store.repo as never
    ).execute()

    expect(store.current.status).toBe(MemberStatus.Active)
    expect(store.current.nextDueDate.getTime()).toBe(newDue.getTime())
    expect(summary.totalExpired).toBe(0)
    expect(summary.skippedChanged).toBe(1)
    expect(summary.errors).toEqual([])
  })
})
