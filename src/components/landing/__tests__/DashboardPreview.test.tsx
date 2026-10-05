import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import fs from 'node:fs'
import path from 'node:path'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { WORKSPACE_NAV } from '@/components/workspace/nav'
import DashboardClient from '@/app/(dashboard)/dashboard/DashboardClient'
import { DashboardPreview } from '../DashboardPreview'

/**
 * The homepage preview is a picture of the real /dashboard (SEO-051, owner
 * decision 2026-10-04). The preview it replaced had drifted into a tile
 * ("Forecast") and a nav entry ("Billing Setup") the product never had. These
 * pin it to the product: the same destinations, the same tiles, the same
 * overdue breakdown — and keep it decorative and free of recharts.
 *
 * jsdom has no layout, so none of this proves how it looks; that is checked
 * in Chromium against a screenshot of the real dashboard.
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))
jest.mock('@/features/members', () => ({
  __esModule: true,
  MemberAvatar: ({ name }: { name: string }) => <span>{name.charAt(0)}</span>,
  isNewMember: () => false,
}))
jest.mock('@/components/ui/primitives/Charts', () => ({
  __esModule: true,
  BarChart: () => <div />,
  LineChart: () => <div />,
  AreaChart: () => <div />,
}))

/** A tile label with the month taken out: "Revenue · July" → "Revenue · <month>". */
const normalise = (label: string) =>
  label.replace(
    /· (January|February|March|April|May|June|July|August|September|October|November|December)$/,
    '· <month>'
  )

function tileLabels(root: HTMLElement): string[] {
  return [...root.querySelectorAll('span.text-metadata.uppercase')].map((el) =>
    normalise(el.textContent ?? '')
  )
}

function tileSubs(root: HTMLElement): string[] {
  return [...root.querySelectorAll('span.text-caption.text-ink-secondary')].map(
    (el) => el.textContent ?? ''
  )
}

async function renderRealDashboard(): Promise<HTMLElement> {
  mockFetchRoutes({
    '/api/dashboard/metrics': {
      success: true,
      data: {
        activeMembers: 96,
        revenueThisMonth: 0,
        overdueMembers: { count: 105, warning: 52, mild: 53 },
        membersDueThisWeek: { count: 64, totalAmount: 224000 },
      },
    },
    '/api/revenue/monthly': apiOk({ historicalData: [] }),
    '/api/payment-collection/collected': apiOk({
      payments: [],
      summary: { totalRevenue: 0, paymentCount: 0 },
    }),
    '/api/reminders/queue': apiOk({ entries: [], total: 0 }),
  })
  const { container } = renderScreen(<DashboardClient />)
  await screen.findByText('105')
  return container
}

describe('DashboardPreview', () => {
  it('draws every workspace destination, in WORKSPACE_NAV order', () => {
    const { container } = render(<DashboardPreview />)
    const drawn = [...container.querySelectorAll('[data-nav-label]')].map(
      (el) => el.getAttribute('data-nav-label')
    )
    expect(drawn).toEqual(
      WORKSPACE_NAV.flatMap((group) => group.items.map((item) => item.name))
    )
  })

  it('shows the real dashboard’s tiles, in its order', async () => {
    const real = tileLabels(await renderRealDashboard())
    const preview = tileLabels(
      render(<DashboardPreview />).container.querySelector(
        '[data-testid="dashboard-preview"]'
      ) as HTMLElement
    )
    expect(real).toHaveLength(4)
    expect(preview.slice(0, 4)).toEqual(real)
  })

  it('breaks overdue members down the way the dashboard does', async () => {
    const [realOverdue] = tileSubs(await renderRealDashboard())
    const [previewOverdue] = tileSubs(render(<DashboardPreview />).container)
    const shape = /^\d+ warning · \d+ mild$/
    expect(realOverdue).toMatch(shape)
    expect(previewOverdue).toMatch(shape)
  })

  it('shows LKR 548,000 collected this month (owner, 2026-10-05)', () => {
    const { container } = render(<DashboardPreview />)
    // The tile label's row, then the tile (StatCard: label row, value, sub).
    const revenueTile = [
      ...container.querySelectorAll('span.text-metadata.uppercase'),
    ].find((el) => /^Revenue · /.test(el.textContent ?? ''))?.parentElement
      ?.parentElement
    expect(revenueTile?.textContent).toContain('Revenue · July')
    expect(revenueTile?.textContent).toContain('548,000')
  })

  it('draws every revenue bar inside its axis, this month’s from the tile', () => {
    const { container } = render(<DashboardPreview />)
    // The axis maximum is read from the top tick ("600k"), so a scale that
    // disagrees with its own label fails here too.
    const topTick = container.querySelector('[data-axis] > span')?.textContent
    const axisMax = Number(topTick?.replace(/k$/, '')) * 1000
    expect(axisMax).toBeGreaterThan(0)

    const heights = [...container.querySelectorAll('[data-bar]')].map((bar) =>
      parseFloat((bar.firstElementChild as HTMLElement).style.height)
    )
    expect(heights).toHaveLength(6)
    for (const h of heights) expect(h).toBeLessThanOrEqual(100)
    // The current month is the last bar, and it is the tile's figure.
    expect(heights[5]).toBeCloseTo((548_000 / axisMax) * 100, 1)
  })

  it('is decorative: hidden from assistive tech, no headings, links or controls', () => {
    const { container } = render(<DashboardPreview />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)
    expect(
      root.querySelectorAll('a, button, input, select, textarea, [tabindex]')
    ).toHaveLength(0)
  })

  it('does not load the chart library (SEO-055)', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'DashboardPreview.tsx'),
      'utf8'
    )
    expect(source).not.toMatch(/from ['"](recharts|@\/components\/ui\/charts)/)
  })
})
