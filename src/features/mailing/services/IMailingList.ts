import type { MailingTopic } from '../config/MailingConfig'
import type { MailingAudience } from '../config/MailingConfig'

/** A person to add to a mailing audience. */
export interface NewMailingContact {
  /** Normalized address (see `normalizeMailingEmail`). */
  email: string
  firstName?: string
  gymName?: string
  /** For gym contacts: lets the sync find this gym's old address later. */
  gymId?: string
  audience: MailingAudience
  /** Signed for this email; stored on the contact for footer links. */
  unsubscribeToken: string
}

/**
 * What adding a contact did:
 * - `created` — a new contact, subscribed to every topic by default;
 * - `added_to_audience` — an existing contact, now also in this audience;
 * - `unchanged` — already a contact in this audience;
 * - `token_mismatch` — an existing contact whose stored token was signed
 *   with a different secret. It is left alone (its sent links still work
 *   only if that secret is the deployed one); rotate deliberately.
 */
export type AddContactResult =
  'created' | 'added_to_audience' | 'unchanged' | 'token_mismatch'

/** The mailing-list provider port (Resend in production). */
export interface IMailingList {
  /**
   * Add a person to an audience. An existing contact keeps every topic
   * subscription it has, so a re-sync can never undo an opt-out.
   */
  addContact(contact: NewMailingContact): Promise<AddContactResult>
  /**
   * Opt a contact out of these topics, leaving the others alone. A contact
   * that does not exist is already receiving nothing, so that is not an error.
   */
  optOut(email: string, topics: MailingTopic[]): Promise<void>
  /** Every member of an audience, emails exactly as the provider stores them. */
  listAudience(audience: MailingAudience): Promise<string[]>
  /** Leave one audience; topics are untouched. A non-member is already out. */
  removeFromAudience(email: string, audience: MailingAudience): Promise<void>
  /** The gym a contact belongs to, or null (no such property or contact). */
  getGymId(email: string): Promise<string | null>
  /** The kinds of email this contact opted out of. */
  optedOutTopics(email: string): Promise<MailingTopic[]>
  /** Delete the contact. One already gone is done. */
  deleteContact(email: string): Promise<void>
}
