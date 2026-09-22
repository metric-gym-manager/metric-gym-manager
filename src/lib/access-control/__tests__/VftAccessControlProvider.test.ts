/**
 * @jest-environment node
 */

/**
 * `VftAccessControlProvider` against the **real** `GetAllDevice` payload.
 *
 * The fixture below is verbatim from a live probe of the Capitalist One VFT
 * account (`https://acccloudlk.com`) on 2026-09-22 — the first time any of this
 * code met the vendor rather than a mock. It is transcription, not invention,
 * and it must not be tidied: every `null` in it is load-bearing. The wrapper
 * returns `null` for almost every optional field, and `z.optional()` accepts
 * `undefined` but **not** `null`, so a single `"TimeZone": null` failed the
 * whole-array parse and `listDevices()` returned `[]` for an account that owns
 * two readers.
 *
 * That failure is silent by construction — `safeParse` failing means "no
 * devices", which is indistinguishable from a gym that has not plugged one in
 * yet. No error, no log, an empty device list, and every later command
 * targeting nothing.
 *
 * See `docs/integrations/vft/vft-api-reference.md` §2.
 */

import { VftAccessControlProvider } from '@/lib/access-control/VftAccessControlProvider'
import type { AccessCredentials } from '@/lib/access-control'
import { TOKEN_CACHE_TTL_SECONDS } from '@/lib/access-control/config'

const credentials: AccessCredentials = {
  baseUrl: 'https://acccloudlk.com',
  email: 'probe@example.com',
  password: 'secret',
}

/** The provider reads bodies with `.text()`; sign-in uses `.json()`. */
function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  } as Response
}

/**
 * One device exactly as `GET /api/device` returned it — all 27 fields.
 */
const LIVE_DEVICE_ROW = {
  DevSN: 'NYU7251900066',
  DevName: 'Device1',
  ATTLOGStamp: null,
  OPERLOGStamp: null,
  ATTPHOTOStamp: null,
  TransFlag: null,
  LastRequestTime: null,
  DevIP: '192.168.8.127',
  DevFaceVersion: null,
  DevFPVersion: '13',
  DevFirmwareVersion: 'ZAM70-NF24HA-Ver3.0.15',
  LockCount: 1,
  ReaderCount: 2,
  UserCount: null,
  AttCount: null,
  FpCount: null,
  TimeZone: null,
  FaceCapacity: null,
  FaceCount: null,
  VendorName: null,
  CompanyID: 8,
  LastUpdateTime: '09/22/2026, 10:36:20',
  CreatedDate: '09/14/2026, 12:08:51',
  ExpireDate: '2027-09-14, 12:08:51',
  IsReboot: false,
  Company: { CompanyName: 'Capitalist One' },
  Area: { AreaName: 'Default Area', AreaID: 1 },
} as const

const LIVE_DEVICE_LIST = [
  LIVE_DEVICE_ROW,
  {
    ...LIVE_DEVICE_ROW,
    DevSN: 'NYU7254500734',
    DevName: 'Device2',
    DevIP: '192.168.8.186',
    DevFirmwareVersion: 'ZAM70-NF24HA-Ver3.3.12',
    LastUpdateTime: '09/22/2026, 18:20:40',
  },
]

