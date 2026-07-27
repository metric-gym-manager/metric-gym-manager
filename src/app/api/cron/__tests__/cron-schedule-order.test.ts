/**
 * Nightly member-status chain ordering.
 *
 * The member lifecycle is driven by three daily crons with a real dependency
 * between them:
 *
 *   update-expired-status     Active    -> Expired   (feeder)
 *   expire-suspended-members  Suspended -> Expired   (feeder)
 *   cancel-overdue-members    Expired   -> Cancelled (consumer)
 *
 * The consumer only ever reads members that are ALREADY Expired, so both
 * feeders must run before it on the same night. If a feeder runs after the
 * consumer, every member it produces waits a full extra day before being
 * cancelled.
 *
 * This is a silent failure mode — nothing errors, members simply linger in
 * Expired — so the ordering is pinned here against vercel.json rather than
 * left to a comment.
 */

import vercelConfig from '../../../../../vercel.json'

interface CronEntry {
  path: string
  schedule: string
}

const crons: CronEntry[] = vercelConfig.crons

function findCron(path: string): CronEntry {
  const entry = crons.find((c) => c.path === path)
  if (!entry) {
    throw new Error(`No cron configured for ${path}`)
  }
  return entry
}

/**
 * Convert a daily 5-field cron expression into minutes past midnight.
 * Only supports the fixed daily form used by this chain (`M H * * *`).
 */
function minutesPastMidnight(schedule: string): number {
  const [minute, hour, dom, month, dow] = schedule.split(' ')

  if (dom !== '*' || month !== '*' || dow !== '*') {
    throw new Error(`Expected a daily schedule, got "${schedule}"`)
  }
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) {
    throw new Error(`Expected fixed minute/hour, got "${schedule}"`)
  }

  return Number(hour) * 60 + Number(minute)
}

const UPDATE_EXPIRED = '/api/cron/update-expired-status'
const EXPIRE_SUSPENDED = '/api/cron/expire-suspended-members'
const CANCEL_OVERDUE = '/api/cron/cancel-overdue-members'

describe('Nightly member-status cron chain', () => {
  it('schedules all three jobs in the chain', () => {
    expect(() => findCron(UPDATE_EXPIRED)).not.toThrow()
    expect(() => findCron(EXPIRE_SUSPENDED)).not.toThrow()
    expect(() => findCron(CANCEL_OVERDUE)).not.toThrow()
  })

  it('runs the Active -> Expired feeder before the cancellation sweep', () => {
    expect(minutesPastMidnight(findCron(UPDATE_EXPIRED).schedule)).toBeLessThan(
      minutesPastMidnight(findCron(CANCEL_OVERDUE).schedule)
    )
  })

  it('runs the Suspended -> Expired feeder before the cancellation sweep', () => {
    expect(
      minutesPastMidnight(findCron(EXPIRE_SUSPENDED).schedule)
    ).toBeLessThan(minutesPastMidnight(findCron(CANCEL_OVERDUE).schedule))
  })

  it('leaves each feeder enough headroom to finish (>= 10 minutes)', () => {
    const cancelAt = minutesPastMidnight(findCron(CANCEL_OVERDUE).schedule)

    for (const feeder of [UPDATE_EXPIRED, EXPIRE_SUSPENDED]) {
      const gap = cancelAt - minutesPastMidnight(findCron(feeder).schedule)
      expect(gap).toBeGreaterThanOrEqual(10)
    }
  })

  it('keeps the whole chain inside the same nightly maintenance window', () => {
    for (const path of [UPDATE_EXPIRED, EXPIRE_SUSPENDED, CANCEL_OVERDUE]) {
      // Same UTC day, before 01:00 — so "runs before" is a wall-clock fact and
      // never wraps past midnight into the following day.
      expect(minutesPastMidnight(findCron(path).schedule)).toBeLessThan(60)
    }
  })
})
