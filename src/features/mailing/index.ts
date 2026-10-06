/**
 * Mailing Feature - Public API
 *
 * Marketing and product-update email through Resend: who is on the list
 * (gym owners, consenting demo leads), and the two kinds of email each person
 * can opt out of on /unsubscribe, and the automatic release and policy-change
 * announcements. Consumers: the /api/public/email-preferences route, the leads
 * factory (consenting leads join Marketing), the sync-marketing-contacts and
 * send-announcements crons, and their scripts. See
 * docs/architecture/marketing-email.md.
 *
 * NOTE: this barrel is **server-tainted** (the factory reaches the Resend SDK
 * and `node:crypto`). Client components deep-import
 * `./config/MailingConfig`; `tests/barrel.test.ts` fails otherwise.
 */

// ============================================================
// SERVICES (factories compose use-cases — R7)
// ============================================================
export {
  createAddMarketingContact,
  createBroadcaster,
  createMailingList,
  createSendAnnouncements,
  createSendOutreach,
  createSyncMarketingContacts,
  createUpdateEmailPreferences,
} from './services/factory'
export {
  SendOutreach,
  type OutreachReport,
  type SendOutreachInput,
} from './services/SendOutreach'
export {
  SendAnnouncements,
  type AnnouncementOutcome,
  type AnnouncementReportEntry,
  type SendAnnouncementsInput,
} from './services/SendAnnouncements'
export {
  AddMarketingContact,
  type AddMarketingContactInput,
} from './services/AddMarketingContact'
export {
  UpdateEmailPreferences,
  type UpdateEmailPreferencesInput,
} from './services/UpdateEmailPreferences'
export {
  SyncMarketingContacts,
  type SyncMarketingContactsOptions,
  type SyncReportEntry,
} from './services/SyncMarketingContacts'
export {
  InvalidUnsubscribeLinkError,
  MailingUnavailableError,
} from './services/errors'
export type {
  AddContactResult,
  IMailingList,
  NewMailingContact,
} from './services/IMailingList'
export type { IMarketingSource } from './services/IMarketingSource'
export type {
  AnnouncementRecord,
  AnnouncementStatus,
  IAnnouncementLog,
} from './services/IAnnouncementLog'
export type {
  AnnouncementTemplate,
  IBroadcaster,
} from './services/IBroadcaster'

// ============================================================
// SCHEMAS
// ============================================================
export {
  emailPreferencesSchema,
  type EmailPreferencesInput,
} from './schemas/emailPreferences.schemas'

// ============================================================
// CONFIG (single owner of the email kinds and audiences — R5)
// ============================================================
export {
  ALWAYS_SENT_EMAILS,
  CONTACT_PROPERTY,
  MAILING_FROM,
  MAILING_REPLY_TO,
  MAILING_TOPIC_DESCRIPTIONS,
  MAILING_TOPIC_LABELS,
  MailingAudience,
  MailingTopic,
  RESEND_TEST_SEGMENT_ID,
  UNSUBSCRIBE_PATH,
  preferencesLinkTemplate,
  unsubscribeLinkTemplate,
} from './config/MailingConfig'
export {
  ANNOUNCEMENT_TEMPLATE_ALIAS,
  ANNOUNCEMENT_VARIABLES,
  AnnouncementKind,
} from './config/AnnouncementConfig'

// ============================================================
// UTILS
// ============================================================
export {
  createUnsubscribeToken,
  normalizeMailingEmail,
} from './utils/unsubscribeToken'
export { placeholdersIn } from './utils/renderTemplate'
export { parseProspectsCsv, type Prospect } from './utils/prospectsCsv'
export {
  OUTREACH_CAMPAIGN,
  OUTREACH_DAILY_LIMIT,
  OUTREACH_FROM,
} from './config/outreachCampaign'
