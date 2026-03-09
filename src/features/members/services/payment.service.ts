import { createClient } from '@/lib/supabase/server';
import type { Payment, Member } from '../types';
import type { CollectPaymentInput } from '../schemas/member.schemas';
import { formatReceiptSMS } from '@/features/sms/services/sms.service';
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service';

// ============================================================
// OPTIMIZED SMS SENDER (NO REDUNDANT QUERIES)
// ============================================================

/**
 * Send SMS without redundant member fetch - optimized for performance
 * This is used when we already have member data from a previous query
 */
async function sendSMSAsync(
  gymId: string,
  memberId: string,
  phoneNumber: string,
  message: string
): Promise<void> {
  try {
    if (!phoneNumber || phoneNumber.trim() === '') {
      console.error(`   ✗ Receipt SMS skipped: phone number is missing for member ${memberId}`);
      return;
    }

    const supabase = await createClient();
    const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

    let deliveryStatus: 'sent' | 'delivered' | 'failed' = 'sent';
    let textLkMessageId: string | null = null;

    if (useRealSms) {
      console.log('📱 [REAL SMS] Sending receipt via text.lk:');
      console.log(`   To: ${phoneNumber}`);
      console.log(`   Message: ${message}`);

      const result = await sendSmsViaTextLk({
        to: phoneNumber,
        message: message,
      });

      if (result.success) {
        textLkMessageId = result.message_id ?? null;
        deliveryStatus = 'sent';
        console.log(`   ✓ SMS sent via text.lk (ID: ${result.message_id ?? 'N/A'})`);
      } else {
        deliveryStatus = 'failed';
        console.error(`   ✗ SMS failed: ${result.error}`);
      }
    } else {
      console.log('📱 [MOCK SMS] Sending receipt SMS:');
      console.log(`   To: ${phoneNumber}`);
      console.log(`   Message: ${message}`);
    }

    // Log to database (fire-and-forget, don't await)
    supabase
      .from('sms_logs')
      .insert({
        member_id: memberId,
        gym_id: gymId,
        sms_type: 'receipt',
        phone_number: phoneNumber,
        message_body: message,
        sent_at: new Date().toISOString(),
        delivery_status: deliveryStatus,
        text_lk_message_id: textLkMessageId,
      })
      .then((result) => {
        if (result.error) {
          console.error('   ✗ Failed to log SMS:', result.error);
        } else {
          console.log('   ✓ SMS logged to database');
        }
      });
  } catch (error) {
    console.error('Failed to send receipt SMS:', error);
  }
}

// ============================================================
// COLLECT PAYMENT
// ============================================================

export async function collectPayment(
  gymId: string,
  input: CollectPaymentInput
): Promise<{ payment: Payment; member: Member }> {
  const supabase = await createClient();

  // Single query: member + discount + gym in one round-trip.
  // Using the members->gyms join avoids a separate gyms SELECT that can be
  // blocked by RLS when querying the gyms table directly.
  const { data: memberRow, error: memberError } = await supabase
    .from('members')
    .select(`
      *,
      discount:discounts(discount_name, discount_percentage),
      gym:gyms!inner(gym_name)
    `)
    .eq('id', input.memberId)
    .eq('gym_id', gymId)
    .single();

  if (memberError || !memberRow) {
    throw new Error('Member not found');
  }

  // Extract joined discount info
  const discountRow = (memberRow as unknown as {
    discount: { discount_name: string; discount_percentage: number } | null;
  }).discount;

  const discountName: string | null =
    input.discountId && discountRow ? discountRow.discount_name : null;
  const discountPercentage: number | null =
    input.discountId && discountRow ? discountRow.discount_percentage : null;

  // Extract gym name (used for receipt SMS)
  const gymName =
    ((memberRow as unknown as { gym: { gym_name: string } | null }).gym?.gym_name) ?? '';

  // Calculate next due date
  const paymentDate = new Date(input.paymentDate);
  const nextDueDate =
    (input.deductOverduePeriod ?? true)
      ? new Date(paymentDate)
      : new Date(memberRow.next_due_date);

  switch (memberRow.plan_type) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      break;
    case 'weekly':
      nextDueDate.setDate(nextDueDate.getDate() + 7);
      break;
    case 'monthly':
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      break;
    case '3-months':
      nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      break;
    case '6-months':
      nextDueDate.setMonth(nextDueDate.getMonth() + 6);
      break;
    case 'annual':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      break;
  }

  const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

  // Parallel writes: insert payment record AND update member status/due date
  const [paymentResult, memberUpdateResult] = await Promise.all([
    supabase
      .from('payments')
      .insert({
        member_id: input.memberId,
        payment_date: input.paymentDate,
        amount_paid: input.paymentAmount,
        discount_applied: discountName,
        discount_percentage: discountPercentage,
        next_due_date_calculated: nextDueDateStr,
      })
      .select()
      .single(),
    supabase
      .from('members')
      .update({
        status: 'active',
        next_due_date: nextDueDateStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.memberId)
      .eq('gym_id', gymId)
      .select()
      .single(),
  ]);

  if (paymentResult.error || !paymentResult.data) {
    throw new Error(`Failed to record payment: ${paymentResult.error?.message}`);
  }

  if (memberUpdateResult.error || !memberUpdateResult.data) {
    throw new Error(`Failed to update member: ${memberUpdateResult.error?.message}`);
  }

  // Fire-and-forget receipt SMS so it never blocks the API response.
  // gymName comes from the already-fetched joined query, not a separate gyms SELECT.
  const receiptMessage = formatReceiptSMS(
    memberUpdateResult.data.name,
    gymName,
    input.paymentAmount,
    nextDueDateStr,
    discountName,
    discountPercentage
  );

  // Use setImmediate/queueMicrotask to truly defer SMS sending
  // This ensures it doesn't block the response even in serverless
  if (typeof setImmediate !== 'undefined') {
    setImmediate(() => {
      sendSMSAsync(gymId, input.memberId, memberUpdateResult.data.phone_number, receiptMessage);
    });
  } else {
    // Fallback for environments without setImmediate
    Promise.resolve().then(() => {
      sendSMSAsync(gymId, input.memberId, memberUpdateResult.data.phone_number, receiptMessage);
    });
  }

  return {
    payment: paymentResult.data as Payment,
    member: memberUpdateResult.data as Member,
  };
}

// ============================================================
// GET PAYMENT HISTORY
// ============================================================

export async function getPaymentHistory(
  memberId: string,
  gymId: string
): Promise<Payment[]> {
  const supabase = await createClient();

  // Verify member belongs to gym
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('gym_id', gymId)
    .single();

  if (!member) {
    throw new Error('Member not found');
  }

  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .eq('member_id', memberId)
    .order('payment_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch payment history: ${error.message}`);
  }

  return (payments || []) as Payment[];
}
