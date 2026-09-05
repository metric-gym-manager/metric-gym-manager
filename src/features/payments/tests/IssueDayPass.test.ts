/**
 * Issue Day Pass Use Case Tests
 *
 * Eligibility rules:
 * - Allowed when next_due_date is today or past AND status is active/expired
 *   (covers the pre-cron grace window where an overdue member is still
 *   'active').
 * - Rejected while the membership period is still running.
 * - Rejected for suspended/cancelled members.
 *
 * Effects: payments row tagged day_pass, next_due_date moves to the day
 * after payment, plan_type untouched, receipt SMS sent and logged.
 */

import { IssueDayPass } from '../services/IssueDayPass'
import { Member, MemberStatus } from '@/features/members/domain/Member'
import { Payment, PaymentType } from '@/features/payments/domain/Payment'
import { PlanType } from '@/features/members/config/PlanConfig'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import {
  BusinessRuleViolationError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors'

function daysFromToday(days: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

/** Local calendar date (time-of-day is preserved by calculateNextDueDate) */
function localDateString(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function buildMember(
  overrides: Partial<Parameters<typeof Member.create>[0]> = {}
): Member {
  return Member.create({
    gymId: 'gym-1',
    name: 'Test Member',
    phoneNumber: '+94775093333',
    planType: PlanType.Monthly,
    planAmount: 3500,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Expired,
    registeredDate: daysFromToday(-90),
    membershipStartDate: daysFromToday(-90),
    nextDueDate: daysFromToday(-10),
    ...overrides,
  })
}

describe('IssueDayPass', () => {
  let memberRepo: { findById: jest.Mock; update: jest.Mock }
  let paymentRepo: { create: jest.Mock }
  let smsProvider: {
    send: jest.Mock
    sendBatch: jest.Mock
    isEnabled: jest.Mock
    getProviderName: jest.Mock
  }
  let smsRepo: { create: jest.Mock; existsForToday: jest.Mock }

  function buildUseCase(): IssueDayPass {
    return new IssueDayPass(
      memberRepo as never,
      paymentRepo as never,
      smsProvider as never,
      smsRepo as never
    )
  }

  const input = {
    gymId: 'gym-1',
    memberId: 'member-1',
    amount: 500,
  }

  beforeEach(() => {
    memberRepo = {
      findById: jest.fn().mockResolvedValue(buildMember()),
      update: jest.fn().mockImplementation((m: Member) => Promise.resolve(m)),
    }
    paymentRepo = {
      create: jest.fn().mockImplementation((p: Payment) => Promise.resolve(p)),
    }
    smsProvider = {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
      sendBatch: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('Mock'),
    }
    smsRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      existsForToday: jest.fn().mockResolvedValue(false),
    }
  })

  describe('happy path', () => {
    it('issues a day pass for an expired member', async () => {
      const result = await buildUseCase().execute(input)

      expect(paymentRepo.create).toHaveBeenCalledTimes(1)
      const payment: Payment = paymentRepo.create.mock.calls[0][0]
      expect(payment.paymentType).toBe(PaymentType.DayPass)
      expect(payment.amountPaid).toBe(500)

      expect(result.member.status).toBe(MemberStatus.Active)
      expect(localDateString(result.member.nextDueDate)).toBe(
        localDateString(daysFromToday(1))
      )
    })

    it('does not change the member plan type', async () => {
      const result = await buildUseCase().execute(input)

      expect(result.member.planType).toBe(PlanType.Monthly)
    })

    it('allows an overdue member the cron has not expired yet (active, past due)', async () => {
      memberRepo.findById.mockResolvedValue(
        buildMember({
          status: MemberStatus.Active,
          nextDueDate: daysFromToday(-3),
        })
      )

      const result = await buildUseCase().execute(input)

      expect(result.member.status).toBe(MemberStatus.Active)
      expect(localDateString(result.member.nextDueDate)).toBe(
        localDateString(daysFromToday(1))
      )
    })

    it('allows a member whose membership is due today (boundary)', async () => {
      memberRepo.findById.mockResolvedValue(
        buildMember({
          status: MemberStatus.Active,
          nextDueDate: daysFromToday(0),
        })
      )

      await expect(buildUseCase().execute(input)).resolves.toBeDefined()
    })

    it('sends and logs the day pass receipt SMS before resolving', async () => {
      await buildUseCase().execute(input)

      expect(smsProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+94775093333' })
      )
      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          smsType: 'receipt',
          deliveryStatus: SMSDeliveryStatus.Sent,
        })
      )
    })
  })

  describe('validation errors', () => {
    it('rejects a non-positive amount', async () => {
      await expect(
        buildUseCase().execute({ ...input, amount: 0 })
      ).rejects.toThrow(ValidationError)

      expect(paymentRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('eligibility rules', () => {
    it('rejects a member still within their membership period', async () => {
      memberRepo.findById.mockResolvedValue(
        buildMember({
          status: MemberStatus.Active,
          nextDueDate: daysFromToday(10),
        })
      )

      await expect(buildUseCase().execute(input)).rejects.toThrow(
        BusinessRuleViolationError
      )
      expect(paymentRepo.create).not.toHaveBeenCalled()
      expect(memberRepo.update).not.toHaveBeenCalled()
    })

    it('rejects a suspended member', async () => {
      memberRepo.findById.mockResolvedValue(
        buildMember({ status: MemberStatus.Suspended })
      )

      await expect(buildUseCase().execute(input)).rejects.toThrow(
        BusinessRuleViolationError
      )
    })

    it('rejects a cancelled member', async () => {
      memberRepo.findById.mockResolvedValue(
        buildMember({ status: MemberStatus.Cancelled })
      )

      await expect(buildUseCase().execute(input)).rejects.toThrow(
        BusinessRuleViolationError
      )
    })
  })

  describe('edge cases', () => {
    it('throws NotFoundError when the member does not exist in this gym', async () => {
      memberRepo.findById.mockResolvedValue(null)

      await expect(buildUseCase().execute(input)).rejects.toThrow(NotFoundError)
    })

    it('does not fail the day pass when the SMS provider throws', async () => {
      smsProvider.send.mockRejectedValue(new Error('provider down'))

      const result = await buildUseCase().execute(input)

      expect(result.payment).toBeDefined()
      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: SMSDeliveryStatus.Failed,
        })
      )
    })
  })
})
