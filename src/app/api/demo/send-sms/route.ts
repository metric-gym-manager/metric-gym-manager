import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service';

// Validation schema
const SendDemoSMSSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^\+94\d{9}$/, 'Phone must be in format +94XXXXXXXXX'),
  gymName: z.string().min(1, 'Gym name is required'),
  type: z.enum(['welcome', 'due', 'receipt'], { required_error: 'Type must be welcome, due, or receipt' }),
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

    // Step 1: Find or create a persistent demo gym (reused for all demos)
    const DEMO_GYM_USERNAME = 'demo_sms_dashboard';

    let demoGym = await supabaseAdmin
      .from('gyms')
      .select('id')
      .eq('username', DEMO_GYM_USERNAME)
      .single();

    let gymId: string;

    if (!demoGym.data) {
      // Create demo gym only once (first time)
      const demoEmail = 'demo-sms@gymmanagement.local';

      // Create auth user
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

      // Create gym record
      const newGym = await supabaseAdmin
        .from('gyms')
        .insert({
          user_id: authUser.data.user.id,
          username: DEMO_GYM_USERNAME,
          email: demoEmail,
          gym_name: 'Demo Gym',
          email_verified: true,
        })
        .select('id')
        .single();

      if (newGym.error || !newGym.data) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.data.user.id);
        return NextResponse.json(
          { error: 'Failed to create demo gym: ' + newGym.error?.message },
          { status: 500 }
        );
      }

      gymId = newGym.data.id;
      console.log(`✓ [DEMO] Created persistent demo gym (ID: ${gymId})`);
    } else {
      gymId = demoGym.data.id;
    }

    // Step 2: Create a temporary member with Annual plan at Rs. 50,000
    const nextDueDate = new Date();
    if (type === 'welcome') {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); // 1 year from now for annual
    } else if (type === 'due') {
      nextDueDate.setDate(nextDueDate.getDate() + 7); // 7 days from now for due reminder
    } else {
      // For receipt, set next due date to 1 year from now (annual plan)
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
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

    // Step 3: Send SMS using production text.lk service
    try {
      console.log(`📱 [DEMO] Sending production ${type} SMS to ${phone} (${name})`);

      // Format message based on type
      let messageBody: string;
      const dueDate = new Date(nextDueDate.toISOString().split('T')[0]).toLocaleDateString('en-GB');

      if (type === 'welcome') {
        messageBody = `Welcome to ${gymName}, ${name}! Your Annual membership is now active. Amount paid: Rs.50000.00. Thank you for joining us!`;
      } else if (type === 'due') {
        messageBody = `Dear ${name}, your Annual membership at ${gymName} is due on ${dueDate}. Amount: Rs.50000.00. Thank you.`;
      } else {
        // Receipt SMS (regular payment without discount)
        messageBody = `Dear ${name}, payment of Rs.50000.00 received. Next due date: ${dueDate}. Thank you - ${gymName}`;
      }

      // Check if real SMS is enabled
      const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

      let deliveryStatus: 'sent' | 'delivered' | 'failed' = 'sent';
      let textLkMessageId: string | null = null;

      if (useRealSms) {
        // Send real SMS via text.lk
        console.log('📱 [REAL SMS] Sending via text.lk:');
        console.log(`   To: ${phone}`);
        console.log(`   Message: ${messageBody}`);

        const result = await sendSmsViaTextLk({
          to: phone,
          message: messageBody,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to send SMS via text.lk');
        }

        deliveryStatus = 'sent';
        textLkMessageId = result.message_id || null;

        console.log(`   ✓ SMS sent via text.lk (ID: ${textLkMessageId})`);
        console.log(`   Balance: ${result.balance} credits`);
      } else {
        // Mock mode - just log to console
        console.log('📱 [MOCK SMS] Mock SMS (not actually sent):');
        console.log(`   To: ${phone}`);
        console.log(`   Message: ${messageBody}`);
      }

      // Log SMS to database (map to DB enum types)
      const smsType = type === 'welcome' || type === 'receipt' ? 'receipt' : 'due_today';
      const { data: smsLog } = await supabaseAdmin
        .from('sms_logs')
        .insert({
          member_id: memberId,
          gym_id: gymId,
          sms_type: smsType,
          phone_number: phone,
          message_body: messageBody,
          delivery_status: deliveryStatus,
          text_lk_message_id: textLkMessageId,
        })
        .select('id')
        .single();

      console.log(`✓ [DEMO] SMS sent successfully (Log ID: ${smsLog?.id || 'N/A'})`);

      // Step 4: Clean up temporary member record (fire-and-forget - don't wait)
      // Delete member in background (will cascade delete SMS log)
      supabaseAdmin.from('members').delete().eq('id', memberId).then(() => {
        console.log(`🗑️ [DEMO] Cleaned up temporary member (ID: ${memberId})`);
      }).catch((err) => {
        console.error(`⚠️ [DEMO] Failed to cleanup member:`, err);
      });

      // Return immediately without waiting for cleanup
      return NextResponse.json({
        success: true,
        message: 'Production SMS sent successfully',
        smsLogId: smsLog?.id || null,
        smsType,
      });

    } catch (smsError) {
      // Clean up member on error
      await supabaseAdmin.from('members').delete().eq('id', memberId);
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
