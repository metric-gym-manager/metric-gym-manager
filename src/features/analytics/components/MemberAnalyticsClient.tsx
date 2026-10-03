'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  EmptyState,
  ListRow,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { AreaChart, BarChart, LineChart } from '@/components/ui/charts'
import {
  PageHeader,
  StatCard,
  ChartCard,
  SectionHeader,
} from '@/components/common/composites'
import type {
  AnalyticsMetric,
  AnalyticsRange,
  MemberAnalyticsResponse,
  TimeSeriesPoint,
} from '@/features/analytics/types'
import { useViewportTier } from '@/hooks/useViewportTier'
import { cn } from '@/lib/utils'
import { RangeSelector } from './RangeSelector'

interface MetricMeta {
  key: AnalyticsMetric
  label: string
  percent: boolean
  chart: 'area' | 'line'
  color?: string
}

const METRICS: MetricMeta[] = [
  { key: 'registrations', label: 'Sign-ups', percent: false, chart: 'area' },
  { key: 'active', label: 'Active', percent: false, chart: 'area' },
  {
    key: 'renewalRate',
    label: 'Renewal %',
    percent: true,
    chart: 'line',
    color: 'var(--ds-accent)',
  },
  {
    key: 'churnRate',
    label: 'Churn %',
    percent: true,
    chart: 'line',
    color: 'var(--ds-error-text)',
  },
  {
    key: 'retentionRate',
    label: 'Retention %',
    percent: true,
    chart: 'line',
    color: 'var(--ds-success-text)',
  },
]

const SERIES_BY_METRIC: Record<
  AnalyticsMetric,
  keyof MemberAnalyticsResponse['series']
> = {
  registrations: 'registrations',
  active: 'activeMembers',
  renewalRate: 'renewalRate',
  churnRate: 'churnRate',
  retentionRate: 'retentionRate',
}

const num = (n: number) => n.toLocaleString('en-US')
const pct = (n: number | null) => (n === null ? '—' : `${n}%`)

/**
 * The three milestone months the condensed phone row shows (§12 "Cohort ·
 * Size · M1 · M3 · M6", §25.4). Every other month stays one tap away in the
 * expanded series — accessible, not simultaneously visible (§9.4).
 */
const COHORT_MILESTONES = [1, 3, 6] as const

/** `M3 —` for a month the cohort has not reached yet, `M3 79%` once it has. */
const milestone = (retention: (number | null)[], k: number) =>
  `M${k} ${pct(retention[k] ?? null)}`

/**
 * Member Analytics — Metric Design System. Headline KPI tiles + a stock-chart
 * style range-switchable primary trend (sign-ups / active / renewal / churn /
 * retention), a year-over-year sign-ups comparison, an at-risk breakdown, and a
 * sign-up cohort retention grid. All data comes from /api/analytics/members;
 * churn/retention are payment-derived estimates (labeled as such).
 */
