/**
 * Leads feature factory.
 *
 * Composes the lead use-cases for API routes (R7). The public lead route is
 * anonymous, so it passes the service-role `createAdminClient()` — writes
 * bypass RLS on the deny-by-default `leads` table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAddMarketingContact, MailingAudience } from '@/features/mailing'
import { createSmtpMailer } from '@/lib/email/smtp'
import type { ILeadMarketingAudience } from './ILeadMarketingAudience'
import type { ILeadNotifier } from './ILeadNotifier'
import type { ILeadRepository } from './ILeadRepository'
import { SmtpLeadNotifier } from './SmtpLeadNotifier'
import { SupabaseLeadRepository } from './SupabaseLeadRepository'
import { SubmitLead } from './SubmitLead'

export function createLeadRepository(
  supabase: SupabaseClient
): ILeadRepository {
  return new SupabaseLeadRepository(supabase)
}

/** The lead email sender, or `null` when SMTP_USER / SMTP_PASS are unset. */
export function createLeadNotifier(): ILeadNotifier | null {
  const mailer = createSmtpMailer()
  return mailer ? new SmtpLeadNotifier(mailer) : null
}

/**
 * Consenting leads join the mailing feature's Demo leads audience, or `null`
 * when mailing is not configured (RESEND_API_KEY / MARKETING_UNSUBSCRIBE_SECRET).
 */
export function createLeadMarketingAudience(): ILeadMarketingAudience | null {
  const addContact = createAddMarketingContact()
  if (!addContact) return null
  return {
    async add(lead) {
      await addContact.execute({
        email: lead.email,
        name: lead.name,
        gymName: lead.gymName,
        audience: MailingAudience.DemoLeads,
      })
    },
  }
}

export function createSubmitLead(supabase: SupabaseClient): SubmitLead {
  return new SubmitLead(
    createLeadRepository(supabase),
    createLeadNotifier(),
    createLeadMarketingAudience()
  )
}
