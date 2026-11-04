/**
 * @jest-environment node
 */

/**
 * The three access-control crons.
 *
 * These are the only callers of the drainer, the reconciler and the retention
 * purge, so a route that silently stopped working would look exactly like a
 * feature that was never wired up: jobs accumulate, members stop syncing,
 * deleted-by-now scan records quietly stay forever, and nothing errors.
 *
 * Vercel Cron issues a GET, so GET must run the job — the regression that once
 * disabled every scheduled job in this codebase was a POST-only handler
 * returning 405 to the scheduler.
 */

import { NextRequest } from 'next/server'

const mockDrain = jest.fn()
const mockReconcile = jest.fn()
const mockRefreshPresence = jest.fn()
const mockPurge = jest.fn()
const mockLogSuccess = jest.fn().mockResolvedValue(undefined)
const mockLogFailure = jest.fn().mockResolvedValue(undefined)

jest.mock('@/features/access-control', () => ({
  createDrainAccessSyncQueue: jest.fn(() => ({ execute: mockDrain })),
  createReconcileMemberAccess: jest.fn(() => ({ execute: mockReconcile })),
  createRefreshDeviceStatus: jest.fn(() => ({ execute: mockRefreshPresence })),
  createPurgeExpiredAccessEvents: jest.fn(() => ({ execute: mockPurge })),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({})),
}))

jest.mock('@/lib/cron', () => ({
  CronLogger: jest.fn().mockImplementation(() => ({
    logStart: jest.fn().mockResolvedValue('cron-log-id'),
    logSuccess: mockLogSuccess,
    logFailure: mockLogFailure,
  })),
}))

import * as drainRoute from '../drain-access-sync/route'
import * as reconcileRoute from '../reconcile-access/route'
import * as purgeRoute from '../purge-access-events/route'
import vercelConfig from '../../../../../vercel.json'
import { readFileSync } from 'fs'
import { join } from 'path'

const CRON_SECRET = 'test-cron-secret'

function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (authHeader ?? null) : null,
    },
  } as unknown as NextRequest
}

const cleanDrain = {
  reclaimed: 0,
  claimed: 2,
  succeeded: 2,
  retrying: 0,
  deadLettered: 0,
  needingAttention: 0,
  errors: [],
}

const cleanPresence = {
  gymsChecked: 1,
  devicesChecked: 1,
  devicesSeen: 1,
  unknownToVendor: [],
  errors: [],
}

const cleanReconcile = {
  gymsConsidered: 1,
  gymsSkippedBilling: 0,
  membersChecked: 10,
  membersEnqueued: 2,
  errors: [],
}

const cleanPurge = {
  deleted: 0,
  cutoff: '2025-08-26T02:00:00.000Z',
  backlogRemaining: false,
}

