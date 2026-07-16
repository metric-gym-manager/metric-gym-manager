/**
 * Charge Attempt Repository Interface (Port)
 *
 * Ledger of server-initiated PayHere token charges (renewals and plan
 * changes). A pending row is inserted BEFORE the REST charge call: it is the
 * webhook's order_id -> gym resolver for late/lost responses, the
 * timeout-ambiguity record, and (via a one-pending-per-gym partial unique
 * index) the gate that makes concurrent charges for one gym impossible.
 */

import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig';

export type ChargeAttemptKind = 'renewal' | 'plan_change';
export type ChargeAttemptStatus = 'pending' | 'succeeded' | 'failed' | 'expired';

export interface ChargeAttempt {
  orderId: string;
  gymId: string;
  kind: ChargeAttemptKind;
  /** Tier being paid for (renewal: current tier; plan_change: the target). */
  targetTier: SaasTier;
  expectedAmount: number;
  currency: string;
  status: ChargeAttemptStatus;
  payherePaymentId: string | null;
  createdAt: Date;
}

export interface IChargeAttemptRepository {
  /**
   * Insert a pending attempt.
   *
   * @throws ConflictError on the one-pending-per-gym partial unique index
   *         (23505) — another charge for this gym is already in flight
   */
  createPending(
    attempt: Omit<ChargeAttempt, 'status' | 'payherePaymentId' | 'createdAt'>
  ): Promise<ChargeAttempt>;

  /**
   * Find a still-pending attempt by its order id (webhook resolution of
   * late/lost charge responses).
   */
  findPendingByOrderId(orderId: string): Promise<ChargeAttempt | null>;

  /**
   * Move an attempt to a terminal status, recording the gateway payment id
   * when one was returned.
   */
  markStatus(
    orderId: string,
    status: Exclude<ChargeAttemptStatus, 'pending'>,
    payherePaymentId?: string | null
  ): Promise<void>;

  /**
   * Expire pending attempts older than the TTL (ambiguous outcomes — the
   * synchronous response was lost and no webhook arrived). Frees the
   * one-pending-per-gym gate so the schedule can try again.
   *
   * @returns Number of attempts expired
   */
  expireStale(olderThan: Date): Promise<number>;
}
