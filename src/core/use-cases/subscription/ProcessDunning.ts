/**
 * Process Dunning Use Case (UC-3)
 *
 * Nightly billing maintenance, idempotent, all suspension decisions taken by
 * SQL on the database server clock (process_dunning_suspensions RPC):
 *   1. past_due beyond grace     -> suspended (tier preserved)
 *   2. canceled past period end  -> suspended (voluntary cancel lapses, no grace)
 * plus expiry of stale pending checkout intents.
 *
 * There is no downgrade landing tier — dunning changes STATUS only.
 * Members are NEVER touched by any dunning branch.
 */

import type {
  IGymSubscriptionRepository,
  ICheckoutIntentRepository,
} from '@/core/ports/repositories';

export interface DunningSummary {
  suspendedPastDue: number;
  suspendedCanceled: number;
  intentsExpired: number;
}

export class ProcessDunning {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly checkoutIntentRepo: ICheckoutIntentRepository
  ) {}

  async execute(): Promise<DunningSummary> {
    const { suspendedPastDue, suspendedCanceled } =
      await this.subscriptionRepo.runDunningSuspensions();
    const intentsExpired = await this.checkoutIntentRepo.expireStale(new Date());

    return { suspendedPastDue, suspendedCanceled, intentsExpired };
  }
}
