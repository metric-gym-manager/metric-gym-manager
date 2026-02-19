import { createClient } from '@/lib/supabase/server';
import type { SMSType, SMSLog, MemberReminderStatus } from '../types';
import type { ReminderFiltersInput } from '../schemas/sms.schemas';
import { sendSmsViaTextLk } from './textlk.service';

// ============================================================
// SEND SMS (WITH REAL SMS INTEGRATION VIA text.lk)
// ============================================================

export async function sendSMS(
  gymId: string,
  memberId: string,
  smsType: SMSType,
  customMessage?: string
): Promise<SMSLog> {
  const supabase = await createClient();

  // Get member details including gym name via join
  const { data: member } = await supabase
    .from('members')
    .select('*, gyms(gym_name)')
    .eq('id', memberId)
    .eq('gym_id', gymId)
    .single();

  if (!member) {
    throw new Error('Member not found');
  }

  const gymName = (member.gyms as { gym_name: string } | null)?.gym_name ?? '';

  // Format message based on SMS type
  const messageBody = customMessage || formatSMSMessage(smsType, member, gymName);

  // Check if real SMS is enabled via feature flag
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

  let deliveryStatus: 'sent' | 'delivered' | 'failed' = 'sent';
  let textLkMessageId: string | null = null;

  if (useRealSms) {
    // Send SMS via text.lk API
    console.log('📱 [REAL SMS] Sending via text.lk:');
    console.log(`   To: ${member.phone_number}`);
    console.log(`   Type: ${smsType}`);
    console.log(`   Message: ${messageBody}`);

    const result = await sendSmsViaTextLk({
      to: member.phone_number,
      message: messageBody,
    });

    if (result.success && result.message_id) {
      textLkMessageId = result.message_id;
      deliveryStatus = 'sent';
      console.log(`   ✓ SMS sent via text.lk (ID: ${result.message_id})`);
      if (result.balance !== undefined) {
        console.log(`   Balance: ${result.balance} credits`);
      }
    } else {
      deliveryStatus = 'failed';
      console.error(`   ✗ SMS failed: ${result.error}`);
    }
  } else {
    // Mock SMS sending - just log to console
    console.log('📱 [MOCK SMS] Sending SMS:');
    console.log(`   To: ${member.phone_number}`);
    console.log(`   Type: ${smsType}`);
    console.log(`   Message: ${messageBody}`);
  }

  // Log to database
  const { data: smsLog, error } = await supabase
    .from('sms_logs')
    .insert({
      member_id: memberId,
      gym_id: gymId,
      sms_type: smsType,
      phone_number: member.phone_number,
      message_body: messageBody,
      sent_at: new Date().toISOString(),
      delivery_status: deliveryStatus,
      text_lk_message_id: textLkMessageId,
    })
    .select()
    .single();

  if (error || !smsLog) {
    throw new Error(`Failed to log SMS: ${error?.message}`);
  }

  console.log(`   ✓ SMS logged to database (ID: ${smsLog.id})`);

  return smsLog as SMSLog;
}

// ============================================================
// GET REMINDER STATUS
// ============================================================

export async function getReminderStatus(
  gymId: string,
  filters?: ReminderFiltersInput
): Promise<MemberReminderStatus[]> {
  const supabase = await createClient();

  // Get all active members with their last SMS log
  const { data: members, error } = await supabase
    .from('members')
    .select(
      `
      id,
      name,
      phone_number,
      plan_type,
      next_due_date,
      sms_logs (
        sms_type,
        sent_at,
        delivery_status
      )
    `
    )
    .eq('gym_id', gymId)
    .order('next_due_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch reminder status: ${error.message}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Process members and calculate days until due
  let reminderStatuses: MemberReminderStatus[] = (members || []).map((member: any) => {
    const dueDate = new Date(member.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Get last SMS log
    const smsLogs = member.sms_logs || [];
    const lastLog = smsLogs.length > 0 ? smsLogs[smsLogs.length - 1] : null;

    return {
      id: member.id,
      name: member.name,
      phone_number: member.phone_number,
      plan_type: member.plan_type,
      next_due_date: member.next_due_date,
      days_until_due: daysUntilDue,
      last_reminder_sent: lastLog?.sent_at || null,
      last_reminder_type: lastLog?.sms_type || null,
      last_delivery_status: lastLog?.delivery_status || null,
    };
  });

  // Apply filters
  if (filters?.filter) {
    switch (filters.filter) {
      case 'upcoming':
        reminderStatuses = reminderStatuses.filter(
          (r) => r.days_until_due >= 1 && r.days_until_due <= 7
        );
        break;
      case 'due_today':
        reminderStatuses = reminderStatuses.filter((r) => r.days_until_due === 0);
        break;
      case 'overdue':
        reminderStatuses = reminderStatuses.filter((r) => r.days_until_due < 0);
        break;
      // 'all' - no filtering
    }
  }

  // Apply sorting
  if (filters?.sortBy === 'last_reminder_desc') {
    reminderStatuses.sort((a, b) => {
      if (!a.last_reminder_sent) return 1;
      if (!b.last_reminder_sent) return -1;
      return new Date(b.last_reminder_sent).getTime() - new Date(a.last_reminder_sent).getTime();
    });
  } else {
    // Default: sort by due date (soonest first)
    reminderStatuses.sort((a, b) => a.days_until_due - b.days_until_due);
  }

  return reminderStatuses;
}

// ============================================================
// FORMAT SMS MESSAGES
// ============================================================

function formatSMSMessage(
  smsType: SMSType,
  member: any,
  gymName: string
): string {
  const dueDate = new Date(member.next_due_date).toLocaleDateString('en-GB');
  const amount = `Rs.${member.plan_amount.toFixed(2)}`;
  const planType = member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1);

  switch (smsType) {
    case 'welcome': {
      const paid = `Rs.${member.payment_amount.toFixed(2)}`;
      return `Welcome to ${gymName}, ${member.name}! Your ${planType} membership is now active. Amount paid: ${paid}. Thank you for joining us!`;
    }

    case 'reminder_7day':
    case 'reminder_3day':
    case 'due_today':
      return `Dear ${member.name}, your ${planType} membership at ${gymName} is due on ${dueDate}. Amount: ${amount}. Thank you.`;

    case 'overdue':
      return `Dear ${member.name}, your ${planType} membership at ${gymName} was due on ${dueDate}. Amount: ${amount}. Please make payment. Thank you.`;

    case 'receipt':
      // This will be formatted in the payment service with actual payment details
      return '';

    default:
      return `Reminder from ${gymName}`;
  }
}

// ============================================================
// FORMAT RECEIPT SMS
// ============================================================

export function formatReceiptSMS(
  memberName: string,
  gymName: string,
  amountPaid: number,
  nextDueDate: string,
  discountName?: string | null,
  discountPercentage?: number | null
): string {
  const amount = `Rs.${amountPaid.toFixed(2)}`;
  const dueDate = new Date(nextDueDate).toLocaleDateString('en-GB');

  if (discountName && discountPercentage) {
    return `Dear ${memberName}, payment of ${amount} received (Discount: ${discountName} ${discountPercentage}% applied). Next due date: ${dueDate}. Thank you - ${gymName}`;
  }

  return `Dear ${memberName}, payment of ${amount} received. Next due date: ${dueDate}. Thank you - ${gymName}`;
}
