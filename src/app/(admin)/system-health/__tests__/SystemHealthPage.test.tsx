import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import SystemHealthPage from '../page'
import CronStatusGrid from '../CronStatusGrid'

const execution = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  job_name: 'send-reminders',
  started_at: '2026-08-30T02:00:00.000Z',
  completed_at: '2026-08-30T02:00:04.500Z',
  status: 'success',
  summary: { sent: 12 },
  errors: null,
  ...over,
})

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/admin/system-health/cron-stats': {
    success: true,
    data: { 'send-reminders': [execution()] },
  },
  '/api/admin/system-health/sms-failures': {
    success: true,
    data: { failures: [], total: 0 },
  },
  '/api/admin/system-health/billing-failures': {
    success: true,
    data: { failures: [], total: 0 },
  },
  ...over,
})

describe('SystemHealthPage', () => {
  afterEach(() => jest.clearAllMocks())

  it('mounts all three monitoring panels', async () => {
    mockFetchRoutes(routes())
    renderScreen(<SystemHealthPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: /System health/i })
    ).toBeInTheDocument()
    // Job keys are mapped to display names for the operator.
    expect(await screen.findByText('Send Reminders')).toBeInTheDocument()
  })

  /**
   * §2.9 and the CRITICAL RULE in architecture.md: this page exists precisely
   * because raw infrastructure detail must never reach a gym manager. The
   * warning is the operator-facing half of that contract, and a redesign that
   * quietly drops it removes the only in-product statement of the rule.
   */
  it('states that the page exposes restricted technical detail', () => {
    mockFetchRoutes(routes())
    renderScreen(<SystemHealthPage />)

    expect(screen.getByText('Restricted access')).toBeInTheDocument()
    expect(
      screen.getByText(/never be shown to gym managers or end users/i)
    ).toBeInTheDocument()
  })
})

describe('CronStatusGrid', () => {
  afterEach(() => jest.clearAllMocks())

  it('reports a run duration', async () => {
    mockFetchRoutes(routes())
    renderScreen(<CronStatusGrid />)
    // 02:00:00.000 → 02:00:04.500
    expect(await screen.findByText('4.5s')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('shows an unfinished run as still running, not as zero duration', async () => {
    mockFetchRoutes(
      routes({
        '/api/admin/system-health/cron-stats': {
          success: true,
          data: {
            'send-reminders': [
              execution({ completed_at: null, status: 'running' }),
            ],
          },
        },
      })
    )
    renderScreen(<CronStatusGrid />)
    expect(await screen.findByText('Running...')).toBeInTheDocument()
  })

  /**
   * A failed cron job is the reason this dashboard exists, and its raw error
   * text is the payload an operator acts on — it must reach the page verbatim
   * rather than being sanitised the way gym-facing surfaces are (§2.8/§2.9).
   */
  it('shows the raw error text of a failed run', async () => {
    mockFetchRoutes(
      routes({
        '/api/admin/system-health/cron-stats': {
          success: true,
          data: {
            'send-reminders': [
              execution({
                status: 'failure',
                errors: ['ECONNREFUSED 10.0.0.4:5432'],
              }),
            ],
          },
        },
      })
    )
    renderScreen(<CronStatusGrid />)

    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(
      screen.getByText(/ECONNREFUSED 10\.0\.0\.4:5432/)
    ).toBeInTheDocument()
  })

  it('surfaces its own fetch failure', async () => {
    mockFetchRoutes(
      routes({
        '/api/admin/system-health/cron-stats': { status: 500, body: {} },
      })
    )
    renderScreen(<CronStatusGrid />)
    expect(
      await screen.findByText('Failed to Load Cron Stats')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
