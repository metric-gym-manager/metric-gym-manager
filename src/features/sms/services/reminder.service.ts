import { createAdminClient } from '@/lib/supabase/admin';
import type { SMSType } from '../types';
import { sendSmsViaTextLk } from './textlk.service';

// ============================================================
// HELPER: SEND SMS FOR CRON JOBS (USING ADMIN CLIENT)
// ============================================================

async function sendReminderSMS(
  supabase: ReturnType<typeof createAdminClient>,
  gymId: string,
  memberId: string,
  smsType: SMSType,
  customMessage?: string
): Promise<void> {
  // Get member details
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
  const dueDate = new Date(member.next_due_date).toLocaleDateString('en-GB');
  const amount = `Rs.${member.plan_amount.toFixed(2)}`;
  const planType = member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1);

  // Format message if not provided
  let messageBody = customMessage;
  if (!messageBody) {
    if (smsType === 'overdue') {
      messageBody = `Dear ${member.name}, your ${planType} membership at ${gymName} was due on ${dueDate}. Amount: ${amount}. Please make payment. Thank you.`;
    } else if (smsType === 'due_today') {
      messageBody = `Dear ${member.name}, your ${planType} membership at ${gymName} expires today. Amount: ${amount}. Please make payment. Thank you.`;
    } else {
      messageBody = `Dear ${member.name}, your ${planType} membership at ${gymName} is due on ${dueDate}. Amount: ${amount}. Thank you.`;
    }
  }

  // Check if real SMS is enabled
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true';
  let deliveryStatus: 'sent' | 'delivered' | 'failed' = 'sent';
  let textLkMessageId: string | null = null;

  if (useRealSms) {
    console.log(`📱 [REAL SMS] Sending via text.lk to ${member.phone_number}`);
    const result = await sendSmsViaTextLk({
      to: member.phone_number,
      message: messageBody,
    });

    if (result.success && result.message_id) {
      textLkMessageId = result.message_id;
      deliveryStatus = 'sent';
    } else {
      deliveryStatus = 'failed';
    }
  } else {
    console.log(`📱 [MOCK SMS] To: ${member.phone_number}, Type: ${smsType}`);
    console.log(`   Message: ${messageBody}`);
  }

  // Log to database
  await supabase.from('sms_logs').insert({
    member_id: memberId,
    gym_id: gymId,
    sms_type: smsType,
    phone_number: member.phone_number,
    message_body: messageBody,
    sent_at: new Date().toISOString(),
    delivery_status: deliveryStatus,
    text_lk_message_id: textLkMessageId,
  });
}

// ============================================================
// SEND AUTOMATED REMINDERS
// ============================================================

