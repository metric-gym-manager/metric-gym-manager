import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/middleware/api-auth';
import { createClient } from '@/lib/supabase/server';
import { pushSubscriptionSchema } from '@/features/push-notifications/schemas/push.schemas';
import { subscribePush } from '@/features/push-notifications/services/push.service';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if (authResult.error) return authResult.error;

    const supabase = await createClient();
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', authResult.user!.id)
      .single();

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = pushSubscriptionSchema.parse(body);
    const userAgent = request.headers.get('user-agent');

    await subscribePush(
      gymProfile.id,
      authResult.user!.id,
      { endpoint: validated.endpoint, keys: validated.keys },
      userAgent
    );

    return NextResponse.json(
      { success: true, message: 'Push subscription saved' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Push subscribe error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription format', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}
