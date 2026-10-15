/**
 * @jest-environment node
 */

/**
 * `GetEventsbyDevSN` as the provider sends it (visit 2, CD-2).
 *
 * Path and casing are vendor fact (`docs/integrations/vft/`): a POST to
 * `/api/devicecmd/events` with the reader in `DevSN`, like every other
 * device command.
 */

import { VftAccessControlProvider } from '@/lib/access-control/VftAccessControlProvider'
import type { AccessCredentials } from '@/lib/access-control'

const credentials: AccessCredentials = {
  baseUrl: 'https://acccloudlk.com',
  email: 'events-upload@example.com',
  password: 'secret',
}

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  } as Response
}

describe('VftAccessControlProvider.requestEventsUpload', () => {
  it('POSTs /api/devicecmd/events with the reader serial as DevSN', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'TOKEN-1' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Command queued' }))
    global.fetch = fetchMock as unknown as typeof fetch

    const outcome = await new VftAccessControlProvider().requestEventsUpload(
      credentials,
      'NYU7251900077'
    )

    expect(outcome.status).not.toBe('failed')
    const [url, init] = fetchMock.mock.calls[1]
    const parsed = new URL(String(url))
    expect(parsed.pathname).toBe('/api/devicecmd/events')
    expect(parsed.searchParams.get('DevSN')).toBe('NYU7251900077')
    expect(init.method).toBe('POST')
  })
})
