/**
 * @jest-environment node
 */
import { createResendClient, readMailingSecret } from '../resend'

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
