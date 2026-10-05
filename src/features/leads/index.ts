/**
 * Leads Feature - Public API
 *
 * Anonymous marketing-lead capture from the public landing page (demo
 * requests, sales enquiries, per-tier "get started"). Self-contained and
 * deletable: consumers are the `/api/public/leads` route and the landing
 * `DemoModal`. This feature has no UI of its own — the modal lives in the
 * shared landing components and calls the public API.
 *
 * NOTE: this barrel is **server-tainted**: the factory reaches nodemailer
 * (`node:net`) through `lib/email/smtp.ts`. Client components deep-import
 * what they need (e.g. `./config/LeadConfig`); `tests/barrel.test.ts` fails
 * if one imports the barrel, which would break the production build.
 */

// ============================================================
// SERVICES (factories compose use-cases for routes — R7)
// ============================================================
export {
  createLeadRepository,
  createLeadMarketingAudience,
  createLeadNotifier,
  createSubmitLead,
} from './services/factory'
export { SubmitLead, type SubmitLeadInput } from './services/SubmitLead'
export type { ILeadRepository } from './services/ILeadRepository'
export type { ILeadNotifier } from './services/ILeadNotifier'
export type { ILeadMarketingAudience } from './services/ILeadMarketingAudience'

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
