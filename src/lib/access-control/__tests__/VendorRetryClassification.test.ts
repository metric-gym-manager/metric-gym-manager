/**
 * @jest-environment node
 */

/**
 * Which HTTP failures the outbox retries (remote day, F-02).
 *
 * A vendor throttle (429) or timeout (408) clears by waiting, but both are 4xx
 * and every 4xx was read as "the request was wrong", so they were dead-lettered
 * and flagged for a person — which is how a throttle once killed a queue. The
 * other rows pin what must NOT change: a genuinely malformed request is still
 * permanent, a bare 500 and the gateway codes are still transient, and a 500
 * that names its reason is still a rejection.
 */

import { VftAccessControlProvider } from '@/lib/access-control/VftAccessControlProvider'
import type { AccessCredentials } from '@/lib/access-control'

const credentials: AccessCredentials = {
  baseUrl: 'https://acccloudlk.com',
  email: 'probe@example.com',
  password: 'secret',
}

function jsonResponse(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  } as Response
}

describe('VftAccessControlProvider — retry classification (F-02)', () => {
  let fetchMock: jest.Mock
  let provider: VftAccessControlProvider

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new VftAccessControlProvider()
  })

  /** Sign-in succeeds; the command itself answers with this status and body. */
  async function grantAnsweringWith(status: number, body: unknown = '') {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'TOKEN-1' }))
      .mockResolvedValueOnce(jsonResponse(body, status))

    return provider.grantAccess(credentials, {
      deviceSerial: 'NYU7251900077',
      subjectId: '100001',
    })
  }

  it.each([429, 408])(
    'retries a %i without flagging a person',
    async (status) => {
      const outcome = await grantAnsweringWith(status)

      expect(outcome).toMatchObject({
        status: 'failed',
        retryable: true,
        needsAttention: false,
      })
    }
  )

  it('still treats a 400 as permanent and needing attention', async () => {
    const outcome = await grantAnsweringWith(400, { message: 'Bad request' })

    expect(outcome).toMatchObject({
      status: 'failed',
      retryable: false,
      needsAttention: true,
    })
  })

  it('still treats a 500 that names its reason as permanent', async () => {
    const outcome = await grantAnsweringWith(500, {
      message: "Data too long for column 'EmpId'",
    })

    expect(outcome).toMatchObject({ status: 'failed', retryable: false })
  })

  it('still retries a bare 500', async () => {
    const outcome = await grantAnsweringWith(500)

    expect(outcome).toMatchObject({ status: 'failed', retryable: true })
  })

  it('still retries a 502', async () => {
    const outcome = await grantAnsweringWith(502, { message: 'Bad gateway' })

    expect(outcome).toMatchObject({ status: 'failed', retryable: true })
  })
})
