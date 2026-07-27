import type { Lead, NewLead } from '../types'

/** Persistence port for marketing leads. */
export interface ILeadRepository {
  /** Insert a new lead and return the stored row. */
  create(lead: NewLead): Promise<Lead>
}
