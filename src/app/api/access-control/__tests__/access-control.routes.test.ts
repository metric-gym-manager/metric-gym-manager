/**
 * @jest-environment node
 */

/**
 * The gym-facing access-control routes.
 *
 * What these pin down is not the happy path — it is the three things that
 * would be silent if they broke:
 *
 *  - **Every route is behind the entitlement gate.** One handler that forgot
 *    it is one tier boundary gone.
 *  - **A device is resolved against the caller's own gym before it is
 *    touched.** The vendor token reaches every terminal on the account, so
 *    this lookup — not the vendor — is the tenant boundary.
 *  - **Credentials are never read back**, not even to the owner who typed them.
 */

const mockGuard = jest.fn()
const mockRepo = {
  findAccountByGymId: jest.fn(),
  saveCredentials: jest.fn(),
  listDevices: jest.fn(),
  findDeviceById: jest.fn(),
  registerDevice: jest.fn(),
  renameDevice: jest.fn(),
  setDeviceActive: jest.fn(),
  unlinkDevice: jest.fn(),
  listEvents: jest.fn(),
  getMemberAccessContext: jest.fn(),
}
const mockOpenDoor = jest.fn()
const mockRegisterExecute = jest.fn()
const mockEnrol = jest.fn()
const mockRecordConsent = jest.fn()
const mockRepairReader = jest.fn()
const mockSyncExecute = jest.fn()

jest.mock('@/lib/auth/requireAccessControlGym', () => ({
  requireAccessControlGym: (...args: unknown[]) => mockGuard(...args),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({})),
}))

