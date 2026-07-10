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
 * while the row still reads active|past_due.
 *
 * After the local canceled write, the tier stays paid-through until
 * current_period_end; the dunning cron then SUSPENDS (tier preserved).
 */

import type { IGymSubscriptionRepository } from '@/core/ports/repositories';
import type { ISubscriptionGateway } from '@/core/ports/services';
import { Subscription } from '@/core/domain/subscription/Subscription';
import { SaasStatus } from '@/core/utils/constants/SubscriptionConfig';
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

    // trialing/suspended: nothing live is charging at the gateway — there is
    // no recurring subscription to stop.
    if (sub.status === SaasStatus.Trialing || sub.status === SaasStatus.Suspended) {
      throw new ConflictError('No active subscription to cancel');
    }

    if (sub.isComplimentary()) {
      // Lifetime/complimentary subscriptions are managed by the platform —
      // there is no gateway subscription to stop and nothing to cancel.
      throw new ConflictError('Your subscription is managed by us — there is nothing to cancel');
    }

    if (sub.status === SaasStatus.Canceled) {
      return sub; // idempotent: a retried cancel is not an error
    }

    if (!sub.payhereSubscriptionId) {
      // A billed subscription without a gateway id is a data inconsistency —
      // surface it rather than silently cancel locally while an unknown
      // gateway sub may charge.
      throw new ConflictError('No payment gateway subscription on record — contact support');
    }

    // Gateway FIRST; throws ExternalServiceError on failure (local state untouched)
    await this.subscriptionGateway.cancelSubscription(sub.payhereSubscriptionId);

    return this.subscriptionRepo.save(sub.cancelPaid(), { extendPeriod: false });
  }
}
