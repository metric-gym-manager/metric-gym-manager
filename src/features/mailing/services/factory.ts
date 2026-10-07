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
import { ResendBroadcaster } from './ResendBroadcaster'
import { HandleMailingEvent } from './HandleMailingEvent'
import { OutreachBrake } from './OutreachBrake'
import { ResendOutreachSender } from './ResendOutreachSender'
import { ResendOwnerMailer } from './ResendOwnerMailer'
import { SendOutreach } from './SendOutreach'
import { SendOutreachSummary } from './SendOutreachSummary'
import { SupabaseOutreachCampaigns } from './SupabaseOutreachCampaigns'
import { SupabaseOutreachLedger } from './SupabaseOutreachLedger'
import { SendAnnouncements } from './SendAnnouncements'
import { SupabaseAnnouncementLog } from './SupabaseAnnouncementLog'
import type { IBroadcaster } from './IBroadcaster'
import type { IMailingList } from './IMailingList'
import {
  ResendMailingList,
  type ResendMailingListOptions,
} from './ResendMailingList'
import { SupabaseMarketingSource } from './SupabaseMarketingSource'
import { SyncMarketingContacts } from './SyncMarketingContacts'
import { UpdateEmailPreferences } from './UpdateEmailPreferences'

/** The Resend mailing list, or `null` when `RESEND_API_KEY` is unset. */
export function createMailingList(
  options: ResendMailingListOptions = {}
): IMailingList | null {
  const client = createResendClient()
  return client ? new ResendMailingList(client.contacts, options) : null
}

/** For POST /api/public/email-preferences. */
export function createUpdateEmailPreferences(): UpdateEmailPreferences {
  return new UpdateEmailPreferences(createMailingList(), readMailingSecret())
}

/** Adds one person to an audience, or `null` when mailing is not configured. */
export function createAddMarketingContact(
  options: ResendMailingListOptions = {}
): AddMarketingContact | null {
  const list = createMailingList(options)
  const secret = readMailingSecret()
  return list && secret ? new AddMarketingContact(list, secret) : null
}

/**
 * For `scripts/sync-marketing-contacts.ts`, with the service-role client.
 *
 * @param supabase - Service-role client (reads every gym and lead)
 * @param options - `rotateTokens` only for a deliberate secret rotation
 * @throws {MailingUnavailableError} When mailing is not configured
 */
export function createSyncMarketingContacts(
  supabase: SupabaseClient,
  options: Pick<ResendMailingListOptions, 'rotateTokens'> = {}
): SyncMarketingContacts {
  const list = createMailingList(options)
  const secret = readMailingSecret()
  if (!list || !secret) throw new MailingUnavailableError()
  return new SyncMarketingContacts(
    new SupabaseMarketingSource(supabase),
    list,
    new AddMarketingContact(list, secret)
  )
}

/** Resend templates and broadcasts, or `null` when `RESEND_API_KEY` is unset. */
export function createBroadcaster(): IBroadcaster | null {
  const client = createResendClient()
  return client ? new ResendBroadcaster(client) : null
}

/**
 * For the `send-announcements` cron and `scripts/send-announcements.ts`.
 * Needs only `RESEND_API_KEY`: an announcement signs no tokens (the footer
 * link reads each contact's stored one).
 *
 * @param supabase - Service-role client (`mailing_announcements` has no policies)
 * @throws {MailingUnavailableError} When `RESEND_API_KEY` is unset
 */
export function createSendAnnouncements(
  supabase: SupabaseClient
): SendAnnouncements {
  const broadcaster = createBroadcaster()
  if (!broadcaster) throw new MailingUnavailableError()
  return new SendAnnouncements(
    new SupabaseAnnouncementLog(supabase),
    broadcaster
  )
}

/**
 * For `scripts/send-outreach.ts`: an introduction campaign to addresses from
 * public pages, leaving out every gym and demo request.
 *
 * @param supabase - Service-role client (`outreach_recipients` has no policies)
 * @throws {MailingUnavailableError} When mailing is not configured
 */
export function createSendOutreach(supabase: SupabaseClient): SendOutreach {
  const client = createResendClient()
  const secret = readMailingSecret()
  if (!client || !secret) throw new MailingUnavailableError()
  const source = new SupabaseMarketingSource(supabase)
  return new SendOutreach(
    new SupabaseOutreachLedger(supabase),
    new ResendOutreachSender(client),
    () => source.listKnownEmails(),
    secret,
    createOutreachBrake(supabase)
  )
}

/**
 * The outreach safety brake: pause, resume, and the check the run and the
 * webhook make.
 *
 * @param supabase - Service-role client (the outreach tables have no policies)
 * @throws {MailingUnavailableError} When `RESEND_API_KEY` is unset (it alerts the owner)
 */
export function createOutreachBrake(supabase: SupabaseClient): OutreachBrake {
  const client = createResendClient()
  if (!client) throw new MailingUnavailableError()
  return new OutreachBrake(
    new SupabaseOutreachLedger(supabase),
    new SupabaseOutreachCampaigns(supabase),
    new ResendOwnerMailer(client)
  )
}

/**
 * For the `send-outreach` cron's Monday summary and `--summary`.
 *
 * @param supabase - Service-role client
 * @throws {MailingUnavailableError} When `RESEND_API_KEY` is unset
 */
export function createSendOutreachSummary(
  supabase: SupabaseClient
): SendOutreachSummary {
  const client = createResendClient()
  if (!client) throw new MailingUnavailableError()
  return new SendOutreachSummary(
    new SupabaseOutreachLedger(supabase),
    new SupabaseOutreachCampaigns(supabase),
    new ResendOwnerMailer(client)
  )
}

/**
 * For POST /api/webhooks/resend: bounces, complaints, opt-outs and received
 * mail, acted on.
 *
 * @param supabase - Service-role client (a webhook has no session, and the
 *   outreach tables have no policies)
 * @throws {MailingUnavailableError} When `RESEND_API_KEY` is unset
 */
export function createHandleMailingEvent(
  supabase: SupabaseClient
): HandleMailingEvent {
  const client = createResendClient()
  if (!client) throw new MailingUnavailableError()
  return new HandleMailingEvent(
    new SupabaseOutreachLedger(supabase),
    new ResendMailingList(client.contacts),
    new ResendOwnerMailer(client),
    createOutreachBrake(supabase)
  )
}
