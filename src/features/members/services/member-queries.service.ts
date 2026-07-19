/**
 * Member read-model queries (server-side).
 *
 * Query text extracted verbatim from the API routes that previously inlined
 * it; response shapes are owned by the routes and unchanged.
 */

import { createClient } from '@/lib/supabase/server';

export interface MemberSuggestion {
  id: string;
  name: string;
  phone_number: string;
  photo_path: string | null;
  photo_updated_at: string | null;
}

/** Typeahead search over the gym's members by name or phone (max 8). */
export async function searchMemberSuggestions(
  gymId: string,
  q: string
): Promise<MemberSuggestion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('members')
    .select('id, name, phone_number, photo_path, photo_updated_at')
    .eq('gym_id', gymId)
    .or(`name.ilike.%${q}%,phone_number.ilike.%${q}%`)
    .limit(8);

  if (error) throw error;

  return (data ?? []) as MemberSuggestion[];
}

export interface MemberDetail {
  member: Record<string, unknown>;
  payments: Record<string, unknown>[];
}

/**
 * Member row (with joined discount) + full payment history,
 * both queries running in parallel. Returns null when the member
 * does not exist in the caller's gym.
 */
export async function getMemberDetail(
  gymId: string,
  memberId: string
): Promise<MemberDetail | null> {
  const supabase = await createClient();

  const [memberResult, paymentsResult] = await Promise.all([
    supabase
      .from('members')
      .select('*, discount:discounts(id, discount_name, discount_percentage)')
      .eq('id', memberId)
      .eq('gym_id', gymId)
      .single(),

    supabase
      .from('payments')
      .select('*')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .order('payment_date', { ascending: false }),
  ]);

  if (memberResult.error || !memberResult.data) {
    return null;
  }

  return {
    member: memberResult.data,
    payments: paymentsResult.data ?? [],
  };
}
