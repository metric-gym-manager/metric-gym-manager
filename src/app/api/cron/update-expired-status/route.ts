import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { CronLogger } from '@/core/utils/cron';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================
// POST /api/cron/update-expired-status - Update expired members cron job
// Schedule: Daily at midnight (00:00 UTC+5:30)
// ============================================================

export async function POST(request: NextRequest) {
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

    console.log('🚀 Starting update expired status cron job...');
    const startTime = Date.now();

    // Log cron job start
    logId = await logger.logStart('update-expired-status');

    // Update expired member status via use case
    const container = await getAdminContainer();
    const updateExpired = container.getUpdateExpiredStatusUseCase();
    const summary = await updateExpired.execute();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    // Log successful completion
    await logger.logSuccess(logId, {
      totalUpdated: summary.totalUpdated,
      updatedMembers: summary.updatedMembers,
      errors: summary.errors,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      ResponseBuilder.success({
        totalUpdated: summary.totalUpdated,
        updatedMembers: summary.updatedMembers,
        errors: summary.errors,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Update expired status cron error:', error);

    // Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to update expired status',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}

// Allow GET for manual testing (only in development)
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      ResponseBuilder.error('Method not allowed in production', 'METHOD_NOT_ALLOWED'),
      { status: 405 }
    );
  }

  // In development, allow GET without auth for easy testing
  console.log('🧪 Manual test: Starting update expired status cron job...');

  const container = await getAdminContainer();
  const updateExpired = container.getUpdateExpiredStatusUseCase();
  const summary = await updateExpired.execute();

  return NextResponse.json(ResponseBuilder.success(summary));
}
