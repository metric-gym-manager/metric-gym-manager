/**
 * @jest-environment node
 */
import { createHmac } from 'node:crypto'
import {
  createResendClient,
  readMailingSecret,
  verifyResendWebhook,
} from '../resend'

describe('createResendClient', () => {
  it('returns no client when RESEND_API_KEY is unset or blank', () => {
    expect(createResendClient({})).toBeNull()
    expect(createResendClient({ RESEND_API_KEY: '   ' })).toBeNull()
  })

  it('returns a client with a contacts API when the key is set', () => {
    const client = createResendClient({ RESEND_API_KEY: 're_test_123' })
    expect(client).not.toBeNull()
    expect(typeof client?.contacts.get).toBe('function')
  })
})

describe('readMailingSecret', () => {
  it('returns null when the secret is unset or too short to sign with', () => {
    expect(readMailingSecret({})).toBeNull()
    expect(
      readMailingSecret({ MARKETING_UNSUBSCRIBE_SECRET: 'short' })
    ).toBeNull()
  })

  it('returns a trimmed secret of 32 characters or more', () => {
    const secret = 'f'.repeat(64)
    expect(
      readMailingSecret({ MARKETING_UNSUBSCRIBE_SECRET: ` ${secret} ` })
    ).toBe(secret)
  })
})

/**
 * Resend signs each webhook delivery the Standard Webhooks way (Svix): an
 * HMAC-SHA256 of `id.timestamp.body` with the endpoint's `whsec_` secret,
 * sent in `svix-id`, `svix-timestamp` and `svix-signature`. Computed here
 * from the spec, so the test checks the SDK's verification, not a mock of it.
 */
describe('verifyResendWebhook', () => {
  const KEY = Buffer.from('k'.repeat(32))
  const SECRET = `whsec_${KEY.toString('base64')}`
  const ENV = { RESEND_API_KEY: 're_test_123', RESEND_WEBHOOK_SECRET: SECRET }
  const BODY = JSON.stringify({ type: 'email.complained', data: {} })

  function headers(
    body = BODY,
    options: { key?: Buffer; at?: number; prefix?: 'svix' | 'webhook' } = {}
  ) {
    const id = 'msg_2abc'
    const timestamp = String(Math.floor((options.at ?? Date.now()) / 1000))
    const signature = `v1,${createHmac('sha256', options.key ?? KEY)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64')}`
    const prefix = options.prefix ?? 'svix'
    const values: Record<string, string> = {
      [`${prefix}-id`]: id,
      [`${prefix}-timestamp`]: timestamp,
      [`${prefix}-signature`]: signature,
    }
    return { get: (name: string) => values[name] ?? null }
  }

  it('accepts a delivery signed with the endpoint’s secret, and returns its event', () => {
    expect(verifyResendWebhook(BODY, headers(), ENV)).toEqual({
      ok: true,
      event: { type: 'email.complained', data: {} },
    })
  })

  it('accepts the Standard Webhooks header names too', () => {
    expect(
      verifyResendWebhook(BODY, headers(BODY, { prefix: 'webhook' }), ENV).ok
    ).toBe(true)
  })

  it('refuses a body changed after signing', () => {
    expect(
      verifyResendWebhook(
        BODY.replace('complained', 'delivered'),
        headers(),
        ENV
      )
    ).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('refuses a delivery signed with another secret', () => {
    expect(
      verifyResendWebhook(
        BODY,
        headers(BODY, { key: Buffer.from('x'.repeat(32)) }),
        ENV
      )
    ).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('refuses a replay of an old delivery', () => {
    expect(
      verifyResendWebhook(
        BODY,
        headers(BODY, { at: Date.now() - 60 * 60_000 }),
        ENV
      )
    ).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('refuses a delivery with no signature', () => {
    expect(verifyResendWebhook(BODY, { get: () => null }, ENV)).toEqual({
      ok: false,
      reason: 'invalid_signature',
    })
  })

  it('says when it is not configured, rather than accepting anything', () => {
    expect(
      verifyResendWebhook(BODY, headers(), { RESEND_API_KEY: 're_test_123' })
    ).toEqual({ ok: false, reason: 'not_configured' })
    expect(
      verifyResendWebhook(BODY, headers(), { RESEND_WEBHOOK_SECRET: SECRET })
    ).toEqual({ ok: false, reason: 'not_configured' })
  })
})
