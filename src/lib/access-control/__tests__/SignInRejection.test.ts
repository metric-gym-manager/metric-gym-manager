/**
 * @jest-environment node
 */

/**
 * What a failed vendor sign-in means to the outbox (remote day, F-03).
 *
 * A rejected sign-in (the vendor says no to our email and password) is not a
 * transient fault: it stays rejected until a person re-enters the account, so
 * it must dead-letter as needing attention and be reported on the account. A
 * sign-in that merely failed to be answered (the vendor is down) is the
 * opposite — an ordinary vendor failure, retried like any other. Both used to
 * look identical: a non-retryable failure flagged for nobody.
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

describe('VftAccessControlProvider — sign-in failures (F-03)', () => {
  let fetchMock: jest.Mock
  let provider: VftAccessControlProvider

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new VftAccessControlProvider()
  })

  const grant = () =>
    provider.grantAccess(credentials, {
      deviceSerial: 'NYU7251900077',
      subjectId: '100001',
    })

  it.each([400, 401, 403])(
    'flags a sign-in rejected with %i as rejected credentials needing attention',
    async (status) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, status))

      const outcome = await grant()

      expect(outcome).toMatchObject({
        status: 'failed',
        retryable: false,
        needsAttention: true,
        credentialsRejected: true,
      })
    }
  )

  it.each([500, 502, 503])(
    'treats a sign-in answered with %i as an ordinary retryable failure',
    async (status) => {
      fetchMock.mockResolvedValueOnce(jsonResponse('', status))

      const outcome = await grant()

      expect(outcome).toMatchObject({ status: 'failed', retryable: true })
      expect(outcome).not.toHaveProperty('credentialsRejected')
    }
  )

  it('treats a sign-in that never reached the vendor as retryable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const outcome = await grant()

    expect(outcome).toMatchObject({ status: 'failed', retryable: true })
    expect(outcome).not.toHaveProperty('credentialsRejected')
  })
})
