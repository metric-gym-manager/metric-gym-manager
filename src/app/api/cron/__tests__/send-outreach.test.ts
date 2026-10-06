/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * /api/cron/send-outreach — the weekly introduction series (owner request,
 * 2026-10-06). Vercel Cron calls it with GET and the CRON_SECRET bearer;
 * every run is logged (rule 2.6), as a failure when any email failed.
 */
const runWeek = jest.fn()
const createOutreach = jest.fn((..._args: unknown[]) => ({ runWeek }))
const logStart = jest.fn().mockResolvedValue('cron-log-id')
const logSuccess = jest.fn().mockResolvedValue(undefined)
const logFailure = jest.fn().mockResolvedValue(undefined)

jest.mock('@/features/mailing', () => ({
  createSendOutreach: (...args: unknown[]) => createOutreach(...args),
  OUTREACH_CAMPAIGN: 'intro-2026-10',
  OUTREACH_WEEKLY_LIMIT: 150,
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
jest.mock('@/lib/cron', () => ({
  CronLogger: jest
    .fn()
    .mockImplementation(() => ({ logStart, logSuccess, logFailure })),
}))

import { GET, POST } from '../send-outreach/route'

const request = (auth?: string) =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (auth ?? null) : null,
    },
  }) as unknown as NextRequest

const report = (counts: Record<string, number>, entries: object[] = []) => ({
  counts: {
    known: 0,
    imported: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    would_send: 0,
    ...counts,
  },
  entries,
})

describe('/api/cron/send-outreach', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    runWeek.mockResolvedValue(report({ sent: 80, skipped: 2 }))
  })

  it('refuses a call without the bearer, and sends nothing', async () => {
    expect((await GET(request())).status).toBe(401)
    expect(runWeek).not.toHaveBeenCalled()
  })

  it('refuses to run when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    expect((await GET(request('Bearer undefined'))).status).toBe(500)
    expect(runWeek).not.toHaveBeenCalled()
  })

  it('runs the week on GET, the method Vercel Cron uses, for the live campaign', async () => {
    const response = await GET(request('Bearer cron-secret'))
    expect(response.status).toBe(200)
    const [input] = runWeek.mock.calls[0]
    expect(input).toMatchObject({
      campaign: 'intro-2026-10',
      limit: 150,
      dryRun: false,
    })
    expect(input.now).toBeInstanceOf(Date)
  })

  it('runs on POST too, for a manual trigger', async () => {
    expect((await POST(request('Bearer cron-secret'))).status).toBe(200)
  })

  it('logs the counts as a success when nothing failed', async () => {
    await GET(request('Bearer cron-secret'))
    expect(logStart).toHaveBeenCalledWith('send-outreach')
    expect(logSuccess).toHaveBeenCalledWith(
      'cron-log-id',
      expect.objectContaining({
        counts: expect.objectContaining({ sent: 80, skipped: 2 }),
      })
    )
  })

  it('logs a run with a failed email as a failure, naming it', async () => {
    runWeek.mockResolvedValue(
      report({ sent: 3, failed: 1 }, [
        {
          email: 'bad@gym.lk',
          outcome: 'failed',
          step: 2,
          detail: 'Resend said no',
        },
      ])
    )
    const response = await GET(request('Bearer cron-secret'))
    expect(response.status).toBe(200)
    expect(logFailure).toHaveBeenCalledWith(
      'cron-log-id',
      ['bad@gym.lk (email 2): Resend said no'],
      expect.objectContaining({
        counts: expect.objectContaining({ failed: 1 }),
      })
    )
  })

  it('logs a crash as a failure and answers 500', async () => {
    runWeek.mockRejectedValue(new Error('Resend is down'))
    expect((await GET(request('Bearer cron-secret'))).status).toBe(500)
    expect(logFailure).toHaveBeenCalledWith('cron-log-id', ['Resend is down'])
  })
})

describe('vercel.json — the weekly schedule', () => {
  it('runs every Tuesday at 04:30 UTC, 10:00 in Sri Lanka', () => {
    const config = JSON.parse(
      readFileSync(join(__dirname, '../../../../../vercel.json'), 'utf8')
    )
    expect(config.crons).toContainEqual({
      path: '/api/cron/send-outreach',
      schedule: '30 4 * * 2',
    })
  })
})
