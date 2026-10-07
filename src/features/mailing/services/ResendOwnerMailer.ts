import { MAILING_FROM } from '../config/MailingConfig'
import { OUTREACH_OWNER_EMAIL } from '../config/outreachCampaign'
import { emailAddressOf } from '../utils/emailAddress'
import type { IOwnerMailer, OwnerEmail } from './IOwnerMailer'
import {
  DEFAULT_RESEND_TIMEOUT_MS,
  timeLimit,
  type ApiResult,
  type RequestOptions,
} from './resendApi'

/** The slice of the Resend SDK the owner's email uses; the real client satisfies it. */
export interface OwnerMailResendApi {
  emails: {
    send(
      payload: {
        from: string
        to: string
        replyTo?: string
        subject: string
        html?: string
        text: string
        tags: { name: string; value: string }[]
      },
      requestOptions?: RequestOptions & { idempotencyKey?: string }
    ): Promise<ApiResult<{ id: string }>>
    receiving: {
      get(
        id: string,
        options?: Record<string, never>,
        requestOptions?: RequestOptions
      ): Promise<
        ApiResult<{
          from: string
          to: string[]
          subject: string
          text: string | null
          html: string | null
          created_at: string
        }>
      >
    }
  }
}

/** The text of an HTML-only email, with no markup left to render. */
function textOf(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '‹')
    .replace(/&gt;/g, '›')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Resend-backed {@link IOwnerMailer}. The owner's email goes out from the
 * updates domain, not the outreach one: if outreach ever damages its own
 * domain's standing, the alert about it still arrives.
 *
 * A forward carries the writer's TEXT only, never their HTML: it arrives from
 * our own trusted address, so passing a stranger's markup on would let anyone
 * who writes to the outreach address put their own page in the owner's inbox
 * under our name. Its Reply-To is the writer, so replying answers them.
 */
export class ResendOwnerMailer implements IOwnerMailer {
  constructor(
    private readonly resend: OwnerMailResendApi,
    private readonly timeoutMs: number = DEFAULT_RESEND_TIMEOUT_MS
  ) {}

  async send(email: OwnerEmail): Promise<string> {
    const { data, error } = await this.resend.emails.send(
      {
        from: MAILING_FROM,
        to: OUTREACH_OWNER_EMAIL,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: 'kind', value: 'outreach-report' }],
      },
      { ...timeLimit(this.timeoutMs), idempotencyKey: email.idempotencyKey }
    )
    if (error) throw new Error(error.message)
    return data.id
  }

  async forward(receivedEmailId: string): Promise<string> {
    const received = await this.resend.emails.receiving.get(
      receivedEmailId,
      {},
      timeLimit(this.timeoutMs)
    )
    if (received.error) throw new Error(received.error.message)
    const email = received.data
    const subject = email.subject?.trim() || '(no subject)'
    const writer = emailAddressOf(email.from)
    const body =
      email.text?.trim() ||
      (email.html ? textOf(email.html) : '') ||
      '(no text)'
    const text = [
      `Someone wrote to ${email.to.join(', ')}, the address outreach is sent from, instead of replying. Reply to this email to answer them.`,
      '',
      `From: ${email.from}`,
      `Date: ${email.created_at}`,
      `Subject: ${subject}`,
      '',
      body,
    ].join('\n')

    const { data, error } = await this.resend.emails.send(
      {
        from: MAILING_FROM,
        to: OUTREACH_OWNER_EMAIL,
        ...(writer ? { replyTo: writer } : {}),
        subject: /^fwd:/i.test(subject) ? subject : `Fwd: ${subject}`,
        text,
        tags: [{ name: 'kind', value: 'outreach-forward' }],
      },
      {
        ...timeLimit(this.timeoutMs),
        idempotencyKey: `outreach-forward:${receivedEmailId}`,
      }
    )
    if (error) throw new Error(error.message)
    return data.id
  }
}
