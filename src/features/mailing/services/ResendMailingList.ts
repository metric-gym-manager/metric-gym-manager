import {
  CONTACT_PROPERTY,
  RESEND_SEGMENT_IDS,
  RESEND_TOPIC_IDS,
  type MailingTopic,
} from '../config/MailingConfig'
import type {
  AddContactResult,
  IMailingList,
  NewMailingContact,
} from './IMailingList'

/** The SDK's `{ data, error }` result; it never throws for an API error. */
type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: { name: string; message: string } }

/**
 * The slice of the Resend SDK's `contacts` API this adapter uses. The real
 * `resend.contacts` satisfies it; tests pass a plain double.
 */
export interface MailingContactsApi {
  get(options: { email: string }): Promise<
    ApiResult<{
      id: string
      properties: Record<string, { type: 'string' | 'number'; value: unknown }>
    }>
  >
  create(payload: {
    email: string
    firstName?: string
    properties?: Record<string, string>
    segments?: { id: string }[]
  }): Promise<ApiResult<{ id: string }>>
  update(options: {
    email: string
    properties: Record<string, string>
  }): Promise<ApiResult<{ id: string }>>
  topics: {
    update(options: {
      email: string
      topics: { id: string; subscription: 'opt_in' | 'opt_out' }[]
    }): Promise<ApiResult<{ id: string }>>
  }
  segments: {
    list(options: {
      email: string
    }): Promise<ApiResult<{ data: { id: string }[]; has_more: boolean }>>
    add(options: {
      email: string
      segmentId: string
    }): Promise<ApiResult<{ id: string }>>
  }
}

function isNotFound(error: { name: string } | null): boolean {
  return error?.name === 'not_found'
}

/**
 * Resend-backed mailing list: contacts in segments, opt-outs per topic.
 *
 * Two promises the rest of the feature relies on:
 * - a contact is created with no subscription fields, so each topic's
 *   default (opt-in) applies, and an existing contact's topics are never
 *   written by `addContact` — a re-sync cannot undo an opt-out;
 * - `optOut` writes topic subscriptions only, never the global
 *   `unsubscribed` flag, which would block every email the account sends.
 */
export class ResendMailingList implements IMailingList {
  constructor(private readonly contacts: MailingContactsApi) {}

  async addContact(contact: NewMailingContact): Promise<AddContactResult> {
    const segmentId = RESEND_SEGMENT_IDS[contact.audience]
    const existing = await this.contacts.get({ email: contact.email })

    if (existing.error && !isNotFound(existing.error)) {
      throw new Error(existing.error.message)
    }

    if (!existing.data) {
      const properties: Record<string, string> = {
        [CONTACT_PROPERTY.unsubscribeToken]: contact.unsubscribeToken,
      }
      if (contact.gymName)
        properties[CONTACT_PROPERTY.gymName] = contact.gymName
      const created = await this.contacts.create({
        email: contact.email,
        ...(contact.firstName ? { firstName: contact.firstName } : {}),
        properties,
        segments: [{ id: segmentId }],
      })
      if (created.error) throw new Error(created.error.message)
      return 'created'
    }

    const storedToken =
      existing.data.properties[CONTACT_PROPERTY.unsubscribeToken]?.value
    if (storedToken !== contact.unsubscribeToken) {
      const updated = await this.contacts.update({
        email: contact.email,
        properties: {
          [CONTACT_PROPERTY.unsubscribeToken]: contact.unsubscribeToken,
        },
      })
      if (updated.error) throw new Error(updated.error.message)
    }

    const segments = await this.contacts.segments.list({ email: contact.email })
    if (segments.error) throw new Error(segments.error.message)
    if (segments.data.data.some((s) => s.id === segmentId)) return 'unchanged'

    const added = await this.contacts.segments.add({
      email: contact.email,
      segmentId,
    })
    if (added.error) throw new Error(added.error.message)
    return 'added_to_audience'
  }

  async optOut(email: string, topics: MailingTopic[]): Promise<void> {
    const result = await this.contacts.topics.update({
      email,
      topics: topics.map((topic) => ({
        id: RESEND_TOPIC_IDS[topic],
        subscription: 'opt_out' as const,
      })),
    })
    if (result.error && !isNotFound(result.error)) {
      throw new Error(result.error.message)
    }
  }
}
