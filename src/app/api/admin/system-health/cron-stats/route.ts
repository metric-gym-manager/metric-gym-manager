import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================
// GET /api/admin/system-health/cron-stats
// Fetch latest 10 execution records for each distinct job_name
// ============================================================

/**
 * Authorization: Requires ADMIN_API_SECRET header
 * This endpoint is for SaaS admin monitoring only
 */
export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Strict authorization check
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_API_SECRET;

    if (!adminSecret) {
      console.error('ADMIN_API_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Admin API not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${adminSecret}`) {
      console.warn('Unauthorized admin API access attempt');
      return NextResponse.json(
        { success: false, error: 'Forbidden - Invalid admin credentials' },
        { status: 403 }
      );
    }

    // Fetch cron logs from database
    const supabase = createAdminClient();

    // Get distinct job names
    const { data: jobNames, error: jobNamesError } = await supabase
      .from('cron_logs')
      .select('job_name')
      .order('job_name');

    if (jobNamesError) {
      console.error('Failed to fetch job names:', jobNamesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch cron jobs' },
        { status: 500 }
      );
    }

    // Get unique job names
    const uniqueJobNames = Array.from(
      new Set((jobNames || []).map((row: { job_name: string }) => row.job_name))
    );

    // Fetch latest 10 executions for each job
    const cronStats: Record<string, any[]> = {};

    for (const jobName of uniqueJobNames) {
      const { data: executions, error: executionsError } = await supabase
        .from('cron_logs')
        .select('id, job_name, started_at, completed_at, status, summary, errors')
        .eq('job_name', jobName)
        .order('started_at', { ascending: false })
        .limit(10);

      if (executionsError) {
        console.error(`Failed to fetch executions for ${jobName}:`, executionsError);
        continue;
      }

      cronStats[jobName] = executions || [];
    }

    return NextResponse.json(
      {
        success: true,
        data: cronStats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cron stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
