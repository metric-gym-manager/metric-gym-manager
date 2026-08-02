/**
 * Reminder-queue read model.
 *
 * Surfaces the *upcoming* automated payment reminders for a gym so the dashboard
 * can show a live queue (the reminders themselves are dispatched by the
 * `send-reminders` cron via {@link SendAutomatedReminders}). Nothing is
 * scheduled or stored — the queue is derived on read from each active member's
 * `next_due_date` and their plan's reminder thresholds (the single source of
 * truth in `ReminderConfig`), exactly the rules the cron applies. Mirrors the
 * direct read-model pattern of `getRegularPayments` / `getAnnouncements`
 * (own `createClient()`, no factory).
 */

import { createClient } from '@/lib/supabase/server'
import {
  getReminderDays,
  getReminderType,
  ReminderType,
} from '@/features/sms/config/ReminderConfig'

/** A reminder that will fire for a member within the lookahead window. */
export interface ReminderQueueEntry {
  memberId: string
  memberName: string
  planType: string
  reminderType: ReminderType
  /** Whole days from today until the reminder fires (0 = today). */
  scheduledInDays: number
  /** The member's next due date (YYYY-MM-DD). */
  nextDueDate: string
  /** Amount the reminder will quote (the member's plan amount, LKR). */
  amount: number
}

export interface ReminderQueueResult {
  /** Upcoming reminders, soonest first, capped to `limit`. */
  entries: ReminderQueueEntry[]
  /** Total upcoming reminders in the window (may exceed `entries.length`). */
  total: number
}

/** Active-member row shape consumed by the queue builder. */
interface ActiveMemberRow {
  id: string
  name: string
  plan_type: string
  plan_amount: number
  next_due_date: string
}

const DEFAULT_LOOKAHEAD_DAYS = 7
const DEFAULT_LIMIT = 8

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Pure queue derivation (no I/O) so the scheduling rules are unit-testable with
 * a fixed `now`. For each active member it finds the soonest reminder threshold
 * (7 / 3 / 0 days before due, per plan) that has not already passed, keeps those
 * firing within `lookaheadDays`, sorts soonest-first (ties broken by larger
 * amount), and returns the capped list plus the full count. Overdue members
 * (already past due) are excluded — they are handled by expiry/fee-collection,
 * not the upcoming queue.
 */
export function computeReminderQueue(
  members: ActiveMemberRow[],
  opts: { lookaheadDays: number; limit: number },
  now: Date = new Date()
): ReminderQueueResult {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const all: ReminderQueueEntry[] = []

  for (const m of members) {
    const due = new Date(m.next_due_date)
    due.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.floor(
      (due.getTime() - today.getTime()) / MS_PER_DAY
    )
    if (daysUntilDue < 0) continue // overdue — not an upcoming reminder

    // Soonest reminder threshold that hasn't already elapsed for this member.
    let best: { threshold: number; inDays: number } | null = null
    for (const threshold of getReminderDays(m.plan_type)) {
      const inDays = daysUntilDue - threshold
      if (inDays < 0) continue
      if (!best || inDays < best.inDays) best = { threshold, inDays }
    }
    if (!best || best.inDays > opts.lookaheadDays) continue

    const reminderType = getReminderType(best.threshold)
    if (!reminderType) continue

    all.push({
      memberId: m.id,
      memberName: m.name,
      planType: m.plan_type,
      reminderType,
      scheduledInDays: best.inDays,
      nextDueDate: m.next_due_date,
      amount: m.plan_amount,
    })
  }

  all.sort(
    (a, b) => a.scheduledInDays - b.scheduledInDays || b.amount - a.amount
  )

  return { entries: all.slice(0, opts.limit), total: all.length }
}

/**
 * Upcoming automated reminders for a gym's active members. Session client → RLS
 * scopes the read to the caller's gym.
 */
export async function getReminderQueue(
  gymId: string,
  opts?: { lookaheadDays?: number; limit?: number }
): Promise<ReminderQueueResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select('id, name, plan_type, plan_amount, next_due_date')
    .eq('gym_id', gymId)
    .eq('status', 'active')

  if (error) throw new Error(error.message)

  return computeReminderQueue((data ?? []) as ActiveMemberRow[], {
    lookaheadDays: opts?.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS,
    limit: opts?.limit ?? DEFAULT_LIMIT,
  })
}
