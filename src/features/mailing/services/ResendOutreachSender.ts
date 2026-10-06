import {
  CONTACT_PROPERTY,
  MAILING_REPLY_TO,
  MailingTopic,
  RESEND_TOPIC_IDS,
} from '../config/MailingConfig'
import { OUTREACH_FROM } from '../config/outreachCampaign'
import type { IOutreachSender, OutreachEmail } from './IOutreachSender'
import {
  DEFAULT_RESEND_TIMEOUT_MS,
  isNotFound,
  timeLimit,
  type ApiResult,
  type RequestOptions,
} from './resendApi'

/** The slice of the Resend SDK outreach uses; the real client satisfies it. */
export interface OutreachResendApi {
  contacts: {
    get(
      options: { email: string },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ id: string; unsubscribed: boolean }>>
    create(
      payload: { email: string; properties: Record<string, string> },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ id: string }>>
    topics: {
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
  }
  emails: {
    send(
      payload: {
        from: string
        replyTo: string
        to: string
        subject: string
        html: string
        text: string
        topicId: string
        headers: Record<string, string>
      },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ id: string }>>
  }
}

/**
 * Resend-backed {@link IOutreachSender}. Every send goes out from the
 * outreach subdomain with a plain-text part and a `List-Unsubscribe` header
 * (the recipient's /unsubscribe link and a mailto), so a mail app's own
 * unsubscribe works too.
 */
export class ResendOutreachSender implements IOutreachSender {
  constructor(
    private readonly resend: OutreachResendApi,
    private readonly timeoutMs: number = DEFAULT_RESEND_TIMEOUT_MS
  ) {}

  async ensureContact(
    email: string,
    unsubscribeToken: string,
    gymName: string | null
  ): Promise<void> {
    const existing = await this.resend.contacts.get(
      { email },
      timeLimit(this.timeoutMs)
    )
    if (existing.data) return
    if (!isNotFound(existing.error)) {
      throw new Error(existing.error?.message ?? 'Contact lookup failed')
    }
    const properties: Record<string, string> = {
      [CONTACT_PROPERTY.unsubscribeToken]: unsubscribeToken,
    }
    if (gymName) properties[CONTACT_PROPERTY.gymName] = gymName
    const created = await this.resend.contacts.create(
      { email, properties },
      timeLimit(this.timeoutMs)
    )
    if (created.error) throw new Error(created.error.message)
  }

  async canReceiveMarketing(email: string): Promise<boolean> {
    const contact = await this.resend.contacts.get(
      { email },
      timeLimit(this.timeoutMs)
    )
    if (contact.error) throw new Error(contact.error.message)
    if (contact.data.unsubscribed) return false
    const topics = await this.resend.contacts.topics.list(
      { email },
      timeLimit(this.timeoutMs)
    )
    if (topics.error) throw new Error(topics.error.message)
    return !topics.data.data.some(
      (topic) =>
        topic.id === RESEND_TOPIC_IDS[MailingTopic.Marketing] &&
        topic.subscription === 'opt_out'
    )
  }

  async send(email: OutreachEmail): Promise<string> {
    const { data, error } = await this.resend.emails.send(
      {
        from: OUTREACH_FROM,
        replyTo: MAILING_REPLY_TO,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        topicId: email.topicId,
        headers: {
          'List-Unsubscribe': `<${email.unsubscribeUrl}>, <mailto:${MAILING_REPLY_TO}?subject=unsubscribe>`,
        },
      },
      timeLimit(this.timeoutMs)
    )
    if (error) throw new Error(error.message)
    return data.id
  }
}