describe('Access-control cron routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    mockDrain.mockResolvedValue(cleanDrain)
    mockRefreshPresence.mockResolvedValue(cleanPresence)
    mockReconcile.mockResolvedValue(cleanReconcile)
    mockPurge.mockResolvedValue(cleanPurge)
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  const cases: Array<
    [string, (req: NextRequest) => Promise<Response>, jest.Mock]
  > = [
    ['drain-access-sync (GET)', drainRoute.GET, mockDrain],
    ['drain-access-sync (POST)', drainRoute.POST, mockDrain],
    ['reconcile-access (GET)', reconcileRoute.GET, mockReconcile],
    ['reconcile-access (POST)', reconcileRoute.POST, mockReconcile],
    ['purge-access-events (GET)', purgeRoute.GET, mockPurge],
    ['purge-access-events (POST)', purgeRoute.POST, mockPurge],
  ]

  it.each(cases)(
    '%s runs the job with a valid bearer token',
    async (_name, handler, execute) => {
      const response = await handler(makeRequest(`Bearer ${CRON_SECRET}`))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(execute).toHaveBeenCalledTimes(1)
    }
  )

  it.each(cases)(
    '%s rejects a request with no authorization header',
    async (_name, handler, execute) => {
      const response = await handler(makeRequest())

      expect(response.status).toBe(401)
      expect(execute).not.toHaveBeenCalled()
    }
  )

  it.each(cases)(
    '%s rejects a wrong secret',
    async (_name, handler, execute) => {
      const response = await handler(makeRequest('Bearer wrong'))

      expect(response.status).toBe(401)
      expect(execute).not.toHaveBeenCalled()
    }
  )

  it.each(cases)(
    '%s refuses to run when CRON_SECRET is unset',
    async (_name, handler, execute) => {
      delete process.env.CRON_SECRET

      const response = await handler(makeRequest('Bearer anything'))

      // 500, not 401: an unconfigured secret is our fault, and running the job
      // unauthenticated would be worse than not running it.
      expect(response.status).toBe(500)
      expect(execute).not.toHaveBeenCalled()
    }
  )

  describe('device presence rides along with the drain', () => {
    it('refreshes presence on every drain run', async () => {
      await drainRoute.GET(makeRequest(`Bearer ${CRON_SECRET}`))

      // Webhook events only arrive when somebody scans, so without this a gym
      // that closed at 10pm shows every reader offline by morning.
      expect(mockRefreshPresence).toHaveBeenCalledTimes(1)
    })

    it('reports readers the vendor does not recognise', async () => {
      mockRefreshPresence.mockResolvedValue({
        ...cleanPresence,
        unknownToVendor: ['SER-404'],
      })

      const body = await (
        await drainRoute.GET(makeRequest(`Bearer ${CRON_SECRET}`))
      ).json()

      // A configuration problem, not an outage — wrong account or mistyped
      // serial — so it is named separately in the log.
      expect(body.data.devicesUnknownToVendor).toEqual(['SER-404'])
    })

    it('does not let a presence failure hide a clean drain', async () => {
      mockRefreshPresence.mockResolvedValue({
        ...cleanPresence,
        errors: ['Gym gym-1: vendor unreachable'],
      })

      const response = await drainRoute.GET(
        makeRequest(`Bearer ${CRON_SECRET}`)
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.succeeded).toBe(2)
      expect(body.data.errors).toContain('Gym gym-1: vendor unreachable')
    })
  })

  describe('audit logging (rule 2.6)', () => {
    it('logs a clean drain as a success', async () => {
      await drainRoute.GET(makeRequest(`Bearer ${CRON_SECRET}`))

      expect(mockLogSuccess).toHaveBeenCalledTimes(1)
      expect(mockLogFailure).not.toHaveBeenCalled()
    })

    it('logs a drain that dead-lettered work needing a person as a failure', async () => {
      mockDrain.mockResolvedValue({
        ...cleanDrain,
        deadLettered: 1,
        needingAttention: 1,
        errors: ['Device storage full'],
      })

      const response = await drainRoute.GET(
        makeRequest(`Bearer ${CRON_SECRET}`)
      )

      // Still a 200 — the run itself worked. But a full reader needs a human,
      // so it must surface on the admin health view rather than sit quietly
      // inside a "successful" run.
      expect(response.status).toBe(200)
      expect(mockLogFailure).toHaveBeenCalledWith('cron-log-id', [
        'Device storage full',
      ])
    })

    it('logs a reconcile that hit gym errors as a failure', async () => {
      mockReconcile.mockResolvedValue({
        ...cleanReconcile,
        errors: ['Gym gym-1: read failed'],
      })

      await reconcileRoute.GET(makeRequest(`Bearer ${CRON_SECRET}`))

      expect(mockLogFailure).toHaveBeenCalledTimes(1)
    })

    it('records the failure when the job itself throws', async () => {
      mockDrain.mockRejectedValue(new Error('database down'))

      const response = await drainRoute.GET(
        makeRequest(`Bearer ${CRON_SECRET}`)
      )

      expect(response.status).toBe(500)
      expect(mockLogFailure).toHaveBeenCalledWith('cron-log-id', [
        'database down',
      ])
    })
  })
})

