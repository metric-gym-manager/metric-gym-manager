import type { LeadInterest } from '../config/LeadConfig'
import type { Lead, LeadNotificationOutcome } from '../types'
import type { ILeadMarketingAudience } from './ILeadMarketingAudience'
import type { ILeadNotifier } from './ILeadNotifier'
import type { ILeadRepository } from './ILeadRepository'

/** The longest notification error kept on a lead row. */
const MAX_ERROR_LENGTH = 500

/** Validated lead input (honeypot already stripped by the schema/route). */
export interface SubmitLeadInput {
  name: string
  email: string
  phone: string
  gymName?: string
  message?: string
  interest: LeadInterest
  /** Origin of the lead; defaults to 'landing'. */
  source?: string
  /** The demo form's marketing checkbox; absent means not ticked. */
  marketingConsent?: boolean
}

/**
 * Submit a marketing lead.
 *
 * Normalizes optional fields (blank → null), stamps the source, persists, and
 * then emails the lead to hello@metricgymos.com (owner decision, 2026-10-05;
 * before that a stored lead was seen by nobody). Kept as a use-case (not an
 * inline route insert) so the route stays thin (R6) and this logic is
 * unit-testable in isolation.
 *
 * The email is awaited, because a serverless function can be frozen once it
 * has responded (the welcome-SMS lesson). Its outcome is recorded on the row —
 * `notified_at`, or `notification_error` — and a failure never fails the
 * request: the lead is already stored, and the visitor still gets their
 * thank-you.
 *
 * A ticked marketing box is stored with its time (`marketing_consent_at`, the
 * consent record) and the lead joins the Marketing mailing audience. Joining
 * is best-effort like the email: the lead is stored either way, and
 * `scripts/sync-marketing-contacts.ts` adds anyone a failure missed.
 */
export class SubmitLead {
  constructor(
    private readonly leads: ILeadRepository,
    /** `null` when no sender is configured (SMTP_USER / SMTP_PASS unset). */
    private readonly notifier: ILeadNotifier | null,
    /** `null` when mailing is not configured (RESEND_API_KEY unset). */
    private readonly audience: ILeadMarketingAudience | null = null
  ) {}

  /**
   * Store the lead, email it, and record the email's outcome.
   *
   * @param input - The validated form fields
   * @returns The stored lead (whatever happened to the email)
   * @throws When the lead itself cannot be stored
   */
  async execute(input: SubmitLeadInput): Promise<Lead> {
    const trimmedGym = input.gymName?.trim()
    const trimmedMessage = input.message?.trim()

    const lead = await this.leads.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      gymName: trimmedGym ? trimmedGym : null,
      message: trimmedMessage ? trimmedMessage : null,
      interest: input.interest,
      source: input.source?.trim() || 'landing',
      marketingConsentAt: input.marketingConsent
        ? new Date().toISOString()
        : null,
    })

    const outcome = await this.notify(lead)
    try {
      await this.leads.recordNotification(lead.id, outcome)
    } catch (error) {
      console.error('Lead notification outcome not recorded:', error)
    }

    if (lead.marketingConsentAt && this.audience) {
      try {
        await this.audience.add(lead)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Lead not added to the mailing list:', message)
      }
    }

    return lead
  }

  private async notify(lead: Lead): Promise<LeadNotificationOutcome> {
    if (!this.notifier) {
      return { error: 'Email not configured: SMTP_USER or SMTP_PASS is unset' }
    }
    try {
      await this.notifier.notify(lead)
      return { notifiedAt: new Date() }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Lead email failed:', message)
      return { error: message.slice(0, MAX_ERROR_LENGTH) }
    }
  }
}