export async function sendAutomatedReminders(): Promise<{
  totalSent: number;
  byType: Record<SMSType, number>;
  errors: string[];
}> {
  const supabase = createAdminClient();

  const results = {
    totalSent: 0,
    byType: {
      reminder_7day: 0,
      reminder_3day: 0,
      due_today: 0,
      overdue: 0,
      receipt: 0,
    } as Record<SMSType, number>,
    errors: [] as string[],
  };

  try {
    console.log('🔍 Fetching all gyms...');

    // Get all gyms
    const { data: gyms, error: gymsError } = await supabase
      .from('gyms')
      .select('id, gym_name');

    console.log('Gyms query result:', { count: gyms?.length, error: gymsError?.message });

    if (gymsError) {
      results.errors.push(`Failed to fetch gyms: ${gymsError.message}`);
      return results;
    }

    if (!gyms || gyms.length === 0) {
      console.log('❌ No gyms found to process');
      console.log('Query result:', { data: gyms, error: gymsError });
      return results;
    }

    console.log(`📅 Processing ${gyms.length} gym(s) for automated reminders...`);
    console.log('Gyms:', gyms.map(g => ({ id: g.id, name: g.gym_name })));

    // Process each gym
    for (const gym of gyms) {
      try {
        const gymResults = await processGymReminders(gym.id);
        results.totalSent += gymResults.totalSent;

        // Merge byType counts
        Object.keys(gymResults.byType).forEach((type) => {
          results.byType[type as SMSType] += gymResults.byType[type as SMSType];
        });
      } catch (error) {
        const errorMsg = `Failed to process gym ${gym.gym_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`✅ Automated reminders complete: ${results.totalSent} SMS sent`);
    console.log(`   - 7-Day: ${results.byType.reminder_7day}`);
    console.log(`   - 3-Day: ${results.byType.reminder_3day}`);
    console.log(`   - Due Today: ${results.byType.due_today}`);
    console.log(`   - Overdue: ${results.byType.overdue}`);

    if (results.errors.length > 0) {
      console.log(`⚠️  Errors: ${results.errors.length}`);
    }

  } catch (error) {
    const errorMsg = `Fatal error in sendAutomatedReminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    console.error(errorMsg);
  }

  return results;
}

// ============================================================
// PROCESS REMINDERS FOR A SINGLE GYM
// ============================================================

async function processGymReminders(gymId: string): Promise<{
  totalSent: number;
  byType: Record<SMSType, number>;
}> {
  const supabase = createAdminClient();

  const results = {
    totalSent: 0,
    byType: {
      reminder_7day: 0,
      reminder_3day: 0,
      due_today: 0,
      overdue: 0,
      receipt: 0,
    } as Record<SMSType, number>,
  };

  // Get all active members for this gym
  const { data: members, error} = await supabase
    .from('members')
    .select(`
      id,
      name,
      phone_number,
      plan_type,
      next_due_date
    `)
    .eq('gym_id', gymId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  if (!members || members.length === 0) {
    console.log(`  ❌ No active members for gym ${gymId}`);
    console.log(`  Query error:`, error);
    return results;
  }

  console.log(`  ✓ Found ${members.length} total active members`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`  📊 Processing ${members.length} members`);

  // Process each member
  for (const member of members) {
    const dueDate = new Date(member.next_due_date);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const planType = (member as any).plan_type;

    console.log(`    Member: ${member.name}, Plan: ${planType}, Due: ${member.next_due_date}, Days until due: ${daysUntilDue}`);

    // Skip all automatic reminders for daily members
    if (planType === 'daily') {
      console.log(`      → Skipped: Daily members don't receive automatic reminders`);
      continue;
    }

    let smsType: SMSType | null = null;

    // Determine SMS type based on days until due
    if (daysUntilDue === 7) {
      // Skip 7-day reminder for monthly members
      if (planType === 'monthly') {
        console.log(`      → Skipped: Monthly members don't receive 7-day reminders`);
        continue;
      }
      smsType = 'reminder_7day';
      console.log(`      → Sending 7-day reminder`);
    } else if (daysUntilDue === 3) {
      smsType = 'reminder_3day';
      console.log(`      → Sending 3-day reminder`);
    } else if (daysUntilDue === 0) {
      smsType = 'due_today';
      console.log(`      → Sending due today reminder`);
    } else if (daysUntilDue < 0) {
      smsType = 'overdue';
      console.log(`      → Sending overdue reminder`);
    } else {
      console.log(`      → No reminder needed (${daysUntilDue} days)`);
    }

    // Send SMS if applicable
    if (smsType) {
      try {
        await sendReminderSMS(supabase, gymId, member.id, smsType);
        results.totalSent++;
        results.byType[smsType]++;
        console.log(`  ✓ Sent ${smsType} to ${member.name} (due in ${daysUntilDue} days)`);
      } catch (error) {
        console.error(`  ✗ Failed to send ${smsType} to ${member.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return results;
}

// ============================================================
// UPDATE EXPIRED MEMBER STATUS
// ============================================================

export async function updateExpiredMemberStatus(): Promise<{
  totalUpdated: number;
  errors: string[];
}> {
  const supabase = createAdminClient();

  const results = {
    totalUpdated: 0,
    errors: [] as string[],
  };

  try {
    console.log('🔄 Checking for expired members...');

    // Get today's date (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().split('T')[0];

    // Update all active members whose next_due_date has passed (is less than today)
    // This means if payment is not made on or before the due date, status changes to expired
    const { data: updatedMembers, error } = await supabase
      .from('members')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'active')
      .lt('next_due_date', todayDate)
      .select('id, name, next_due_date');

    if (error) {
      results.errors.push(`Failed to update expired members: ${error.message}`);
      console.error(`✗ ${results.errors[0]}`);
      return results;
    }

    results.totalUpdated = updatedMembers?.length || 0;

    if (results.totalUpdated > 0) {
      console.log(`✅ Updated ${results.totalUpdated} member(s) to expired status`);
      updatedMembers?.forEach((member) => {
        console.log(`  - ${member.name} (was due: ${member.next_due_date})`);
      });
    } else {
      console.log('✓ No members need status update');
    }
  } catch (error) {
    const errorMsg = `Fatal error in updateExpiredMemberStatus: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    console.error(errorMsg);
  }

  return results;
}

// ============================================================
// CANCEL MEMBERS OVERDUE BY 45+ DAYS
// ============================================================

export async function cancelOverdueMembers(): Promise<{
  totalCancelled: number;
  errors: string[];
}> {
  const supabase = createAdminClient();

  const results = {
    totalCancelled: 0,
    errors: [] as string[],
  };

  try {
    console.log('🔄 Checking for members overdue by 45+ days...');

    // Calculate the date 45 days ago
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fortyFiveDaysAgo = new Date(today);
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const cutoffDate = fortyFiveDaysAgo.toISOString().split('T')[0];

    // Update expired members whose next_due_date is more than 45 days in the past
    const { data: cancelledMembers, error } = await supabase
      .from('members')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'expired')
      .lt('next_due_date', cutoffDate)
      .select('id, name, next_due_date');

    if (error) {
      results.errors.push(`Failed to cancel overdue members: ${error.message}`);
      console.error(`✗ ${results.errors[0]}`);
      return results;
    }

    results.totalCancelled = cancelledMembers?.length || 0;

    if (results.totalCancelled > 0) {
      console.log(`✅ Cancelled ${results.totalCancelled} member(s) overdue by 45+ days`);
      cancelledMembers?.forEach((member) => {
        console.log(`  - ${member.name} (was due: ${member.next_due_date})`);
      });
    } else {
      console.log('✓ No members need cancellation');
    }
  } catch (error) {
    const errorMsg = `Fatal error in cancelOverdueMembers: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    console.error(errorMsg);
  }

  return results;
}

// ============================================================
// ARCHIVE OLD MEMBERS
// ============================================================

export async function archiveOldMembers(): Promise<{
  totalArchived: number;
  errors: string[];
}> {
  const supabase = createAdminClient();

  const results = {
    totalArchived: 0,
    errors: [] as string[],
  };

  try {
    console.log('🗄️  Checking for members to archive...');

    // Calculate the date 2 years ago
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString();

    // Find expired members that haven't been updated in 2 years
    const { data: membersToArchive, error: fetchError } = await supabase
      .from('members')
      .select('id, name')
      .eq('status', 'expired')
      .lt('updated_at', cutoffDate);

    if (fetchError) {
      results.errors.push(`Failed to fetch old members: ${fetchError.message}`);
      console.error(`✗ ${results.errors[0]}`);
      return results;
    }

    if (!membersToArchive || membersToArchive.length === 0) {
      console.log('✓ No members need archiving');
      return results;
    }

    // Soft delete by changing status to 'cancelled'
    // (In a real implementation, you might move to an archive table)
    const { data: archivedMembers, error: archiveError } = await supabase
      .from('members')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'expired')
      .lt('updated_at', cutoffDate)
      .select('id, name');

    if (archiveError) {
      results.errors.push(`Failed to archive members: ${archiveError.message}`);
      console.error(`✗ ${results.errors[0]}`);
      return results;
    }

    results.totalArchived = archivedMembers?.length || 0;

    console.log(`✅ Archived ${results.totalArchived} member(s)`);
    archivedMembers?.forEach((member) => {
      console.log(`  - ${member.name}`);
    });
  } catch (error) {
    const errorMsg = `Fatal error in archiveOldMembers: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    console.error(errorMsg);
  }

  return results;
}
