import { Payment } from '../domain/Payment'
import { PaymentType } from '../domain/Payment'

const base = {
  memberId: 'm-1',
  gymId: 'g-1',
  paymentDate: new Date('2026-09-05'),
  amountPaid: 6000,
  discountApplied: null,
  discountPercentage: null,
  nextDueDateCalculated: new Date('2026-10-05'),
}

/**
 * The admission fee is a **component of** `amountPaid`, not an addition to it.
 *
 * It is charged once, on a member's first payment, and used to be folded into
 * the total with nothing to distinguish it — so the revenue model counted it as
 * plan revenue against a billing schedule that could never predict it, which is
 * one of the ways the collection rate exceeded 100%.
 */
describe('Payment admission fee', () => {
  it('defaults to zero for an ordinary payment', () => {
    const payment = Payment.create({ ...base })
    expect(payment.admissionFee).toBe(0)
    expect(payment.planAmountPaid).toBe(6000)
  })

  it('is included in the total, not added to it', () => {
    const payment = Payment.create({
      ...base,
      amountPaid: 6000,
      admissionFee: 1000,
    })
    // The member handed over 6,000 of which 1,000 was the joining fee.
    expect(payment.amountPaid).toBe(6000)
    expect(payment.admissionFee).toBe(1000)
    expect(payment.planAmountPaid).toBe(5000)
  })

  /**
   * Guarded in the entity as well as by the database CHECK, because a fee
   * larger than the payment would make plan revenue negative — a number that
   * would silently reduce a gym's reported income.
   */
  it('rejects a fee larger than the payment', () => {
    expect(() =>
      Payment.create({ ...base, amountPaid: 500, admissionFee: 900 })
    ).toThrow('admissionFee cannot exceed amountPaid')
  })

  it('rejects a negative fee', () => {
    expect(() => Payment.create({ ...base, admissionFee: -1 })).toThrow(
      'admissionFee cannot be negative'
    )
  })

  it('allows a fee equal to the whole payment', () => {
    // Legitimate: a gym could take the joining fee up front and the first
    // period's dues separately.
    const payment = Payment.create({
      ...base,
      amountPaid: 1000,
      admissionFee: 1000,
    })
    expect(payment.planAmountPaid).toBe(0)
  })

  it('leaves the payment type alone', () => {
    const payment = Payment.create({ ...base, admissionFee: 500 })
    expect(payment.paymentType).toBe(PaymentType.PlanPayment)
  })
})
