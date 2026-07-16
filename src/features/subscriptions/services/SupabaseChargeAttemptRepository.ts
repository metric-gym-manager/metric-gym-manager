/**
 * Supabase implementation of IChargeAttemptRepository.
 *
 * The one-pending-per-gym invariant lives in the database (partial unique
 * index idx_charge_attempts_one_pending_per_gym); this repo translates the
 * 23505 unique violation into the domain ConflictError. Constructed with the
 * service-role client only (billing cron / billing routes / webhook).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IChargeAttemptRepository,
  ChargeAttempt,
  ChargeAttemptStatus,
} from '@/core/ports/repositories';
import { saasTierSchema } from '@/features/subscriptions/config/SubscriptionConfig';
import { ConflictError, DatabaseError } from '@/utils/errors';

interface ChargeAttemptRow {
  order_id: string;
  gym_id: string;
  kind: ChargeAttempt['kind'];
  target_tier: string;
  expected_amount: number | string;
  currency: string;
  status: ChargeAttemptStatus;
  payhere_payment_id: string | null;
  created_at: string;
}

const UNIQUE_VIOLATION = '23505';

export class SupabaseChargeAttemptRepository implements IChargeAttemptRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private toDomain(row: ChargeAttemptRow): ChargeAttempt {
    return {
      orderId: row.order_id,
      gymId: row.gym_id,
      kind: row.kind,
      targetTier: saasTierSchema.parse(row.target_tier),
      expectedAmount: Number(row.expected_amount),
      currency: row.currency,
      status: row.status,
      payherePaymentId: row.payhere_payment_id,
      createdAt: new Date(row.created_at),
    };
  }

  async createPending(
    attempt: Omit<ChargeAttempt, 'status' | 'payherePaymentId' | 'createdAt'>
  ): Promise<ChargeAttempt> {
    const { data, error } = await this.supabase
      .from('saas_charge_attempts')
      .insert({
        order_id: attempt.orderId,
        gym_id: attempt.gymId,
        kind: attempt.kind,
        target_tier: attempt.targetTier,
        expected_amount: attempt.expectedAmount,
        currency: attempt.currency,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError('A charge is already in progress for this gym');
      }
      throw new DatabaseError(`Failed to create charge attempt: ${error.message}`);
    }
    return this.toDomain(data as ChargeAttemptRow);
  }

  async findPendingByOrderId(orderId: string): Promise<ChargeAttempt | null> {
    const { data, error } = await this.supabase
      .from('saas_charge_attempts')
      .select()
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to load charge attempt: ${error.message}`);
    }
    return data ? this.toDomain(data as ChargeAttemptRow) : null;
  }

  async markStatus(
    orderId: string,
    status: Exclude<ChargeAttemptStatus, 'pending'>,
    payherePaymentId: string | null = null
  ): Promise<void> {
    const { error } = await this.supabase
      .from('saas_charge_attempts')
      .update({
        status,
        payhere_payment_id: payherePaymentId,
        resolved_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    if (error) {
      throw new DatabaseError(`Failed to update charge attempt: ${error.message}`);
    }
  }

  async expireStale(olderThan: Date): Promise<number> {
    const { data, error } = await this.supabase
      .from('saas_charge_attempts')
      .update({ status: 'expired', resolved_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('created_at', olderThan.toISOString())
      .select('order_id');

    if (error) {
      throw new DatabaseError(`Failed to expire stale charge attempts: ${error.message}`);
    }
    return data?.length ?? 0;
  }
}
