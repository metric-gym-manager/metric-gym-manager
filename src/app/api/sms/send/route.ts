import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { sendSMSSchema } from '@/features/sms/schemas/sms.schemas';
import { sendSMS } from '@/features/sms/services/sms.service';

// ============================================================
// POST /api/sms/send - Send SMS reminder
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate input
    const validatedData = sendSMSSchema.parse(body);

    // Send SMS (mock)
    const smsLog = await sendSMS(
      gymProfile.id,
      validatedData.memberId,
      validatedData.smsType,
      validatedData.customMessage
    );

    return NextResponse.json(
      {
        success: true,
        data: { smsLog },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send SMS API error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to send SMS' },
      { status: 500 }
    );
  }
}
