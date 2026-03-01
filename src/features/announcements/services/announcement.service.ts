import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Announcement } from '../types';
import type { CreateAnnouncementInput } from '../schemas/announcement.schemas';
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service';

// ============================================================
// GET ANNOUNCEMENTS
// ============================================================

export async function getAnnouncements(gymId: string): Promise<Announcement[]> {
  const supabase = await createClient();

  const { data: announcements, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('gym_id', gymId)
    .order('sent_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch announcements: ${error.message}`);
  }

  return (announcements || []) as Announcement[];
}

// ============================================================
// CREATE AND SEND ANNOUNCEMENT (OPTIMIZED)
// ============================================================

export async function createAndSendAnnouncement(
  gymId: string,
  input: CreateAnnouncementInput
): Promise<{
  announcement: Announcement;
  recipientCount: number;
}> {
  const supabase = createAdminClient();

  // Get gym name for message personalization
  const { data: gym } = await supabase
    .from('gyms')
    .select('gym_name')
    .eq('id', gymId)
    .single();

  const gymName = gym?.gym_name || 'your gym';

  // Get all active and expired members for this gym
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name, phone_number')
    .eq('gym_id', gymId)
    .in('status', ['active', 'expired']);

  if (membersError) {
    throw new Error(`Failed to fetch members: ${membersError.message}`);
  }

  if (!members || members.length === 0) {
    throw new Error('No active or expired members found to send announcement to');
  }

  // Create announcement record
  const { data: announcement, error: announcementError } = await supabase
    .from('announcements')
    .insert({
      gym_id: gymId,
      message: input.message,
      recipient_count: members.length,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (announcementError || !announcement) {
    throw new Error(`Failed to create announcement: ${announcementError?.message}`);
  }

  // Fire-and-forget: Send SMS in background (non-blocking)
  // This allows the API to return immediately
  sendAnnouncementSmsInBackground(gymId, gymName, input.message, members).catch((error) => {
    console.error('Background SMS sending error:', error);
  });

  // Return immediately - SMS sending happens in background
  return {
    announcement: announcement as Announcement,
    recipientCount: members.length,
  };
}

// ============================================================
// SEND ANNOUNCEMENT SMS IN BACKGROUND (PARALLEL BATCHES)
// ============================================================

async function sendAnnouncementSmsInBackground(
  gymId: string,
  gymName: string,
  message: string,
  members: Array<{ id: string; name: string; phone_number: string }>
): Promise<void> {
  const supabase = createAdminClient();
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true';
  const messageBody = `${message}\n- ${gymName}`;

  // Find the announcement record
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id')
    .eq('gym_id', gymId)
    .eq('message', message)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!announcement) {
    console.error('Announcement not found for tracking');
    return;
  }

  const announcementId = announcement.id;

  // Update status to 'sending'
  await supabase
    .from('announcements')
    .update({ status: 'sending' })
    .eq('id', announcementId);

  console.log(`📱 [ANNOUNCEMENT] Starting parallel batch sending to ${members.length} members`);
  const startTime = Date.now();

  // Process in parallel batches of 50 for optimal performance
  const BATCH_SIZE = 50;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);
    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(members.length / BATCH_SIZE)} (${batch.length} members)`);

    // Send all SMS in this batch in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      batch.map(async (member) => {
        try {
          if (useRealSms) {
            const result = await sendSmsViaTextLk({
              to: member.phone_number,
              message: messageBody,
            });

            // Log to database (fire-and-forget, don't await)
            void supabase.from('sms_logs').insert({
              member_id: member.id,
              gym_id: gymId,
              sms_type: 'welcome',
              phone_number: member.phone_number,
              message_body: messageBody,
              sent_at: new Date().toISOString(),
              delivery_status: result.success ? 'sent' : 'failed',
              text_lk_message_id: result.message_id || null,
            });

            if (!result.success) {
              throw new Error(result.error || 'Failed to send');
            }

            return { success: true, member };
          } else {
            // Mock SMS - log to database
            void supabase.from('sms_logs').insert({
              member_id: member.id,
              gym_id: gymId,
              sms_type: 'welcome',
              phone_number: member.phone_number,
              message_body: messageBody,
              sent_at: new Date().toISOString(),
              delivery_status: 'sent',
            });

            return { success: true, member };
          }
        } catch (error) {
          return { success: false, member, error };
        }
      })
    );

    // Process results and track failures
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failureCount++;

        // Track failure in database
        const member = result.status === 'fulfilled' ? result.value.member : null;
        const error = result.status === 'fulfilled' ? result.value.error : result.reason;

        if (member) {
          // Get current failures
          const { data: currentAnnouncement } = await supabase
            .from('announcements')
            .select('session_failures')
            .eq('id', announcementId)
            .single();

          const failures = (currentAnnouncement?.session_failures || []) as any[];

          // Add new failure to the array
          failures.push({
            id: `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            member_id: member.id,
            phone_number: member.phone_number,
            retry_count: 0,
            last_error: error instanceof Error ? error.message : String(error),
            last_attempt_at: new Date().toISOString(),
          });

          // Update session_failures
          await supabase
            .from('announcements')
            .update({ session_failures: failures })
            .eq('id', announcementId);

          console.error(`Failed to send to ${member.name}:`, error);
        }
      }
    }

    // Update progress in database
    await supabase
      .from('announcements')
      .update({
        sent_count: successCount,
        failed_count: failureCount,
      })
      .eq('id', announcementId);

    console.log(`✓ Batch complete: ${successCount + failureCount}/${members.length} processed so far`);
  }

  const duration = Date.now() - startTime;

  // Update final status
  await supabase
    .from('announcements')
    .update({
      status: failureCount === members.length ? 'failed' : 'completed',
      sent_count: successCount,
      failed_count: failureCount,
    })
    .eq('id', announcementId);

  console.log(`✅ Announcement complete: ${successCount} sent, ${failureCount} failed in ${duration}ms (${Math.round(members.length / (duration / 1000))} SMS/sec)`);
}

