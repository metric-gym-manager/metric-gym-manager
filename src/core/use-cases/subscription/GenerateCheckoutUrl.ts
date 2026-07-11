/**
 * Generate Checkout URL Use Case (UC-1)
 *
 * Creates a pending checkout intent (the webhook's order_id -> gym resolver)
 * and assembles the PayHere PREAPPROVAL redirect: the customer authorizes
 * their card on PayHere, the first month's tier price is captured alongside,
 * and the notification returns the reusable customer_token that powers all
 * subsequent server-initiated charges. Every tier is paid and checkoutable.
 *
 * Needed only when no valid saved card exists (first purchase, or after a
 * token invalidates) — gyms with a stored token change/reactivate plans
 * one-click via ChangePlan instead.
 *
 * Concurrency: the one-pending-per-gym partial unique index makes a second
 * concurrent call fail with ConflictError — propagate it (route maps to 409).
 */

import type {
  IGymSubscriptionRepository,
  ICheckoutIntentRepository,
} from '@/core/ports/repositories';
import type { IPaymentGateway, CheckoutCustomer, CheckoutRedirect } from '@/core/ports/services';
import {
  SaasStatus,
  SaasTier,
  CHECKOUT_INTENT_TTL_MINUTES,
} from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError, NotFoundError } from '@/core/utils/errors';

export interface GenerateCheckoutUrlInput {
  gymId: string;
  /** Which tier the gym is buying. Priced server-side — never a request amount. */
  targetTier: SaasTier;
  customer: CheckoutCustomer;
}

export interface GenerateCheckoutUrlOutput extends CheckoutRedirect {
  orderId: string;
}

export class GenerateCheckoutUrl {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly checkoutIntentRepo: ICheckoutIntentRepository,
    private readonly paymentGateway: IPaymentGateway,
    /** Per-tier monthly prices, injected from config by the DI container — the core never reads env */
    private readonly pricesLkr: Record<SaasTier, number>
  ) {}

  async execute(input: GenerateCheckoutUrlInput): Promise<GenerateCheckoutUrlOutput> {
    const sub = await this.subscriptionRepo.findByGymId(input.gymId);
    if (!sub) {
      throw new NotFoundError('Gym');
    }

    // Complimentary (lifetime) subscriptions are platform-managed: no
    // self-service checkout may replace or double-bill them.
    if (sub.isComplimentary()) {
      throw new ConflictError('Your subscription is managed by us');
    }

    // active: already subscribed — a plan change requires cancelling the
    // current gateway subscription first (PayHere has no in-place swap).
    // past_due: recovery arrives via PayHere retry on the EXISTING
    // subscription — a second checkout would double-bill under two
    // subscription ids. trialing/suspended/canceled may proceed (trial
    // conversion, reactivation, re-subscription).
    if (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue) {
      throw new ConflictError('Already subscribed');
    }

    const amount = this.pricesLkr[input.targetTier];
    const orderId = `SUB-${input.gymId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + CHECKOUT_INTENT_TTL_MINUTES * 60 * 1000);

    await this.checkoutIntentRepo.createPending({
      orderId,
      gymId: input.gymId,
      targetTier: input.targetTier,
      expectedAmount: amount,
      currency: 'LKR',
      expiresAt,
    });

    const redirect = this.paymentGateway.buildPreapprovalRedirect({
      orderId,
      amount,
      currency: 'LKR',
      tier: input.targetTier,
      gymId: input.gymId,
      customer: input.customer,
    });

    return { ...redirect, orderId };
  }
}
