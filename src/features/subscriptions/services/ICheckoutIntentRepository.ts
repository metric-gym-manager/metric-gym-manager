/**
 * Checkout Intent Repository Interface (Port)
 *
 * Pending PayHere checkout attribution: the webhook resolves order_id -> gym
 * through these rows. At most one pending intent per gym (enforced by a
 * partial unique index; concurrent double-checkout surfaces as ConflictError).
 */

import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig';

export interface CheckoutIntent {
  orderId: string;
  gymId: string;
  targetTier: SaasTier;
  expectedAmount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  expiresAt: Date;
}

export interface ICheckoutIntentRepository {
  /**
   * Create a pending intent.
   *
   * @throws ConflictError on the one-pending-per-gym partial unique index (23505)
   */
  createPending(intent: Omit<CheckoutIntent, 'status'>): Promise<CheckoutIntent>;

  /**
   * Find a still-pending intent by its order id (webhook resolution).
   */
  findPendingByOrderId(orderId: string): Promise<CheckoutIntent | null>;

  /**
   * Move an intent to a terminal status.
   */
  markStatus(orderId: string, status: CheckoutIntent['status']): Promise<void>;

  /**
   * Expire pending intents whose expires_at has passed.
   *
   * @returns Number of intents expired
   */
  expireStale(now: Date): Promise<number>;
}
