import type { Lead } from '../types'

/**
 * Where a lead who ticked the marketing consent box is added (the mailing
 * feature's Marketing audience, wired in the factory).
 */
export interface ILeadMarketingAudience {
  /** Rejects when the provider refuses; the caller logs and carries on. */
  add(lead: Lead): Promise<void>
}
