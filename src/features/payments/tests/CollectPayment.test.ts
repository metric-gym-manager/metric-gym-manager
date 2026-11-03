/**
 * Collect Payment Use Case Tests
 *
 * The receipt SMS must be sent AND logged to sms_logs before execute()
 * resolves. The previous fire-and-forget implementation let the serverless
 * function freeze right after the HTTP response, dropping the sms_logs
 * insert (and sometimes the send) mid-flight.
 */

import {
  LIFECYCLE_FIELDS,
  PLAN_FIELDS,
} from '@/features/members/config/MemberWriteFields'
import { CollectPayment } from '../services/CollectPayment'
import { Member, MemberStatus } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import { NotFoundError, ValidationError } from '@/utils/errors'

/**
 * A date relative to today.
 *
 * The fixture used to pin calendar dates, which quietly rotted once real time
 * passed them: `Member.renew` rejects a due date in the past, so the suite
 * started failing on a clock change rather than a code change.
 */
function daysFromToday(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
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
    status: MemberStatus.Active,
    registeredDate: daysFromToday(-180),
    membershipStartDate: daysFromToday(-180),
    nextDueDate: daysFromToday(5),
    ...overrides,
  })
}

describe('CollectPayment', () => {
  let memberRepo: {
    findById: jest.Mock
    updateFields: jest.Mock
  }
  let paymentRepo: { create: jest.Mock }
  let smsProvider: {
    send: jest.Mock
    sendBatch: jest.Mock
    isEnabled: jest.Mock
    getProviderName: jest.Mock
  }
  let smsRepo: { create: jest.Mock; existsForToday: jest.Mock }
  let member: Member

  function buildUseCase(): CollectPayment {
    return new CollectPayment(
      memberRepo as never,
      paymentRepo as never,
      smsProvider as never,
      smsRepo as never
    )
  }

  const input = {
    gymId: 'gym-1',
    gymName: 'Titan Fitness',
    memberId: 'member-1',
    paymentDate: daysFromToday(0),
    paymentAmount: 3500,
  }

  beforeEach(() => {
    member = buildMember()

    memberRepo = {
      findById: jest.fn().mockResolvedValue(member),
      updateFields: jest
        .fn()
        .mockImplementation((m: Member) => Promise.resolve(m)),
    }
    paymentRepo = {
      create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    }
    smsProvider = {
      // Resolve on a macrotask tick so a fire-and-forget implementation
      // (which lets execute() resolve without waiting) is caught by the
      // assertions below instead of passing on microtask-ordering luck.
      send: jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ success: true, messageId: 'msg-1' }),
                0
              )
            )
        ),
      sendBatch: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('Mock'),
    }
    smsRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      existsForToday: jest.fn().mockResolvedValue(false),
    }
  })

  describe('which columns a payment writes', () => {
    it('writes the status and the due date, and nothing else', async () => {
      await buildUseCase().execute(input)

      expect(memberRepo.updateFields.mock.calls[0][1]).toEqual(LIFECYCLE_FIELDS)
    })

    it('adds the plan columns only when the payment switches the plan', async () => {
      member = buildMember({ status: MemberStatus.Cancelled })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute({
        ...input,
        planType: PlanType.Annual,
        planAmount: 40000,
      })

      expect(memberRepo.updateFields.mock.calls[0][1]).toEqual([
        ...LIFECYCLE_FIELDS,
        ...PLAN_FIELDS,
      ])
    })

    it('guards the write with the due date it computed against', async () => {
      await buildUseCase().execute(input)

      expect(memberRepo.updateFields.mock.calls[0][2]).toEqual({
        expectedNextDueDate: member.nextDueDate,
      })
    })

    it('a payment that switches the plan also guards on the plan it read', async () => {
      member = buildMember({ status: MemberStatus.Cancelled })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute({
        ...input,
        planType: PlanType.Annual,
        planAmount: 40000,
      })

      expect(memberRepo.updateFields.mock.calls[0][2]).toEqual({
        expectedNextDueDate: member.nextDueDate,
        expectedPlan: {
          planType: member.planType,
          planAmount: member.planAmount,
        },
      })
    })
  })

  it('collects payment and returns updated member and payment record', async () => {
    const result = await buildUseCase().execute(input)

    expect(paymentRepo.create).toHaveBeenCalledTimes(1)
    expect(memberRepo.updateFields).toHaveBeenCalledTimes(1)
    expect(result.member).toBeDefined()
    expect(result.payment).toBeDefined()
  })

  /**
   * An early payer keeps their due date: a member due in 3 days who pays
   * today is next due one month after the OLD due date, not one month after
   * today. Dating every payment from the payment day cost early payers the
   * days they had already paid for (owner decision, 2026-10-04).
   */
  describe('next due date', () => {
    function persistedDueDate(): string {
      const persisted = memberRepo.updateFields.mock.calls[0][0] as Member
      return persisted.nextDueDate.toDateString()
    }

    it('extends an early payment from the current due date', async () => {
      const currentDue = daysFromToday(3)
      member = buildMember({ nextDueDate: currentDue })
      memberRepo.findById.mockResolvedValue(member)

      const result = await buildUseCase().execute(input)

      const expected = calculateNextDueDate(currentDue, PlanType.Monthly)
      expect(persistedDueDate()).toBe(expected.toDateString())
      expect(result.payment.nextDueDateCalculated.toDateString()).toBe(
        expected.toDateString()
      )
    })

    it('dates a late payment from the payment day', async () => {
      member = buildMember({
        status: MemberStatus.Expired,
        nextDueDate: daysFromToday(-5),
      })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute(input)

      const expected = calculateNextDueDate(input.paymentDate, PlanType.Monthly)
      expect(persistedDueDate()).toBe(expected.toDateString())
    })
  })

  it('sends and logs the receipt SMS before execute() resolves', async () => {
    await buildUseCase().execute(input)

    // Both the provider call and the sms_logs write must have completed
    // by the time execute() resolves — a serverless runtime may freeze
    // the function as soon as the response is returned.
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
    expect(smsProvider.send).toHaveBeenCalledWith(
      // gymId lets the send layer refuse a gym on SMS_DISABLED_GYM_IDS.
      expect.objectContaining({ to: '+94775093333', gymId: 'gym-1' })
    )
    expect(smsRepo.create).toHaveBeenCalledTimes(1)
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'receipt',
        deliveryStatus: SMSDeliveryStatus.Sent,
        textLkMessageId: 'msg-1',
      })
    )
  })

  it('names the gym in the receipt text', async () => {
    await buildUseCase().execute(input)

    const { message } = smsProvider.send.mock.calls[0][0]
    expect(message).toMatch(/^Titan Fitness: thank you, Test Member! /)
    expect(message).toContain('Payment of Rs.3,500 received.')
    expect(smsRepo.create.mock.calls[0][0].messageBody).toBe(message)
  })

  it('names the discount on the receipt when one applied', async () => {
    await buildUseCase().execute({
      ...input,
      discount: {
        discountId: 'disc-1',
        discountName: 'Student',
        discountPercentage: 10,
      },
    })

    const { message } = smsProvider.send.mock.calls[0][0]
    expect(message).toContain('received (Student 10% off).')
    expect(message).toMatch(/^Titan Fitness: /)
  })

  it('logs a failed receipt SMS when the provider reports failure', async () => {
    smsProvider.send.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'No credits' }), 0)
        )
    )

    const result = await buildUseCase().execute(input)

    // Payment must still succeed; the failure must be recorded in sms_logs
    expect(result.payment).toBeDefined()
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'receipt',
        deliveryStatus: SMSDeliveryStatus.Failed,
        errorMessage: 'No credits',
      })
    )
  })

  it('does not fail the payment when SMS sending throws', async () => {
    smsProvider.send.mockImplementation(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('network down')), 0)
        )
    )

    const result = await buildUseCase().execute(input)

    expect(result.payment).toBeDefined()
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'receipt',
        deliveryStatus: SMSDeliveryStatus.Failed,
      })
    )
  })

  it('logs a failed receipt SMS when its text cannot be built, and still collects the payment', async () => {
    const result = await buildUseCase().execute({
      ...input,
      gymName: undefined as unknown as string,
    })

    expect(result.payment).toBeDefined()
    expect(smsProvider.send).not.toHaveBeenCalled()
    expect(smsRepo.create).toHaveBeenCalledTimes(1)
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'receipt',
        messageBody: '',
        deliveryStatus: SMSDeliveryStatus.Failed,
        errorMessage: expect.stringMatching(/.+/),
      })
    )
  })

  it('throws NotFoundError when the member does not exist', async () => {
    memberRepo.findById.mockResolvedValue(null)

    await expect(buildUseCase().execute(input)).rejects.toThrow(NotFoundError)
    expect(smsProvider.send).not.toHaveBeenCalled()
  })

  it('rejects a non-positive payment amount', async () => {
    await expect(
      buildUseCase().execute({ ...input, paymentAmount: 0 })
    ).rejects.toThrow(ValidationError)
    expect(paymentRepo.create).not.toHaveBeenCalled()
    expect(smsProvider.send).not.toHaveBeenCalled()
  })

  describe('reactivation', () => {
    it('sends the reactivation SMS (not a receipt) when reactivating a cancelled member', async () => {
      member = buildMember({ status: MemberStatus.Cancelled })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute(input)

      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ smsType: 'reactivation' })
      )
      const message = smsProvider.send.mock.calls[0][0].message as string
      expect(message).toMatch(/^Welcome back to Titan Fitness, Test Member! /)
    })

    it('sends the reactivation SMS when reactivating a suspended member', async () => {
      member = buildMember({ status: MemberStatus.Suspended })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute(input)

      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ smsType: 'reactivation' })
      )
    })

    it('still sends a receipt (not reactivation) for a paying expired member', async () => {
      member = buildMember({ status: MemberStatus.Expired })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute(input)

      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ smsType: 'receipt' })
      )
    })

    it('applies the plan switch before persisting the reactivated member', async () => {
      member = buildMember({
        status: MemberStatus.Cancelled,
        planType: PlanType.Monthly,
        planAmount: 3500,
      })
      memberRepo.findById.mockResolvedValue(member)

      const result = await buildUseCase().execute({
        ...input,
        planType: PlanType.Annual,
        planAmount: 40000,
      })

      const persisted = memberRepo.updateFields.mock.calls[0][0] as Member
      expect(persisted.planType).toBe(PlanType.Annual)
      expect(persisted.planAmount).toBe(40000)
      expect(persisted.status).toBe(MemberStatus.Active)
      expect(result.member.planType).toBe(PlanType.Annual)
    })

    it('keeps the existing plan when no plan switch is requested', async () => {
      member = buildMember({
        status: MemberStatus.Cancelled,
        planType: PlanType.Monthly,
        planAmount: 3500,
      })
      memberRepo.findById.mockResolvedValue(member)

      await buildUseCase().execute(input)

      const persisted = memberRepo.updateFields.mock.calls[0][0] as Member
      expect(persisted.planType).toBe(PlanType.Monthly)
      expect(persisted.planAmount).toBe(3500)
    })
  })
})
