import { createClient } from '@/lib/supabase/server';
import type {
  MonthlyRevenue,
  YearlyRevenue,
  RevenueMetrics,
  MonthlyRevenueResponse,
  YearlyRevenueResponse,
} from '../types';

// ============================================================
// GET MONTHLY REVENUE
// ============================================================

export async function getMonthlyRevenue(
  gymId: string,
  year: number,
  month: number
): Promise<MonthlyRevenueResponse> {
  const supabase = await createClient();

  // Get gym registration date to determine data range
  const { data: gymProfile } = await supabase
    .from('gyms')
    .select('created_at')
    .eq('id', gymId)
    .single();

  if (!gymProfile) {
    throw new Error('Gym not found');
  }

  const gymCreatedDate = new Date(gymProfile.created_at);

  // Calculate collected revenue for current month
  const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: currentMonthPayments } = await supabase
    .from('payments')
    .select('amount_paid, members!inner(gym_id)')
    .eq('members.gym_id', gymId)
    .gte('payment_date', startOfMonth)
    .lte('payment_date', endOfMonth);

  const currentCollected = (currentMonthPayments || []).reduce(
    (sum, p) => sum + p.amount_paid,
    0
  );

  // Calculate projected revenue for current month
  const projectedRevenue = await calculateMonthlyProjectedRevenue(gymId);

  // Get historical data (all months from gym creation to current)
  const historicalData: MonthlyRevenue[] = [];
  const startYear = gymCreatedDate.getFullYear();
  const startMonth = gymCreatedDate.getMonth() + 1;

  for (let y = startYear; y <= year; y++) {
    const monthStart = y === startYear ? startMonth : 1;
    const monthEnd = y === year ? month : 12;

    for (let m = monthStart; m <= monthEnd; m++) {
      const monthStartDate = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const monthEndDate = new Date(y, m, 0).toISOString().split('T')[0];

      // Get collected revenue for this month
      const { data: payments } = await supabase
        .from('payments')
        .select('amount_paid, members!inner(gym_id)')
        .eq('members.gym_id', gymId)
        .gte('payment_date', monthStartDate)
        .lte('payment_date', monthEndDate);

      const collected = (payments || []).reduce((sum, p) => sum + p.amount_paid, 0);

      // Get active members count at the end of this month
      const { data: activeMembers } = await supabase
        .from('members')
        .select('plan_type, plan_amount')
        .eq('gym_id', gymId)
        .eq('status', 'active')
        .lte('membership_start_date', monthEndDate);

      const projected = calculateProjectedMonthlyFromMembers(activeMembers || []);

      historicalData.push({
        year: y,
        month: m,
        monthLabel: `${getMonthName(m)} ${y}`,
        collectedRevenue: collected,
        projectedRevenue: projected,
      });
    }
  }

  // Get metrics
  const metrics = await getRevenueMetrics(gymId);

  return {
    currentMonth: {
      collectedRevenue: currentCollected,
      projectedRevenue: projectedRevenue,
    },
    historicalData,
    metrics,
  };
}

// ============================================================
// GET YEARLY REVENUE
// ============================================================

