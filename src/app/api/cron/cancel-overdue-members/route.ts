import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { CronLogger } from '@/core/utils/cron';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================
// POST /api/cron/cancel-overdue-members - Cancel members overdue by 45+ days
// Schedule: Daily at midnight (00:00 UTC+5:30)
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const logger = new CronLogger(supabase);
  let logId: string | null = null;

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    console.log('🚀 Starting cancel overdue members cron job...');
    const startTime = Date.now();

    // Log cron job start
    logId = await logger.logStart('cancel-overdue-members');

    // Cancel overdue members via use case
    const container = await getAdminContainer();
    const cancelOverdue = container.getCancelOverdueMembersUseCase();
    const summary = await cancelOverdue.execute();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    // Log successful completion
    await logger.logSuccess(logId, {
      totalCancelled: summary.totalCancelled,
      cancelledMembers: summary.cancelledMembers,
      errors: summary.errors,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      ResponseBuilder.success({
        totalCancelled: summary.totalCancelled,
        cancelledMembers: summary.cancelledMembers,
        errors: summary.errors,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Cancel overdue members cron error:', error);

    // Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to cancel overdue members',
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
  console.log('🧪 Manual test: Starting cancel overdue members cron job...');

  const container = await getAdminContainer();
  const cancelOverdue = container.getCancelOverdueMembersUseCase();
  const summary = await cancelOverdue.execute();

  return NextResponse.json(ResponseBuilder.success(summary));
}
