/**
 * Due-today reminder = the "membership expires today" notice.
 *
 * With instant expiry (no grace period) the due date is the LAST day a member
 * is Active — update-expired-status (00:00) expires them before the next
 * send-reminders run (03:30), and that job only reads ACTIVE members. So the
 * due-today SMS is the final message a lapsing member receives, and it must
 * say the membership expires today.
 *
 * Also pins the branch ordering that makes `daysUntilDue === 0` belong to
 * DueToday and NOT to Overdue.
 */

import { SendAutomatedReminders } from '@/features/sms/services/SendAutomatedReminders'
import {
  ReminderType,
  getReminderType,
} from '@/features/sms/config/ReminderConfig'
import { Member } from '@/features/members/domain/Member'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { PlanType } from '@/features/members/config/PlanConfig'
import {
  makeSubscription,
  mockSubscriptionRepo,
} from '@/features/subscriptions/tests/subscription-mocks'
import type { IMemberRepository } from '@/features/members/services/IMemberRepository'
import type { ISMSRepository } from '@/features/sms/services/ISMSRepository'
import type { ISMSProvider } from '@/features/sms/services/ISMSProvider'

const GYM_ID = 'gym-1'

function daysFromToday(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function makeMember(nextDueDate: Date, name = 'Test Member'): Member {
  return Member.create({
    gymId: GYM_ID,
    name,
    phoneNumber: '+94771234567',
    planType: PlanType.Monthly,
    planAmount: 2000,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    nextDueDate,
  })
}

function build(members: Member[]) {
  const memberRepo = {
    findAllActiveMembers: jest.fn().mockResolvedValue(members),
    findActiveMembers: jest.fn(async () => members),
  } as unknown as jest.Mocked<IMemberRepository>

  const smsRepo = {
    existsForToday: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
  } as unknown as jest.Mocked<ISMSRepository>

  const smsProvider = {
    send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
  } as unknown as jest.Mocked<ISMSProvider>

  const subscriptionRepo = mockSubscriptionRepo()
  subscriptionRepo.findByGymId.mockResolvedValue(
    makeSubscription({ gymId: GYM_ID })
  )

  const useCase = new SendAutomatedReminders(
    memberRepo,
    smsRepo,
    smsProvider,
    subscriptionRepo
  )
  return { useCase, smsRepo, smsProvider }
}

describe('Due-today reminder — "membership expires today"', () => {
  it('sends the expires-today message on the due date', async () => {
    const { useCase, smsProvider } = build([makeMember(daysFromToday(0))])

    const summary = await useCase.execute()

    expect(summary.byType[ReminderType.DueToday]).toBe(1)
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
    const { message } = smsProvider.send.mock.calls[0][0]
    expect(message).toContain('expires today')
    expect(message).toContain('Rs.2000.00')
  })

  it('logs the due-today SMS under the due_today type', async () => {
    const { useCase, smsRepo } = build([makeMember(daysFromToday(0))])

    await useCase.execute()

    expect(smsRepo.create).toHaveBeenCalledTimes(1)
    const logged = (smsRepo.create as jest.Mock).mock.calls[0][0]
    expect(logged.smsType).toBe(ReminderType.DueToday)
    expect(logged.messageBody).toContain('expires today')
  })

  it('does NOT classify the due date as overdue', async () => {
    const { useCase } = build([makeMember(daysFromToday(0))])

    const summary = await useCase.execute()

    expect(summary.byType[ReminderType.Overdue]).toBe(0)
  })

  it('keeps the 3-day reminder on the neutral "due on <date>" wording', async () => {
    const { useCase, smsProvider } = build([makeMember(daysFromToday(3))])

    const summary = await useCase.execute()

    expect(summary.byType[ReminderType.ThreeDay]).toBe(1)
    const { message } = smsProvider.send.mock.calls[0][0]
    expect(message).toContain('is due on')
    expect(message).not.toContain('expires today')
  })

  it('sends nothing to a member who is not due today or on a reminder day', async () => {
    const { useCase, smsProvider } = build([makeMember(daysFromToday(5))])

    const summary = await useCase.execute()

    expect(summary.totalSent).toBe(0)
    expect(smsProvider.send).not.toHaveBeenCalled()
  })

  it('does not resend when the due-today SMS already went out', async () => {
    const { useCase, smsRepo, smsProvider } = build([
      makeMember(daysFromToday(0)),
    ])
    ;(smsRepo.existsForToday as jest.Mock).mockResolvedValue(true)

    const summary = await useCase.execute()

    expect(summary.totalSent).toBe(0)
    expect(smsProvider.send).not.toHaveBeenCalled()
  })
})

describe('Reminder branch ordering — day 0 belongs to DueToday', () => {
  it('maps exactly 0 days to DueToday, not Overdue', () => {
    expect(getReminderType(0)).toBe(ReminderType.DueToday)
  })

  it('still maps genuinely negative days to Overdue (safety net if expiry cron fails)', () => {
    expect(getReminderType(-1)).toBe(ReminderType.Overdue)
    expect(getReminderType(-14)).toBe(ReminderType.Overdue)
  })

  it('keeps Overdue reachable as a fallback for an overdue ACTIVE member', async () => {
    const { useCase, smsProvider } = build([makeMember(daysFromToday(-3))])

    const summary = await useCase.execute()

    expect(summary.byType[ReminderType.Overdue]).toBe(1)
    const { message } = smsProvider.send.mock.calls[0][0]
    expect(message).toContain('was due on')
  })
})
