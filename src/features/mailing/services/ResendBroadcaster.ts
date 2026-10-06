import { MAILING_FROM, MAILING_REPLY_TO } from '../config/MailingConfig'
import type {
  AnnouncementTemplate,
  BroadcastState,
  IBroadcaster,
  NewBroadcast,
} from './IBroadcaster'
import {
  DEFAULT_RESEND_TIMEOUT_MS,
  isNotFound,
  timeLimit,
  type ApiResult,
  type RequestOptions,
} from './resendApi'

/**
 * The slice of the Resend SDK announcements use. The real `Resend` client
 * satisfies it; tests pass a plain double.
 */
export interface AnnouncementResendApi {
  templates: {
    get(
      identifier: string,
      requestOptions?: RequestOptions
    ): Promise<
      ApiResult<{
        subject: string | null
        html: string
        status: string
        variables:
          { key: string; fallback_value: string | number | null }[] | null
      }>
    >
  }
  broadcasts: {
    create(
      payload: {
        name: string
        segmentId: string
        topicId: string | null
        from: string
        replyTo: string
        subject: string
        html: string
        send: true
        scheduledAt?: string
      },
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ id: string }>>
    list(
      options: { limit?: number; after?: string },
      requestOptions?: RequestOptions
    ): Promise<
      ApiResult<{
        data: { id: string; name: string; scheduled_at: string | null }[]
        has_more: boolean
      }>
    >
    get(
      id: string,
      requestOptions?: RequestOptions
    ): Promise<ApiResult<{ status: string }>>
  }
}

/** Pages of 100 read when looking a broadcast up by name: 2,000 broadcasts. */
const MAX_LIST_PAGES = 20

/** ISO when it parses, as given when it does not. */
function iso(value: string | null): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : new Date(time).toISOString()
}

/**
 * Resend-backed {@link IBroadcaster}: templates fetched by alias, broadcasts
 * created from their filled HTML.
 *
 * Every broadcast goes out from `MAILING_FROM` with `MAILING_REPLY_TO`, and is
 * sent on creation — at `scheduledAt`, or at once. Every request carries a
 * time limit, because the SDK applies none.
 */
export class ResendBroadcaster implements IBroadcaster {
  constructor(
    private readonly resend: AnnouncementResendApi,
    private readonly timeoutMs: number = DEFAULT_RESEND_TIMEOUT_MS
  ) {}

  async getTemplate(alias: string): Promise<AnnouncementTemplate | null> {
    const { data, error } = await this.resend.templates.get(
      alias,
      timeLimit(this.timeoutMs)
    )
    if (isNotFound(error)) return null
    if (error) throw new Error(error.message)
    return {
      subject: data.subject,
      html: data.html,
      published: data.status === 'published',
      variables: (data.variables ?? []).map((v) => ({
        key: v.key,
        fallback: v.fallback_value,
      })),
    }
  }

  async createBroadcast(broadcast: NewBroadcast): Promise<{ id: string }> {
    const { data, error } = await this.resend.broadcasts.create(
      {
        name: broadcast.name,
        segmentId: broadcast.segmentId,
        topicId: broadcast.topicId,
        from: MAILING_FROM,
        replyTo: MAILING_REPLY_TO,
        subject: broadcast.subject,
        html: broadcast.html,
        send: true,
        ...(broadcast.scheduledAt
          ? { scheduledAt: broadcast.scheduledAt }
          : {}),
      },
      timeLimit(this.timeoutMs)
    )
    if (error) throw new Error(error.message)
    return { id: data.id }
  }

  async findBroadcastByName(
    name: string
  ): Promise<{ id: string; scheduledAt: string | null } | null> {
    let after: string | undefined
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const { data, error } = await this.resend.broadcasts.list(
        { limit: 100, ...(after ? { after } : {}) },
        timeLimit(this.timeoutMs)
      )
      if (error) throw new Error(error.message)
      const found = data.data.find((b) => b.name === name)
      if (found) return { id: found.id, scheduledAt: iso(found.scheduled_at) }
      const last = data.data[data.data.length - 1]
      if (!data.has_more || !last) return null
      after = last.id
    }
    throw new Error(
      `Broadcast "${name}" not found in ${MAX_LIST_PAGES} pages; refusing to guess`
    )
  }

  async getBroadcastState(id: string): Promise<BroadcastState> {
    const { data, error } = await this.resend.broadcasts.get(
      id,
      timeLimit(this.timeoutMs)
    )
    if (error) throw new Error(error.message)
    switch (data.status) {
      case 'sent':
        return 'sent'
      case 'queued':
      case 'scheduled':
      case 'sending':
        return 'scheduled'
      // A cancelled scheduled broadcast goes back to being a draft. Only sends
      // whose time has passed are asked about, so a draft here was cancelled.
      case 'draft':
      case 'canceled':
      case 'cancelled':
        return 'canceled'
      default:
        return 'unknown'
    }
  }
}
