/**
 * @jest-environment node
 */

/**
 * The inbound device webhook.
 *
 * Two properties are load-bearing and neither is visible from the happy path:
 *
 *  - **The path token is the only credential.** The push protocol defines no
 *    header signature, so a route that accepted an unset or mismatched token
 *    would be an open write endpoint.
 *  - **Always 200 for business outcomes.** A non-200 makes the sender retry or
 *    disable the callback, and a malformed batch will be just as malformed on
 *    the retry. Only a genuine transient fault earns a 500.
 */

import { NextRequest } from 'next/server'
import type { RecordAccessEventsSummary } from '@/features/access-control/services/RecordAccessEvents'

const mockExecute = jest.fn()

jest.mock('@/features/access-control', () => ({
  createRecordAccessEvents: jest.fn(() => ({ execute: mockExecute })),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({})),
}))

import { POST } from '../[token]/route'

const TOKEN = 'a'.repeat(64)

function makeRequest(body: unknown, malformed = false): NextRequest {
  return {
    json: async () => {
      if (malformed) throw new SyntaxError('Unexpected token')
      return body
    },
  } as unknown as NextRequest
}

function paramsFor(token: string) {
  return { params: Promise.resolve({ token }) }
}

// Every field of `RecordAccessEventsSummary`: the route reads them, and a
// fixture missing one passes for the wrong reason or fails for one no real
// delivery can produce.
const cleanSummary: RecordAccessEventsSummary = {
  received: 1,
  stored: 1,
  duplicates: 0,
  redeliveredShifted: 0,
  pulledScans: 0,
  unknownDevice: 0,
  unknownSerials: [],
  malformed: 0,
  unreadableDelivery: false,
  unreadableFieldNames: [],
  enrolmentsConfirmed: 0,
  refusalRepairsQueued: 0,
  driftingDevices: [],
  errors: [],
}

describe('POST /api/webhooks/access-control/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ACCESS_CONTROL_WEBHOOK_TOKEN = TOKEN
    mockExecute.mockResolvedValue(cleanSummary)
  })

  afterEach(() => {
    delete process.env.ACCESS_CONTROL_WEBHOOK_TOKEN
  })

  describe('authentication', () => {
    it('accepts the configured token', async () => {
      const response = await POST(makeRequest([]), paramsFor(TOKEN))

      expect(response.status).toBe(200)
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('rejects a wrong token without ingesting anything', async () => {
      const response = await POST(makeRequest([]), paramsFor('b'.repeat(64)))

      expect(response.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('rejects a token of the wrong length', async () => {
      // The constant-time compare returns false on a length mismatch rather
      // than throwing, which would itself leak the expected length.
      const response = await POST(makeRequest([]), paramsFor('short'))

      expect(response.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('refuses everything when no token is configured', async () => {
      delete process.env.ACCESS_CONTROL_WEBHOOK_TOKEN

      const response = await POST(makeRequest([]), paramsFor(TOKEN))

      expect(response.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })

  describe('the always-200 contract', () => {
    it('acknowledges a body that is not JSON', async () => {
      const response = await POST(makeRequest(null, true), paramsFor(TOKEN))

      expect(response.status).toBe(200)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('acknowledges a batch that was entirely unknown devices', async () => {
      // On a shared vendor account this is expected traffic, not an error.
      mockExecute.mockResolvedValue({
        ...cleanSummary,
        stored: 0,
        unknownDevice: 3,
      })

      const response = await POST(makeRequest([]), paramsFor(TOKEN))

      expect(response.status).toBe(200)
    })

    it('acknowledges a batch with per-event errors', async () => {
      mockExecute.mockResolvedValue({
        ...cleanSummary,
        errors: ['Unparseable timestamp "yesterday"'],
      })

      const response = await POST(makeRequest([]), paramsFor(TOKEN))

      expect(response.status).toBe(200)
    })

    it('returns 500 for a transient fault so the delivery is retried', async () => {
      mockExecute.mockRejectedValue(new Error('database down'))

      const response = await POST(makeRequest([]), paramsFor(TOKEN))

      expect(response.status).toBe(500)
    })
  })

  describe('clock drift', () => {
    it('warns when a reader clock has drifted', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

      mockExecute.mockResolvedValue({
        ...cleanSummary,
        driftingDevices: ['SER-001'],
      })

      const response = await POST(makeRequest([]), paramsFor(TOKEN))

      // The expiry cutover runs on the device's own clock, so drift moves the
      // moment a member stops being admitted — it cannot pass silently.
      expect(response.status).toBe(200)
      expect(warn).toHaveBeenCalled()

      warn.mockRestore()
    })
  })

  /**
   * Every delivery leaves one line in the runtime log.
   *
   * Before this, a delivery we accepted and discarded — every event from a
   * serial we do not know — produced a 200 and nothing else, anywhere. The
   * first time real hardware calls us, "the vendor never called" and "the
   * vendor called with a serial we do not recognise" have to be told apart
   * from the log alone, because nothing reaches the database in either case.
   */
  describe('the delivery trace', () => {
    let info: jest.SpyInstance
    let warn: jest.SpyInstance

    beforeEach(() => {
      info = jest.spyOn(console, 'info').mockImplementation(() => {})
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      info.mockRestore()
      warn.mockRestore()
    })

    it('logs the counts of every delivery that carried events', async () => {
      mockExecute.mockResolvedValue({
        ...cleanSummary,
        received: 3,
        stored: 2,
        duplicates: 1,
        enrolmentsConfirmed: 1,
      })

      await POST(makeRequest([{}, {}, {}]), paramsFor(TOKEN))

      expect(info).toHaveBeenCalledTimes(1)
      const [label, trace] = info.mock.calls[0]
      expect(label).toBe('Access webhook delivery')
      expect(trace).toMatchObject({
        received: 3,
        stored: 2,
        duplicates: 1,
        enrolmentsConfirmed: 1,
      })
    })

    it('names the serials it dropped, as a warning', async () => {
      mockExecute.mockResolvedValue({
        ...cleanSummary,
        received: 1,
        stored: 0,
        unknownDevice: 1,
        unknownSerials: ['QEM1253800017'],
      })

      await POST(makeRequest([{}]), paramsFor(TOKEN))

      expect(info.mock.calls[0][1]).toMatchObject({
        unknownDevice: 1,
        unknownSerials: ['QEM1253800017'],
      })
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('QEM1253800017')
      )
    })

    it('never writes the path token into the log', async () => {
      mockExecute.mockResolvedValue({
        ...cleanSummary,
        received: 1,
        unknownDevice: 1,
        unknownSerials: ['QEM1253800017'],
      })

      await POST(makeRequest([{}]), paramsFor(TOKEN))

      const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls])
      expect(logged).not.toContain(TOKEN)
    })

    it('stays quiet for an empty delivery', async () => {
      mockExecute.mockResolvedValue({ ...cleanSummary, received: 0, stored: 0 })

      await POST(makeRequest([]), paramsFor(TOKEN))

      expect(info).not.toHaveBeenCalled()
    })
  })

  it('never reveals whether anything was stored', async () => {
    mockExecute.mockResolvedValue({ ...cleanSummary, stored: 0 })
    const quiet = await POST(makeRequest([]), paramsFor(TOKEN))

    mockExecute.mockResolvedValue({ ...cleanSummary, stored: 5 })
    const busy = await POST(makeRequest([]), paramsFor(TOKEN))

    expect(await quiet.json()).toEqual(await busy.json())
  })
})