describe('VftAccessControlProvider — live GetAllDevice payload', () => {
  let fetchMock: jest.Mock
  let provider: VftAccessControlProvider

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    provider = new VftAccessControlProvider()
  })

  /** Sign-in first, then the listing — the order the provider issues them. */
  function respondWithDevices(devices: unknown): void {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'TOKEN-1' }))
      .mockResolvedValueOnce(jsonResponse(devices))
  }

  it('parses every device the vendor returns', async () => {
    respondWithDevices(LIVE_DEVICE_LIST)

    const devices = await provider.listDevices(credentials)

    // The regression that shipped: two readers on the account, zero parsed.
    expect(devices.map((d) => d.serial)).toEqual([
      'NYU7251900066',
      'NYU7254500734',
    ])
    expect(devices[0].name).toBe('Device1')
  })

  it('reads the area id from the nested Area object', async () => {
    respondWithDevices(LIVE_DEVICE_LIST)

    const [device] = await provider.listDevices(credentials)

    // The collection documents a flat `AreaID`; the live wrapper nests it under
    // `Area`. Reading only the flat form loses the association silently.
    expect(device.areaId).toBe(1)
  })

  it('reports presence as unknown when the vendor sends no presence field', async () => {
    respondWithDevices(LIVE_DEVICE_LIST)

    const [device] = await provider.listDevices(credentials)

    // Live payload has no IsOnline/LastSeen/LastActivity, and LastRequestTime
    // is null. "We cannot tell" must not be rendered as "offline" (2.8).
    expect(device.online).toBeNull()
    expect(device.lastSeenAt).toBeNull()
    expect(device.timezoneOffsetMinutes).toBeNull()
  })

  it('falls back to the serial when the vendor sends a null device name', async () => {
    respondWithDevices([{ ...LIVE_DEVICE_ROW, DevName: null }])

    const [device] = await provider.listDevices(credentials)

    expect(device.name).toBe('NYU7251900066')
  })

  it('drops only the unusable row when one device lacks a serial', async () => {
    respondWithDevices([
      { ...LIVE_DEVICE_ROW, DevSN: null },
      LIVE_DEVICE_LIST[1],
    ])

    const devices = await provider.listDevices(credentials)

    // A row with no serial cannot be addressed, so it is unusable — but it must
    // not take the rest of the account's readers down with it.
    expect(devices.map((d) => d.serial)).toEqual(['NYU7254500734'])
  })

  describe('token cache', () => {
    afterEach(() => {
      jest.useRealTimers()
    })

    it('reuses the cached token for a second call', async () => {
      respondWithDevices(LIVE_DEVICE_LIST)
      fetchMock.mockResolvedValueOnce(jsonResponse(LIVE_DEVICE_LIST))

      await provider.listDevices(credentials)
      await provider.listDevices(credentials)

      // sign-in, list, list — not sign-in, list, sign-in, list.
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('signs in again once the cached token has aged past the TTL', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-09-22T10:00:00Z'))

      respondWithDevices(LIVE_DEVICE_LIST)
      await provider.listDevices(credentials)

      // The vendor documents no token lifetime, so the cache holds one for
      // TOKEN_CACHE_TTL_SECONDS and refreshes rather than discovering expiry
      // through a 401 on a command we care about.
      jest.setSystemTime(
        new Date(Date.now() + (TOKEN_CACHE_TTL_SECONDS + 1) * 1000)
      )

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'TOKEN-2' }))
        .mockResolvedValueOnce(jsonResponse(LIVE_DEVICE_LIST))

      await provider.listDevices(credentials)

      expect(fetchMock).toHaveBeenCalledTimes(4)
      const [, listInit] = fetchMock.mock.calls[3]
      expect(listInit.headers).toMatchObject({ ApiToken: 'TOKEN-2' })
    })

    it('keeps one gym off another gym cached token', async () => {
      respondWithDevices(LIVE_DEVICE_LIST)
      await provider.listDevices(credentials)

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'TOKEN-OTHER' }))
        .mockResolvedValueOnce(jsonResponse(LIVE_DEVICE_LIST))

      await provider.listDevices({ ...credentials, email: 'other@example.com' })

      const [, listInit] = fetchMock.mock.calls[3]
      expect(listInit.headers).toMatchObject({ ApiToken: 'TOKEN-OTHER' })
    })
  })

  it('signs in at the trailing-slash path and sends the token as ApiToken', async () => {
    respondWithDevices(LIVE_DEVICE_LIST)

    await provider.listDevices(credentials)

    const [signInUrl, signInInit] = fetchMock.mock.calls[0]
    expect(signInUrl).toBe('https://acccloudlk.com/api/user/')
    expect(signInInit.method).toBe('POST')

    const [listUrl, listInit] = fetchMock.mock.calls[1]
    expect(listUrl).toBe('https://acccloudlk.com/api/device')
    expect(listInit.headers).toMatchObject({ ApiToken: 'TOKEN-1' })
  })
})
