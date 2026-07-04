/**
 * Cancel Subscription Use Case (UC-4)
 *
 * Gateway-first ordering is the invariant: PayHere is told to stop charging
 * BEFORE any local write. If the gateway call throws, local state is
 * untouched and the user retries; the inverse order could stop billing
 * locally while PayHere keeps charging the card.
 *
 * The gateway-success -> local-write window is safe (plan C-21 window
 * analysis): a RECURRING_STOPPED for the current id in that window is the
 * intended reconciliation and converges idempotently, and no replacement
 * subscription can be created inside it because GenerateCheckoutUrl rejects
 * while the row still reads pro/active|past_due.
 */

import type { IGymSubscriptionRepository } from '@/core/ports/repositories';
import type { ISubscriptionGateway } from '@/core/ports/services';
import { Subscription } from '@/core/domain/subscription/Subscription';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError, NotFoundError } from '@/core/utils/errors';

export class CancelSubscription {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly subscriptionGateway: ISubscriptionGateway
  ) {}

  async execute(input: { gymId: string }): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findByGymId(input.gymId);
    if (!sub) {
      throw new NotFoundError('Gym');
    }

    if (sub.tier !== SaasTier.Pro) {
      throw new ConflictError('No active subscription to cancel');
    }

    if (sub.status === SaasStatus.Canceled) {
      return sub; // idempotent: a retried cancel is not an error
    }

    if (!sub.payhereSubscriptionId) {
      // Pro without a gateway id is a data inconsistency — surface it rather
      // than silently cancel locally while an unknown gateway sub may charge.
      throw new ConflictError('No payment gateway subscription on record — contact support');
    }

    // Gateway FIRST; throws ExternalServiceError on failure (local state untouched)
    await this.subscriptionGateway.cancelSubscription(sub.payhereSubscriptionId);

    return this.subscriptionRepo.save(sub.cancelPro(), { extendPeriod: false });
  }
}
