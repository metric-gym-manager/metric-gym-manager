import { NextRequest, NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { sendPushSchema } from '@/features/push-notifications/schemas/push.schemas';
import { sendPushToGym } from '@/features/push-notifications/services/push.service';

export async function POST(request: NextRequest) {
  try {
    const { gymProfile, error } = await getApiGymProfile();
    if (error) return error;

    const body = await request.json();
    const validated = sendPushSchema.parse(body);

    const result = await sendPushToGym(gymProfile!.id, {
      title: validated.title,
      body: validated.body,
      data: {
        url: validated.url,
        type: validated.type,
      },
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error) {
    console.error('Send push error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid notification data', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
