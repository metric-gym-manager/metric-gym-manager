/**
 * Generate Checkout URL Use Case (UC-1)
 *
 * Creates a pending checkout intent (the webhook's order_id -> gym resolver)
 * and assembles the PayHere recurring-checkout redirect.
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
  CHECKOUT_INTENT_TTL_MINUTES,
  isPaidTier,
  type PaidTier,
} from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError, NotFoundError } from '@/core/utils/errors';

export interface GenerateCheckoutUrlInput {
  gymId: string;
  /** Which paid tier the gym is buying. Priced server-side — never a request amount. */
  targetTier: PaidTier;
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
    private readonly pricesLkr: Record<PaidTier, number>
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

    // {paid}/active: already subscribed — a plan change requires cancelling
    // the current gateway subscription first (PayHere has no in-place swap).
    // {paid}/past_due: recovery arrives via PayHere retry on the EXISTING
    // subscription — a second checkout would double-bill under two
    // subscription ids. {paid}/canceled and starter/* may proceed.
    if (
      isPaidTier(sub.tier) &&
      (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue)
    ) {
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

    const redirect = this.paymentGateway.buildCheckoutRedirect({
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
