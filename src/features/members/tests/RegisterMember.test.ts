/**
 * Register Member Use Case Tests
 *
 * The welcome SMS must be sent AND logged to sms_logs before execute()
 * resolves. It used to be fire-and-forget, and on Vercel the function can be
 * frozen as soon as the response is sent: about a third of registrations had
 * no `welcome` log (0 of 2 on 2026-09-28; neither bulk test member in Titan
 * Fitness on 2026-10-03). CollectPayment had the same defect and was fixed by
 * awaiting; this suite mirrors `payments/tests/CollectPayment.test.ts`.
 *
 * All three registration routes — desk, bulk and QR — run this use case.
 */

import {
  RegisterMember,
  type RegisterMemberInput,
} from '../services/RegisterMember'
import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { SMSDeliveryStatus } from '@/features/sms/services/ISMSRepository'
import { ConflictError } from '@/utils/errors'

/** Resolve on a macrotask tick, so an un-awaited send is still in flight when execute() returns. */
function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 0))
}

describe('RegisterMember', () => {
  let memberRepo: { findByPhoneNumber: jest.Mock; createGuarded: jest.Mock }
  let paymentRepo: { create: jest.Mock }
  let smsProvider: {
    send: jest.Mock
    sendBatch: jest.Mock
    isEnabled: jest.Mock
    getProviderName: jest.Mock
  }
  let smsRepo: { create: jest.Mock; existsForToday: jest.Mock }

  function buildUseCase(): RegisterMember {
    return new RegisterMember(
      memberRepo as never,
      paymentRepo as never,
      smsProvider as never,
      smsRepo as never
    )
  }

  const input: RegisterMemberInput = {
    gymId: 'gym-1',
    gymName: 'Titan Fitness',
    name: 'Nimal Perera',
    phoneNumber: '0775093333',
    planType: PlanType.Monthly,
    planAmount: 4000,
    membershipStartDate: new Date(),
    paymentAmount: 4000,
  }

  beforeEach(() => {
    memberRepo = {
      findByPhoneNumber: jest.fn().mockResolvedValue(null),
      createGuarded: jest
        .fn()
        .mockImplementation((_gymId: string, m: Member) => Promise.resolve(m)),
    }
    paymentRepo = {
      create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    }
    smsProvider = {
      send: jest
        .fn()
        .mockImplementation(() => later({ success: true, messageId: 'msg-1' })),
      sendBatch: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('Mock'),
    }
    smsRepo = {
      create: jest.fn().mockImplementation(() => later(undefined)),
      existsForToday: jest.fn().mockResolvedValue(false),
    }
  })

  it('registers the member and records the first payment', async () => {
    const result = await buildUseCase().execute(input)

    expect(memberRepo.createGuarded).toHaveBeenCalledTimes(1)
    expect(paymentRepo.create).toHaveBeenCalledTimes(1)
    expect(result.member.name).toBe('Nimal Perera')
    expect(result.payment.amountPaid).toBe(4000)
  })

  it('sends and logs the welcome SMS before execute() resolves', async () => {
    const result = await buildUseCase().execute(input)

    // Both the provider call and the sms_logs write must have completed by
    // the time execute() resolves — a serverless runtime may freeze the
    // function as soon as the response is returned.
    expect(smsProvider.send).toHaveBeenCalledTimes(1)
    expect(smsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+94775093333' })
    )
    expect(smsRepo.create).toHaveBeenCalledTimes(1)
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: result.member.id,
        gymId: 'gym-1',
        smsType: 'welcome',
        deliveryStatus: SMSDeliveryStatus.Sent,
        textLkMessageId: 'msg-1',
        errorMessage: null,
      })
    )
    // The create() promise itself must have settled, not merely been called.
    await expect(smsRepo.create.mock.results[0].value).resolves.toBeUndefined()
  })

  it('names the gym in the welcome text', async () => {
    await buildUseCase().execute(input)

    const { message } = smsProvider.send.mock.calls[0][0]
    expect(message).toMatch(/^Welcome to Titan Fitness, Nimal Perera!/)
    expect(message).not.toContain('our gym')
    expect(smsRepo.create.mock.calls[0][0].messageBody).toBe(message)
  })

  it('logs a failed welcome SMS when the provider reports failure, and still registers', async () => {
    smsProvider.send.mockImplementation(() =>
      later({ success: false, error: 'No credits' })
    )

    const result = await buildUseCase().execute(input)

    expect(result.member).toBeDefined()
    expect(result.payment).toBeDefined()
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'welcome',
        deliveryStatus: SMSDeliveryStatus.Failed,
        textLkMessageId: null,
        errorMessage: 'No credits',
      })
    )
  })

  it('logs a failed welcome SMS when the provider throws, and still registers', async () => {
    smsProvider.send.mockImplementation(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('network down')), 0)
        )
    )

    const result = await buildUseCase().execute(input)

    expect(result.member).toBeDefined()
    expect(smsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smsType: 'welcome',
        deliveryStatus: SMSDeliveryStatus.Failed,
        errorMessage: 'network down',
      })
    )
  })

  it('still registers when the sms_logs write itself fails', async () => {
    smsRepo.create.mockRejectedValue(new Error('insert refused'))

    const result = await buildUseCase().execute(input)

    expect(result.member).toBeDefined()
    expect(result.payment).toBeDefined()
  })

  it('refuses a duplicate phone number and sends nothing', async () => {
    memberRepo.findByPhoneNumber.mockResolvedValue({ id: 'existing' })

    await expect(buildUseCase().execute(input)).rejects.toBeInstanceOf(
      ConflictError
    )
    expect(memberRepo.createGuarded).not.toHaveBeenCalled()
    expect(paymentRepo.create).not.toHaveBeenCalled()
    expect(smsProvider.send).not.toHaveBeenCalled()
    expect(smsRepo.create).not.toHaveBeenCalled()
  })

  it('sends nothing when the quota gate refuses the member', async () => {
    memberRepo.createGuarded.mockRejectedValue(
      new Error('MEMBER_LIMIT_REACHED')
    )

    await expect(buildUseCase().execute(input)).rejects.toThrow(
      'MEMBER_LIMIT_REACHED'
    )
    expect(paymentRepo.create).not.toHaveBeenCalled()
    expect(smsProvider.send).not.toHaveBeenCalled()
  })
})
