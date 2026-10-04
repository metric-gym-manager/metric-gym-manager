/**
 * effectivePlanAmount — what a member owes per period: the plan amount, less
 * a discount only when that discount recurs.
 *
 * One formula for every place that states the amount: the renewals list the
 * desk collects against, the revenue schedule, and the reminder SMS. Revenue
 * and renewals each carried their own copy; a reminder quoting the raw plan
 * amount asked a discounted member for more than the desk would take.
 */

import { effectivePlanAmount } from '../utils/effectivePlanAmount'

describe('effectivePlanAmount', () => {
  it('is the plan amount when there is no discount', () => {
    expect(
      effectivePlanAmount({
        planAmount: 4000,
        recurringDiscount: false,
        discountPercentage: null,
      })
    ).toBe(4000)
  })

  it('applies a recurring discount', () => {
    expect(
      effectivePlanAmount({
        planAmount: 4000,
        recurringDiscount: true,
        discountPercentage: 10,
      })
    ).toBe(3600)
  })

  it('ignores a discount that does not recur', () => {
    expect(
      effectivePlanAmount({
        planAmount: 4000,
        recurringDiscount: false,
        discountPercentage: 10,
      })
    ).toBe(4000)
  })

  it('treats a recurring flag with no discount row as no discount', () => {
    expect(
      effectivePlanAmount({
        planAmount: 4000,
        recurringDiscount: true,
        discountPercentage: null,
      })
    ).toBe(4000)
  })

  it('rounds to cents, not to IEEE-754 noise', () => {
    // 3333 * 0.67 is 2233.1099999999997 in floating point.
    expect(
      effectivePlanAmount({
        planAmount: 3333,
        recurringDiscount: true,
        discountPercentage: 33,
      })
    ).toBe(2233.11)
  })
})
