import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDashboardMetrics } from '@/features/revenue/services/metrics.service';

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

    // Get the gym record for this user
    const { data: gym, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (gymError || !gym) {
      console.error('Error fetching gym:', gymError);
      return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
    }

    const data = await getDashboardMetrics(gym.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'Failed to fetch members') {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }
    console.error('Dashboard metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
