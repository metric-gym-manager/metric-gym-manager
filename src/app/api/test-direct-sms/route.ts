import { NextResponse } from 'next/server';
import { sendSMS } from '@/features/sms/services/sms.service';

export async function GET() {
  try {
    console.log('===== TESTING DIRECT SMS =====');

    const result = await sendSMS(
      '481599f6-5134-4152-83b2-6e2dd10e3018', // gym_id
      '331846fa-f1b8-4903-8691-ccfdc2fccd2a', // Test Regular Overdue member_id
      'overdue'
    );

    console.log('SMS sent:', result);

    return NextResponse.json({
      success: true,
      sms: result,
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
