/**
 * Cancel Subscription Use Case (UC-4)
 *
 * TOKEN-BILLED subscriptions (stored card, no gateway-side schedule): the
 * local write IS the cancellation — this application initiates every charge,
 * so setting `canceled` (which clears next_charge_at in the save RPC) stops
 * billing authoritatively. Nothing to call at PayHere; the saved card token
 * is retained for one-click re-subscription.
 *
 * LEGACY recurring subscriptions keep the gateway-first invariant: PayHere
 * is told to stop charging BEFORE any local write. If the gateway call
 * throws, local state is untouched and the user retries; the inverse order
 * could stop billing locally while PayHere keeps charging the card. The
 * gateway-success -> local-write window is safe (plan C-21 window analysis).
 *
 * After the local canceled write, the tier stays paid-through until
 * current_period_end; the dunning cron then SUSPENDS (tier preserved).
 */

import type { IGymSubscriptionRepository } from './IGymSubscriptionRepository';
import type { ISubscriptionGateway } from '@/lib/payhere/ISubscriptionGateway';
import { Subscription } from '@/features/subscriptions/domain/Subscription';
import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig';
import { ConflictError, NotFoundError } from '@/utils/errors';

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

    if (sub.payhereSubscriptionId) {
      // LEGACY recurring: gateway FIRST; throws ExternalServiceError on
      // failure (local state untouched).
      await this.subscriptionGateway.cancelSubscription(sub.payhereSubscriptionId);
    } else if (!sub.payhereCustomerId) {
      // Billed with neither a gateway subscription nor a stored token is a
      // data inconsistency — surface it rather than silently cancel locally
      // while an unknown gateway sub may charge.
      throw new ConflictError('No payment gateway subscription on record — contact support');
    }
    // Token-billed: nothing scheduled at the gateway — the local write stops
    // billing (the save RPC clears next_charge_at for canceled).

    return this.subscriptionRepo.save(sub.cancelPaid(), { extendPeriod: false });
  }
}
