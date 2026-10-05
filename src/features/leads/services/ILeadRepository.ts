import type { Lead, LeadNotificationOutcome, NewLead } from '../types'

/** Persistence port for marketing leads. */
export interface ILeadRepository {
  /** Insert a new lead and return the stored row. */
  create(lead: NewLead): Promise<Lead>
  /**
   * Record whether the lead's email was sent. Rejects unless exactly one row
   * was updated, so a no-op cannot pass for a write.
   */
  recordNotification(
    id: string,
    outcome: LeadNotificationOutcome
  ): Promise<void>
}