export default function MemberAnalyticsClient() {
  const tier = useViewportTier()
  const phone = tier === 'phone'
  const currentYear = new Date().getFullYear()
  const [range, setRange] = useState<AnalyticsRange>('YTD')
  const [year, setYear] = useState(currentYear)
  const [metric, setMetric] = useState<AnalyticsMetric>('registrations')
  /**
   * Which cohorts are open on the phone list.
   *
   * §13 names `DataTable renderExpanded` for this, and it cannot be used: the
   * cohort grid is a hand-built `Table` with a dynamic M0..M12 column count,
   * not a `DataTable`, and `DataTable`'s list path does not implement
   * `renderExpanded` at all — expansion exists only on its TABLE path, which
   * is the desktop, which keeps its table and does not need it. §27 already
   * names the alternative this uses ("`renderExpanded` / local state").
   * Recorded as an AMENDMENT.
   */
  const [openCohorts, setOpenCohorts] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

  const { data, isLoading } = useQuery<MemberAnalyticsResponse>({
    queryKey: ['analytics', 'members', range, year],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/members?range=${range}&year=${year}`
      )
      if (!response.ok) throw new Error('Failed to fetch member analytics')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })

  const summary = data?.summary
  const activeMeta = METRICS.find((m) => m.key === metric)!
  const points: TimeSeriesPoint[] = data
    ? data.series[SERIES_BY_METRIC[metric]]
    : []
  const chartData = points.map((p) => ({ label: p.label, value: p.value }))
  const ChartComp = activeMeta.chart === 'area' ? AreaChart : LineChart

  const yoy = data?.registrationsYoy ?? []
  const yoyData = yoy.map((y) => ({
    label: y.label,
    previous: y.previous,
    current: y.current,
  }))

  const atRiskData = (data?.atRisk ?? []).map((b) => ({
    label: b.label,
    count: b.count,
  }))

  const cohorts = data?.cohortRetention ?? []
  const cohortCols = cohorts.reduce(
    (max, r) => Math.max(max, r.retention.length),
    0
  )

  const tiles = [
    {
      label: 'Active members',
      value: summary ? num(summary.activeMembers) : '—',
      sub: `${summary ? num(summary.totalMembers) : '—'} total`,
      delta: undefined as
        { value: string; direction: 'up' | 'down' | 'flat' } | undefined,
    },
    {
      label: 'New sign-ups · this month',
      value: summary ? num(summary.newThisMonth) : '—',
      sub: summary ? `vs ${num(summary.newSameMonthLastYear)} last year` : ' ',
      delta:
        summary && summary.yoyDeltaPct !== null
          ? {
              value: `${Math.abs(summary.yoyDeltaPct)}%`,
              direction:
                summary.yoyDeltaPct > 0
                  ? ('up' as const)
                  : summary.yoyDeltaPct < 0
                    ? ('down' as const)
                    : ('flat' as const),
            }
          : undefined,
    },
    {
      label: 'Renewal rate',
      value: summary ? pct(summary.renewalRate) : '—',
      sub: `over ${range}`,
      delta: undefined,
    },
    {
      label: 'Churn rate',
      value: summary ? pct(summary.churnRate) : '—',
      sub: summary ? `Retention ${pct(summary.retentionRate)}` : ' ',
      delta: undefined,
    },
  ]

  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader title="Member Analytics" />

      {/* Range controls in their own row so the pill + year picker wrap on
          mobile instead of overflowing the (shrink-0) page-header actions. */}
      <RangeSelector
        range={range}
        year={year}
        yearOptions={yearOptions}
        onRangeChange={setRange}
        onYearChange={setYear}
      />

      {/* Headline KPI tiles */}
      <div className="grid grid-cols-2 divide-x divide-y divide-line-1 border-y border-line-1 lg:grid-cols-4 lg:divide-y-0">
        {tiles.map((t) => (
          <StatCard
            key={t.label}
            label={t.label}
            value={isLoading ? '—' : t.value}
            sub={t.sub}
            delta={isLoading ? undefined : t.delta}
          />
        ))}
      </div>

      {/* Primary time-series with metric toggle */}
      <ChartCard
        title="Membership trend"
        scale={activeMeta.percent ? '%' : 'members'}
        bodyClassName="pt-2"
      >
        {/*
         * The series control is a native `Select` on a phone and the segmented
         * button group above `tablet` (§13). Same `metric` state variable on
         * both tiers — a switched TREE, not a restyled control: five labelled
         * segments wrapped to two rows at 390 (the audit's finding), and five
         * options in a native picker is what a phone does instead.
         */}
        {phone ? (
          <div className="mb-3">
            <Select
              aria-label="Metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as AnalyticsMetric)}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          /* Metric toggle lives in the body (not the shrink-0 header) so it
             wraps to multiple rows on mobile instead of overflowing. */
          <div
            role="group"
            aria-label="Metric"
            className="mb-3 flex w-fit max-w-full flex-wrap gap-0.5 rounded-sm border border-line-1 p-0.5"
          >
            {METRICS.map((m) => (
              <Button
                key={m.key}
                size="xs"
                variant="ghost"
                aria-pressed={m.key === metric}
                className={cn(
                  m.key === metric &&
                    'bg-surface-selected text-ink hover:bg-surface-selected'
                )}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        )}
        <ChartComp
          data={chartData}
          xKey="label"
          series={[
            { key: 'value', label: activeMeta.label, color: activeMeta.color },
          ]}
          valueFormatter={(v) =>
            activeMeta.percent ? `${v}%` : num(Number(v))
          }
          height={phone ? 180 : 240}
          compactAxis={phone}
          label={`${activeMeta.label} over ${range}`}
          loading={isLoading}
          empty={<EmptyState title="No data for this range yet." />}
        />
      </ChartCard>

      {/* Year-over-year sign-ups */}
      <ChartCard
        title="New sign-ups · year over year"
        scale="members"
        bodyClassName="pt-2"
      >
        <BarChart
          data={yoyData}
          xKey="label"
          series={[
            { key: 'previous', label: `${year - 1}` },
            { key: 'current', label: `${year}` },
          ]}
          showLegend
          valueFormatter={(v) => num(Number(v))}
          height={phone ? 160 : 200}
          compactAxis={phone}
          label="New sign-ups this year versus last year"
          loading={isLoading}
          empty={<EmptyState title="No registrations recorded yet." />}
        />
      </ChartCard>

      {/* At-risk / due-soon */}
      <ChartCard
        title="At-risk members · due soon"
        description={
          summary
            ? `${num(summary.atRiskCount)} member(s) overdue or due within 7 days`
            : undefined
        }
        scale="members"
        bodyClassName="pt-2"
      >
        <BarChart
          data={atRiskData}
          xKey="label"
          series={[
            { key: 'count', label: 'Members', color: 'var(--ds-warning-text)' },
          ]}
          valueFormatter={(v) => num(Number(v))}
          height={phone ? 160 : 180}
          compactAxis={phone}
          label="Members by days until payment is due"
          loading={isLoading}
          empty={<EmptyState title="No members at risk." />}
        />
      </ChartCard>

      {/* Cohort retention */}
      <section>
        <SectionHeader
          variant="metadata"
          divider
          title="Cohort retention · by sign-up month"
        />
        {phone ? (
          /*
           * §12 category C-alt: the desktop keeps its matrix and the phone
           * gets condensed rows that expand. The matrix is 1,093 px wide with
           * 3½ of 15 columns visible at 390 (audit §C) — the comparison it
           * exists for is impossible while scrolling sideways, so the phone
           * shows the three milestones and puts the full M0–M12 series one tap
           * away. Nothing is removed; everything is reachable.
           */
          cohorts.length === 0 ? (
            <EmptyState className="py-10" title="No cohorts yet." />
          ) : (
            <ul role="list">
              {cohorts.map((row) => {
                const open = openCohorts.has(row.cohort)
                return (
                  <ListRow
                    key={row.cohort}
                    primary={row.label}
                    meta={COHORT_MILESTONES.map((k) =>
                      milestone(row.retention, k)
                    )}
                    value={
                      <span className="inline-flex items-center gap-1">
                        {num(row.cohortSize)}
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            'size-3 text-ink-muted transition-transform duration-fast',
                            open && 'rotate-180'
                          )}
                        />
                      </span>
                    }
                    onClick={() =>
                      setOpenCohorts((prev) => {
                        const next = new Set(prev)
                        if (!next.delete(row.cohort)) next.add(row.cohort)
                        return next
                      })
                    }
                    /*
                     * The expanded series rides the `actions` slot, which is
                     * the row's last line in §9.1's anatomy — the same slot
                     * Phase 6 gave the revenue share bar. Each month is its
                     * own span so the line wraps between months rather than
                     * mid-figure (§25.4 "mono list … wrapping").
                     */
                    actions={
                      open ? (
                        <>
                          {row.retention.map((v, k) => (
                            <span
                              key={k}
                              className="font-mono text-mono-sm text-ink-secondary"
                            >
                              M{k} {pct(v)}
                            </span>
                          ))}
                        </>
                      ) : undefined
                    }
                  />
                )
              })}
            </ul>
          )
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead numeric>Size</TableHead>
                  {Array.from({ length: cohortCols }, (_, k) => (
                    <TableHead key={k} numeric>
                      M{k}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={cohortCols + 2}
                      className="py-6 text-center text-ink-muted"
                    >
                      No cohorts yet.
                    </TableCell>
                  </TableRow>
                )}
                {cohorts.map((row) => (
                  <TableRow key={row.cohort}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {row.label}
                    </TableCell>
                    <TableCell numeric className="text-ink-secondary">
                      {num(row.cohortSize)}
                    </TableCell>
                    {Array.from({ length: cohortCols }, (_, k) => {
                      const v = row.retention[k] ?? null
                      return (
                        <TableCell key={k} numeric>
                          {v === null ? (
                            <span className="text-ink-muted">·</span>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-mono text-mono-sm text-ink-secondary">
                                {v}%
                              </span>
                              <div className="h-1 w-10 overflow-hidden rounded-sm bg-surface-hover">
                                <div
                                  className="h-full bg-accentui"
                                  style={{ width: `${v}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <p className="text-caption text-ink-muted">
        Renewal, churn, retention and cohort figures are estimated from payment
        history, not from recorded status changes.
      </p>
    </div>
  )
}
