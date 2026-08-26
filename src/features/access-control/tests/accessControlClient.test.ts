/**
 * The browser client layer.
 *
 * Two things are worth testing here and the rest is plumbing: **what goes onto
 * the query string**, because an `undefined` reaching it as the text
 * "undefined" fails the route's Zod parse and produces a 400 nobody can read;
 * and **what comes back out of the envelope**, because a client that swallowed
 * the server's wording would replace every carefully-phrased refusal with
 * "Request failed".
 */

import {
  AccessApiError,
  getAccessAccount,
  getAccessEvents,
  updateAccessDevice,
} from '@/features/access-control/services/access-control.service'
import { DeviceEventKind } from '@/features/access-control/config/DeviceEventCodes'

const originalFetch = global.fetch

function mockFetch(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
) {
  const calls: Array<{ url: string; init?: RequestInit }> = []

  global.fetch = jest.fn(async (url: string, requestInit?: RequestInit) => {
    calls.push({ url: String(url), init: requestInit })
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    } as unknown as Response
  }) as unknown as typeof fetch

  return calls
}

afterEach(() => {
  global.fetch = originalFetch
})

describe('the events query string', () => {
  it('omits filters that were never set', async () => {
    // `new URLSearchParams({ kind: undefined })` would serialise the literal
    // text "undefined", which the route's z.nativeEnum rejects — a 400 caused
    // entirely by the client asking for "everything".
    const calls = mockFetch({ success: true, data: [], meta: {} })

    await getAccessEvents({ page: 1, limit: 25 })

    expect(calls[0].url).toBe('/api/access-control/events?page=1&limit=25')
    expect(calls[0].url).not.toContain('undefined')
  })

  it('passes a kind filter through to the server', async () => {
    // Filtering in the browser would return however many of a 25-row page
    // matched, and the pager under it would be describing a different set.
    const calls = mockFetch({ success: true, data: [], meta: {} })

    await getAccessEvents({ kind: DeviceEventKind.Denied })

    expect(calls[0].url).toContain('kind=denied')
  })

  it('reads paging from the envelope meta, not from the row count', async () => {
    mockFetch({
      success: true,
      data: [{ id: 'e1' }],
      meta: { page: 3, totalPages: 9, total: 214 },
    })

    const result = await getAccessEvents({ page: 3 })

    expect(result).toMatchObject({ page: 3, totalPages: 9, total: 214 })
  })
})

describe('the response envelope', () => {
  it('answers null for a gym that has not set up an account', async () => {
    // Not having a door controller is the ordinary state of a gym, not a
    // missing resource — the settings page renders an empty form for it.
    mockFetch({ success: true, data: null })

    await expect(getAccessAccount()).resolves.toBeNull()
  })

  it('throws with the server’s own wording and code', async () => {
    mockFetch(
      {
        success: false,
        error: {
          message:
            'Access control hardware is available on the Enterprise plan',
          code: 'FORBIDDEN',
        },
      },
      { ok: false, status: 403 }
    )

    await expect(getAccessAccount()).rejects.toMatchObject({
      name: 'AccessApiError',
      code: 'FORBIDDEN',
      status: 403,
      message: 'Access control hardware is available on the Enterprise plan',
    })
  })

  it('survives a response that is not JSON at all', async () => {
    // A proxy error page or a gateway timeout. Throwing a TypeError from
    // `.json()` here would surface as a blank screen rather than a message.
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })) as unknown as typeof fetch

    await expect(getAccessAccount()).rejects.toBeInstanceOf(AccessApiError)
  })
})

describe('updating a reader', () => {
  it('sends only the fields that were supplied', async () => {
    // The device PATCH treats an absent field as "leave it alone". Sending
    // `templateCapacity: undefined` explicitly is the same thing over JSON,
    // but sending a name the caller never set would silently rename a reader.
    const calls = mockFetch({ success: true, data: { id: 'device-1' } })

    await updateAccessDevice('device-1', { templateCapacity: 3000 })

    const body = JSON.parse(String(calls[0].init?.body))

    expect(body).toEqual({ templateCapacity: 3000 })
    expect(calls[0].init?.method).toBe('PATCH')
  })
})
