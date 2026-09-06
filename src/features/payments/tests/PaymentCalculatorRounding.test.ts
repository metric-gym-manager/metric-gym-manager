import { PaymentCalculator } from '../domain/PaymentCalculator'

/**
 * `PaymentCalculator.calculateAmount` is the single implementation of "what
 * does this member owe" (R5). It had grown three divergent copies — the desktop
 * member drawer, the mobile drawer, and the renewals read model — and the two
 * drawers, which are the ones that decide the amount actually charged, did the
 * arithmetic inline **without rounding**.
 *
 * `amount_paid` is `numeric(10,2)`, so Postgres absorbed the float noise on
 * insert. But the unrounded figure was what the confirm dialog displayed and
 * what the receipt was generated from, so a member could be shown a price with
 * fourteen decimal places for a payment the database then quietly rounded.
 */
describe('PaymentCalculator rounding', () => {
  it('returns the plan amount when there is no discount', () => {
    expect(PaymentCalculator.calculateAmount(5000, null)).toBe(5000)
  })

  /**
   * The case the inline copies got wrong. In IEEE-754,
   * `3333 - (3333 * 33) / 100` is 2233.1099999999997.
   */
  it('rounds a discount that does not divide cleanly', () => {
    const amount = PaymentCalculator.calculateAmount(3333, {
      discountId: 'd-1',
      discountName: 'Student',
      discountPercentage: 33,
    })
    expect(amount).toBe(2233.11)
    // Explicitly: never the raw float.
    expect(amount).not.toBe(2233.1099999999997)
  })

  it('never returns more than two decimal places', () => {
    // A spread of percentages and prices that produce repeating decimals.
    for (const planAmount of [3333, 4999, 1234.56, 7777]) {
      for (const pct of [3, 7, 11, 13, 17, 33, 67]) {
        const amount = PaymentCalculator.calculateAmount(planAmount, {
          discountId: 'd',
          discountName: 'd',
          discountPercentage: pct,
        })
        expect(Math.round(amount * 100) / 100).toBe(amount)
      }
    }
  })

  it('treats a zero-percent discount as no discount', () => {
    expect(
      PaymentCalculator.calculateAmount(5000, {
        discountId: 'd-1',
        discountName: 'None',
        discountPercentage: 0,
      })
    ).toBe(5000)
  })

  it('handles a full discount', () => {
    expect(
      PaymentCalculator.calculateAmount(5000, {
        discountId: 'd-1',
        discountName: 'Comp',
        discountPercentage: 100,
      })
    ).toBe(0)
  })

  /**
   * The admission fee is never discounted: a membership discount reduces the
   * membership price, not a one-off joining fee. Registration adds the fee to
   * the discounted plan amount, so this function must only ever see the plan.
   */
  it('takes the plan amount alone, never a plan-plus-fee total', () => {
    const planOnly = PaymentCalculator.calculateAmount(5000, {
      discountId: 'd-1',
      discountName: 'Student',
      discountPercentage: 20,
    })
    expect(planOnly).toBe(4000)
    // If a caller passed 5,000 plan + 1,000 fee, the discount would eat 200 of
    // the joining fee. This asserts the difference is real, so the composition
    // at the call site matters.
    const planPlusFee = PaymentCalculator.calculateAmount(6000, {
      discountId: 'd-1',
      discountName: 'Student',
      discountPercentage: 20,
    })
    expect(planPlusFee).toBe(4800)
    expect(planPlusFee).not.toBe(planOnly + 1000)
  })
})
