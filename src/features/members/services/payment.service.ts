import { createClient } from '@/lib/supabase/server';
import type { Payment, Member } from '../types';
import type { CollectPaymentInput } from '../schemas/member.schemas';
import { sendSMS, formatReceiptSMS } from '@/features/sms/services/sms.service';

// ============================================================
// COLLECT PAYMENT
// ============================================================

export async function collectPayment(
  gymId: string,
  input: CollectPaymentInput
): Promise<{ payment: Payment; member: Member }> {
  const supabase = await createClient();

  // Get member details
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('id', input.memberId)
    .eq('gym_id', gymId)
    .single();

  if (memberError || !member) {
    throw new Error('Member not found');
  }

  // Get discount info if applicable
  let discountName: string | null = null;
  let discountPercentage: number | null = null;

  if (input.discountId) {
    const { data: discount } = await supabase
      .from('discounts')
      .select('discount_name, discount_percentage')
      .eq('id', input.discountId)
      .eq('gym_id', gymId)
      .single();

    if (discount) {
      discountName = discount.discount_name;
      discountPercentage = discount.discount_percentage;
    }
  }

  // Calculate next due date
  let nextDueDate: Date;
  const paymentDate = new Date(input.paymentDate);

  if (input.deductOverduePeriod ?? true) {
    // Start from payment date
    nextDueDate = new Date(paymentDate);
  } else {
    // Start from original due date
    nextDueDate = new Date(member.next_due_date);
  }

  // Add plan duration
  switch (member.plan_type) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      break;
    case 'monthly':
      nextDueDate.setDate(nextDueDate.getDate() + 30);
      break;
    case 'annual':
      nextDueDate.setDate(nextDueDate.getDate() + 365);
      break;
  }

  const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

  // Record payment
  const { data: payment, error: paymentError } = await supabase
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
    .single();

  if (paymentError || !payment) {
    throw new Error(`Failed to record payment: ${paymentError?.message}`);
  }

  // Update member status and next due date
  const { data: updatedMember, error: updateError } = await supabase
    .from('members')
    .update({
      status: 'active',
      next_due_date: nextDueDateStr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.memberId)
    .eq('gym_id', gymId)
    .select()
    .single();

  if (updateError || !updatedMember) {
    throw new Error(`Failed to update member: ${updateError?.message}`);
  }

  // Send SMS receipt
  try {
    // Get gym name for the SMS
    const { data: gym } = await supabase
      .from('gyms')
      .select('gym_name')
      .eq('id', gymId)
      .single();

    if (gym) {
      const receiptMessage = formatReceiptSMS(
        updatedMember.name,
        gym.gym_name,
        input.paymentAmount,
        nextDueDateStr,
        discountName,
        discountPercentage
      );

      // Send SMS receipt
      await sendSMS(gymId, input.memberId, 'receipt', receiptMessage);
      console.log(`✓ Payment receipt SMS sent to ${updatedMember.name}`);
    }
  } catch (smsError) {
    // Don't fail the payment if SMS fails, just log the error
    console.error('Failed to send payment receipt SMS:', smsError);
  }

  return {
    payment: payment as Payment,
    member: updatedMember as Member,
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
