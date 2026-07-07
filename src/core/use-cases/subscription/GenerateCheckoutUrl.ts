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
  SaasTier,
  SaasStatus,
  CHECKOUT_INTENT_TTL_MINUTES,
} from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError, NotFoundError } from '@/core/utils/errors';

export interface GenerateCheckoutUrlInput {
  gymId: string;
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
    /** Injected from config by the DI container — the core never reads env */
    private readonly proPriceLkr: number
  ) {}

  async execute(input: GenerateCheckoutUrlInput): Promise<GenerateCheckoutUrlOutput> {
    const sub = await this.subscriptionRepo.findByGymId(input.gymId);
    if (!sub) {
      throw new NotFoundError('Gym');
    }

    // pro/active: already subscribed. pro/past_due: recovery arrives via
    // PayHere retry on the EXISTING subscription — a second checkout would
    // double-bill under two subscription ids. pro/canceled and free/* may proceed.
    if (
      sub.tier === SaasTier.Growth &&
      (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue)
    ) {
      throw new ConflictError('Already subscribed');
    }

    const orderId = `SUB-${input.gymId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + CHECKOUT_INTENT_TTL_MINUTES * 60 * 1000);

    await this.checkoutIntentRepo.createPending({
      orderId,
      gymId: input.gymId,
      targetTier: SaasTier.Growth,
      expectedAmount: this.proPriceLkr,
      currency: 'LKR',
      expiresAt,
    });

    const redirect = this.paymentGateway.buildCheckoutRedirect({
      orderId,
      amount: this.proPriceLkr,
      currency: 'LKR',
      gymId: input.gymId,
      customer: input.customer,
    });

    return { ...redirect, orderId };
  }
}
