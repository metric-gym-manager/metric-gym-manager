/**
 * Change Plan Use Case (UC-6) — one-click tier change against the stored
 * card token (PayHere Charging API). No redirect, no card re-entry.
 *
 * Flow: validate the transition FIRST (an illegal state must never charge) →
 * insert a pending charge attempt (the ledger row that makes concurrent
 * charges impossible and lets the webhook recover a lost response) → charge
 * the token synchronously → on verified success persist the transition with
 * the credit-preserving period extension (save_gym_subscription GREATEST
 * rule, C-33): the customer pays the new tier's full month TODAY and every
 * unused day of the old period is banked onto the new one.
 *
 * Transition by current status:
 *   trialing            → convertTrialToPaid(target)   (trial conversion)
 *   active              → switchPlan(target)           (mid-cycle change)
 *   suspended|canceled  → activate(target)             (one-click reactivation)
 *   past_due            → rejected (the retry pipeline owns recovery; a
 *                         second charge path would race it — C-26)
 *
 * Ambiguous outcomes (transport fault, unverifiable response, gateway
 * "pending"): the attempt stays PENDING — no state change, the notify
 * webhook finalizes it, and the one-pending-per-gym gate blocks any second
 * charge until then (C-32).
 */

import type {
  IGymSubscriptionRepository,
  IChargeAttemptRepository,
  ISaasPaymentLogRepository,
} from '@/core/ports/repositories';
import type { ISubscriptionGateway } from '@/core/ports/services';
import { Subscription } from '@/features/subscriptions/domain/Subscription';
import {
  SaasTier,
  SaasStatus,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig';
import {
  ChargeFailedError,
  ConflictError,
  NoSavedCardError,
  NotFoundError,
} from '@/utils/errors';

export interface ChangePlanInput {
  gymId: string;
  targetTier: SaasTier;
}

export interface ChangePlanOutput {
  subscription: Subscription;
  /** 'applied' = charged + provisioned; 'pending_confirmation' = charge in flight, webhook will finalize. */
  outcome: 'applied' | 'pending_confirmation';
}

/** saas_payment_logs stores string payloads; charge responses arrive as JSON. */
const toStringRecord = (raw: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v == null ? '' : String(v)]));

export class ChangePlan {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly chargeAttemptRepo: IChargeAttemptRepository,
    private readonly subscriptionGateway: ISubscriptionGateway,
    private readonly paymentLogRepo: ISaasPaymentLogRepository,
    /** Per-tier monthly prices, injected from config by the DI container — the core never reads env */
    private readonly pricesLkr: Record<SaasTier, number>
  ) {}

  async execute(input: ChangePlanInput): Promise<ChangePlanOutput> {
    const sub = await this.subscriptionRepo.findByGymId(input.gymId);
    if (!sub) {
      throw new NotFoundError('Gym');
    }

    if (sub.isComplimentary()) {
      throw new ConflictError('Your subscription is managed by us');
    }
    if (sub.status === SaasStatus.PastDue) {
      throw new ConflictError('Resolve the outstanding payment before changing plans');
    }
    if (sub.status === SaasStatus.Active && sub.tier === input.targetTier) {
      throw new ConflictError('Already on this plan');
    }
    const customerToken = sub.payhereCustomerId;
    if (!customerToken) {
      // Legacy recurring or never-tokenized gym — the client falls back to
      // the full PayHere checkout (preapproval) on this code.
      throw new NoSavedCardError();
    }

    // Validate the transition BEFORE any money moves. Gateway ids are kept:
    // the same token keeps billing (subscriptionId stays null for token subs).
    const next = this.nextState(sub, input.targetTier);

    const amount = this.pricesLkr[input.targetTier];
    const orderId = `CHG-${input.gymId}-${Date.now()}`;

    // ConflictError propagates (409): another charge for this gym is in flight.
    await this.chargeAttemptRepo.createPending({
      orderId,
      gymId: input.gymId,
      kind: 'plan_change',
      targetTier: input.targetTier,
      expectedAmount: amount,
      currency: 'LKR',
    });

    // Transport faults throw ExternalServiceError (500): the outcome is
    // UNKNOWN, the attempt stays pending and the webhook/TTL resolves it.
    const charge = await this.subscriptionGateway.chargeCustomerToken({
      orderId,
      amount,
      currency: 'LKR',
      customerToken,
      items: `${TIER_DISPLAY_NAME[input.targetTier]} Plan — Monthly`,
      gymId: input.gymId,
    });

    if (charge.paymentId) {
      await this.paymentLogRepo.insertIfNew({
        gymId: input.gymId,
        orderId,
        payherePaymentId: charge.paymentId,
        payhereSubscriptionId: null,
        statusCode: charge.statusCode,
        signatureValid: charge.signatureValid,
        messageType: 'TOKEN_CHARGE',
        statusMessage: charge.statusMessage,
        rawPayload: toStringRecord(charge.rawPayload),
      });
    }

    if (charge.statusCode === 2 && charge.signatureValid) {
      const saved = await this.subscriptionRepo.save(next, { extendPeriod: true });
      await this.chargeAttemptRepo.markStatus(orderId, 'succeeded', charge.paymentId);
      return { subscription: saved, outcome: 'applied' };
    }

    if (charge.statusCode === 0 || (charge.statusCode === 2 && !charge.signatureValid)) {
      // Gateway-pending, or a success we cannot verify: no state change now;
      // the signed notify callback finalizes the attempt.
      return { subscription: sub, outcome: 'pending_confirmation' };
    }

    // Definite decline (-1/-2): current plan untouched, nothing was provisioned.
    await this.chargeAttemptRepo.markStatus(orderId, 'failed', charge.paymentId);
    throw new ChargeFailedError();
  }

  private nextState(sub: Subscription, targetTier: SaasTier): Subscription {
    const keepIds = { subscriptionId: null, customerId: null };
    switch (sub.status) {
      case SaasStatus.Trialing:
        return sub.convertTrialToPaid(targetTier, keepIds);
      case SaasStatus.Active:
        return sub.switchPlan(targetTier);
      case SaasStatus.Suspended:
      case SaasStatus.Canceled:
        return sub.activate(targetTier, keepIds);
      default:
        // past_due is rejected above; exhaustive for safety
        throw new ConflictError('Plan cannot be changed in the current billing state');
    }
  }
}
