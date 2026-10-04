/**
 * Overdue tiers — the breakdown under the dashboard's "Overdue members" tile.
 *
 * Two tiers: **warning** (7 days or more overdue) and **mild** (under 7).
 *
 * There used to be a third, **critical**, for members more than 14 days
 * overdue. It could not show a number: the cancel run cancels every expired
 * member once they are `MEMBER_CANCELLATION_OVERDUE_DAYS` (14) past due, so a
 * critical member existed only if that cron had failed. The owner retired it
 * on 2026-10-04. In practice warning now covers days 7–13; a member the cancel
 * run has not reached yet still counts, as warning rather than vanishing.
 */

/** Days overdue at which a member moves from mild to warning. */
export const OVERDUE_WARNING_DAYS = 7

export interface OverdueTierCounts {
  /** Expired members whose due date is before today. */
  count: number
  /** Overdue by `OVERDUE_WARNING_DAYS` or more. */
  warning: number
  /** Overdue by fewer than `OVERDUE_WARNING_DAYS`. */
  mild: number
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Count expired, past-due members by tier.
 *
 * @param members - Members of one gym; only `status` and `next_due_date` are read
 * @param today - Today as YYYY-MM-DD
 * @returns The total and the warning/mild split
 *
 * @example
 * countOverdueTiers([{ status: 'expired', next_due_date: '2026-09-25' }], '2026-10-04')
 * // { count: 1, warning: 1, mild: 0 }
 */
export function countOverdueTiers(
  members: ReadonlyArray<{ status: string; next_due_date: string }>,
  today: string
): OverdueTierCounts {
  const overdue = members.filter(
    (m) => m.status === 'expired' && m.next_due_date < today
  )

  let warning = 0
  for (const member of overdue) {
    const daysOverdue = Math.floor(
      (new Date(today).getTime() - new Date(member.next_due_date).getTime()) /
        MS_PER_DAY
    )
    if (daysOverdue >= OVERDUE_WARNING_DAYS) warning++
  }

  return { count: overdue.length, warning, mild: overdue.length - warning }
}
