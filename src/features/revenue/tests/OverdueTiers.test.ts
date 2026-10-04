import { MEMBER_CANCELLATION_OVERDUE_DAYS } from '@/features/members/config/StatusConfig'
import { OVERDUE_WARNING_DAYS, countOverdueTiers } from '../domain/OverdueTiers'

/**
 * The dashboard's "Overdue members" breakdown. It used to have a third tier,
 * "critical", for members more than 14 days overdue — but the cancel run
 * cancels every member at 14 days (MEMBER_CANCELLATION_OVERDUE_DAYS), so
 * critical read 0 unless that cron had failed. The owner retired it
 * (2026-10-04): warning is 7 days or more, mild is under 7.
 */
const TODAY = '2026-10-04'

function expiredFor(daysOverdue: number) {
  const due = new Date(`${TODAY}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() - daysOverdue)
  return { status: 'expired', next_due_date: due.toISOString().split('T')[0] }
}

describe('countOverdueTiers', () => {
  it('splits expired members into warning (7 days or more) and mild', () => {
    const result = countOverdueTiers([1, 6, 7, 13].map(expiredFor), TODAY)
    expect(result).toEqual({ count: 4, warning: 2, mild: 2 })
  })

  it('has no critical tier', () => {
    expect(Object.keys(countOverdueTiers([], TODAY)).sort()).toEqual([
      'count',
      'mild',
      'warning',
    ])
  })

  it('counts a member the cancel run has not reached yet as warning', () => {
    const result = countOverdueTiers(
      [expiredFor(MEMBER_CANCELLATION_OVERDUE_DAYS), expiredFor(20)],
      TODAY
    )
    expect(result).toEqual({ count: 2, warning: 2, mild: 0 })
  })

  it('ignores members that are not expired, and expired members due today', () => {
    const result = countOverdueTiers(
      [
        { status: 'active', next_due_date: expiredFor(3).next_due_date },
        { status: 'cancelled', next_due_date: expiredFor(20).next_due_date },
        expiredFor(0),
      ],
      TODAY
    )
    expect(result).toEqual({ count: 0, warning: 0, mild: 0 })
  })

  it('starts the warning tier before cancellation, so it can show a number', () => {
    expect(OVERDUE_WARNING_DAYS).toBeLessThan(MEMBER_CANCELLATION_OVERDUE_DAYS)
  })
})
