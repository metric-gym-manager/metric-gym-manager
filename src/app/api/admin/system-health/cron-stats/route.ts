import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin';

// ============================================================
// GET /api/admin/system-health/cron-stats
// Fetch latest 10 execution records for each distinct job_name
// ============================================================

/**
 * Authorization: Supabase session + saas_admins membership.
 * This endpoint is for SaaS admin monitoring only.
 */
export async function GET() {
  try {
    // CRITICAL: Strict authorization BEFORE any DB query — Supabase session +
    // saas_admins membership (replaces the retired ADMIN_API_SECRET Bearer).
    const admin = await getSaasAdmin();
    if (!admin) {
      console.warn('Unauthorized admin API access attempt');
      return NextResponse.json(
        { success: false, error: 'Forbidden - SaaS admin access required' },
        { status: 403 }
      );
    }

    // Fetch cron logs from database (cross-tenant read needs the service role)
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
