import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  BILLABLE_STATUSES,
  billedInMonth,
  dueOccurrencesInMonth,
  effectiveAmountFor,
  isBillable,
  type BillableMember,
} from '../domain/BillingSchedule'

const member = (over: Partial<BillableMember> = {}): BillableMember => ({
  planType: PlanType.Monthly,
  planAmount: 5000,
  membershipStartDate: '2026-01-15',
  status: MemberStatus.Active,
  recurringDiscount: false,
  discountPercentage: null,
  ...over,
})

describe('isBillable', () => {
  /**
   * The billable set is a business rule, not a detail. `expired` means the
   * member's payment is overdue — they still owe, which is the whole reason the
   * renewals screen chases them. `cancelled` and `suspended` do not owe.
   */
  it.each([
    [MemberStatus.Active, true],
    [MemberStatus.Expired, true],
    [MemberStatus.Suspended, false],
    [MemberStatus.Cancelled, false],
  ])('treats %s as billable=%s', (status, expected) => {
    expect(isBillable(status)).toBe(expected)
  })

  it('exposes the billable set so callers cannot re-derive it', () => {
    expect([...BILLABLE_STATUSES].sort()).toEqual(
      [MemberStatus.Active, MemberStatus.Expired].sort()
    )
  })
})

describe('effectiveAmountFor', () => {
  it('bills the plan amount when there is no discount', () => {
    expect(effectiveAmountFor(member({ planAmount: 5000 }))).toBe(5000)
  })

  /**
   * The old revenue model summed raw `plan_amount`, so every member on a
   * recurring discount was over-projected. This mirrors the formula already
   * used by the renewals read model rather than inventing a second one.
   */
  it('applies a recurring discount', () => {
    expect(
      effectiveAmountFor(
        member({
          planAmount: 5000,
          recurringDiscount: true,
          discountPercentage: 20,
        })
      )
    ).toBe(4000)
  })

  /**
   * A one-off discount applies to a single payment already taken; it must not
   * reduce what the member is billed next period.
   */
  it('ignores a non-recurring discount', () => {
    expect(
      effectiveAmountFor(
        member({
          planAmount: 5000,
          recurringDiscount: false,
          discountPercentage: 20,
        })
      )
    ).toBe(5000)
  })

  it('rounds to whole cents rather than carrying float noise', () => {
    // 3333 * 0.67 = 2233.1099999999997 in IEEE-754.
    expect(
      effectiveAmountFor(
        member({
          planAmount: 3333,
          recurringDiscount: true,
          discountPercentage: 33,
        })
      )
    ).toBe(2233.11)
  })
})

describe('dueOccurrencesInMonth — month-based plans', () => {
  /**
   * The start month itself is a billing event: the registration payment covers
   * the first period. Excluding it would under-count every member's first month.
   */
  it('counts the starting month', () => {
    expect(
      dueOccurrencesInMonth(
        member({
          planType: PlanType.Monthly,
          membershipStartDate: '2026-03-10',
        }),
        2026,
        3
      )
    ).toBe(1)
  })

  it('never bills a month before the member existed', () => {
    expect(
      dueOccurrencesInMonth(
        member({ membershipStartDate: '2026-03-10' }),
        2026,
        2
      )
    ).toBe(0)
  })

  it('bills a monthly member exactly once in every month', () => {
    const m = member({
      planType: PlanType.Monthly,
      membershipStartDate: '2026-01-15',
    })
    for (const month of [1, 2, 3, 4, 5, 6]) {
      expect(dueOccurrencesInMonth(m, 2026, month)).toBe(1)
    }
  })

  /**
   * The distinction the whole change exists to make: an annual member is billed
   * in one month a year, not one twelfth every month. On a gym that is 52/54
   * annual this moved the September figure from 94,000 to 120,000.
   */
  it.each([
    [PlanType.Annual, 12],
    [PlanType.SixMonths, 6],
    [PlanType.ThreeMonths, 3],
  ])('bills a %s member once per period', (planType, periodMonths) => {
    const m = member({ planType, membershipStartDate: '2026-01-20' })
    for (let offset = 0; offset < 24; offset++) {
      const year = 2026 + Math.floor((0 + offset) / 12)
      const month = ((0 + offset) % 12) + 1
      expect(dueOccurrencesInMonth(m, year, month)).toBe(
        offset % periodMonths === 0 ? 1 : 0
      )
    }
  })

  /**
   * `custom` behaves monthly per PLAN_CONFIGS. The previous switch had no case
   * for it at all, so a custom-plan member silently contributed zero revenue.
   */
  it('bills a custom plan monthly rather than not at all', () => {
    expect(
      dueOccurrencesInMonth(
        member({
          planType: PlanType.Custom,
          membershipStartDate: '2026-02-01',
        }),
        2026,
        5
      )
    ).toBe(1)
  })

  /**
   * Month-length drift: a member starting on the 31st has due dates that land on
   * the 28th/30th in shorter months. The billing *month* is unaffected, which is
   * why the schedule is reasoned about in whole months rather than by adding
   * days to a date.
   */
  it('is unaffected by short months', () => {
    const m = member({
      planType: PlanType.Monthly,
      membershipStartDate: '2026-01-31',
    })
    expect(dueOccurrencesInMonth(m, 2026, 2)).toBe(1)
    expect(dueOccurrencesInMonth(m, 2026, 3)).toBe(1)
  })

  it('handles a leap-day annual member', () => {
    const m = member({
      planType: PlanType.Annual,
      membershipStartDate: '2024-02-29',
    })
    expect(dueOccurrencesInMonth(m, 2025, 2)).toBe(1)
    expect(dueOccurrencesInMonth(m, 2025, 3)).toBe(0)
  })

  it('crosses year boundaries', () => {
    const m = member({
      planType: PlanType.Annual,
      membershipStartDate: '2024-11-05',
    })
    expect(dueOccurrencesInMonth(m, 2025, 11)).toBe(1)
    expect(dueOccurrencesInMonth(m, 2026, 11)).toBe(1)
    expect(dueOccurrencesInMonth(m, 2026, 10)).toBe(0)
  })
})

