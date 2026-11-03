import { CollectPayment } from '../services/CollectPayment'
import { Member } from '@/features/members/domain/Member'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { LIFECYCLE_FIELDS } from '@/features/members/config/MemberWriteFields'
import { ConflictError } from '@/utils/errors'

/**
 * Duplicate-payment prevention.
 *
 * Production carries 31 duplicate payment rows across 22 members (3.6% of 871).
 * One member has three identical payments on one day, all advancing the due
 * date to the *same* date — the signature of a race, not of three real
 * payments: each request read the same member state, computed the same next due
 * date, and inserted its own row.
 *
 * `CollectPayment` had no concurrency control at all: read member → compute →
 * unconditional UPDATE → insert payment. The "Mark Paid" button is disabled
 * while in flight, but a disabled button does not stop a second tab, a retry on
 * a slow connection, or a double-tap that fires before React re-renders.
 *
 * Money needs a server-side guard, so the member write is now conditional on
 * the due date the payment was computed against.
 */

// Relative to today. This was a fixed 2026-09-15, so once that date passed every
// renewal it computed landed in the past and "newDueDate must be in the future"
// failed all five tests for a reason that had nothing to do with concurrency.
const DUE = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 5)
  return d
})()
const TODAY = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()

const makeMember = () =>
  Member.create({
    gymId: 'g-1',
    name: 'Nimal',
    phoneNumber: '+94770000001',
    planType: PlanType.Monthly,
    planAmount: 5000,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: new Date('2025-01-15'),
    membershipStartDate: new Date('2025-01-15'),
    nextDueDate: DUE,
  })

function harness(updateImpl?: jest.Mock) {
  const member = makeMember()
  const paymentRepo = { create: jest.fn(async (p) => p) }
  const memberRepo = {
    findById: jest.fn(async () => member),
    updateFields: updateImpl ?? jest.fn(async (m) => m),
  }
  const smsProvider = { send: jest.fn(async () => ({ success: true })) }
  const smsRepo = { create: jest.fn(async () => ({})) }

  const useCase = new CollectPayment(
    memberRepo as never,
    paymentRepo as never,
    smsProvider as never,
    smsRepo as never
  )
  return { useCase, memberRepo, paymentRepo, member }
}

const input = {
  gymId: 'g-1',
  gymName: 'Titan Fitness',
  memberId: 'm-1',
  paymentDate: TODAY,
  paymentAmount: 5000,
  discountId: null,
  discount: null,
}

describe('CollectPayment concurrency', () => {
  it('guards the member write with the due date it computed against', async () => {
    const { useCase, memberRepo } = harness()
    await useCase.execute(input as never)

    expect(memberRepo.updateFields).toHaveBeenCalledWith(
      expect.anything(),
      // A payment writes the status and the due date, nothing else.
      LIFECYCLE_FIELDS,
      // Without this the write is unconditional and two racing requests both win.
      { expectedNextDueDate: DUE }
    )
  })

  /**
   * The important one: when the guard rejects the write, **no payment row is
   * created**. Ordering matters as much as the guard — a conflict after the
   * insert would still leave the duplicate behind.
   */
  it('records no payment when another request got there first', async () => {
    const conflicting = jest.fn(async () => {
      throw new ConflictError('This member was updated by another request.')
    })
    const { useCase, paymentRepo } = harness(conflicting)

    await expect(useCase.execute(input as never)).rejects.toBeInstanceOf(
      ConflictError
    )
    expect(paymentRepo.create).not.toHaveBeenCalled()
  })

  it('records exactly one payment on the request that wins', async () => {
    const { useCase, paymentRepo } = harness()
    await useCase.execute(input as never)
    expect(paymentRepo.create).toHaveBeenCalledTimes(1)
  })

  /**
   * The admission fee is charged once, at registration. A renewal must never
   * carry one — if it did, every renewal would report one-off revenue that was
   * never collected, and the member would be over-charged.
   */
  it('never attaches an admission fee to a renewal', async () => {
    const { useCase, paymentRepo } = harness()
    await useCase.execute(input as never)

    const payment = paymentRepo.create.mock.calls[0][0]
    expect(payment.admissionFee).toBe(0)
    expect(payment.planAmountPaid).toBe(payment.amountPaid)
  })

  /**
   * A recurring discount must be recorded on the payment, not just applied to
   * the amount, so a receipt and the revenue breakdown can both show why the
   * member paid less than their plan price.
   */
  it('records the discount that was applied', async () => {
    const { useCase, paymentRepo } = harness()
    await useCase.execute({
      ...input,
      paymentAmount: 4000,
      discountId: 'd-1',
      discount: {
        discountId: 'd-1',
        discountName: 'Student',
        discountPercentage: 20,
      },
    } as never)

    const payment = paymentRepo.create.mock.calls[0][0]
    expect(payment.amountPaid).toBe(4000)
    expect(payment.discountApplied).toBe('d-1')
    expect(payment.discountPercentage).toBe(20)
  })
})
