import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/middleware/api-auth';
import { unsubscribePush } from '@/features/push-notifications/services/push.service';
import { z } from 'zod';

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireApiAuth();
    if (error) return error;

    const body = await request.json();
    const { endpoint } = unsubscribeSchema.parse(body);

    await unsubscribePush(endpoint);

    return NextResponse.json(
      { success: true, message: 'Push subscription removed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Push unsubscribe error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid endpoint', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
}
