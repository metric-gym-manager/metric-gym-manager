/**
 * Process Trial Expiry Use Case (UC-5)
 *
 * Nightly onboarding maintenance, idempotent: gyms still `trialing` past
 * their trial clock (trial_ends_at) are SUSPENDED — tier preserved — by SQL
 * on the database server clock (process_trial_expiry RPC).
 *
 * A successful checkout converts trialing -> active via the webhook (UC-2),
 * so a row still trialing past its clock by definition never checked out.
 * Members are NEVER touched.
 */

import type { IGymSubscriptionRepository } from '@/core/ports/repositories';

export interface TrialExpirySummary {
  suspendedTrials: number;
}

export class ProcessTrialExpiry {
  constructor(private readonly subscriptionRepo: IGymSubscriptionRepository) {}

  async execute(): Promise<TrialExpirySummary> {
    const suspendedTrials = await this.subscriptionRepo.runTrialExpiry();
    return { suspendedTrials };
  }
}
