import { NextRequest, NextResponse } from 'next/server';
import { cancelOverdueMembers } from '@/features/sms/services/reminder.service';

// ============================================================
// POST /api/cron/cancel-overdue-members - Cancel members overdue by 45+ days
// Schedule: Daily at midnight (00:00 UTC+5:30)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 Starting cancel overdue members cron job...');
    const startTime = Date.now();

    // Cancel members overdue by 45+ days
    const results = await cancelOverdueMembers();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    return NextResponse.json(
      {
        success: true,
        data: {
          totalCancelled: results.totalCancelled,
          errors: results.errors,
          duration: `${duration}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cancel overdue members cron error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel overdue members',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
  console.log('🧪 Manual test: Starting cancel overdue members cron job...');

  const results = await cancelOverdueMembers();

  return NextResponse.json({
    success: true,
    data: results,
  });
}