export async function getYearlyRevenue(
  gymId: string,
  year: number
): Promise<YearlyRevenueResponse> {
  const supabase = await createClient();

  // Get gym registration date to determine data range
  const { data: gymProfile } = await supabase
    .from('gyms')
    .select('created_at')
    .eq('id', gymId)
    .single();

  if (!gymProfile) {
    throw new Error('Gym not found');
  }

  const gymCreatedDate = new Date(gymProfile.created_at);
  const startYear = gymCreatedDate.getFullYear();

  // Calculate collected revenue for current year
  const startOfYear = new Date(year, 0, 1).toISOString().split('T')[0];
  const endOfYear = new Date(year, 11, 31).toISOString().split('T')[0];

  const { data: currentYearPayments } = await supabase
    .from('payments')
    .select('amount_paid, members!inner(gym_id)')
    .eq('members.gym_id', gymId)
    .gte('payment_date', startOfYear)
    .lte('payment_date', endOfYear);

  const currentCollected = (currentYearPayments || []).reduce(
    (sum, p) => sum + p.amount_paid,
    0
  );

  // Calculate projected revenue for current year
  const projectedRevenue = await calculateYearlyProjectedRevenue(gymId);

  // Get historical data (all years from gym creation to current)
  const historicalData: YearlyRevenue[] = [];

  for (let y = startYear; y <= year; y++) {
    const yearStartDate = new Date(y, 0, 1).toISOString().split('T')[0];
    const yearEndDate = new Date(y, 11, 31).toISOString().split('T')[0];

    // Get collected revenue for this year
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_paid, members!inner(gym_id)')
      .eq('members.gym_id', gymId)
      .gte('payment_date', yearStartDate)
      .lte('payment_date', yearEndDate);

    const collected = (payments || []).reduce((sum, p) => sum + p.amount_paid, 0);

    // Get active members count at the end of this year
    const { data: activeMembers } = await supabase
      .from('members')
      .select('plan_type, plan_amount')
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .lte('membership_start_date', yearEndDate);

    const projected = calculateProjectedYearlyFromMembers(activeMembers || []);

    historicalData.push({
      year: y,
      collectedRevenue: collected,
      projectedRevenue: projected,
    });
  }

  // Get metrics
  const metrics = await getRevenueMetrics(gymId);

  return {
    currentYear: {
      collectedRevenue: currentCollected,
      projectedRevenue: projectedRevenue,
    },
    historicalData,
    metrics,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function calculateMonthlyProjectedRevenue(gymId: string): Promise<number> {
  const supabase = await createClient();

  const { data: activeMembers } = await supabase
    .from('members')
    .select('plan_type, plan_amount')
    .eq('gym_id', gymId)
    .eq('status', 'active');

  return calculateProjectedMonthlyFromMembers(activeMembers || []);
}

async function calculateYearlyProjectedRevenue(gymId: string): Promise<number> {
  const supabase = await createClient();

  const { data: activeMembers } = await supabase
    .from('members')
    .select('plan_type, plan_amount')
    .eq('gym_id', gymId)
    .eq('status', 'active');

  return calculateProjectedYearlyFromMembers(activeMembers || []);
}

function calculateProjectedMonthlyFromMembers(
  members: Array<{ plan_type: string; plan_amount: number }>
): number {
  let projectedRevenue = 0;

  for (const member of members) {
    switch (member.plan_type) {
      case 'monthly':
        projectedRevenue += member.plan_amount;
        break;
      case 'daily':
        projectedRevenue += member.plan_amount * 30;
        break;
      case 'annual':
        projectedRevenue += member.plan_amount / 12;
        break;
    }
  }

  return projectedRevenue;
}

function calculateProjectedYearlyFromMembers(
  members: Array<{ plan_type: string; plan_amount: number }>
): number {
  let projectedRevenue = 0;

  for (const member of members) {
    switch (member.plan_type) {
      case 'monthly':
        projectedRevenue += member.plan_amount * 12;
        break;
      case 'daily':
        projectedRevenue += member.plan_amount * 365;
        break;
      case 'annual':
        projectedRevenue += member.plan_amount;
        break;
    }
  }

  return projectedRevenue;
}

async function getRevenueMetrics(gymId: string): Promise<RevenueMetrics> {
  const supabase = await createClient();

  // Get total active members
  const { count: activeCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .eq('status', 'active');

  // Get total revenue since inception
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_paid, members!inner(gym_id)')
    .eq('members.gym_id', gymId);

  const totalRevenue = (allPayments || []).reduce((sum, p) => sum + p.amount_paid, 0);

  // Calculate average revenue per member
  const averageRevenue = activeCount && activeCount > 0 ? totalRevenue / activeCount : 0;

  return {
    totalActiveMembers: activeCount || 0,
    totalRevenueSinceInception: totalRevenue,
    averageRevenuePerMember: averageRevenue,
  };
}

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
  ];
  return months[month - 1];
}
