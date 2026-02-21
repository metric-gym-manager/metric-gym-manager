import { NextResponse } from 'next/server';
import { sendAutomatedReminders } from '@/features/sms/services/reminder.service';

export async function GET() {
  console.log('===== STARTING REMINDER TEST =====');

  try {
    const results = await sendAutomatedReminders();

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
