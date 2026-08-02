/**
 * Collect Payment Use Case Tests
 *
 * The receipt SMS must be sent AND logged to sms_logs before execute()
 * resolves. The previous fire-and-forget implementation let the serverless
 * function freeze right after the HTTP response, dropping the sms_logs
 * insert (and sometimes the send) mid-flight.
 */

import { CollectPayment } from '../services/CollectPayment'
import { Member, MemberStatus } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import { NotFoundError, ValidationError } from '@/utils/errors'

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
    registeredDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    nextDueDate: new Date('2026-07-01'),
    ...overrides,
  })
}

describe('CollectPayment', () => {
  let memberRepo: {
    findById: jest.Mock
    update: jest.Mock
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
    memberId: 'member-1',
    paymentDate: new Date('2026-07-02'),
    paymentAmount: 3500,
  }

  beforeEach(() => {
    member = buildMember()

    memberRepo = {
      findById: jest.fn().mockResolvedValue(member),
      update: jest.fn().mockImplementation((m: Member) => Promise.resolve(m)),
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

  it('collects payment and returns updated member and payment record', async () => {
    const result = await buildUseCase().execute(input)

    expect(paymentRepo.create).toHaveBeenCalledTimes(1)
    expect(memberRepo.update).toHaveBeenCalledTimes(1)
    expect(result.member).toBeDefined()
    expect(result.payment).toBeDefined()
  })

  it('sends and logs the receipt SMS before execute() resolves', async () => {
    await buildUseCase().execute(input)

    // Both the provider call and the sms_logs write must have completed
    // by the time execute() resolves — a serverless runtime may freeze
    // the function as soon as the response is returned.
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
    expect(smsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+94775093333' })
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
      expect(message).toContain('reactivated')
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

      const persisted = memberRepo.update.mock.calls[0][0] as Member
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

      const persisted = memberRepo.update.mock.calls[0][0] as Member
      expect(persisted.planType).toBe(PlanType.Monthly)
      expect(persisted.planAmount).toBe(3500)
    })
  })
})
