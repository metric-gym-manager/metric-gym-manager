/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

/**
 * /api/cron/sync-marketing-contacts — the nightly reconcile of the Resend
 * mailing list with the gyms (owner decisions of 2026-10-06). Vercel Cron
 * calls it with GET and the CRON_SECRET bearer; every run is logged (rule 2.6).
 */
const execute = jest.fn()
const createSync = jest.fn((..._args: unknown[]) => ({ execute }))
const logStart = jest.fn().mockResolvedValue('cron-log-id')
const logSuccess = jest.fn().mockResolvedValue(undefined)
const logFailure = jest.fn().mockResolvedValue(undefined)

jest.mock('@/features/mailing', () => ({
  createSyncMarketingContacts: (...args: unknown[]) => createSync(...args),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
jest.mock('@/lib/cron', () => ({
  CronLogger: jest.fn().mockImplementation(() => ({
    logStart,
    logSuccess,
    logFailure,
  })),
}))

import { GET, POST } from '../sync-marketing-contacts/route'

const request = (auth?: string) =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (auth ?? null) : null,
    },
  }) as unknown as NextRequest

describe('GET /api/cron/sync-marketing-contacts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.SMS_DISABLED_GYM_IDS = 'e2e-1, e2e-2'
    process.env.MARKETING_EXCLUDED_GYM_IDS = 'mine-1'
    execute.mockResolvedValue([
      {
        email: 'a@gym.lk',
        action: 'add',
        audience: 'marketing',
        outcome: 'created',
      },
      {
        email: 'b@gym.lk',
        action: 'leave_updates',
        audience: 'product_updates',
        outcome: 'done',
      },
      {
        email: 'c@gym.lk',
        action: 'add',
        audience: 'marketing',
        outcome: 'failed',
        error: 'rate limited',
      },
      { email: 'e2e@gym.test', action: 'exclude', outcome: 'excluded' },
    ])
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.SMS_DISABLED_GYM_IDS
    delete process.env.MARKETING_EXCLUDED_GYM_IDS
  })

  it('applies the reconcile with both exclusion lists and logs the run', async () => {
    const res = await GET(request('Bearer cron-secret'))
    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      apply: true,
      excludeGymIds: ['e2e-1', 'e2e-2', 'mine-1'],
      excludeEmails: [],
    })
    expect(logStart).toHaveBeenCalledWith('sync-marketing-contacts')
    expect(logSuccess).toHaveBeenCalledWith(
      'cron-log-id',
      expect.objectContaining({
        counts: {
          'add:created': 1,
          'leave_updates:done': 1,
          'add:failed': 1,
          'exclude:excluded': 1,
        },
        failures: ['c@gym.lk: rate limited'],
      })
    )
  })

  it('never rotates tokens', async () => {
    await GET(request('Bearer cron-secret'))
    expect(createSync).toHaveBeenCalledWith(expect.anything())
    expect(createSync.mock.calls[0]).toHaveLength(1)
  })

  it('also runs on POST, for a manual trigger', async () => {
    const res = await POST(request('Bearer cron-secret'))
    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('refuses a wrong bearer and runs nothing', async () => {
    const res = await GET(request('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses to run when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(request('Bearer anything'))
    expect(res.status).toBe(500)
    expect(execute).not.toHaveBeenCalled()
  })

  it('logs a failed run when mailing is not configured', async () => {
    createSync.mockImplementationOnce(() => {
      throw new Error('Mailing is not configured')
    })
    const res = await GET(request('Bearer cron-secret'))
    expect(res.status).toBe(500)
    expect(logFailure).toHaveBeenCalledWith('cron-log-id', [
      'Mailing is not configured',
    ])
  })
})
