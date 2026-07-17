import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createChargeDueRenewals } from '@/features/subscriptions';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { CronLogger } from '@/lib/cron';
import { safeEqual } from '@/lib/auth/safeEqual';

export const runtime = 'nodejs';

// ============================================================
// POST /api/cron/charge-renewals — token-billing engine
// Schedule: daily 00:30 UTC (vercel.json) — BEFORE process-dunning (00:45),
// so dunning only suspends gyms whose charge genuinely failed today.
//
// Charges due stored-card tokens (Charging API): success renews with the
// credit-preserving period extension; declines start grace + schedule the
// capped retry; ambiguous outcomes stay pending for the notify webhook.
// Members NEVER touched.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const logger = new CronLogger(supabase);
  let logId: string | null = null;

  try {
    // Constant-time secret check; NO dev fallback secret (fail closed)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || !safeEqual(authHeader, `Bearer ${cronSecret}`)) {
      console.error('Unauthorized charge-renewals cron request');
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    console.log('🚀 Starting charge-renewals cron job...');
    const startTime = Date.now();

    logId = await logger.logStart('charge-renewals');

    const summary = await createChargeDueRenewals(createAdminClient()).execute();

    const duration = Date.now() - startTime;
    console.log(`⏱️  Charge-renewals cron completed in ${duration}ms`);

    if (summary.errors.length > 0) {
      await logger.logFailure(logId, summary.errors);
    } else {
      await logger.logSuccess(logId, {
        due: summary.due,
        charged: summary.charged,
        markedPastDue: summary.markedPastDue,
        retriesScheduled: summary.retriesScheduled,
        skippedPendingAttempt: summary.skippedPendingAttempt,
        awaitingConfirmation: summary.awaitingConfirmation,
        attemptsExpired: summary.attemptsExpired,
        duration: `${duration}ms`,
      });
    }

    return NextResponse.json(
      ResponseBuilder.success({ ...summary, duration: `${duration}ms` }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Charge renewals cron error:', error);

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to charge due renewals',
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

  console.log('🧪 Manual test: Starting charge-renewals cron job...');

  const summary = await createChargeDueRenewals(createAdminClient()).execute();

  return NextResponse.json(ResponseBuilder.success(summary));
}
