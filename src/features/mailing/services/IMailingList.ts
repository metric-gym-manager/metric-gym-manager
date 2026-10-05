import type { MailingTopic } from '../config/MailingConfig'
import type { MailingAudience } from '../config/MailingConfig'

/** A person to add to a mailing audience. */
export interface NewMailingContact {
  /** Normalized address (see `normalizeMailingEmail`). */
  email: string
  firstName?: string
  gymName?: string
  audience: MailingAudience
  /** Signed for this email; stored on the contact for footer links. */
  unsubscribeToken: string
}

/**
 * What adding a contact did:
 * - `created` — a new contact, subscribed to every topic by default;
 * - `added_to_audience` — an existing contact, now also in this audience;
 * - `unchanged` — already a contact in this audience.
 */
export type AddContactResult = 'created' | 'added_to_audience' | 'unchanged'

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
}