jest.mock('@/features/access-control', () => {
  const actual = jest.requireActual('@/features/access-control')
  return {
    ...actual,
    createAccessControlRepository: jest.fn(() => mockRepo),
    createOperateDevice: jest.fn(() => ({
      openDoor: mockOpenDoor,
      repairReader: mockRepairReader,
    })),
    createRegisterDevice: jest.fn(() => ({ execute: mockRegisterExecute })),
    createManageMemberBiometric: jest.fn(() => ({
      enrol: mockEnrol,
      recordConsent: mockRecordConsent,
    })),
    createSyncMemberAccess: jest.fn(() => ({ execute: mockSyncExecute })),
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { GET as getAccount, PUT as putAccount } from '../account/route'
import { GET as getDevices, POST as postDevice } from '../devices/route'
import { PATCH as patchDevice } from '../devices/[id]/route'
import { POST as enableDevice } from '../devices/[id]/enable/route'
import { POST as openDoorRoute } from '../devices/[id]/open/route'
import { POST as repairDevice } from '../devices/[id]/repair/route'
import { GET as getEvents } from '../events/route'
import { POST as enrolMember } from '../members/[id]/enrol/route'
import { POST as recordConsent } from '../members/[id]/consent/route'
import { POST as syncMember } from '../members/[id]/sync/route'

const CALLER = { gymId: 'gym-1', userId: 'user-1', supabase: {} }

function allow() {
  mockGuard.mockResolvedValue({ caller: CALLER, error: null })
}

function deny(status: number) {
  mockGuard.mockResolvedValue({
    caller: null,
    error: NextResponse.json({ success: false }, { status }),
  })
}

function jsonRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

function queryRequest(query: string): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
  } as unknown as NextRequest
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

const DEVICE = {
  id: 'device-1',
  gym_id: 'gym-1',
  device_serial: 'SER-001',
  device_name: 'Front Door',
  area_id: 1,
  timezone_offset_minutes: 330,
  is_active: true,
  last_seen_at: null,
  last_synced_at: null,
  template_count: 10,
  template_capacity: 3000,
  clock_skew_seconds: null,
  clock_skew_measured_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('Access-control routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    allow()
    // By default registering is just the repository write, as the route used to
    // do it; the serial check has its own cases below and its own suite.
    mockRegisterExecute.mockImplementation(
      async (gymId: string, input: unknown) => ({
        device: await mockRepo.registerDevice(gymId, input),
      })
    )
  })

  describe('the entitlement gate', () => {
    it.each([
      ['GET /account', () => getAccount()],
      ['GET /devices', () => getDevices()],
      ['GET /events', () => getEvents(queryRequest(''))],
      [
        'POST /devices/[id]/enable',
        () => enableDevice(jsonRequest({}), params('device-1')),
      ],
      [
        'POST /devices/[id]/open',
        () => openDoorRoute(jsonRequest({}), params('device-1')),
      ],
    ])(
      '%s returns the guard response for a non-Enterprise gym',
      async (_name, call) => {
        deny(403)

        const response = await call()

        expect(response.status).toBe(403)
        // Nothing was read or written before the gate.
        expect(mockRepo.listDevices).not.toHaveBeenCalled()
        expect(mockOpenDoor).not.toHaveBeenCalled()
      }
    )
  })

  describe('GET /account', () => {
    it('never returns the stored credentials', async () => {
      mockRepo.findAccountByGymId.mockResolvedValue({
        id: 'acct-1',
        gym_id: 'gym-1',
        base_url: 'https://vft.example.com',
        area_id: 1,
        is_active: true,
        // Recent, so `verified` is legitimately true here. A fixed date used
        // to serve: `verified` once meant "a check succeeded at some point,
        // ever", which is what let the card read Connected for twenty-five
        // days through a total outage. It now expires.
        last_verified_at: new Date().toISOString(),
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })

      const body = await (await getAccount()).json()
      const serialized = JSON.stringify(body)

      expect(body.data.verified).toBe(true)
      // Write-only by design: the row is serialized field by field, so a
      // column added later cannot appear in a response nobody re-reviewed.
      expect(serialized).not.toContain('password')
      expect(serialized).not.toContain('email')
    })

    it('reports an unconfigured gym as null rather than an error', async () => {
      mockRepo.findAccountByGymId.mockResolvedValue(null)

      const response = await getAccount()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toBeNull()
    })
  })

  describe('PUT /account', () => {
    it('rejects a malformed body before writing anything', async () => {
      const response = await putAccount(
        jsonRequest({ baseUrl: 'not-a-url', email: 'x', password: '' })
      )

      expect(response.status).toBe(400)
      expect(mockRepo.saveCredentials).not.toHaveBeenCalled()
    })
  })

  describe('POST /devices', () => {
    it('rejects a serial with characters that could escape a URL path', async () => {
      const response = await postDevice(
        jsonRequest({ deviceSerial: '../../etc', deviceName: 'Door' })
      )

      expect(response.status).toBe(400)
      expect(mockRepo.registerDevice).not.toHaveBeenCalled()
    })

    it('returns 409 when the serial is already claimed', async () => {
      const conflict = new Error('Device serial: already exists')
      conflict.name = 'ConflictError'
      mockRepo.registerDevice.mockRejectedValue(conflict)

      const response = await postDevice(
        jsonRequest({ deviceSerial: 'SER-001', deviceName: 'Door' })
      )

      // A serial belongs to exactly one gym: it is how a webhook event finds
      // its gym, so two claims would make that routing ambiguous.
      expect(response.status).toBe(409)
    })
  })

  describe('POST /devices — the serial is checked against the VFT account (F-07)', () => {
    it('answers 400 with a plain message when the serial is not on the account', async () => {
      mockRegisterExecute.mockResolvedValue({ notOnAccount: true })

      const response = await postDevice(
        jsonRequest({ deviceSerial: 'NYU7251900077', deviceName: 'Door' })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toEqual({
        code: 'BAD_REQUEST',
        message:
          'This serial is not on your VFT account. Check the label on the reader, or ask VFT to add the reader to your account.',
      })
    })

    it('hands the use case the caller’s gym and the serial in capitals', async () => {
      mockRegisterExecute.mockResolvedValue({ notOnAccount: true })

      await postDevice(
        jsonRequest({ deviceSerial: ' nyu7251900077 ', deviceName: 'Door' })
      )

      expect(mockRegisterExecute).toHaveBeenCalledWith(
        'gym-1',
        expect.objectContaining({ deviceSerial: 'NYU7251900077' })
      )
    })

    it('answers 201 with the registered reader otherwise', async () => {
      mockRegisterExecute.mockResolvedValue({ device: DEVICE })

      const response = await postDevice(
        jsonRequest({ deviceSerial: 'SER-001', deviceName: 'Door' })
      )

      expect(response.status).toBe(201)
    })
  })

  describe('the device tenant boundary', () => {
    it('refuses to rename a device that is not this gym’s', async () => {
      mockRepo.findDeviceById.mockResolvedValue(null)

      const response = await patchDevice(
        jsonRequest({ deviceName: 'Renamed' }),
        params('someone-elses-device')
      )

      expect(response.status).toBe(404)
      expect(mockRepo.renameDevice).not.toHaveBeenCalled()
    })

    it('refuses to enable a device that is not this gym’s', async () => {
      mockRepo.findDeviceById.mockResolvedValue(null)

      const response = await enableDevice(
        jsonRequest({}),
        params('someone-elses-device')
      )

      expect(response.status).toBe(404)
      expect(mockRepo.setDeviceActive).not.toHaveBeenCalled()
    })

    it('scopes the lookup to the caller’s gym, not the id alone', async () => {
      mockRepo.findDeviceById.mockResolvedValue(DEVICE)

      await enableDevice(jsonRequest({}), params('device-1'))

      expect(mockRepo.findDeviceById).toHaveBeenCalledWith('gym-1', 'device-1')
    })
  })

  describe('POST /devices/[id]/open', () => {
    it('passes the session user as the actor, never a client-supplied id', async () => {
      mockOpenDoor.mockResolvedValue({ applicable: true, dispatched: true })

      await openDoorRoute(
        jsonRequest({ actorId: 'someone-else' }),
        params('device-1')
      )

      expect(mockOpenDoor).toHaveBeenCalledWith({
        gymId: 'gym-1',
        deviceId: 'device-1',
        actorId: 'user-1',
      })
    })

    it('reports an unreachable reader as 502, not a success', async () => {
      mockOpenDoor.mockResolvedValue({
        applicable: true,
        dispatched: false,
        error: 'No response',
      })

      const response = await openDoorRoute(jsonRequest({}), params('device-1'))

      expect(response.status).toBe(502)
    })
  })

  describe('GET /events', () => {
    it('paginates and never exposes the raw vendor payload', async () => {
      mockRepo.listEvents.mockResolvedValue({
        events: [
          {
            id: 'event-1',
            gym_id: 'gym-1',
            member_id: 'member-1',
            device_serial: 'SER-001',
            subject_id: 100001,
            occurred_at: '2026-01-10T06:30:00Z',
            verify_type: 1,
            checking_status: 0,
            event_code: '0',
            raw: { secretVendorField: 'do-not-expose' },
            created_at: '2026-01-10T06:30:01Z',
          },
        ],
        total: 1,
      })

      const body = await (
        await getEvents(queryRequest('page=1&limit=10'))
      ).json()

      expect(mockRepo.listEvents).toHaveBeenCalledWith('gym-1', {
        page: 1,
        limit: 10,
      })
      expect(JSON.stringify(body)).not.toContain('do-not-expose')
      expect(body.data[0].description).toBeDefined()
    })

    it('rejects a limit beyond the cap', async () => {
      const response = await getEvents(queryRequest('limit=5000'))

      expect(response.status).toBe(400)
      expect(mockRepo.listEvents).not.toHaveBeenCalled()
    })
  })

  describe('POST /devices/[id]/repair', () => {
    it("answers 404 for another gym's reader", async () => {
      mockRepairReader.mockResolvedValue({
        applicable: false,
        membersQueued: 0,
        error: 'Device not found for this gym',
      })

      const response = await repairDevice(
        { json: async () => ({}) } as unknown as NextRequest,
        params('other-gyms-device')
      )

      expect(response.status).toBe(404)
      expect(mockRepairReader).toHaveBeenCalledWith({
        gymId: 'gym-1',
        deviceId: 'other-gyms-device',
        actorId: 'user-1',
      })
    })

    it('reports how many members were queued', async () => {
      mockRepairReader.mockResolvedValue({ applicable: true, membersQueued: 3 })

      const response = await repairDevice(
        { json: async () => ({}) } as unknown as NextRequest,
        params('device-1')
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toEqual({ membersQueued: 3 })
    })

    it('refuses callers the entitlement gate refuses', async () => {
      deny(403)

      const response = await repairDevice(
        { json: async () => ({}) } as unknown as NextRequest,
        params('device-1')
      )

      expect(response.status).toBe(403)
      expect(mockRepairReader).not.toHaveBeenCalled()
    })
  })

  describe('POST /members/[id]/consent', () => {
    it("answers 404 for another gym's member and records nothing", async () => {
      mockRepo.getMemberAccessContext.mockResolvedValue({
        memberId: 'member-1',
        gymId: 'gym-2',
      })

      const response = await recordConsent(
        { json: async () => ({}) } as unknown as NextRequest,
        params('member-1')
      )

      expect(response.status).toBe(404)
      expect(mockRecordConsent).not.toHaveBeenCalled()
    })

    it("records consent for the caller's own member", async () => {
      mockRepo.getMemberAccessContext.mockResolvedValue({
        memberId: 'member-1',
        gymId: 'gym-1',
      })
      mockRecordConsent.mockResolvedValue({
        applicable: true,
        dispatched: true,
      })

      const response = await recordConsent(
        { json: async () => ({}) } as unknown as NextRequest,
        params('member-1')
      )

      expect(response.status).toBe(200)
      expect(mockRecordConsent).toHaveBeenCalledWith('gym-1', 'member-1')
    })

    it('refuses callers the entitlement gate refuses', async () => {
      deny(403)

      const response = await recordConsent(
        { json: async () => ({}) } as unknown as NextRequest,
        params('member-1')
      )

      expect(response.status).toBe(403)
      expect(mockRecordConsent).not.toHaveBeenCalled()
    })
  })

  describe('POST /members/[id]/enrol', () => {
    beforeEach(() => {
      mockRepo.getMemberAccessContext.mockResolvedValue({
        memberId: 'member-1',
        gymId: 'gym-1',
      })
    })

    it("passes the desk's consent through to the service", async () => {
      mockEnrol.mockResolvedValue({ applicable: true, dispatched: true })

      const response = await enrolMember(
        jsonRequest({
          deviceId: '11111111-1111-4111-8111-111111111111',
          consent: true,
        }),
        params('member-1')
      )

      expect(response.status).toBe(200)
      expect(mockEnrol).toHaveBeenCalledWith(
        expect.objectContaining({ consentGranted: true })
      )
    })

    it('answers a missing consent with 400 and its own code, not a vendor failure', async () => {
      mockEnrol.mockResolvedValue({
        applicable: true,
        dispatched: false,
        consentRequired: true,
        error: 'The member must agree first',
      })

      const response = await enrolMember(
        jsonRequest({ deviceId: '11111111-1111-4111-8111-111111111111' }),
        params('member-1')
      )
      const body = await response.json()

      // Not 502: nothing failed at the reader, and telling the desk it did
      // would send them retrying a request that cannot succeed.
      expect(response.status).toBe(400)
      expect(body.error.code).toBe('BIOMETRIC_CONSENT_REQUIRED')
    })

    it('never defaults an absent consent flag to true', async () => {
      mockEnrol.mockResolvedValue({ applicable: true, dispatched: true })

      await enrolMember(
        jsonRequest({ deviceId: '11111111-1111-4111-8111-111111111111' }),
        params('member-1')
      )

      expect(mockEnrol).toHaveBeenCalledWith(
        expect.objectContaining({ consentGranted: undefined })
      )
    })
  })

  describe('POST /members/[id]/sync', () => {
    beforeEach(() => {
      mockSyncExecute.mockResolvedValue({
        applicable: true,
        allowed: true,
        commandsSent: 6,
        commandsPending: 6,
        failures: [],
      })
    })

    it('forces a re-send rather than diffing against our own record', async () => {
      // "Re-send to readers" is the desk's remedy when our record and a
      // reader disagree. A diff of our record against itself sends nothing in
      // exactly that case, so the route must ask for a forced run.
      mockRepo.getMemberAccessContext.mockResolvedValue({
        memberId: 'member-1',
        gymId: 'gym-1',
      })

      const response = await syncMember(jsonRequest({}), params('member-1'))

      expect(response.status).toBe(200)
      // And a re-seat, not only a forced push: after a reader restart the
      // reader keeps the user and ignores a re-pushed template, so the member
      // is deleted from the readers and added back (visit 1, D1). A failure
      // queues a forced retry, which is what the desk toast promises.
      expect(mockSyncExecute).toHaveBeenCalledWith({
        memberId: 'member-1',
        force: true,
        reseat: true,
        retryOnFailure: true,
      })
    })

    it("refuses a member who is not the caller's, before anything is sent", async () => {
      mockRepo.getMemberAccessContext.mockResolvedValue({
        memberId: 'member-1',
        gymId: 'some-other-gym',
      })

      const response = await syncMember(jsonRequest({}), params('member-1'))

      expect(response.status).toBe(404)
      expect(mockSyncExecute).not.toHaveBeenCalled()
    })
  })
})
