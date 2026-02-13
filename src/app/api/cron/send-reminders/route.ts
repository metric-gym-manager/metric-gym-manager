import { NextRequest, NextResponse } from 'next/server';
import { sendAutomatedReminders } from '@/features/sms/services/reminder.service';

// ============================================================
// POST /api/cron/send-reminders - Daily SMS reminder cron job
// Schedule: Daily at 9:00 AM Sri Lanka Time (UTC+5:30)
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

    console.log('🚀 Starting automated reminder cron job...');
    const startTime = Date.now();

    // Send automated reminders
    const results = await sendAutomatedReminders();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    return NextResponse.json(
      {
        success: true,
        data: {
          totalSent: results.totalSent,
          byType: results.byType,
          errors: results.errors,
          duration: `${duration}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Send reminders cron error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send reminders',
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
  console.log('🧪 Manual test: Starting automated reminder cron job...');

  const results = await sendAutomatedReminders();

  return NextResponse.json({
    success: true,
    data: results,
  });
}
