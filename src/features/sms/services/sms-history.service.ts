/**
 * Member SMS history (server-side read model).
 *
 * Query text extracted verbatim from api/members/[id]/sms-history.
 * error_message is deliberately excluded from the log selection so technical
 * infrastructure details are never exposed to gym managers (rule 2.8).
 */

import { createClient } from '@/lib/supabase/server';

export type MemberSmsHistoryResult =
  | { status: 'member_not_found' }
  | { status: 'logs_error' }
  | {
      status: 'ok';
      member: Record<string, unknown>;
      smsLogs: Record<string, unknown>[];
      totalCount: number;
    };

export async function getMemberSmsHistory(
  gymId: string,
  memberId: string
): Promise<MemberSmsHistoryResult> {
  const supabase = await createClient();

  // Verify member belongs to gym and get plan details for grouping
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, name, phone_number, plan_type, membership_start_date, next_due_date')
    .eq('id', memberId)
    .eq('gym_id', gymId)
    .single();

  if (memberError || !member) {
    return { status: 'member_not_found' };
  }

  // Fetch SMS logs for this member, ordered by most recent first
  const { data: smsLogs, error: logsError } = await supabase
    .from('sms_logs')
    .select('id, sms_type, phone_number, message_body, sent_at, delivery_status, text_lk_message_id, created_at')
    .eq('member_id', memberId)
    .eq('gym_id', gymId)
    .order('sent_at', { ascending: false });

  if (logsError) {
    console.error('Fetch SMS logs error:', logsError);
    return { status: 'logs_error' };
  }

  return {
    status: 'ok',
    member,
    smsLogs: smsLogs || [],
    totalCount: smsLogs?.length || 0,
  };
}
