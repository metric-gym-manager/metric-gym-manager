/**
 * Mailing feature factory (R7).
 *
 * Every use-case is built from the environment: `RESEND_API_KEY` (full
 * access) and `MARKETING_UNSUBSCRIBE_SECRET`. Either missing leaves the
 * use-cases reporting `MailingUnavailableError`, or the optional ones `null`,
 * so the app runs without them.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createResendClient, readMailingSecret } from '@/lib/email/resend'
import { AddMarketingContact } from './AddMarketingContact'
import { MailingUnavailableError } from './errors'
import type { IMailingList } from './IMailingList'
import { ResendMailingList } from './ResendMailingList'
import { SupabaseMarketingSource } from './SupabaseMarketingSource'
import { SyncMarketingContacts } from './SyncMarketingContacts'
import { UpdateEmailPreferences } from './UpdateEmailPreferences'

/** The Resend mailing list, or `null` when `RESEND_API_KEY` is unset. */
export function createMailingList(): IMailingList | null {
  const client = createResendClient()
  return client ? new ResendMailingList(client.contacts) : null
}

/** For POST /api/public/email-preferences. */
export function createUpdateEmailPreferences(): UpdateEmailPreferences {
  return new UpdateEmailPreferences(createMailingList(), readMailingSecret())
}

/** Adds one person to an audience, or `null` when mailing is not configured. */
export function createAddMarketingContact(): AddMarketingContact | null {
  const list = createMailingList()
  const secret = readMailingSecret()
  return list && secret ? new AddMarketingContact(list, secret) : null
}

/**
 * For `scripts/sync-marketing-contacts.ts`, with the service-role client.
 *
 * @throws {MailingUnavailableError} When mailing is not configured
 */
export function createSyncMarketingContacts(
  supabase: SupabaseClient
): SyncMarketingContacts {
  const add = createAddMarketingContact()
  if (!add) throw new MailingUnavailableError()
  return new SyncMarketingContacts(new SupabaseMarketingSource(supabase), add)
}
