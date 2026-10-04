/**
 * Dashboard metrics (aggregate reporting read model).
 *
 * Query text and calculations extracted verbatim from api/dashboard/metrics.
 */

import { createClient } from '@/lib/supabase/server'
import {
  countOverdueTiers,
  type OverdueTierCounts,
} from '../domain/OverdueTiers'

export interface DashboardMetrics {
  overdueMembers: OverdueTierCounts
  revenueThisMonth: number
  membersDueThisWeek: {
    count: number
    totalAmount: number
  }
  activeMembers: number
}

export async function getDashboardMetrics(
  gymId: string
): Promise<DashboardMetrics> {
  const supabase = await createClient()

  // Get current date info
  const now = new Date()
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString()
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  // Fetch all members for calculations
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, status, next_due_date, plan_type, plan_amount')
    .eq('gym_id', gymId)

  if (membersError) {
    console.error('Error fetching members:', membersError)
    throw new Error('Failed to fetch members')
  }

  // Overdue members, split warning (7+ days) / mild (see OverdueTiers).
  // Note: System automatically updates members to 'expired' when overdue
  const today = new Date().toISOString().split('T')[0]
  const overdueMembers = countOverdueTiers(members, today)

  // Get revenue this month
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_paid, members!inner(gym_id)')
    .eq('members.gym_id', gymId)
    .gte('payment_date', startOfMonth)
    .lte('payment_date', endOfMonth)

  const revenueThisMonth =
    payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0

  // Get members due this week
  const membersDueThisWeek = members.filter(
    (m) =>
      m.status === 'active' &&
      m.next_due_date >= today &&
      m.next_due_date <= sevenDaysFromNow
  )

  // Calculate total amount due this week (use each member's actual plan_amount)
  const totalAmountDueThisWeek = membersDueThisWeek.reduce((sum, m) => {
    return sum + (m.plan_amount || 0)
  }, 0)

  // Count active members
  const activeMembers = members.filter((m) => m.status === 'active').length

  return {
    overdueMembers,
    revenueThisMonth,
    membersDueThisWeek: {
      count: membersDueThisWeek.length,
      totalAmount: totalAmountDueThisWeek,
    },
    activeMembers,
  }
}
