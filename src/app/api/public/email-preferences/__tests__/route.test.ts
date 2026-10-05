/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { MailingTopic } from '@/features/mailing/config/MailingConfig'
import { createUnsubscribeToken } from '@/features/mailing/utils/unsubscribeToken'

/**
 * POST /api/public/email-preferences with the real use-case and a recorded
 * Resend contacts API: a genuine link opts out of exactly the ticked topics,
 * anything else changes nothing.
 */
const SECRET = 'r'.repeat(64)
const topicUpdates: unknown[] = []
let resendConfigured = true

jest.mock('@/lib/email/resend', () => ({
  readMailingSecret: () => SECRET,
  createResendClient: () =>
    resendConfigured
      ? {
          contacts: {
            topics: {
              update: async (options: unknown) => {
                topicUpdates.push(options)
                return { data: { id: 'contact-1' }, error: null }
              },
              // Reads back what was written, like Resend once it settles.
              list: async () => ({
                data: {
                  data: topicUpdates
                    .flatMap((u) => (u as { topics: { id: string }[] }).topics)
                    .map((t) => ({ id: t.id, subscription: 'opt_out' })),
                  has_more: false,
                },
                error: null,
              }),
            },
          },
        }
      : null,
}))

import { POST } from '../route'

let ip = 0
function request(body: unknown) {
  ip += 1 // a fresh address per test, so the per-IP limit never interferes
  return new NextRequest('http://localhost/api/public/email-preferences', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.1.0.${ip}`,
    },
    body: JSON.stringify(body),
  })
}

const email = 'owner@titanfitness.lk'
const token = createUnsubscribeToken(email, SECRET)

describe('POST /api/public/email-preferences', () => {
  beforeEach(() => {
    topicUpdates.length = 0
    resendConfigured = true
  })

  it('opts out of the ticked topic and answers 200', async () => {
    const res = await POST(
      request({ email, token, topics: [MailingTopic.Updates] })
    )
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(topicUpdates).toEqual([
      {
        email,
        topics: [{ id: expect.any(String), subscription: 'opt_out' }],
      },
    ])
  })

  it('rejects a link whose token is for another address, changing nothing', async () => {
    const res = await POST(
      request({
        email: 'someone@else.lk',
        token,
        topics: [MailingTopic.Marketing],
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_LINK')
    expect(topicUpdates).toHaveLength(0)
  })

  it('rejects a request that ticks nothing', async () => {
    const res = await POST(request({ email, token, topics: [] }))
    expect(res.status).toBe(400)
    expect(topicUpdates).toHaveLength(0)
  })

  it('answers 400, not 500, to a body that is not JSON', async () => {
    // Seen on 2026-10-06: a browser closed mid-submit sent a truncated body,
    // and `request.json()`'s SyntaxError was logged and answered as a 500.
    const res = await POST(
      new NextRequest('http://localhost/api/public/email-preferences', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.2.0.1',
        },
        body: '{"email":"owner@titan',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_REQUEST')
  })

  it('rejects a malformed body', async () => {
    const res = await POST(request({ email }))
    expect(res.status).toBe(400)
  })

  it('answers 503 with a way to reach us when mailing is not configured', async () => {
    resendConfigured = false
    const res = await POST(
      request({ email, token, topics: [MailingTopic.Marketing] })
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('MAILING_UNAVAILABLE')
    expect(body.error.message).toContain('hello@metricgymos.com')
  })

  it('limits repeated requests from one address', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await POST(
        new NextRequest('http://localhost/api/public/email-preferences', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '10.9.9.9',
          },
          body: JSON.stringify({ email, token: 'bad', topics: ['marketing'] }),
        })
      )
      statuses.push(res.status)
    }
    expect(statuses).toContain(429)
  })
})
