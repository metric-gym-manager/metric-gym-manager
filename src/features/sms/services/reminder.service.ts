import { createClient } from '@/lib/supabase/server';
import { sendSMS } from './sms.service';
import type { SMSType } from '../types';

// ============================================================
// SEND AUTOMATED REMINDERS
// ============================================================

export async function sendAutomatedReminders(): Promise<{
  totalSent: number;
  byType: Record<SMSType, number>;
  errors: string[];
}> {
  const supabase = await createClient();

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
    // Get all gyms
    const { data: gyms, error: gymsError } = await supabase
      .from('gyms')
      .select('id, gym_name');

    if (gymsError) {
      results.errors.push(`Failed to fetch gyms: ${gymsError.message}`);
      return results;
    }

    if (!gyms || gyms.length === 0) {
      console.log('No gyms found to process');
      return results;
    }

    console.log(`📅 Processing ${gyms.length} gym(s) for automated reminders...`);

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
  const supabase = await createClient();

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
  const { data: members, error } = await supabase
    .from('members')
    .select('id, name, phone_number, next_due_date')
    .eq('gym_id', gymId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  if (!members || members.length === 0) {
    console.log(`  No active members for gym ${gymId}`);
    return results;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Process each member
  for (const member of members) {
    const dueDate = new Date(member.next_due_date);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let smsType: SMSType | null = null;

    // Determine SMS type based on days until due
    if (daysUntilDue === 7) {
      smsType = 'reminder_7day';
    } else if (daysUntilDue === 3) {
      smsType = 'reminder_3day';
    } else if (daysUntilDue === 0) {
      smsType = 'due_today';
    } else if (daysUntilDue < 0) {
      smsType = 'overdue';
    }

    // Send SMS if applicable
    if (smsType) {
      try {
        await sendSMS(gymId, member.id, smsType);
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
  const supabase = await createClient();

  const results = {
    totalUpdated: 0,
    errors: [] as string[],
  };

  try {
    console.log('🔄 Checking for expired members...');

    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

    // Update all active members whose next_due_date is more than 7 days in the past
    const { data: updatedMembers, error } = await supabase
      .from('members')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'active')
      .lt('next_due_date', cutoffDate)
      .select('id, name');

    if (error) {
      results.errors.push(`Failed to update expired members: ${error.message}`);
      console.error(`✗ ${results.errors[0]}`);
      return results;
    }

    results.totalUpdated = updatedMembers?.length || 0;

    if (results.totalUpdated > 0) {
      console.log(`✅ Updated ${results.totalUpdated} member(s) to expired status`);
      updatedMembers?.forEach((member) => {
        console.log(`  - ${member.name}`);
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
// ARCHIVE OLD MEMBERS
// ============================================================

export async function archiveOldMembers(): Promise<{
  totalArchived: number;
  errors: string[];
}> {
  const supabase = await createClient();

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
