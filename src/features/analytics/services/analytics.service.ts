/**
 * Member analytics read-model service.
 *
 * Fetches the gym's members and payments ONCE each (RLS-scoped to the tenant),
 * then delegates every calculation to the pure `computeMemberAnalytics`
 * aggregator. Deliberately avoids the per-period query loop the legacy revenue
 * service uses (no N+1): gym-scale data is small enough for a single in-memory
 * pass. Wire it via `services/factory.ts` (R7).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeMemberAnalytics } from '../utils/aggregate'
import type {
  AnalyticsRange,
  MemberAnalyticsResponse,
  MemberRecord,
  PaymentRecord,
} from '../types'

interface MemberRow {
  id: string
  status: string
  registered_date: string
  next_due_date: string
}

interface PaymentRow {
  member_id: string
  payment_date: string
  next_due_date_calculated: string
}

export class MemberAnalyticsService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getMemberAnalytics(
    gymId: string,
    range: AnalyticsRange,
    year: number
  ): Promise<MemberAnalyticsResponse> {
    // Gym creation bounds the MAX range (data since the gym started).
    const { data: gym, error: gymError } = await this.supabase
      .from('gyms')
      .select('created_at')
      .eq('id', gymId)
      .single()

    if (gymError || !gym) {
      throw new Error('Gym not found')
    }

    const [membersResult, paymentsResult] = await Promise.all([
      this.supabase
        .from('members')
        .select('id, status, registered_date, next_due_date')
        .eq('gym_id', gymId),
      this.supabase
        .from('payments')
        .select('member_id, payment_date, next_due_date_calculated')
        .eq('gym_id', gymId),
    ])

    if (membersResult.error) throw new Error(membersResult.error.message)
    if (paymentsResult.error) throw new Error(paymentsResult.error.message)

    const members: MemberRecord[] = (
      (membersResult.data ?? []) as MemberRow[]
    ).map((r) => ({
      id: r.id,
      status: r.status,
      registeredDate: r.registered_date,
      nextDueDate: r.next_due_date,
    }))

    const payments: PaymentRecord[] = (
      (paymentsResult.data ?? []) as PaymentRow[]
    ).map((r) => ({
      memberId: r.member_id,
      paymentDate: r.payment_date,
      coversUntil: r.next_due_date_calculated,
    }))

    const todayIso = new Date().toISOString().slice(0, 10)

    return computeMemberAnalytics(members, payments, {
      range,
      year,
      todayIso,
      gymCreatedIso: (gym as { created_at: string }).created_at,
    })
  }
}
