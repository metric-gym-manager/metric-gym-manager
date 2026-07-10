/**
 * Gym Subscription Repository Interface (Port)
 *
 * Persists the SaaS subscription state that lives on the gyms row
 * (subscription_tier/status, PayHere ids, current_period_end, member_count).
 *
 * CRITICAL: no infrastructure details here (hexagonal port).
 */

import { Subscription } from '@/core/domain/subscription/Subscription';

export interface IGymSubscriptionRepository {
  /**
   * Load the subscription state for a gym.
   */
  findByGymId(gymId: string): Promise<Subscription | null>;

  /**
   * Resolve a gym by its PayHere subscription id (webhook attribution).
   */
  findByPayhereSubscriptionId(payhereSubscriptionId: string): Promise<Subscription | null>;

  /**
   * Persist tier/status/ids via the save_gym_subscription RPC (migration
   * 20260704000003). extendPeriod:true anchors current_period_end =
   * now() + 1 month ON THE DATABASE CLOCK — supabase-js .update() cannot
   * express SQL expressions, hence the RPC; JS date math is forbidden here.
   *
   * @returns The entity rebuilt with the RPC's returned current_period_end
   */
  save(sub: Subscription, opts: { extendPeriod: boolean }): Promise<Subscription>;

  /**
   * Set-based dunning pass, all decisions on the DB server clock:
   * 1. past_due beyond grace     -> suspended (tier preserved)
   * 2. canceled past period end  -> suspended (tier preserved)
   * No tier is ever written — there is no downgrade landing tier.
   * Members are NEVER touched.
   *
   * @returns Row counts per branch
   */
  runDunningSuspensions(): Promise<{ suspendedPastDue: number; suspendedCanceled: number }>;

  /**
   * Set-based trial-expiry pass on the DB server clock: gyms still trialing
   * past trial_ends_at become suspended (tier preserved). Members are NEVER
   * touched.
   *
   * @returns Number of gyms suspended
   */
  runTrialExpiry(): Promise<number>;
}
