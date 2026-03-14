import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const feedbackSchema = z.object({
  message: z.string().min(1, 'Feedback message is required').max(1000, 'Feedback message is too long'),
  email: z.string().email('Invalid email address').optional(),
  category: z.enum(['bug', 'feature', 'general']),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id, gym_name, phone_number')
      .eq('user_id', user.id)
      .single();

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = feedbackSchema.parse(body);

    // Log feedback (for now, just log to console)
    // In production, you could save this to a database table or send an email
    console.log('📝 [FEEDBACK] Received feedback:', {
      gym_id: gymProfile.id,
      gym_name: gymProfile.gym_name,
      gym_phone: gymProfile.phone_number,
      user_email: validatedData.email || user.email || 'Not provided',
      category: validatedData.category,
      message: validatedData.message,
      timestamp: new Date().toISOString(),
    });

    // Optional: Save feedback to a database table
    // You could create a 'feedback' table in Supabase and insert the feedback here
    // await supabase.from('feedback').insert({
    //   gym_id: gymProfile.id,
    //   user_email: validatedData.email || user.email,
    //   category: validatedData.category,
    //   message: validatedData.message,
    //   created_at: new Date().toISOString(),
    // });

    return NextResponse.json(
      {
        success: true,
        message: 'Feedback received successfully. Thank you for helping us improve!',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Feedback submission error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => e.message).join(', '),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
