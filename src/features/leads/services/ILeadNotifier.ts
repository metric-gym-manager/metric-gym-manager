import type { Lead } from '../types'

/** Tells a person about a new lead. */
export interface ILeadNotifier {
  /** Deliver the lead; rejects when it could not be delivered. */
  notify(lead: Lead): Promise<void>
}
