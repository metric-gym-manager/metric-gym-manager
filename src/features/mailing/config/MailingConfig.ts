/**
 * Mailing configuration — the single owner (R5) of the email kinds a person
 * can opt out of, the audiences they belong to, and the Resend ids behind
 * both. Client-safe: the /unsubscribe page deep-imports this file, so it must
 * never reach `node:*` or the Resend SDK.
 *
 * Each kind is a Resend Topic. A broadcast is sent with one topic, and Resend
 * skips every contact who opted out of it. Opting out is per topic and never
 * a global unsubscribe: Resend's global flag blocks every email the account
 * sends, which would also stop the other kind (docs/architecture/marketing-email.md).
 */
import { SITE_URL } from '@/features/marketing/config/site'

/** The kinds of email a person can opt out of, one checkbox each. */
export enum MailingTopic {
  /** Product news, offers and tips. */
  Marketing = 'marketing',
  /** New versions, changes to how the product works, security notices. */
  Updates = 'updates',
}

export const MAILING_TOPIC_LABELS: Record<MailingTopic, string> = {
  [MailingTopic.Marketing]: 'Marketing emails',
  [MailingTopic.Updates]: 'Product and security updates',
}

export const MAILING_TOPIC_DESCRIPTIONS: Record<MailingTopic, string> = {
  [MailingTopic.Marketing]: 'Product news, offers and tips.',
  [MailingTopic.Updates]:
    'New versions, changes to how Metric Gym OS works, and security notices.',
}

/** Resend Topic ids (created 2026-10-06, both `opt_in` by default). */
export const RESEND_TOPIC_IDS: Record<MailingTopic, string> = {
  [MailingTopic.Marketing]: 'f6e083f1-e3aa-4ade-87b3-6131027728d4',
  [MailingTopic.Updates]: '3df985c4-50bb-4cfd-9adc-ee61e81d260b',
}

/**
 * Who may receive which kind of email; each is a Resend Segment a broadcast
 * targets. A segment is ELIGIBILITY, a topic is CHOICE: leaving a segment
 * never touches the person's topic subscriptions.
 */
export enum MailingAudience {
  /** Every gym, whatever its status, and every demo lead who consented. */
  Marketing = 'marketing',
  /** Gyms with a current subscription (see `audiencesForGym`). */
  ProductUpdates = 'product_updates',
}

/**
 * Resend Segment ids. Renamed 2026-10-06 (were "Demo leads" and "Gym owners",
 * both empty at the time). The third segment, "Test", is for trial sends.
 */
export const RESEND_SEGMENT_IDS: Record<MailingAudience, string> = {
  [MailingAudience.Marketing]: 'bf045632-d75d-4ed1-9c67-4ba178e82935',
  [MailingAudience.ProductUpdates]: '83025e1c-80ab-4046-b92a-e1f387ebb720',
}

/** Contact properties defined in Resend; broadcasts read them as `{{{contact.<key>}}}`. */
export const CONTACT_PROPERTY = {
  gymName: 'gym_name',
  /** Set on gym contacts, so the sync can find a gym's old address after an email change. */
  gymId: 'gym_id',
  unsubscribeToken: 'unsubscribe_token',
} as const

/** Marketing mail goes out from its own subdomain, so it cannot hurt auth email. */
export const MAILING_FROM = 'Metric Gym OS <hello@updates.metricgymos.com>'
export const MAILING_REPLY_TO = 'hello@metricgymos.com'

export const UNSUBSCRIBE_PATH = '/unsubscribe'

/**
 * What keeps arriving after opting out of both kinds. Shown on /unsubscribe
 * and stated in the privacy policy; the two must say the same thing.
 */
export const ALWAYS_SENT_EMAILS = [
  'Emails you ask for, such as sign-up confirmation, password reset and email change',
  'Billing and payment notices about your subscription',
  'Notices the law requires us to send, such as a personal-data breach notification',
] as const

/**
 * The footer link a broadcast of this kind carries. Resend fills in the
 * contact's email and token for each recipient.
 *
 * @param topic - The kind of email the broadcast is
 * @returns The link, with Resend's triple-brace placeholders
 */
export function unsubscribeLinkTemplate(topic: MailingTopic): string {
  return (
    `${SITE_URL}${UNSUBSCRIBE_PATH}` +
    `?email={{{contact.email}}}` +
    `&token={{{contact.${CONTACT_PROPERTY.unsubscribeToken}}}}` +
    `&topic=${topic}`
  )
}
