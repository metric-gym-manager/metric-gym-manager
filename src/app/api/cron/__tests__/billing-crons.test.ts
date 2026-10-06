/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

/**
 * The three billing crons: process-trial-expiry, process-dunning and
 * charge-renewals.
 *
 * Vercel Cron calls a cron path with GET. All three answered GET with
 * `405 Method not allowed in production` and did their work only on POST, so
 * from launch until 2026-10-06 none of them ever ran: no `cron_logs` row,
 * trials 72 days past their end still `trialing`, and three 405s a night in
 * the production logs. `cron-routes.test.ts` had pinned the same defect for
 * the member crons; these routes were never in it. GET must run the job,
 * behind the same CRON_SECRET bearer as POST, in every environment.
 */
const trialExpiry = jest.fn()
const dunning = jest.fn()
const renewals = jest.fn()
const logStart = jest.fn().mockResolvedValue('cron-log-id')
const logSuccess = jest.fn().mockResolvedValue(undefined)
const logFailure = jest.fn().mockResolvedValue(undefined)

jest.mock('@/features/subscriptions', () => ({
  createProcessTrialExpiry: () => ({ execute: trialExpiry }),
  createProcessDunning: () => ({ execute: dunning }),
  createChargeDueRenewals: () => ({ execute: renewals }),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
jest.mock('@/lib/cron', () => ({
  CronLogger: jest.fn().mockImplementation(() => ({
    logStart,
    logSuccess,
    logFailure,
  })),
}))

import * as trialExpiryRoute from '../process-trial-expiry/route'
import * as dunningRoute from '../process-dunning/route'
import * as renewalsRoute from '../charge-renewals/route'

const request = (auth?: string) =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (auth ?? null) : null,
    },
  }) as unknown as NextRequest

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  })
}

const routes = [
  { name: 'process-trial-expiry', route: trialExpiryRoute, job: trialExpiry },
  { name: 'process-dunning', route: dunningRoute, job: dunning },
  { name: 'charge-renewals', route: renewalsRoute, job: renewals },
]

describe.each(routes)('$name', ({ name, route, job }) => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    trialExpiry.mockResolvedValue({ suspendedTrials: 0 })
    dunning.mockResolvedValue({
      suspendedPastDue: 0,
      suspendedCanceled: 0,
      intentsExpired: 0,
    })
    renewals.mockResolvedValue({
      due: 0,
      charged: 0,
      markedPastDue: 0,
      retriesScheduled: 0,
      skippedPendingAttempt: 0,
      awaitingConfirmation: 0,
      attemptsExpired: 0,
      errors: [],
    })
  })

  afterEach(() => {
    setNodeEnv('test')
    delete process.env.CRON_SECRET
  })

  it('runs and logs on GET in production, the way Vercel Cron calls it', async () => {
    setNodeEnv('production')
    const res = await route.GET(request('Bearer cron-secret'))
    expect(res.status).toBe(200)
    expect(job).toHaveBeenCalledTimes(1)
    expect(logStart).toHaveBeenCalledWith(name)
  })

  it('refuses GET without the bearer, in production or not', async () => {
    for (const env of ['production', 'development']) {
      setNodeEnv(env)
      const res = await route.GET(request())
      expect(res.status).toBe(401)
    }
    expect(job).not.toHaveBeenCalled()
  })

  it('refuses GET with a wrong bearer', async () => {
    const res = await route.GET(request('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(job).not.toHaveBeenCalled()
  })

  it('still runs on POST, for a manual trigger', async () => {
    const res = await route.POST(request('Bearer cron-secret'))
    expect(res.status).toBe(200)
    expect(job).toHaveBeenCalledTimes(1)
  })
})
