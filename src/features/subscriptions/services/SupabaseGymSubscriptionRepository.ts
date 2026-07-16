/**
 * Supabase implementation of IGymSubscriptionRepository.
 *
 * Reads the subscription columns on the gyms row; writes go through the
 * save_gym_subscription RPC so current_period_end is always computed on the
 * DATABASE clock (migration 20260704000003 — supabase-js .update() cannot
 * express SQL expressions). Dunning suspensions and trial expiry likewise
 * run in SQL via process_dunning_suspensions / process_trial_expiry.
 *
 * Constructed with the service-role client in billing/webhook/cron paths;
 * the RPCs are EXECUTE-granted to service_role only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Subscription } from '@/features/subscriptions/domain/Subscription';
import type { IGymSubscriptionRepository } from '@/core/ports/repositories';
import {
  saasTierSchema,
  saasStatusSchema,
  GRACE_PERIOD_DAYS,
  RENEWAL_RETRY_INTERVAL_DAYS,
} from '@/features/subscriptions/config/SubscriptionConfig';
import { NotFoundError, DatabaseError } from '@/utils/errors';

interface GymSubscriptionRow {
  id: string;
  subscription_tier: string;
  subscription_status: string;
  member_count: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
  payhere_customer_id: string | null;
  payhere_subscription_id: string | null;
}

const SUBSCRIPTION_COLUMNS =
  'id, subscription_tier, subscription_status, member_count, current_period_end, trial_ends_at, payhere_customer_id, payhere_subscription_id';

export class SupabaseGymSubscriptionRepository implements IGymSubscriptionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private toDomain(row: GymSubscriptionRow): Subscription {
    return Subscription.create({
      gymId: row.id,
      tier: saasTierSchema.parse(row.subscription_tier),
      status: saasStatusSchema.parse(row.subscription_status),
      memberCount: row.member_count,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
      payhereCustomerId: row.payhere_customer_id,
      payhereSubscriptionId: row.payhere_subscription_id,
    });
  }

  async findByGymId(gymId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('gyms')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('id', gymId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to load subscription for gym: ${error.message}`);
    }
    return data ? this.toDomain(data as GymSubscriptionRow) : null;
  }

  async findByPayhereSubscriptionId(payhereSubscriptionId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('gyms')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('payhere_subscription_id', payhereSubscriptionId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to resolve subscription id: ${error.message}`);
    }
    return data ? this.toDomain(data as GymSubscriptionRow) : null;
  }

  async save(sub: Subscription, opts: { extendPeriod: boolean }): Promise<Subscription> {
    const props = sub.toProps();

    const { data, error } = await this.supabase.rpc('save_gym_subscription', {
      p_gym_id: props.gymId,
      p_tier: props.tier,
      p_status: props.status,
      p_payhere_subscription_id: props.payhereSubscriptionId,
      p_payhere_customer_id: props.payhereCustomerId,
      p_extend_period: opts.extendPeriod,
    });

    if (error) {
      if (error.message.includes('GYM_NOT_FOUND')) {
        throw new NotFoundError('Gym');
      }
      throw new DatabaseError(`Failed to save subscription: ${error.message}`);
    }

    // RPC returns the (possibly extended) current_period_end
    const periodEnd = data ? new Date(data as string) : null;
    return Subscription.create({ ...props, currentPeriodEnd: periodEnd });
  }

  async runDunningSuspensions(): Promise<{
    suspendedPastDue: number;
    suspendedCanceled: number;
  }> {
    const { data, error } = await this.supabase.rpc('process_dunning_suspensions', {
      p_grace_days: GRACE_PERIOD_DAYS,
    });

    if (error) {
      throw new DatabaseError(`Dunning suspension pass failed: ${error.message}`);
    }

    const row = Array.isArray(data) ? (data[0] as Record<string, number> | undefined) : undefined;
    return {
      suspendedPastDue: row?.suspended_past_due ?? 0,
      suspendedCanceled: row?.suspended_canceled ?? 0,
    };
  }

  async runTrialExpiry(): Promise<number> {
    const { data, error } = await this.supabase.rpc('process_trial_expiry');

    if (error) {
      throw new DatabaseError(`Trial expiry pass failed: ${error.message}`);
    }

    return typeof data === 'number' ? data : 0;
  }

  async findDueForCharge(now: Date, limit: number): Promise<Subscription[]> {
    const { data, error } = await this.supabase
      .from('gyms')
      .select(SUBSCRIPTION_COLUMNS)
      .in('subscription_status', ['active', 'past_due'])
      .not('payhere_customer_id', 'is', null)
      .lte('next_charge_at', now.toISOString())
      .order('next_charge_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new DatabaseError(`Failed to load gyms due for charge: ${error.message}`);
    }
    return (data ?? []).map((row) => this.toDomain(row as GymSubscriptionRow));
  }

  async scheduleChargeRetry(gymId: string): Promise<Date | null> {
    const { data, error } = await this.supabase.rpc('schedule_charge_retry', {
      p_gym_id: gymId,
      p_retry_interval_days: RENEWAL_RETRY_INTERVAL_DAYS,
      p_grace_days: GRACE_PERIOD_DAYS,
    });

    if (error) {
      throw new DatabaseError(`Failed to schedule charge retry: ${error.message}`);
    }
    return data ? new Date(data as string) : null;
  }
}
