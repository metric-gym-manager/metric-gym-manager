import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { CronLogger } from '@/core/utils/cron';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================
// /api/cron/expire-suspended-members - Expire overdue suspended members cron job
// Schedule: Daily at midnight (00:00 UTC+5:30)
//
// Vercel Cron invokes this path with an HTTP GET request, so the
// job must run on GET as well as POST. Both verify the CRON_SECRET
// bearer token.
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Expire Suspended Members Cron Job
 *
 * This cron job automatically expires suspended members whose next_due_date has passed.
 *
 * Business Rule: If a suspended member's payment due date has passed,
 * they should transition from 'suspended' to 'expired' status.
 *
 * Valid State Transition: Suspended → Expired
 *
 * This closes the suspension loophole where members could remain suspended
 * indefinitely past their due date without automatic expiration.
 */
async function runExpireSuspendedMembers(request: NextRequest) {
  const supabase = createAdminClient();
  const logger = new CronLogger(supabase);
  let logId: string | null = null;

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET is not configured — refusing to run cron job');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    console.log('🚀 Starting expire suspended members cron job...');
    const startTime = Date.now();

    // Log cron job start
    logId = await logger.logStart('expire-suspended-members');

    // Expire overdue suspended members via use case
    const container = await getAdminContainer();
    const expireSuspended = container.getExpireSuspendedMembersUseCase();
    const summary = await expireSuspended.execute();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    // Log successful completion
    await logger.logSuccess(logId, {
      totalExpired: summary.totalExpired,
      expiredMembers: summary.expiredMembers,
      errors: summary.errors,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      ResponseBuilder.success({
        totalExpired: summary.totalExpired,
        expiredMembers: summary.expiredMembers,
        errors: summary.errors,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Expire suspended members cron error:', error);

    // Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to expire suspended members',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}

// Vercel Cron triggers this handler
export async function GET(request: NextRequest) {
  // In development, allow GET without auth for easy manual testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 Manual test: Starting expire suspended members cron job...');

    const container = await getAdminContainer();
    const expireSuspended = container.getExpireSuspendedMembersUseCase();
    const summary = await expireSuspended.execute();

    return NextResponse.json(ResponseBuilder.success(summary));
  }

  return runExpireSuspendedMembers(request);
}

// Manual/external trigger (e.g. curl with the bearer token)
export async function POST(request: NextRequest) {
  return runExpireSuspendedMembers(request);
}
