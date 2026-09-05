import { createClient } from '@/lib/supabase/server'
import { PlanType } from '@/features/members/config/PlanConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  BILLABLE_STATUSES,
  billedInMonth,
  effectiveAmountFor,
  isBillable,
  type BillableMember,
} from '../domain/BillingSchedule'
import type {
  MonthlyRevenue,
  YearlyRevenue,
  RevenueMetrics,
  RevenuePosition,
  MonthlyRevenueResponse,
  YearlyRevenueResponse,
} from '../types'

/**
 * Revenue read model.
 *
 * "Billed" means what billable members actually owe for the period, derived
 * from their due dates by `domain/BillingSchedule`. It replaces a normalised
 * **run-rate** — annual ÷ 12, daily × 30 — that was presented as "projected"
 * and then divided into cash collected under the label "% of billed". The
 * denominator had never been billed, so the ratio was meaningless and could
 * exceed 100%.
 *
 * All database access is in this file; the arithmetic is in the pure domain
 * module, where it can be tested exhaustively.
 */

/** Row shape shared by every member read in this file. */
const MEMBER_BILLING_COLUMNS =
  'plan_type, plan_amount, membership_start_date, status, recurring_discount, next_due_date, discounts(discount_percentage)'

interface MemberBillingRow {
  plan_type: string
  plan_amount: number
  membership_start_date: string
  status: string
  recurring_discount: boolean
  next_due_date: string
  discounts: { discount_percentage: number } | null
}

function toBillableMember(row: MemberBillingRow): BillableMember {
  return {
    planType: row.plan_type as PlanType,
    planAmount: Number(row.plan_amount),
    membershipStartDate: row.membership_start_date,
    status: row.status as MemberStatus,
    recurringDiscount: row.recurring_discount,
    discountPercentage: row.discounts?.discount_percentage ?? null,
  }
}

/**
 * Every member who can owe money, with what they owe.
 *
 * Fetched once per request. The previous implementation issued two queries per
 * month since the gym was created — around 42 for a gym created in early 2025 —
 * to compute a historical projection that was never rendered.
 */
async function loadBillableMembers(gymId: string): Promise<MemberBillingRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select(MEMBER_BILLING_COLUMNS)
    .eq('gym_id', gymId)
    .in('status', BILLABLE_STATUSES)

  if (error) {
    throw new Error(`Failed to load members for revenue: ${error.message}`)
  }

  return (data ?? []) as unknown as MemberBillingRow[]
}

/**
 * Payments in a date range, split by whether a membership schedule predicts them.
 *
 * Reads `payments.gym_id` directly. The previous queries joined
 * `members!inner(gym_id)`, which is both an unnecessary join and subtly wrong:
 * it scoped by the member's *current* gym rather than the gym the payment was
 * taken in.
 */
async function loadPayments(
  gymId: string,
  startDate: string,
  endDate: string
): Promise<{ plan: number; oneOff: number }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payments')
    .select('amount_paid, payment_type')
    .eq('gym_id', gymId)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)

  if (error) {
    throw new Error(`Failed to load payments for revenue: ${error.message}`)
  }

  return (data ?? []).reduce(
    (totals, payment) => {
      const amount = Number(payment.amount_paid)
      if (payment.payment_type === 'day_pass') {
        totals.oneOff += amount
      } else {
        totals.plan += amount
      }
      return totals
    },
    { plan: 0, oneOff: 0 }
  )
}

/** Collected totals per calendar month, from one query rather than one per month. */
async function loadMonthlyCollected(
  gymId: string,
  fromDate: string,
  toDate: string
): Promise<Map<string, number>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payments')
    .select('amount_paid, payment_date')
    .eq('gym_id', gymId)
    .gte('payment_date', fromDate)
    .lte('payment_date', toDate)

  if (error) {
    throw new Error(`Failed to load revenue history: ${error.message}`)
  }

  const byMonth = new Map<string, number>()
  for (const payment of data ?? []) {
    // `payment_date` is a DATE column: the first seven characters are its
    // calendar year-month, with no timezone to shift them.
    const key = String(payment.payment_date).slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(payment.amount_paid))
  }
  return byMonth
}

function countOverdue(rows: MemberBillingRow[], today: Date): number {
  const cutoff = new Date(today)
  cutoff.setHours(0, 0, 0, 0)

  return rows.filter((row) => {
    if (!isBillable(row.status as MemberStatus)) return false
    const due = new Date(row.next_due_date)
    due.setHours(0, 0, 0, 0)
    return due < cutoff
  }).length
}

