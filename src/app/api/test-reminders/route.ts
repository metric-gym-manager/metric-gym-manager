import { NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';

export async function GET() {
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
