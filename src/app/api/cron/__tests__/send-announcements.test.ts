/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { APP_VERSION } from '@/lib/client-state/app-version'
import { LEGAL_CHANGES } from '@/features/marketing/config/legalChanges'

/**
 * /api/cron/send-announcements — release and policy-change emails (owner
 * request, 2026-10-06). Vercel Cron calls it with GET and the CRON_SECRET
 * bearer; every run is logged (rule 2.6), and a run in which an email could
 * not be rendered, previewed or scheduled is logged as a FAILURE, so it shows
 * on /system-health instead of passing quietly.
 */
const execute = jest.fn()
const createSend = jest.fn((..._args: unknown[]) => ({ execute }))
const logStart = jest.fn().mockResolvedValue('cron-log-id')
const logSuccess = jest.fn().mockResolvedValue(undefined)
const logFailure = jest.fn().mockResolvedValue(undefined)

jest.mock('@/features/mailing', () => ({
  createSendAnnouncements: (...args: unknown[]) => createSend(...args),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
jest.mock('@/lib/cron', () => ({
  CronLogger: jest.fn().mockImplementation(() => ({
    logStart,
    logSuccess,
    logFailure,
  })),
}))

import { GET, POST } from '../send-announcements/route'

const request = (auth?: string) =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (auth ?? null) : null,
    },
  }) as unknown as NextRequest

describe('/api/cron/send-announcements', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    execute.mockResolvedValue([
      {
        kind: 'release',
        ref: '1.2.0',
        outcome: 'scheduled',
        scheduledFor: 'x',
      },
      {
        kind: 'policy',
        ref: 'privacy@2026-10-06',
        outcome: 'template_not_ready',
      },
    ])
  })

  it('refuses a call without the bearer, and runs nothing', async () => {
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
    expect(logStart).not.toHaveBeenCalled()
  })

  it('refuses to run when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(request('Bearer undefined'))
    expect(response.status).toBe(500)
    expect(execute).not.toHaveBeenCalled()
  })

  it('runs on GET, the method Vercel Cron uses', async () => {
    const response = await GET(request('Bearer cron-secret'))
    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('runs on POST too, for a manual trigger', async () => {
    const response = await POST(request('Bearer cron-secret'))
    expect(response.status).toBe(200)
  })

  it('announces what is deployed: this version, this changelog, these legal changes', async () => {
    await GET(request('Bearer cron-secret'))
    const [input] = execute.mock.calls[0]
    expect(input.appVersion).toBe(APP_VERSION)
    expect(input.changelog).toMatch(/^# Changelog/)
    expect(input.legalChanges).toBe(LEGAL_CHANGES)
    expect(input.now).toBeInstanceOf(Date)
    expect(input.dryRun).toBeFalsy()
    expect(input.testOnly).toBeFalsy()
  })

  it('logs the outcome counts as a success when nothing failed', async () => {
    await GET(request('Bearer cron-secret'))
    expect(logStart).toHaveBeenCalledWith('send-announcements')
    expect(logSuccess).toHaveBeenCalledWith(
      'cron-log-id',
      expect.objectContaining({
        counts: { 'release:scheduled': 1, 'policy:template_not_ready': 1 },
      })
    )
    expect(logFailure).not.toHaveBeenCalled()
  })

  it.each(['render_failed', 'preview_failed', 'send_failed', 'refresh_failed'])(
    'logs a run with %s as a failure, naming it',
    async (outcome) => {
      execute.mockResolvedValue([
        { kind: 'release', ref: '1.2.0', outcome, detail: 'HEADLINE' },
      ])
      const response = await GET(request('Bearer cron-secret'))
      expect(response.status).toBe(200)
      expect(logFailure).toHaveBeenCalledWith(
        'cron-log-id',
        [`release 1.2.0: ${outcome} — HEADLINE`],
        expect.objectContaining({ counts: { [`release:${outcome}`]: 1 } })
      )
      expect(logSuccess).not.toHaveBeenCalled()
    }
  )

  it('logs a crash as a failure and answers 500', async () => {
    execute.mockRejectedValue(new Error('Resend is down'))
    const response = await GET(request('Bearer cron-secret'))
    expect(response.status).toBe(500)
    expect(logFailure).toHaveBeenCalledWith('cron-log-id', ['Resend is down'])
  })
})

/**
 * The route reads CHANGELOG.md from disk at runtime. Next bundles only the
 * files a route imports, so without this include the deployed function would
 * have no changelog — every unit test above would still pass, and production
 * would fail every night.
 */
describe('next.config — the changelog ships with the route', () => {
  it('traces CHANGELOG.md into /api/cron/send-announcements', () => {
    const config = require('../../../../../next.config.js')
    expect(
      config.outputFileTracingIncludes['/api/cron/send-announcements']
    ).toContain('./CHANGELOG.md')
  })
})
