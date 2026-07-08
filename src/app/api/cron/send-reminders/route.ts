import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { CronLogger } from '@/core/utils/cron';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================
// POST /api/cron/send-reminders - Daily SMS reminder cron job
// Schedule: Daily at 9:00 AM Sri Lanka Time (3:30 AM UTC)
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
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 Starting automated reminder cron job...');
    const startTime = Date.now();

    // Log cron job start
    logId = await logger.logStart('send-reminders');

    // Send automated reminders via use case
    const container = await getAdminContainer();
    const sendReminders = container.getSendAutomatedRemindersUseCase();
    const summary = await sendReminders.execute();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    // Log successful completion
    await logger.logSuccess(logId, {
      totalSent: summary.totalSent,
      byType: summary.byType,
      errors: summary.errors,
      membersProcessed: summary.membersProcessed,
      membersSkipped: summary.membersSkipped,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      ResponseBuilder.success({
        totalSent: summary.totalSent,
        byType: summary.byType,
        errors: summary.errors,
        membersProcessed: summary.membersProcessed,
        membersSkipped: summary.membersSkipped,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Send reminders cron error:', error);

    // Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to send reminders',
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
      { success: false, error: 'Method not allowed in production' },
      { status: 405 }
    );
  }

  // In development, allow GET without auth for easy testing
  console.log('🧪 Manual test: Starting automated reminder cron job...');

  const container = await getAdminContainer();
  const sendReminders = container.getSendAutomatedRemindersUseCase();
  const summary = await sendReminders.execute();

  return NextResponse.json(ResponseBuilder.success(summary));
}