describe('Access-control cron schedules', () => {
  const crons: Array<{ path: string; schedule: string }> = vercelConfig.crons

  function scheduleFor(path: string): string {
    const entry = crons.find((c) => c.path === path)
    if (!entry) throw new Error(`No cron configured for ${path}`)
    return entry.schedule
  }

  it('runs the reconciler at local midnight, not UTC midnight', () => {
    // 18:30 UTC is 00:00 Sri Lanka time. A membership paid through the 15th
    // must stop admitting at midnight *local*, and this slot is what asserts
    // that boundary.
    expect(scheduleFor('/api/cron/reconcile-access')).toBe('30 18 * * *')
  })

  /**
   * The drain runs every five minutes from GitHub Actions, not from
   * vercel.json: the Vercel team is on Hobby, which refuses to deploy any cron
   * that runs more than once a day (access-control-master.md §4.5).
   */
  describe('the outbox drain, scheduled from GitHub Actions', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/drain-access-sync.yml'),
      'utf8'
    )

    it('is not a Vercel cron', () => {
      expect(
        crons.find((c) => c.path === '/api/cron/drain-access-sync')
      ).toBeUndefined()
    })

    it('drains the outbox frequently enough to be a catch-up path', () => {
      const schedules = [...workflow.matchAll(/cron:\s*'([^']+)'/g)].map(
        (m) => m[1]
      )
      expect(schedules).toEqual(['*/5 * * * *'])
    })

    it('calls the production drain with the cron secret', () => {
      expect(workflow).toContain(
        'https://www.metricgymos.com/api/cron/drain-access-sync'
      )
      expect(workflow).toMatch(/-X POST/)
      expect(workflow).toContain('Authorization: Bearer $CRON_SECRET')
      expect(workflow).toContain('CRON_SECRET: ${{ secrets.CRON_SECRET }}')
    })

    it('never prints the response body: the repository is public', () => {
      // The body carries counts and vendor error text; Actions logs of a
      // public repository are readable by anyone.
      expect(workflow).toMatch(/-o \/dev\/null/)
      expect(workflow).not.toMatch(/cat |jq |--include|-i /)
    })
  })

  it('purges expired scans daily, so the published figure stays true', () => {
    // The privacy policy states twelve months. A monthly sweep would let the
    // oldest scans reach thirteen, making that statement untrue for weeks at
    // a time.
    const schedule = scheduleFor('/api/cron/purge-access-events')

    expect(schedule).toBe('0 2 * * *')
    // Daily: no day-of-month or day-of-week restriction.
    expect(schedule.split(' ').slice(2)).toEqual(['*', '*', '*'])
  })

  it('keeps the purge clear of the nightly status chain window', () => {
    // It shares no data with the status crons in either direction, so it does
    // not belong in their pinned ordering — it just must not sit inside their
    // window and compete for the same minutes.
    const hour = Number(
      scheduleFor('/api/cron/purge-access-events').split(' ')[1]
    )

    expect(hour).toBeGreaterThan(0)
  })

  it('keeps the reconciler out of the nightly status chain window', () => {
    // It runs six hours BEFORE update-expired-status, which is only safe
    // because the access decision reads next_due_date rather than status.
    // Pinned here so a well-meaning move into the 00:00 block gets caught.
    const statusChain = crons
      .filter((c) =>
        [
          '/api/cron/update-expired-status',
          '/api/cron/expire-suspended-members',
          '/api/cron/cancel-overdue-members',
        ].includes(c.path)
      )
      .map((c) => Number(c.schedule.split(' ')[1]))

    expect(statusChain.every((hour) => hour === 0)).toBe(true)
    expect(
      Number(scheduleFor('/api/cron/reconcile-access').split(' ')[1])
    ).toBe(18)
  })
})