// ============================================================
// RETRY FAILED ANNOUNCEMENTS (MAX 3 ATTEMPTS)
// ============================================================

export async function retryFailedAnnouncements(
  announcementId: string
): Promise<{
  success: boolean;
  retriedCount: number;
  successCount: number;
  failedCount: number;
  maxAttemptsReached: number;
}> {
  const supabase = createAdminClient();
  const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

  // Get announcement details
  const { data: announcement, error: announcementError } = await supabase
    .from('announcements')
    .select('gym_id, message')
    .eq('id', announcementId)
    .single();

  if (announcementError || !announcement) {
    throw new Error('Announcement not found');
  }

  // Get gym name for message personalization
  const { data: gym } = await supabase
    .from('gyms')
    .select('gym_name')
    .eq('id', announcement.gym_id)
    .single();

  const gymName = gym?.gym_name || 'your gym';
  const messageBody = `${announcement.message}\n- ${gymName}`;

  // Get session failures from the announcement
  const { data: announcementData, error: failuresError } = await supabase
    .from('announcements')
    .select('session_failures')
    .eq('id', announcementId)
    .single();

  if (failuresError) {
    throw new Error(`Failed to fetch failures: ${failuresError.message}`);
  }

  const allFailures = (announcementData?.session_failures || []) as any[];
  const failures = allFailures.filter((f) => f.retry_count < 3);

  if (failures.length === 0) {
    return {
      success: true,
      retriedCount: 0,
      successCount: 0,
      failedCount: 0,
      maxAttemptsReached: allFailures.filter((f) => f.retry_count >= 3).length,
    };
  }

  console.log(`🔄 [RETRY] Retrying ${failures.length} failed SMS for announcement ${announcementId}`);

  const BATCH_SIZE = 50;
  let successCount = 0;
  let failedCount = 0;

  // Process retries in parallel batches
  for (let i = 0; i < failures.length; i += BATCH_SIZE) {
    const batch = failures.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (failure) => {
        try {
          if (useRealSms) {
            const result = await sendSmsViaTextLk({
              to: failure.phone_number,
              message: messageBody,
            });

            if (!result.success) {
              throw new Error(result.error || 'Failed to send');
            }

            // Log success
            void supabase.from('sms_logs').insert({
              member_id: failure.member_id,
              gym_id: announcement.gym_id,
              sms_type: 'welcome',
              phone_number: failure.phone_number,
              message_body: messageBody,
              sent_at: new Date().toISOString(),
              delivery_status: 'sent',
              text_lk_message_id: result.message_id || null,
            });

            return { success: true, failure };
          } else {
            // Mock SMS - log to database
            void supabase.from('sms_logs').insert({
              member_id: failure.member_id,
              gym_id: announcement.gym_id,
              sms_type: 'welcome',
              phone_number: failure.phone_number,
              message_body: messageBody,
              sent_at: new Date().toISOString(),
              delivery_status: 'sent',
            });

            return { success: true, failure };
          }
        } catch (error) {
          return { success: false, failure, error };
        }
      })
    );

    // Process results and update session_failures
    const successfulFailureIds: string[] = [];
    const updatedFailures: any[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        successfulFailureIds.push(result.value.failure.id);
        console.log(`✓ Retry successful for ${result.value.failure.phone_number}`);
      } else {
        failedCount++;

        const failure = result.status === 'fulfilled' ? result.value.failure : null;
        const error = result.status === 'fulfilled' ? result.value.error : result.reason;

        if (failure) {
          const newRetryCount = (failure.retry_count || 0) + 1;
          updatedFailures.push({
            ...failure,
            retry_count: newRetryCount,
            last_error: error instanceof Error ? error.message : String(error),
            last_attempt_at: new Date().toISOString(),
          });
          console.error(`✗ Retry failed for ${failure.phone_number} (attempt ${newRetryCount}/3):`, error);
        }
      }
    }

    // Get current session_failures
    const { data: currentAnnouncement } = await supabase
      .from('announcements')
      .select('session_failures')
      .eq('id', announcementId)
      .single();

    let updatedSessionFailures = (currentAnnouncement?.session_failures || []) as any[];

    // Remove successful failures
    updatedSessionFailures = updatedSessionFailures.filter(
      (f) => !successfulFailureIds.includes(f.id)
    );

    // Update failed attempts
    updatedSessionFailures = updatedSessionFailures.map((f) => {
      const updated = updatedFailures.find((uf) => uf.id === f.id);
      return updated || f;
    });

    // Update session_failures in database
    await supabase
      .from('announcements')
      .update({ session_failures: updatedSessionFailures })
      .eq('id', announcementId);
  }

  // Update announcement counts
  const { data: currentAnnouncement } = await supabase
    .from('announcements')
    .select('sent_count, failed_count')
    .eq('id', announcementId)
    .single();

  const newSentCount = (currentAnnouncement?.sent_count || 0) + successCount;
  const newFailedCount = (currentAnnouncement?.failed_count || 0) - successCount + failedCount;

  await supabase
    .from('announcements')
    .update({
      sent_count: newSentCount,
      failed_count: newFailedCount,
    })
    .eq('id', announcementId);

  // Count how many failures have reached max attempts from updated session_failures
  const { data: finalAnnouncement } = await supabase
    .from('announcements')
    .select('session_failures')
    .eq('id', announcementId)
    .single();

  const finalFailures = (finalAnnouncement?.session_failures || []) as any[];
  const maxAttemptsCount = finalFailures.filter((f) => f.retry_count >= 3).length;

  console.log(`🔄 [RETRY] Complete: ${successCount} succeeded, ${failedCount} failed, ${maxAttemptsCount} reached max attempts`);

  return {
    success: true,
    retriedCount: failures.length,
    successCount,
    failedCount,
    maxAttemptsReached: maxAttemptsCount || 0,
  };
}

// ============================================================
// CLEAR SESSION FAILURES (FOR CLEANUP)
// ============================================================

export async function clearSessionFailures(announcementId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('announcements')
    .update({ session_failures: [] })
    .eq('id', announcementId);

  console.log(`🧹 [CLEANUP] Cleared session failures for announcement ${announcementId}`);
}
