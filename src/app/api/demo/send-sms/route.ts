import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { sendSMS } from '@/features/sms/services/sms.service';

// Validation schema
const SendDemoSMSSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^\+94\d{9}$/, 'Phone must be in format +94XXXXXXXXX'),
  gymName: z.string().min(1, 'Gym name is required'),
  type: z.enum(['welcome', 'due'], { required_error: 'Type must be welcome or due' }),
});

/**
 * Demo API for sending REAL production SMS messages
 * Only accessible from localhost
 *
 * This creates a temporary member record and sends actual production SMS
 */
export async function POST(request: NextRequest) {
  try {
    // Check if request is from localhost
    const host = request.headers.get('host') || '';
    const isLocalhost =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('[::1]');

    if (!isLocalhost) {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is only accessible from localhost.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = SendDemoSMSSchema.parse(body);

    const { name, phone, gymName, type } = validatedData;

    // Create service role client (bypasses RLS)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Step 1: Create a temporary demo gym (will be deleted after SMS is sent)
    const demoEmail = `demo+${gymName.toLowerCase().replace(/\s+/g, '-')}+${Date.now()}@gymmanagement.local`;

    // Create a temporary demo user in auth
    const authUser = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: 'demo-password-' + Math.random().toString(36).slice(2),
      email_confirm: true,
    });

    if (!authUser?.data?.user) {
      return NextResponse.json(
        { error: 'Failed to create demo user' },
        { status: 500 }
      );
    }

    const userId = authUser.data.user.id;

    // Create temporary gym record
    const newGym = await supabaseAdmin
      .from('gyms')
      .insert({
        user_id: userId,
        username: `demo_${Date.now()}_${gymName.toLowerCase().replace(/\s+/g, '_')}`,
        email: demoEmail,
        gym_name: gymName,
        email_verified: true,
      })
      .select('id')
      .single();

    if (newGym.error || !newGym.data) {
      // Clean up auth user if gym creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to create demo gym: ' + newGym.error?.message },
        { status: 500 }
      );
    }

    const gymId = newGym.data.id;

    // Step 2: Create a temporary member with Annual plan at Rs. 50,000
    const nextDueDate = new Date();
    if (type === 'welcome') {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); // 1 year from now for annual
    } else {
      nextDueDate.setDate(nextDueDate.getDate() + 7); // 7 days from now for due reminder
    }

    const memberData = {
      gym_id: gymId,
      name,
      phone_number: phone,
      plan_type: 'annual',
      plan_amount: 50000,
      status: 'active',
      membership_start_date: new Date().toISOString().split('T')[0],
      next_due_date: nextDueDate.toISOString().split('T')[0],
    };

    const newMember = await supabaseAdmin
      .from('members')
      .insert(memberData)
      .select('id')
      .single();

    if (newMember.error || !newMember.data) {
      return NextResponse.json(
        { error: 'Failed to create demo member: ' + newMember.error?.message },
        { status: 500 }
      );
    }

    const memberId = newMember.data.id;

    // Step 3: Send SMS using the ACTUAL production sendSMS function
    try {
      const smsType = type === 'welcome' ? 'welcome' : 'due_today';
      const paymentAmount = type === 'welcome' ? 50000 : undefined;

      console.log(`📱 [DEMO] Sending production ${type} SMS to ${phone} (${name})`);

      const smsLog = await sendSMS(
        gymId,
        memberId,
        smsType,
        undefined, // Use default message formatting
        paymentAmount
      );

      console.log(`✓ [DEMO] SMS sent successfully (ID: ${smsLog.id})`);

      // Step 4: Clean up temporary records (member, gym, and auth user)
      console.log(`🗑️ [DEMO] Cleaning up temporary records...`);

      // Delete member (will cascade delete payments and SMS logs via ON DELETE CASCADE)
      await supabaseAdmin.from('members').delete().eq('id', memberId);

      // Delete gym (will cascade delete other related records)
      await supabaseAdmin.from('gyms').delete().eq('id', gymId);

      // Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);

      console.log(`✓ [DEMO] Cleanup complete - all temporary records removed`);

      return NextResponse.json({
        success: true,
        message: 'Production SMS sent successfully (temporary records cleaned up)',
        smsLogId: smsLog.id,
        smsType,
      });

    } catch (smsError) {
      // Clean up all temporary records on error
      await supabaseAdmin.from('members').delete().eq('id', memberId);
      await supabaseAdmin.from('gyms').delete().eq('id', gymId);
      await supabaseAdmin.auth.admin.deleteUser(userId);

      throw smsError;
    }

  } catch (error) {
    console.error('Demo SMS error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      },
      { status: 500 }
    );
  }
}
