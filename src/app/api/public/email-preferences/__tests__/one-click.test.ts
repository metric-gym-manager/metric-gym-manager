/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import {
  MailingTopic,
  RESEND_TOPIC_IDS,
} from '@/features/mailing/config/MailingConfig'
import { createUnsubscribeToken } from '@/features/mailing/utils/unsubscribeToken'

/**
 * The `List-Unsubscribe` one-click endpoint (RFC 8058). Gmail, Yahoo and
 * Outlook show their own "Unsubscribe" button for bulk mail and POST
 * `List-Unsubscribe=One-Click` to the header's https URL, with no page and no
 * person in between. It must opt the address out of that topic for real, from
 * the link's signed token alone.
 */
const SECRET = 'r'.repeat(64)
const topicUpdates: {
  email: string
  topics: { id: string; subscription: string }[]
}[] = []

jest.mock('@/lib/email/resend', () => ({
  readMailingSecret: () => SECRET,
  createResendClient: () => ({
    contacts: {
      topics: {
        update: async (options: (typeof topicUpdates)[number]) => {
          topicUpdates.push(options)
          return { data: { id: 'contact-1' }, error: null }
        },
        list: async () => ({
          data: {
            data: topicUpdates
              .flatMap((u) => u.topics)
              .map((t) => ({ id: t.id, subscription: 'opt_out' })),
            has_more: false,
          },
          error: null,
        }),
      },
    },
  }),
}))

import { GET, POST } from '../one-click/route'

const email = 'owner+gym@titanfitness.lk'
const token = createUnsubscribeToken(email, SECRET)

let ip = 0
function url(params: Record<string, string>) {
  const u = new URL('http://localhost/api/public/email-preferences/one-click')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u.toString()
}
function post(params: Record<string, string>) {
  ip += 1
  return new NextRequest(url(params), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': `10.2.0.${ip}`,
    },
    body: 'List-Unsubscribe=One-Click',
  })
}

beforeEach(() => {
  topicUpdates.length = 0
})

describe('POST /api/public/email-preferences/one-click', () => {
  it('opts the address out of that topic, from the signed link alone', async () => {
    const response = await POST(
      post({ email, token, topic: MailingTopic.Marketing })
    )
    expect(response.status).toBe(200)
    expect(topicUpdates).toEqual([
      {
        email,
        topics: [
          {
            id: RESEND_TOPIC_IDS[MailingTopic.Marketing],
            subscription: 'opt_out',
          },
        ],
      },
    ])
  })

  it('changes nothing for a forged token', async () => {
    const response = await POST(
      post({
        email,
        token: createUnsubscribeToken('someone@else.lk', SECRET),
        topic: 'marketing',
      })
    )
    expect(response.status).toBe(400)
    expect(topicUpdates).toEqual([])
  })

  it('changes nothing without a known topic', async () => {
    expect(
      (await POST(post({ email, token, topic: 'everything' }))).status
    ).toBe(400)
    expect((await POST(post({ email, token }))).status).toBe(400)
    expect(topicUpdates).toEqual([])
  })
})

describe('GET /api/public/email-preferences/one-click', () => {
  it('sends a person who opens the link to the unsubscribe page, changing nothing', async () => {
    const response = await GET(
      new NextRequest(url({ email, token, topic: 'marketing' }))
    )
    expect(response.status).toBe(303)
    const location = new URL(response.headers.get('location') ?? '')
    expect(location.pathname).toBe('/unsubscribe')
    expect(location.searchParams.get('email')).toBe(email)
    expect(location.searchParams.get('token')).toBe(token)
    expect(location.searchParams.get('topic')).toBe('marketing')
    expect(topicUpdates).toEqual([])
  })
})
