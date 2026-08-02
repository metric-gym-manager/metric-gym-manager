import { computeReminderQueue } from '../services/reminder-queue.service'
import { ReminderType } from '../config/ReminderConfig'
import { PlanType } from '@/features/members/config/PlanConfig'

/**
 * Local-midnight date string N days from `base`, so the day-diff math in
 * computeReminderQueue is deterministic regardless of the test runner's
 * timezone (the "T00:00:00" suffix forces a local, not UTC, parse).
 */
function dueIn(base: Date, addDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + addDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}T00:00:00`
}

const NOW = new Date(2026, 7, 2) // Aug 2, 2026 (local midnight)
const opts = { lookaheadDays: 7, limit: 8 }

function member(
  over: Partial<{
    id: string
    name: string
    plan_type: string
    plan_amount: number
    next_due_date: string
  }>
) {
  return {
    id: over.id ?? 'm1',
    name: over.name ?? 'Test Member',
    plan_type: over.plan_type ?? PlanType.Monthly,
    plan_amount: over.plan_amount ?? 3500,
    next_due_date: over.next_due_date ?? dueIn(NOW, 3),
  }
}

describe('computeReminderQueue', () => {
  it('schedules a monthly member due in 10 days for the 3-day reminder in 7 days', () => {
    // Monthly reminderDays = [3, 0]; due in 10 → 3-day fires in 7, due-day in 10.
    const res = computeReminderQueue(
      [member({ plan_type: PlanType.Monthly, next_due_date: dueIn(NOW, 10) })],
      opts,
      NOW
    )
    expect(res.total).toBe(1)
    expect(res.entries[0].reminderType).toBe(ReminderType.ThreeDay)
    expect(res.entries[0].scheduledInDays).toBe(7)
  })

  it('picks the soonest non-elapsed threshold (weekly due in 5 → 3-day in 2)', () => {
    const res = computeReminderQueue(
      [member({ plan_type: PlanType.Weekly, next_due_date: dueIn(NOW, 5) })],
      opts,
      NOW
    )
    expect(res.entries[0].reminderType).toBe(ReminderType.ThreeDay)
    expect(res.entries[0].scheduledInDays).toBe(2)
  })

  it('flags a due-today member as a DueToday reminder scheduled for today', () => {
    const res = computeReminderQueue(
      [member({ next_due_date: dueIn(NOW, 0) })],
      opts,
      NOW
    )
    expect(res.entries[0].reminderType).toBe(ReminderType.DueToday)
    expect(res.entries[0].scheduledInDays).toBe(0)
  })

  it('excludes daily members (no automated reminders)', () => {
    const res = computeReminderQueue(
      [member({ plan_type: PlanType.Daily, next_due_date: dueIn(NOW, 1) })],
      opts,
      NOW
    )
    expect(res.total).toBe(0)
  })

  it('excludes overdue members (handled by expiry, not the upcoming queue)', () => {
    const res = computeReminderQueue(
      [member({ next_due_date: dueIn(NOW, -2) })],
      opts,
      NOW
    )
    expect(res.total).toBe(0)
  })

  it('excludes reminders that fall outside the lookahead window', () => {
    // Monthly due in 20 → next threshold (3-day) fires in 17 > 7.
    const res = computeReminderQueue(
      [member({ plan_type: PlanType.Monthly, next_due_date: dueIn(NOW, 20) })],
      opts,
      NOW
    )
    expect(res.total).toBe(0)
  })

  it('sorts soonest-first, breaking ties by larger amount, and caps to limit while reporting the true total', () => {
    const members = [
      member({ id: 'a', plan_amount: 3500, next_due_date: dueIn(NOW, 0) }), // due-today reminder, today
      member({ id: 'b', plan_amount: 15000, next_due_date: dueIn(NOW, 0) }), // due-today reminder, today, bigger
      member({ id: 'c', plan_amount: 5000, next_due_date: dueIn(NOW, 6) }), // monthly 3-day reminder fires in 3
    ]
    const res = computeReminderQueue(
      members,
      { lookaheadDays: 7, limit: 2 },
      NOW
    )
    expect(res.total).toBe(3)
    expect(res.entries).toHaveLength(2)
    expect(res.entries.map((e) => e.memberId)).toEqual(['b', 'a'])
  })
})
