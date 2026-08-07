/**
 * Payment reporting read models (Collected tab + Dues tab).
 *
 * Query text, row mapping, filters, and summary calculations extracted
 * verbatim from api/payment-collection/collected and api/regular-payments.
 */

import { createClient } from '@/lib/supabase/server'

// ============================================================
// Collected payments (monthly report)
// ============================================================

interface MemberData {
  id: string
  name: string
  phone_number: string
  plan_type: string
  registered_date: string
  created_at: string
  discount_id: string | null
  discount: DiscountData | null
  photo_path: string | null
  photo_updated_at: string | null
}

interface DiscountData {
  id: string
  discount_name: string
  discount_percentage: number
}

interface PaymentRecord {
  id: string
  member_id: string
  amount_paid: number
  payment_date: string
  next_due_date_calculated: string
  members: MemberData
}

interface PaymentCollectedRow {
  paymentId: string
  memberId: string
  memberName: string
  phoneNumber: string
  planType: string
  memberCreatedAt: string
  amountPaid: number
  discountName: string | null
  discountPct: number | null
  paymentDate: string
  nextDueDate: string
  photoPath: string | null
  photoUpdatedAt: string | null
}

/** Date range for a given month (YYYY-MM). */
function getMonthDateRange(month: string): {
  startDate: string
  endDate: string
} {
  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(year, monthNum - 1, 1)
  const endDate = new Date(year, monthNum, 0) // Last day of month

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

function calculateSummaryMetrics(payments: PaymentCollectedRow[]) {
  const totalRevenue = payments.reduce((sum, p) => sum + p.amountPaid, 0)
  const paymentCount = payments.length

  const revenueByPlanType: Record<string, number> = {}
  payments.forEach((p) => {
    if (!revenueByPlanType[p.planType]) {
      revenueByPlanType[p.planType] = 0
    }
    revenueByPlanType[p.planType] += p.amountPaid
  })

  return {
    totalRevenue,
    paymentCount,
    revenueByPlanType,
  }
}

/** Collected payments for a month with plan/search filters and summary metrics. */
export async function getCollectedPayments(
  gymId: string,
  month: string,
  planType: string,
  search: string
) {
  const supabase = await createClient()
  const { startDate, endDate } = getMonthDateRange(month)

  // Build query for payments joined with members and discounts
  const query = supabase
    .from('payments')
    .select(
      `
      id,
      member_id,
      amount_paid,
      payment_date,
      next_due_date_calculated,
      members!inner (
        id,
        name,
        phone_number,
        plan_type,
        registered_date,
        created_at,
        discount_id,
        photo_path,
        photo_updated_at,
        discount:discounts (
          id,
          discount_name,
          discount_percentage
        )
      )
    `
    )
    .eq('gym_id', gymId)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)
    .order('payment_date', { ascending: false })

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Type-safe data processing
  const payments = (data ?? []) as unknown as PaymentRecord[]

  let rows = payments.map((p) => {
    const member = p.members
    const discountObj = member.discount

    return {
      paymentId: p.id,
      memberId: member.id,
      memberName: member.name,
      phoneNumber: member.phone_number,
      planType: member.plan_type,
      memberCreatedAt: member.created_at,
      amountPaid: p.amount_paid,
      discountName: discountObj?.discount_name ?? null,
      discountPct: discountObj?.discount_percentage ?? null,
      paymentDate: p.payment_date,
      nextDueDate: p.next_due_date_calculated,
      photoPath: member.photo_path,
      photoUpdatedAt: member.photo_updated_at,
      // Include snake_case for backward compatibility
      payment_id: p.id,
      member_id: member.id,
      member_name: member.name,
      phone_number: member.phone_number,
      plan_type: member.plan_type,
      amount_paid: p.amount_paid,
      discount_name: discountObj?.discount_name ?? null,
      discount_pct: discountObj?.discount_percentage ?? null,
      payment_date: p.payment_date,
      next_due_date: p.next_due_date_calculated,
    }
  })

  // Apply plan type filter
  if (planType !== 'all') {
    rows = rows.filter((r) => r.planType === planType)
  }

  // Apply client-side search filter (name or phone)
  if (search.trim()) {
    const searchLower = search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.memberName.toLowerCase().includes(searchLower) ||
        r.phoneNumber.includes(search)
    )
  }

  return {
    payments: rows,
    summary: calculateSummaryMetrics(rows),
    totalCount: rows.length,
  }
}

// ============================================================
// Regular payments / dues (pending payments report)
// ============================================================

/** Members with payments pending, joined with discount info, filtered and sorted. */
export async function getRegularPayments(
  gymId: string,
  filter: string,
  sortBy: string
) {
  const supabase = await createClient()

  // Fetch members with their discount info
  const { data, error } = await supabase
    .from('members')
    .select(
      `
      id,
      name,
      phone_number,
      plan_type,
      plan_amount,
      discount_id,
      recurring_discount,
      next_due_date,
      status,
      photo_path,
      photo_updated_at,
      discount:discounts(id, discount_name, discount_percentage)
    `
    )
    .eq('gym_id', gymId)
    .in('status', ['active', 'expired'])

  if (error) throw new Error(error.message)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RawRow = Record<string, any>

  let rows = ((data ?? []) as RawRow[]).map((m) => {
    const dueDate = new Date(m.next_due_date as string)
    dueDate.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Compute effective payment amount (apply recurring discount if set)
    const discountObj = m.discount as {
      id: string
      discount_name: string
      discount_percentage: number
    } | null
    const discountPct =
      m.recurring_discount && discountObj ? discountObj.discount_percentage : 0
    const effectiveAmount =
      Math.round((m.plan_amount as number) * (1 - discountPct / 100) * 100) /
      100

    return {
      id: m.id as string,
      name: m.name as string,
      phoneNumber: m.phone_number as string,
      planType: m.plan_type as string,
      planAmount: m.plan_amount as number,
      discountId:
        m.recurring_discount && discountObj ? (m.discount_id as string) : null,
      discountName: discountObj?.discount_name ?? null,
      discountPct: discountPct > 0 ? discountPct : null,
      recurringDiscount: m.recurring_discount as boolean,
      effectiveAmount,
      nextDueDate: m.next_due_date as string,
      daysUntilDue,
      memberStatus: m.status as string,
      photoPath: (m.photo_path as string | null) ?? null,
      photoUpdatedAt: (m.photo_updated_at as string | null) ?? null,
    }
  })

  // Apply filter
  if (filter === 'overdue') {
    rows = rows.filter((r) => r.daysUntilDue < 0)
  } else if (filter === 'due_today') {
    rows = rows.filter((r) => r.daysUntilDue === 0)
  } else if (filter === 'upcoming') {
    rows = rows.filter((r) => r.daysUntilDue >= 1 && r.daysUntilDue <= 7)
  }
  // 'all' — no extra filter

  // Apply sort
  if (sortBy === 'member_name') {
    rows.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    // due_date_asc: most overdue first, then upcoming
    rows.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  }

  return { payments: rows, totalCount: rows.length }
}
