import {
  Avatar,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { StatCard } from '@/components/common/composites'
import { WORKSPACE_NAV } from '@/components/workspace/nav'
import { cn } from '@/lib/utils'

/**
 * The homepage's picture of the product: the real `/dashboard`, drawn with the
 * real pieces (SEO-051, owner decision 2026-10-04).
 *
 * The preview it replaced was a hand-drawn mock in raw hex: a "Forecast" tile
 * and a "Billing Setup" nav entry the product never had, and 10–11 px
 * `#5c5c64` labels on black at about 3:1 — 32 Lighthouse contrast failures.
 * This one renders under `data-theme="dark"`, so every colour is a design
 * token, and it reuses what the dashboard uses:
 *
 * - the sidebar is `WORKSPACE_NAV` itself, the one navigation list, so a
 *   renamed or added destination appears here without an edit;
 * - the four tiles are `StatCard`s with the dashboard's labels and its
 *   `N warning · N mild` breakdown;
 * - the reminder queue and recent payments use the dashboard's row markup,
 *   `Badge` and the `Table` primitives (non-interactive rows: rule 2.23).
 *
 * The bars are plain CSS, not the `Charts` primitive: the homepage must not
 * load recharts (SEO-055).
 *
 * Decorative: `aria-hidden`, with no headings (the homepage keeps one `<h1>`
 * and a clean outline), no links and nothing focusable. The data is fictional.
 */

/** Sample gym. Door Access is an Enterprise destination, so the gym is one. */
const GYM = { name: 'Prime Fitness', subtitle: 'Colombo · ENTERPRISE' }

const TILES = [
  {
    label: 'Overdue members',
    value: <span className="text-error">14</span>,
    sub: '5 warning · 9 mild',
  },
  {
    label: 'Revenue · July',
    value: '96,500',
    sub: 'LKR · collected this month',
  },
  {
    label: 'Expires this week',
    value: <span className="text-warning">23</span>,
    sub: 'LKR 92,000 expected',
  },
  {
    label: 'Active members',
    value: <span className="text-success">312</span>,
    sub: 'Currently active subscriptions',
  },
] as const

// Early in the month, as the stamp says: July is the month so far, as the
// real chart's current-month bar is.
const REVENUE = [
  { month: 'Feb', lkr: 312_000 },
  { month: 'Mar', lkr: 356_000 },
  { month: 'Apr', lkr: 341_000 },
  { month: 'May', lkr: 398_000 },
  { month: 'Jun', lkr: 455_000 },
  { month: 'Jul', lkr: 96_500 },
]
const AXIS = ['500k', '250k', '0']
const AXIS_MAX = 500_000

const QUEUE = [
  {
    name: 'Nuwan Perera',
    type: 'Due-today reminder',
    when: 'today',
    amount: '4,000',
  },
  {
    name: 'Ishara Gunasekara',
    type: '3-day reminder',
    when: 'today',
    amount: '4,000',
  },
  {
    name: 'Dilani Fernando',
    type: '7-day reminder',
    when: 'tomorrow',
    amount: '36,000',
  },
  {
    name: 'Kasun Jayawardena',
    type: '3-day reminder',
    when: 'in 2 days',
    amount: '4,000',
  },
]

const PAYMENTS = [
  {
    name: 'Anushka Weerasinghe',
    plan: 'Monthly',
    date: '05 Jul 2026',
    amount: '4,000',
  },
  {
    name: 'Malith Rathnayake',
    plan: 'Annual',
    date: '05 Jul 2026',
    amount: '36,000',
  },
  {
    name: 'Sachini Perera',
    plan: '3-Months',
    date: '04 Jul 2026',
    amount: '10,500',
  },
  {
    name: 'Ravindu Dias',
    plan: 'Monthly',
    date: '03 Jul 2026',
    amount: '4,000',
  },
]

/** The metadata label row the dashboard's `SectionHeader` draws, minus the `<h2>`. */
function PanelLabel({
  title,
  aside,
}: {
  title: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-1 pb-2">
      <p className="text-metadata uppercase text-ink-muted">{title}</p>
      {aside}
    </div>
  )
}

export function DashboardPreview() {
  return (
    <div
      data-theme="dark"
      aria-hidden="true"
      data-testid="dashboard-preview"
      className="overflow-hidden rounded-t-lg border border-b-0 border-line-2 bg-surface-base font-geist text-body text-ink antialiased"
    >
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-3 border-b border-line-1 px-3.5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-line-2" />
          ))}
        </div>
        <div className="mx-auto flex h-6 max-w-sm flex-1 items-center justify-center rounded-sm border border-line-1 font-mono text-mono-sm text-ink-muted">
          www.metricgymos.com/dashboard
        </div>
        <div className="w-10" />
      </div>

      <div className="flex">
        {/* Sidebar — WORKSPACE_NAV, as the workspace renders it */}
        <div className="hidden w-52 shrink-0 flex-col border-r border-line-1 bg-surface-card tablet:flex">
          <div className="flex h-bar items-center gap-2.5 border-b border-line-1 px-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative, 22 px, same file the sidebar uses */}
            <img src="/logo.svg" alt="" className="size-5 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-body font-semibold tracking-tight text-ink">
                {GYM.name}
              </div>
              <div className="truncate font-mono text-mono-sm text-ink-muted">
                {GYM.subtitle}
              </div>
            </div>
          </div>
          <div className="p-2">
            {WORKSPACE_NAV.map((group, gi) => (
              <div key={group.label} className={cn(gi > 0 && 'mt-3.5')}>
                <p className="px-2 pb-1 pt-2 text-metadata uppercase text-ink-muted">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = item.href === '/dashboard'
                    return (
                      <li
                        key={item.href}
                        data-nav-label={item.name}
                        className={cn(
                          'flex h-8 items-center gap-2.5 rounded-sm px-2 text-body [&_svg]:size-4 [&_svg]:shrink-0',
                          active
                            ? 'bg-surface-selected font-medium text-ink'
                            : 'text-ink-secondary'
                        )}
                      >
                        <Icon strokeWidth={1.8} aria-hidden="true" />
                        <span className="flex-1 truncate">{item.name}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Top bar */}
          <div className="hidden h-bar items-center justify-between border-b border-line-1 px-6 tablet:flex">
            <p className="text-body text-ink-muted">
              {GYM.name} <span className="px-1">/</span>{' '}
              <span className="font-medium text-ink">Overview</span>
            </p>
            <div className="flex items-center gap-2.5">
              <Avatar size="sm" name={GYM.name} />
              <span className="text-body font-medium text-ink">{GYM.name}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-6 phone:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-h1 text-ink">Overview</p>
              <span className="font-mono text-mono-sm text-ink-muted phone:hidden">
                JUL 06 2026, 09:00 IST
              </span>
            </div>

            {/* Stat tiles — the dashboard's own grid and composite */}
            <div className="grid grid-cols-2 divide-x divide-y divide-line-1 border-y border-line-1 lg:grid-cols-4 lg:divide-y-0">
              {TILES.map((t) => (
                <StatCard
                  key={t.label}
                  label={t.label}
                  value={t.value}
                  sub={t.sub}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* Revenue bars (CSS; recharts stays off the homepage) */}
              <section className="lg:col-span-2">
                <PanelLabel
                  title="Revenue · Trailing 6 months"
                  aside={
                    <span className="font-mono text-mono-sm text-ink-muted">
                      LKR
                    </span>
                  }
                />
                <div className="flex gap-2 pt-3">
                  <div className="flex h-40 flex-col justify-between pb-5 font-mono text-mono-sm text-ink-muted">
                    {AXIS.map((tick) => (
                      <span key={tick}>{tick}</span>
                    ))}
                  </div>
                  <div className="flex flex-1 items-end gap-3">
                    {REVENUE.map((r) => (
                      <div
                        key={r.month}
                        data-bar={r.month}
                        className="flex h-40 flex-1 flex-col justify-end gap-1.5"
                      >
                        <div
                          className="rounded-t-xs bg-line-3"
                          style={{ height: `${(r.lkr / AXIS_MAX) * 100}%` }}
                        />
                        <span className="text-center font-mono text-mono-sm text-ink-muted">
                          {r.month}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Reminder queue — the dashboard's desktop row markup */}
              <section className="flex flex-col">
                <PanelLabel
                  title="Reminder queue"
                  aside={<Badge variant="warning">12 queued</Badge>}
                />
                {QUEUE.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between gap-3 border-b border-line-subtle py-2 last:border-0"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body text-ink">
                        {row.name}
                      </span>
                      <span className="font-mono text-mono-sm text-ink-muted">
                        {row.type} · {row.when}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-body-sm tabular-nums text-ink-secondary">
                      {row.amount}
                    </span>
                  </div>
                ))}
              </section>
            </div>

            {/* Recent payments — left out on a phone, where the preview
                would otherwise run four screens tall */}
            <section className="phone:hidden">
              <PanelLabel title="Recent payments" />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead numeric>Amount (LKR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PAYMENTS.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar size="sm" name={p.name} />
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-ink-secondary">
                        {p.plan}
                      </TableCell>
                      <TableCell className="font-mono text-mono-sm text-ink-muted">
                        {p.date}
                      </TableCell>
                      <TableCell numeric>{p.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
