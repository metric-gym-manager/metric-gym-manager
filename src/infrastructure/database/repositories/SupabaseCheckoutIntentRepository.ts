/**
 * Supabase implementation of ICheckoutIntentRepository.
 *
 * The one-pending-per-gym invariant lives in the database (partial unique
 * index idx_checkout_intents_one_pending_per_gym); this repo translates the
 * 23505 unique violation into the domain ConflictError.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ICheckoutIntentRepository,
  CheckoutIntent,
} from '@/core/ports/repositories';
import { saasTierSchema } from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError, DatabaseError } from '@/utils/errors';

interface CheckoutIntentRow {
  order_id: string;
  gym_id: string;
  target_tier: string;
  expected_amount: number | string;
  currency: string;
  status: CheckoutIntent['status'];
  expires_at: string;
}

const UNIQUE_VIOLATION = '23505';

export class SupabaseCheckoutIntentRepository implements ICheckoutIntentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private toDomain(row: CheckoutIntentRow): CheckoutIntent {
    return {
      orderId: row.order_id,
      gymId: row.gym_id,
      targetTier: saasTierSchema.parse(row.target_tier),
      expectedAmount: Number(row.expected_amount),
      currency: row.currency,
      status: row.status,
      expiresAt: new Date(row.expires_at),
    };
  }

  async createPending(intent: Omit<CheckoutIntent, 'status'>): Promise<CheckoutIntent> {
    const { data, error } = await this.supabase
      .from('checkout_intents')
      .insert({
        order_id: intent.orderId,
        gym_id: intent.gymId,
        target_tier: intent.targetTier,
        expected_amount: intent.expectedAmount,
        currency: intent.currency,
        status: 'pending',
        expires_at: intent.expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError('A checkout is already in progress for this gym');
      }
      throw new DatabaseError(`Failed to create checkout intent: ${error.message}`);
    }
    return this.toDomain(data as CheckoutIntentRow);
  }

  async findPendingByOrderId(orderId: string): Promise<CheckoutIntent | null> {
    const { data, error } = await this.supabase
      .from('checkout_intents')
      .select()
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to load checkout intent: ${error.message}`);
    }
    return data ? this.toDomain(data as CheckoutIntentRow) : null;
  }

  async markStatus(orderId: string, status: CheckoutIntent['status']): Promise<void> {
    const { error } = await this.supabase
      .from('checkout_intents')
      .update({ status })
      .eq('order_id', orderId);

    if (error) {
      throw new DatabaseError(`Failed to update checkout intent: ${error.message}`);
    }
  }

  async expireStale(now: Date): Promise<number> {
    const { data, error } = await this.supabase
      .from('checkout_intents')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', now.toISOString())
      .select('order_id');

    if (error) {
      throw new DatabaseError(`Failed to expire stale checkout intents: ${error.message}`);
    }
    return data?.length ?? 0;
  }
}
