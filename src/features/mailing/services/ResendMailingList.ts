import {
  CONTACT_PROPERTY,
  RESEND_SEGMENT_IDS,
  RESEND_TOPIC_IDS,
  type MailingAudience,
  MailingTopic,
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

/** Per-request options; the SDK aborts the request when `signal` fires. */
type RequestOptions = { signal?: AbortSignal }

/**
 * The slice of the Resend SDK's `contacts` API this adapter uses. The real
 * `resend.contacts` satisfies it; tests pass a plain double.
 */
export interface MailingContactsApi {
  get(
    options: { email: string },
    requestOptions?: RequestOptions
  ): Promise<
    ApiResult<{
      id: string
      properties: Record<string, { type: 'string' | 'number'; value: unknown }>
    }>
  >
  create(
    payload: {
      email: string
      firstName?: string
      properties?: Record<string, string>
      segments?: { id: string }[]
    },
    requestOptions?: RequestOptions
  ): Promise<ApiResult<{ id: string }>>
  update(
    options: { email: string; properties: Record<string, string> },
    requestOptions?: RequestOptions
  ): Promise<ApiResult<{ id: string }>>
  topics: {
    update(
      options: {
        email: string
        topics: { id: string; subscription: 'opt_in' | 'opt_out' }[]
      },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ id: string }>>
    list(
      options: { email: string },
      requestOptions?: RequestOptions
    ): Promise<
      ApiResult<{
        data: { id: string; subscription: 'opt_in' | 'opt_out' }[]
        has_more: boolean
      }>
    >
  }
  list(
    options: { segmentId: string; limit?: number; after?: string },
    requestOptions?: RequestOptions
  ): Promise<
    ApiResult<{ data: { id: string; email: string }[]; has_more: boolean }>
  >
  remove(
    options: { email: string },
    requestOptions?: RequestOptions
  ): Promise<ApiResult<unknown>>
  segments: {
    remove(
      options: { email: string; segmentId: string },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<unknown>>
    list(
      options: { email: string },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ data: { id: string }[]; has_more: boolean }>>
    add(
      options: { email: string; segmentId: string },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ id: string }>>
  }
}

export interface ResendMailingListOptions {
  /**
   * Rewrite an existing contact's `unsubscribe_token` when it differs from
   * the one signed now. Off by default: a different token means a different
   * `MARKETING_UNSUBSCRIBE_SECRET`, and rewriting would silently break every
   * link already sent. Only a deliberate secret rotation turns it on.
   */
  rotateTokens?: boolean
  /** Per-request limit. The SDK has none, so a stalled Resend hangs the caller. */
  timeoutMs?: number
  /** How many times `optOut` reads the topics back before giving up. */
  confirmAttempts?: number
  /** Pause between read-backs; Resend shows a topic write after 1–2.5 s. */
  confirmDelayMs?: number
}

/** Long enough for Resend's slowest normal answer, short of a serverless timeout. */
const DEFAULT_TIMEOUT_MS = 8_000
/**
 * 10 reads, 800 ms apart: about 8 s of waiting, three times the longest lag
 * measured on 2026-10-06 (2.5 s). A miss tells the visitor to write to hello@.
 */
const DEFAULT_CONFIRM_ATTEMPTS = 10
const DEFAULT_CONFIRM_DELAY_MS = 800

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isNotFound(error: { name: string } | null): boolean {
  return error?.name === 'not_found'
}

/**
 * Resend-backed mailing list: contacts in segments, opt-outs per topic.
 *
 * Promises the rest of the feature relies on:
 * - a contact is created with no subscription fields, so each topic's
 *   default (opt-in) applies, and an existing contact's topics are never
 *   written by `addContact` — a re-sync cannot undo an opt-out;
 * - `optOut` writes topic subscriptions only, never the global
 *   `unsubscribed` flag, which would block every email the account sends;
 * - an existing token is never replaced unless `rotateTokens` is set;
 * - every request carries a time limit;
 * - an opt-out is confirmed by reading it back, or it is an error.
 *
 * Two Resend behaviours, measured against the live API on 2026-10-06:
 * - contact emails match CASE-SENSITIVELY: a contact stored with capitals is
 *   `not_found` under its lowercased address. Address a contact exactly as
 *   stored (links carry it via `{{{contact.email}}}`); contacts this feature
 *   creates are lowercased;
 * - a topic write takes 1–2.5 s to read back (eventually consistent), so the
 *   confirmation polls. An opt-out that never reads back is an error, never a
 *   "Done": a no-op must not pass for a write (the rule 2.7 lesson).
 */
export class ResendMailingList implements IMailingList {
  private readonly rotateTokens: boolean
  private readonly timeoutMs: number
  private readonly confirmAttempts: number
  private readonly confirmDelayMs: number

  constructor(
    private readonly contacts: MailingContactsApi,
    options: ResendMailingListOptions = {}
  ) {
    this.rotateTokens = options.rotateTokens ?? false
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.confirmAttempts = options.confirmAttempts ?? DEFAULT_CONFIRM_ATTEMPTS
    this.confirmDelayMs = options.confirmDelayMs ?? DEFAULT_CONFIRM_DELAY_MS
  }

  private limit(): RequestOptions {
    return { signal: AbortSignal.timeout(this.timeoutMs) }
  }

  async addContact(contact: NewMailingContact): Promise<AddContactResult> {
    const segmentId = RESEND_SEGMENT_IDS[contact.audience]
    const existing = await this.contacts.get(
      { email: contact.email },
      this.limit()
    )

    if (existing.error && !isNotFound(existing.error)) {
      throw new Error(existing.error.message)
    }

    if (!existing.data) {
      const properties: Record<string, string> = {
        [CONTACT_PROPERTY.unsubscribeToken]: contact.unsubscribeToken,
      }
      if (contact.gymName)
        properties[CONTACT_PROPERTY.gymName] = contact.gymName
      if (contact.gymId) properties[CONTACT_PROPERTY.gymId] = contact.gymId
      const created = await this.contacts.create(
        {
          email: contact.email,
          ...(contact.firstName ? { firstName: contact.firstName } : {}),
          properties,
          segments: [{ id: segmentId }],
        },
        this.limit()
      )
      if (created.error) throw new Error(created.error.message)
      return 'created'
    }

    const storedToken =
      existing.data.properties[CONTACT_PROPERTY.unsubscribeToken]?.value
    const tokenMismatch =
      typeof storedToken === 'string' &&
      storedToken !== '' &&
      storedToken !== contact.unsubscribeToken
    if (!storedToken || (tokenMismatch && this.rotateTokens)) {
      const updated = await this.contacts.update(
        {
          email: contact.email,
          properties: {
            [CONTACT_PROPERTY.unsubscribeToken]: contact.unsubscribeToken,
          },
        },
        this.limit()
      )
      if (updated.error) throw new Error(updated.error.message)
    }

    const segments = await this.contacts.segments.list(
      { email: contact.email },
      this.limit()
    )
    if (segments.error) throw new Error(segments.error.message)
    let result: AddContactResult = 'unchanged'
    if (!segments.data.data.some((s) => s.id === segmentId)) {
      const added = await this.contacts.segments.add(
        { email: contact.email, segmentId },
        this.limit()
      )
      if (added.error) throw new Error(added.error.message)
      result = 'added_to_audience'
    }
    return tokenMismatch && !this.rotateTokens ? 'token_mismatch' : result
  }

  async listAudience(audience: MailingAudience): Promise<string[]> {
    const segmentId = RESEND_SEGMENT_IDS[audience]
    const emails: string[] = []
    let after: string | undefined
    for (;;) {
      const page = await this.contacts.list(
        { segmentId, limit: 100, ...(after ? { after } : {}) },
        this.limit()
      )
      if (page.error) throw new Error(page.error.message)
      emails.push(...page.data.data.map((c) => c.email))
      const last = page.data.data[page.data.data.length - 1]
      if (!page.data.has_more || !last) return emails
      after = last.id
    }
  }

  async removeFromAudience(
    email: string,
    audience: MailingAudience
  ): Promise<void> {
    const result = await this.contacts.segments.remove(
      { email, segmentId: RESEND_SEGMENT_IDS[audience] },
      this.limit()
    )
    if (result.error && !isNotFound(result.error)) {
      throw new Error(result.error.message)
    }
  }

  async getGymId(email: string): Promise<string | null> {
    const result = await this.contacts.get({ email }, this.limit())
    if (result.error && !isNotFound(result.error)) {
      throw new Error(result.error.message)
    }
    const value = result.data?.properties[CONTACT_PROPERTY.gymId]?.value
    return typeof value === 'string' && value !== '' ? value : null
  }

  async optedOutTopics(email: string): Promise<MailingTopic[]> {
    const result = await this.contacts.topics.list({ email }, this.limit())
    if (result.error) throw new Error(result.error.message)
    const optedOut = new Set(
      result.data.data
        .filter((t) => t.subscription === 'opt_out')
        .map((t) => t.id)
    )
    return Object.values(MailingTopic).filter((topic) =>
      optedOut.has(RESEND_TOPIC_IDS[topic])
    )
  }

  async deleteContact(email: string): Promise<void> {
    const result = await this.contacts.remove({ email }, this.limit())
    if (result.error && !isNotFound(result.error)) {
      throw new Error(result.error.message)
    }
  }

  async optOut(email: string, topics: MailingTopic[]): Promise<void> {
    const ids = topics.map((topic) => RESEND_TOPIC_IDS[topic])
    const result = await this.contacts.topics.update(
      {
        email,
        topics: ids.map((id) => ({ id, subscription: 'opt_out' as const })),
      },
      this.limit()
    )
    if (result.error && !isNotFound(result.error)) {
      throw new Error(result.error.message)
    }
    if (result.error) {
      // No such contact means nothing is sent to this address, so the
      // visitor's request is already true. Logged because a case mismatch
      // between the link and the stored contact looks exactly like this.
      console.warn('Email preferences: no Resend contact for this address')
      return
    }

    // The write counts only once it reads back (see the class comment).
    for (let attempt = 0; attempt < this.confirmAttempts; attempt++) {
      if (attempt > 0) await sleep(this.confirmDelayMs)
      const read = await this.contacts.topics.list({ email }, this.limit())
      if (read.error) throw new Error(read.error.message)
      const state = new Map(read.data.data.map((t) => [t.id, t.subscription]))
      if (ids.every((id) => state.get(id) === 'opt_out')) return
    }
    throw new Error('Opt-out not confirmed by the mailing provider')
  }
}
