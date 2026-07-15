import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApiGymProfile } from '@/lib/middleware/api-auth';

// ============================================================
// GET /api/admin/system-health/cron-stats
// Fetch latest 10 execution records for each distinct job_name
// ============================================================

/**
 * Authorization: SaaS operator only. Requires a valid session whose gym-owner
 * email matches ADMIN_ALLOWED_EMAIL (server-only env var). No client-held secret.
 */
export async function GET() {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries.
    const { gymProfile, error: authError } = await getApiGymProfile();
    if (authError) {
      return authError; // 401 (no session) or 404 (no gym profile)
    }

    const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL;
    if (!allowedEmail || gymProfile!.email !== allowedEmail) {
      console.warn('Unauthorized admin API access attempt');
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
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
    interface CronExecutionRow {
      id: string;
      job_name: string;
      started_at: string;
      completed_at: string | null;
      status: string;
      summary: Record<string, unknown> | null;
      errors: string[] | null;
    }

    const cronStats: Record<string, CronExecutionRow[]> = {};

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
