/**
 * Process Dunning Use Case (UC-3)
 *
 * Nightly billing maintenance, idempotent, all downgrade decisions taken by
 * SQL on the database server clock (process_dunning_downgrades RPC):
 *   1. pro/past_due beyond grace  -> free/canceled (hard downgrade)
 *   2. pro/canceled past period   -> free (voluntary cancel lapses, no grace)
 * plus expiry of stale pending checkout intents.
 *
 * Members are NEVER touched by any dunning branch.
 */

import type {
  IGymSubscriptionRepository,
  ICheckoutIntentRepository,
} from '@/core/ports/repositories';

export interface DunningSummary {
  downgradedPastDue: number;
  lapsedCanceled: number;
  intentsExpired: number;
}

export class ProcessDunning {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly checkoutIntentRepo: ICheckoutIntentRepository
  ) {}

  async execute(): Promise<DunningSummary> {
    const { downgradedPastDue, lapsedCanceled } =
      await this.subscriptionRepo.runDunningDowngrades();
    const intentsExpired = await this.checkoutIntentRepo.expireStale(new Date());

    return { downgradedPastDue, lapsedCanceled, intentsExpired };
  }
}
