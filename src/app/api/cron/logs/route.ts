import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// GET /api/cron/logs - Get cron execution logs
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const jobName = searchParams.get('job');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('cron_execution_logs')
      .select('*', { count: 'exact' })
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by job name if provided
    if (jobName) {
      query = query.eq('cron_job_name', jobName);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Failed to fetch cron logs:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch cron logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        totalCount: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Cron logs API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