describe('dueOccurrencesInMonth — day-based plans', () => {
  /**
   * Daily and weekly plans recur many times within a month, so they are counted,
   * not approximated. The old model multiplied by 30 and 4.33 — fixed fudge
   * factors that ignored both the month's length and when the member started.
   *
   * No gym currently has an active daily or weekly member (all 14 are
   * cancelled), so this is latent today. It is implemented properly because
   * "latent" is exactly how the missing `custom` case survived.
   */
  it('counts every day of a 30-day month for a daily member', () => {
    const m = member({
      planType: PlanType.Daily,
      membershipStartDate: '2026-01-01',
    })
    expect(dueOccurrencesInMonth(m, 2026, 9)).toBe(30) // September
    expect(dueOccurrencesInMonth(m, 2026, 8)).toBe(31) // August
    expect(dueOccurrencesInMonth(m, 2026, 2)).toBe(28) // February 2026
  })

  it('counts only from the start date in the joining month', () => {
    const m = member({
      planType: PlanType.Daily,
      membershipStartDate: '2026-09-20',
    })
    // 20th to 30th inclusive.
    expect(dueOccurrencesInMonth(m, 2026, 9)).toBe(11)
  })

  it('counts weekly occurrences on the true cadence', () => {
    const m = member({
      planType: PlanType.Weekly,
      membershipStartDate: '2026-09-01',
    })
    // Sep 1, 8, 15, 22, 29 — five, not the 4.33 the old model assumed.
    expect(dueOccurrencesInMonth(m, 2026, 9)).toBe(5)
  })
})

describe('billedInMonth', () => {
  it('sums only billable members', () => {
    const members = [
      member({ planAmount: 5000, status: MemberStatus.Active }),
      member({ planAmount: 3000, status: MemberStatus.Expired }),
      member({ planAmount: 9000, status: MemberStatus.Cancelled }),
      member({ planAmount: 7000, status: MemberStatus.Suspended }),
    ]
    expect(billedInMonth(members, 2026, 6)).toBe(8000)
  })

  it('multiplies amount by occurrences for a recurring-within-month plan', () => {
    const members = [
      member({
        planType: PlanType.Weekly,
        planAmount: 1000,
        membershipStartDate: '2026-09-01',
      }),
    ]
    expect(billedInMonth(members, 2026, 9)).toBe(5000)
  })

  it('bills nothing in a month where nobody has a due date', () => {
    const members = [
      member({ planType: PlanType.Annual, membershipStartDate: '2026-01-10' }),
    ]
    expect(billedInMonth(members, 2026, 7)).toBe(0)
  })

  it('applies the recurring discount to what is billed', () => {
    const members = [
      member({
        planAmount: 10000,
        recurringDiscount: true,
        discountPercentage: 25,
      }),
    ]
    expect(billedInMonth(members, 2026, 6)).toBe(7500)
  })
})
