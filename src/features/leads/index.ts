/**
 * Leads Feature - Public API
 *
 * Anonymous marketing-lead capture from the public landing page (demo
 * requests, sales enquiries, per-tier "get started"). Self-contained and
 * deletable: consumers are the `/api/public/leads` route and the landing
 * `DemoModal`. This feature has no UI of its own — the modal lives in the
 * shared landing components and calls the public API.
 */

// ============================================================
// SERVICES (factories compose use-cases for routes — R7)
// ============================================================
export {
  createLeadRepository,
  createLeadNotifier,
  createSubmitLead,
} from './services/factory'
export { SubmitLead, type SubmitLeadInput } from './services/SubmitLead'
export type { ILeadRepository } from './services/ILeadRepository'
export type { ILeadNotifier } from './services/ILeadNotifier'

// ============================================================
// SCHEMAS
// ============================================================
export { createLeadSchema, type CreateLeadInput } from './schemas/lead.schemas'

// ============================================================
// CONFIG (single owner of the interest enum — R5)
// ============================================================
export {
  LeadInterest,
  LEAD_INTEREST_LABELS,
  LEAD_NOTIFY_FROM,
  LEAD_NOTIFY_TO,
  getLeadInterestLabel,
} from './config/LeadConfig'

// ============================================================
// TYPES
// ============================================================
export type { Lead, LeadNotificationOutcome, NewLead } from './types'
