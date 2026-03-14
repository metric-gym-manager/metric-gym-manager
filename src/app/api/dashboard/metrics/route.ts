import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Dashboard Metrics API
 * GET /api/dashboard/metrics
 *
 * Returns aggregated metrics for the dashboard:
 * - Overdue members count (with urgency breakdown)
 * - Revenue this month
 * - Members due this week
 * - Active members count
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gymId = user.id;

    // Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all members for calculations
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, status, next_due_date, plan_type')
      .eq('gym_id', gymId);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Calculate overdue members with urgency breakdown
    const today = new Date().toISOString().split('T')[0];
    const overdueMembers = members.filter(
      (m) => m.status === 'expired' && m.next_due_date < today
    );

    let critical = 0;
    let warning = 0;
    let mild = 0;

    overdueMembers.forEach((member) => {
      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(member.next_due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue > 14) critical++;
      else if (daysOverdue >= 7) warning++;
      else mild++;
    });

    // Get revenue this month
    const { data: payments } = await supabase
      .from('payments')
      .select('payment_amount')
      .eq('gym_id', gymId)
      .gte('payment_date', startOfMonth)
      .lte('payment_date', endOfMonth);

    const revenueThisMonth =
      payments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;

    // Get members due this week
    const membersDueThisWeek = members.filter(
      (m) =>
        m.status === 'active' &&
        m.next_due_date >= today &&
        m.next_due_date <= sevenDaysFromNow
    );

    // Calculate total amount due this week (need to get plan amounts)
    const { data: plans } = await supabase
      .from('plan_types')
      .select('plan_type, default_amount')
      .eq('gym_id', gymId);

    const planAmountMap = plans?.reduce((acc, plan) => {
      acc[plan.plan_type] = plan.default_amount;
      return acc;
    }, {} as Record<string, number>) || {};

    const totalAmountDueThisWeek = membersDueThisWeek.reduce((sum, m) => {
      return sum + (planAmountMap[m.plan_type] || 0);
    }, 0);

    // Count active members
    const activeMembers = members.filter((m) => m.status === 'active').length;

    // Return metrics
    return NextResponse.json({
      success: true,
      data: {
        overdueMembers: {
          count: overdueMembers.length,
          critical,
          warning,
          mild,
        },
        revenueThisMonth,
        membersDueThisWeek: {
          count: membersDueThisWeek.length,
          totalAmount: totalAmountDueThisWeek,
        },
        activeMembers,
      },
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
