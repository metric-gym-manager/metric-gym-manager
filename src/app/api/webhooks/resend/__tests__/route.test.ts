/**
 * @jest-environment node
 */
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

/**
 * POST /api/webhooks/resend — Resend's events for the outreach series
 * (owner request, 2026-10-06): bounces, complaints, opt-outs and mail
 * received on the outreach domain.
 *
 * - **The signature is the only credential.** An unsigned or forged
 *   delivery changes nothing and gets 401.
 * - **Always 200 for business outcomes** (an event we do not act on, a
 *   malformed payload): Resend retries anything else for days, and the same
 *   payload will be just as unusable. A 500 is for a fault a retry may fix.
 */
const execute = jest.fn()
const createHandleMailingEvent = jest.fn((..._args: unknown[]) => ({ execute }))

jest.mock('@/features/mailing', () => ({
  ...jest.requireActual('@/features/mailing/schemas/mailingEvents.schemas'),
  createHandleMailingEvent: (...args: unknown[]) =>
    createHandleMailingEvent(...args),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ client: 'service-role' }),
}))

import { GET, POST } from '../route'

const KEY = Buffer.from('w'.repeat(32))
const SECRET = `whsec_${KEY.toString('base64')}`

function request(
  event: unknown,
  options: { key?: Buffer; sign?: boolean } = {}
) {
  const body = JSON.stringify(event)
  const id = 'msg_1'
  const timestamp = String(Math.floor(Date.now() / 1000))
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.sign !== false) {
    headers['svix-id'] = id
    headers['svix-timestamp'] = timestamp
    headers['svix-signature'] = `v1,${createHmac('sha256', options.key ?? KEY)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64')}`
  }
  return new NextRequest('https://www.metricgymos.com/api/webhooks/resend', {
    method: 'POST',
    body,
    headers,
  })
}

const complaint = {
  type: 'email.complained',
  created_at: '2026-10-14T05:00:00Z',
  data: {
    email_id: 'em_1',
    from: 'Metric Gym OS <hello@go.metricgymos.com>',
    to: ['a@gym.lk'],
    subject: 'Tired of chasing payments?',
    created_at: '2026-10-14T04:31:00Z',
    message_id: '<m1@resend>',
    tags: { kind: 'outreach', campaign: 'intro-2026-10', email: '1' },
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test_123'
  process.env.RESEND_WEBHOOK_SECRET = SECRET
  execute.mockResolvedValue({
    outcome: 'stopped',
    status: 'complained',
    campaigns: ['intro-2026-10'],
    paused: [],
  })
})

describe('POST /api/webhooks/resend', () => {
  it('acts on a signed event, with the service-role client', async () => {
    const response = await POST(request(complaint))
    expect(response.status).toBe(200)
    expect(createHandleMailingEvent).toHaveBeenCalledWith({
      client: 'service-role',
    })
    expect(execute).toHaveBeenCalledWith({
      type: 'email.complained',
      data: {
        email_id: 'em_1',
        from: 'Metric Gym OS <hello@go.metricgymos.com>',
        to: ['a@gym.lk'],
      },
    })
    expect((await response.json()).data).toMatchObject({ outcome: 'stopped' })
  })

  it('refuses an unsigned delivery, and acts on nothing', async () => {
    expect((await POST(request(complaint, { sign: false }))).status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses a delivery signed with another secret', async () => {
    const forged = request(complaint, { key: Buffer.from('x'.repeat(32)) })
    expect((await POST(forged)).status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses to run unconfigured, rather than trusting anything', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    expect((await POST(request(complaint))).status).toBe(500)
    expect(execute).not.toHaveBeenCalled()
  })

  it('acknowledges an event it does not act on', async () => {
    const response = await POST(
      request({ type: 'email.opened', data: { email_id: 'em_1' } })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({
      outcome: 'ignored',
      reason: 'email.opened is not handled',
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('acknowledges a malformed event of a kind it handles, without acting', async () => {
    const response = await POST(
      request({ type: 'email.bounced', data: { email_id: 'em_1' } })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({ outcome: 'invalid_payload' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('answers 500 when acting failed, so Resend retries, and says nothing internal', async () => {
    execute.mockRejectedValue(
      new Error('relation "outreach_events" does not exist')
    )
    const response = await POST(request(complaint))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain(
      'outreach_events'
    )
  })
})

describe('GET /api/webhooks/resend', () => {
  it('says whether it is configured, never the secret', async () => {
    const body = await (await GET()).json()
    expect(body.data).toMatchObject({ configured: true, method: 'POST' })
    expect(JSON.stringify(body)).not.toContain(SECRET)
  })
})
