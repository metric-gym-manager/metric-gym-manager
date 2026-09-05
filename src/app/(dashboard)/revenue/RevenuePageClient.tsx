'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  EmptyState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import {
  PageHeader,
  StatCard,
  ChartCard,
  SectionHeader,
} from '@/components/common/composites'
import type { MonthlyRevenueResponse } from '@/features/revenue/types'

interface CollectedPayment {
  planType: string
  amountPaid: number
}
interface CollectedResponse {
  payments: CollectedPayment[]
  summary: { totalRevenue: number; paymentCount: number }
}
interface PlanEnrolment {
  planType: string
  activeCount: number
}

const PLAN_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  '3-months': '3 Months',
  '6-months': '6 Months',
  annual: 'Annual',
  custom: 'Custom',
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * Revenue — Metric Design System. Stat tiles + a trailing monthly bar chart +
 * a plan-type breakdown. Metrics/history come from /api/revenue/monthly, the
 * period revenue split from /api/payment-collection/collected, and the
 * enrolment (Members) column from /api/members/enrolment-by-plan (active member
 * count per plan — distinct from the per-plan payment count).
 */
export default function RevenuePageClient() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const yearOptions = Array.from(
    { length: 6 },
    (_, i) => today.getFullYear() - i
  )

  const { data, isLoading } = useQuery<MonthlyRevenueResponse>({
    queryKey: ['revenue', 'monthly', year, month],
    queryFn: async () => {
      const response = await fetch(
        `/api/revenue/monthly?year=${year}&month=${month}`
      )
      if (!response.ok) throw new Error('Failed to fetch monthly revenue')
      const result = await response.json()
      return result.data
    },
  })

  const { data: collected } = useQuery<CollectedResponse>({
    queryKey: ['revenue', 'collected', year, month],
    queryFn: async () => {
      const m = `${year}-${String(month).padStart(2, '0')}`
      const response = await fetch(
        `/api/payment-collection/collected?month=${m}`
      )
      if (!response.ok) throw new Error('Failed to fetch collected payments')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })

  const { data: enrolment } = useQuery<PlanEnrolment[]>({
    queryKey: ['members', 'enrolment-by-plan'],
    queryFn: async () => {
      const response = await fetch('/api/members/enrolment-by-plan')
      if (!response.ok) throw new Error('Failed to fetch enrolment by plan')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })

  const cur = data?.currentMonth
  const metrics = data?.metrics

  // A real ratio at last: the denominator is what billable members were
  // actually billed this month, from their due dates, and the numerator is the
  // part of the cash a schedule predicts. Comparing TOTAL cash to billings is
  // what produced "127.7% of billed" — one-off money against a subscription
  // denominator.
  const collectedRate =
    cur && cur.billedRevenue > 0
      ? Math.round((cur.planCollectedRevenue / cur.billedRevenue) * 100)
      : null

  // Deliberately not defaulted to 0: before the query resolves we do not know
  // whether anyone is overdue, and "No overdue members" is a claim, not a
  // placeholder. The tile stays silent until it has the answer.
  const overdue = cur?.overdueMemberCount ?? null

  const tiles: Array<{ label: string; value: string; sub: React.ReactNode }> = [
    {
      // ALL cash taken this month — plan payments, the joining fees inside them,
      // and day passes. This is the figure a gym reports as revenue, so it is
      // deliberately the total and never a subset. It matches the dashboard's
      // "Revenue" tile for the same month.
      label: `Collected · ${MONTHS[month - 1].slice(0, 3)}`,
      value: cur ? fmt(cur.collectedRevenue) : '—',
      sub:
        cur && cur.oneOffRevenue > 0 ? (
          <>incl. {fmt(cur.oneOffRevenue)} joining fees &amp; day passes</>
        ) : (
          'All cash received this month'
        ),
    },
    {
      // "Billed", not "Projected". This is what members owe for this month
      // from their actual due dates — so an annual member counts in their
      // renewal month and in no other, instead of one twelfth every month.
      label: `Billed · ${MONTHS[month - 1].slice(0, 3)}`,
      value: cur ? fmt(cur.billedRevenue) : '—',
      sub:
        overdue === null ? (
          ' '
        ) : collectedRate !== null ? (
          // The collection rate belongs on the tile whose value is its
          // denominator, and it compares like with like: plan cash against plan
          // billings, with one-off money excluded from both.
          <span className={overdue > 0 ? 'text-warning' : 'text-success'}>
            {collectedRate}% collected
            {overdue > 0 ? ` · ${overdue} overdue` : ''}
          </span>
        ) : (
          // States what its predicate actually tests. The old label read "Fully
          // collected" in green whenever no member happened to be past due —
          // including, as on a new gym, when nothing at all had been collected.
          <span className={overdue > 0 ? 'text-warning' : 'text-success'}>
            {overdue > 0
              ? `${overdue} member${overdue === 1 ? '' : 's'} overdue`
              : 'No overdue members'}
          </span>
        ),
    },
    {
      label: 'Active members',
      value: metrics ? fmt(metrics.totalActiveMembers) : '—',
      sub: 'Currently active',
    },
    {
      label: 'Avg / member',
      value: metrics ? fmt(metrics.averageRevenuePerMember) : '—',
      sub: 'Lifetime value',
    },
  ]

  const history = data?.historicalData ?? []
  const chartData = history.map((h) => ({
    month: h.monthLabel.split(' ')[0],
    revenue: h.collectedRevenue,
  }))

  // Plan breakdown: union of plans that collected this period and plans with
  // active enrolment, so both the revenue split and current enrolment show.
  const byPlan = new Map<string, { amount: number; count: number }>()
  for (const p of collected?.payments ?? []) {
    const acc = byPlan.get(p.planType) ?? { amount: 0, count: 0 }
    acc.amount += p.amountPaid
    acc.count += 1
    byPlan.set(p.planType, acc)
  }
  const enrolMap = new Map(
    (enrolment ?? []).map((e) => [e.planType, e.activeCount])
  )
  const totalCollected = collected?.summary.totalRevenue ?? 0
  const planKeys = new Set<string>([...byPlan.keys(), ...enrolMap.keys()])
  const breakdown = Array.from(planKeys)
    .map((plan) => {
      const v = byPlan.get(plan) ?? { amount: 0, count: 0 }
      return {
        plan,
        members: enrolMap.get(plan) ?? 0,
        amount: v.amount,
        count: v.count,
        share:
          totalCollected > 0
            ? Math.round((v.amount / totalCollected) * 100)
            : 0,
      }
    })
    .sort((a, b) => b.amount - a.amount || b.members - a.members)

  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader
        title="Revenue"
        actions={
          <div className="flex gap-2">
            {/* Sized to the longest month name. `Select` wraps itself in a
                `w-full` div, so the width has to go on the container — a
                className on the Select lands on the inner <select> and leaves
                the wrapper claiming the whole line. "September" was truncating
                to "Septeml". */}
            <div className="w-44 shrink-0">
              <Select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                aria-label="Month"
              >
                {MONTHS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {/* Tiles */}
      <div className="grid grid-cols-2 divide-x divide-y divide-line-1 border-y border-line-1 lg:grid-cols-4 lg:divide-y-0">
        {tiles.map((t) => (
          <StatCard
            key={t.label}
            label={t.label}
            value={isLoading ? '—' : t.value}
            sub={t.sub}
          />
        ))}
      </div>

      {/* Chart */}
      <ChartCard
        title="Monthly collected revenue"
        scale="LKR"
        bodyClassName="pt-2"
      >
        <BarChart
          data={chartData}
          xKey="month"
          series={[{ key: 'revenue', label: 'Collected' }]}
          valueFormatter={(v) => `LKR ${Number(v).toLocaleString('en-US')}`}
          height={180}
          label="Monthly collected revenue"
          loading={isLoading}
          empty={<EmptyState title="No revenue history for this period." />}
        />
      </ChartCard>

      {/* Breakdown by plan type */}
      <section>
        <SectionHeader
          variant="metadata"
          divider
          title="Breakdown by plan type"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead numeric>Members</TableHead>
                <TableHead numeric>Payments</TableHead>
                <TableHead numeric>Collected (LKR)</TableHead>
                <TableHead numeric>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-ink-muted"
                  >
                    No plan activity for this period.
                  </TableCell>
                </TableRow>
              )}
              {breakdown.map((p) => (
                <TableRow key={p.plan}>
                  <TableCell className="font-medium">
                    {PLAN_LABEL[p.plan] ?? p.plan}
                  </TableCell>
                  <TableCell numeric className="text-ink-secondary">
                    {p.members}
                  </TableCell>
                  <TableCell numeric className="text-ink-secondary">
                    {p.count}
                  </TableCell>
                  <TableCell numeric>{fmt(p.amount)}</TableCell>
                  <TableCell numeric>
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1 w-20 overflow-hidden rounded-sm bg-surface-hover">
                        <div
                          className="h-full bg-accentui"
                          style={{ width: `${p.share}%` }}
                        />
                      </div>
                      <span className="min-w-9 text-right font-mono text-mono-sm text-ink-secondary">
                        {p.share}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
