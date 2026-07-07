import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // This endpoint triggers real SMS sends. In production it must not be
  // publicly invocable, so require the same bearer token as the cron routes.
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  console.log('===== STARTING REMINDER TEST =====');

  try {
    // Use SendAutomatedReminders use case via DI container
    const container = await getAdminContainer();
    const sendReminders = container.getSendAutomatedRemindersUseCase();
    const results = await sendReminders.execute();

    console.log('===== REMINDER TEST RESULTS =====');
    console.log(JSON.stringify(results, null, 2));

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('===== REMINDER TEST ERROR =====');
    console.error(error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