const pad = (n: number) => String(n).padStart(2, '0')
const firstOfMonth = (year: number, month: number) => `${year}-${pad(month)}-01`
const lastOfMonth = (year: number, month: number) =>
  `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`

// ============================================================
// GET MONTHLY REVENUE
// ============================================================

export async function getMonthlyRevenue(
  gymId: string,
  year: number,
  month: number
): Promise<MonthlyRevenueResponse> {
  const supabase = await createClient()

  const { data: gymProfile } = await supabase
    .from('gyms')
    .select('created_at')
    .eq('id', gymId)
    .single()

  if (!gymProfile) {
    throw new Error('Gym not found')
  }

  const startDate = firstOfMonth(year, month)
  const endDate = lastOfMonth(year, month)

  const [memberRows, collected] = await Promise.all([
    loadBillableMembers(gymId),
    loadPayments(gymId, startDate, endDate),
  ])

  const members = memberRows.map(toBillableMember)

  const currentMonth: RevenuePosition = {
    billedRevenue: billedInMonth(members, year, month),
    collectedRevenue: collected.plan,
    oneOffRevenue: collected.oneOff,
    overdueMemberCount: countOverdue(memberRows, new Date()),
  }

  const gymCreatedDate = new Date(gymProfile.created_at)
  const startYear = gymCreatedDate.getFullYear()
  const startMonth = gymCreatedDate.getMonth() + 1

  const byMonth = await loadMonthlyCollected(
    gymId,
    firstOfMonth(startYear, startMonth),
    endDate
  )

  const historicalData: MonthlyRevenue[] = []
  for (let y = startYear; y <= year; y++) {
    const from = y === startYear ? startMonth : 1
    const to = y === year ? month : 12
    for (let m = from; m <= to; m++) {
      historicalData.push({
        year: y,
        month: m,
        monthLabel: `${getMonthName(m)} ${y}`,
        collectedRevenue: byMonth.get(`${y}-${pad(m)}`) ?? 0,
      })
    }
  }

  return {
    currentMonth,
    historicalData,
    metrics: await getRevenueMetrics(gymId),
  }
}

// ============================================================
// GET YEARLY REVENUE
// ============================================================

export async function getYearlyRevenue(
  gymId: string,
  year: number
): Promise<YearlyRevenueResponse> {
  const supabase = await createClient()

  const { data: gymProfile } = await supabase
    .from('gyms')
    .select('created_at')
    .eq('id', gymId)
    .single()

  if (!gymProfile) {
    throw new Error('Gym not found')
  }

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const [memberRows, collected] = await Promise.all([
    loadBillableMembers(gymId),
    loadPayments(gymId, startDate, endDate),
  ])

  const members = memberRows.map(toBillableMember)

  // A year's billings are the sum of its months', not an annualised run-rate:
  // a member on a 6-month plan is billed twice, and in which months depends on
  // when they joined.
  const billedRevenue =
    Math.round(
      Array.from({ length: 12 }, (_, i) =>
        billedInMonth(members, year, i + 1)
      ).reduce((sum, monthly) => sum + monthly, 0) * 100
    ) / 100

  const currentYear: RevenuePosition = {
    billedRevenue,
    collectedRevenue: collected.plan,
    oneOffRevenue: collected.oneOff,
    overdueMemberCount: countOverdue(memberRows, new Date()),
  }

  const gymCreatedDate = new Date(gymProfile.created_at)
  const startYear = gymCreatedDate.getFullYear()

  const byMonth = await loadMonthlyCollected(
    gymId,
    `${startYear}-01-01`,
    endDate
  )

  const historicalData: YearlyRevenue[] = []
  for (let y = startYear; y <= year; y++) {
    let total = 0
    for (let m = 1; m <= 12; m++) {
      total += byMonth.get(`${y}-${pad(m)}`) ?? 0
    }
    historicalData.push({ year: y, collectedRevenue: total })
  }

  return {
    currentYear,
    historicalData,
    metrics: await getRevenueMetrics(gymId),
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getRevenueMetrics(gymId: string): Promise<RevenueMetrics> {
  const supabase = await createClient()

  const { count: activeCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .eq('status', MemberStatus.Active)

  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('gym_id', gymId)

  const totalRevenue = (allPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0
  )

  return {
    totalActiveMembers: activeCount || 0,
    totalRevenueSinceInception: totalRevenue,
    averageRevenuePerMember:
      activeCount && activeCount > 0 ? totalRevenue / activeCount : 0,
  }
}

/** Exported for the plan-breakdown read model, which bills the same way. */
export { effectiveAmountFor }

function getMonthName(month: number): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return months[month - 1]
}
