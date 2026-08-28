'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  BarChart,
  Card,
  CardBody,
  CardHeader,
  CardLabel,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { PageHeader, StatCard, ChartCard } from '@/components/common/composites'
import { MemberAvatar } from '@/features/members'
import { useNow } from '@/hooks/useNow'
import { useIsHydrated } from '@/hooks/useIsHydrated'
import type { MonthlyRevenueResponse } from '@/features/revenue/types'
import { isNewMember } from '@/features/members'

interface DashboardMetrics {
  overdueMembers: {
    count: number
    critical: number
    warning: number
    mild: number
  }
  revenueThisMonth: number
  membersDueThisWeek: { count: number; totalAmount: number }
  activeMembers: number
}

interface CollectedPayment {
  paymentId: string
  memberName: string
  planType: string
  memberCreatedAt: string
  amountPaid: number
  paymentDate: string
  photoPath?: string | null
  photoUpdatedAt?: string | null
}

interface CollectedResponse {
  payments: CollectedPayment[]
  summary: { totalRevenue: number; paymentCount: number }
}

interface ReminderQueueEntry {
  memberId: string
  memberName: string
  planType: string
  reminderType: string
  scheduledInDays: number
  nextDueDate: string
  amount: number
}

interface ReminderQueueResult {
  entries: ReminderQueueEntry[]
  total: number
}

const REMINDER_LABEL: Record<string, string> = {
  reminder_7day: '7-day reminder',
  reminder_3day: '3-day reminder',
  due_today: 'Due-today reminder',
  overdue: 'Overdue reminder',
}

const fmt = (n: number) => n.toLocaleString('en-US')

function whenLabel(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/**
 * Dashboard "Overview" — Metric Design System. Wired to live data: stat tiles →
 * /api/dashboard/metrics, revenue chart → /api/revenue/monthly (trailing
 * months), recent payments → /api/payment-collection/collected, and the
 * reminder-queue panel → /api/reminders/queue (upcoming automated reminders
 * derived from active members' due dates + plan thresholds).
 */
export default function DashboardClient() {
  const router = useRouter()

  const {
    data: metricsRes,
    isLoading,
    error,
  } = useQuery<{ success: boolean; data: DashboardMetrics }>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/metrics')
      if (!response.ok) throw new Error('Failed to fetch dashboard metrics')
      return response.json()
    },
  })

  const nowMs = useNow()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: revenue } = useQuery<MonthlyRevenueResponse>({
    queryKey: ['revenue', 'monthly', year, month],
    queryFn: async () => {
      const response = await fetch(
        `/api/revenue/monthly?year=${year}&month=${month}`
      )
      if (!response.ok) throw new Error('Failed to fetch revenue')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })

  const { data: collected } = useQuery<CollectedResponse>({
    queryKey: ['dashboard', 'collected', year, month],
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

  const { data: reminderQueue } = useQuery<ReminderQueueResult>({
    queryKey: ['reminder-queue'],
    queryFn: async () => {
      const response = await fetch('/api/reminders/queue')
      if (!response.ok) throw new Error('Failed to fetch reminder queue')
      const result = await response.json()
      return result.data
    },
    staleTime: 60_000,
  })

  /**
   * The header clock, resolved on the client only.
   *
   * Rendering it during SSR is a guaranteed hydration mismatch: the stamp is
   * accurate to the minute, so any request crossing a minute boundary between
   * the server render and hydration hands React two different strings
   * ("AUG 27 2026, 20:44" against "AUG 27 2026, 20:45") and it throws the tree
   * away. It was also wrong on its own terms — an SSR-ed stamp is the
   * *server's* clock, printed under a label that says IST.
   *
   * `useIsHydrated` holds the server render and the hydrating client render to
   * the same output, and the real time appears on the render after. `useNow`
   * supplies the value itself — it is the repo's render-safe clock and ticks
   * on the minute, so the stamp stays true instead of freezing at mount.
   */
  const hydrated = useIsHydrated()

  const stamp = hydrated
    ? new Date(nowMs)
        .toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .toUpperCase()
        .replace(',', '')
    : null

  if (error) {
    return (
      <div className="flex max-w-app flex-col gap-4">
        <PageHeader title="Overview" />
        <Card className="border-error-border bg-error-bg">
          <CardBody className="text-body text-error">
            Failed to load dashboard metrics. Please try again.
          </CardBody>
        </Card>
      </div>
    )
  }

  const m = metricsRes?.data
  const tiles: Array<{
    label: string
    value: React.ReactNode
    sub: string
    href: string
  }> = [
    {
      label: 'Overdue members',
      value: (
        <span className="text-error">
          {m ? fmt(m.overdueMembers.count) : '—'}
        </span>
      ),
      sub: m
        ? `${m.overdueMembers.critical} critical · ${m.overdueMembers.warning} warning · ${m.overdueMembers.mild} mild`
        : ' ',
      href: '/payment-collection',
    },
    {
      label: `Revenue · ${now.toLocaleString('en-US', { month: 'long' })}`,
      value: m ? fmt(m.revenueThisMonth) : '—',
      sub: 'LKR · collected this month',
      href: '/revenue',
    },
    {
      label: 'Expires this week',
      value: (
        <span className="text-warning">
          {m ? fmt(m.membersDueThisWeek.count) : '—'}
        </span>
      ),
      sub: m ? `LKR ${fmt(m.membersDueThisWeek.totalAmount)} expected` : ' ',
      href: '/payment-collection',
    },
    {
      label: 'Active members',
      value: (
        <span className="text-success">{m ? fmt(m.activeMembers) : '—'}</span>
      ),
      sub: 'Currently active subscriptions',
      href: '/members',
    },
  ]

  // Trailing revenue bars (last 8 months).
  const history = (revenue?.historicalData ?? []).slice(-8)
  const chartData = history.map((h) => ({
    month: h.monthLabel.split(' ')[0],
    revenue: h.collectedRevenue,
  }))

  const queue = reminderQueue?.entries ?? []
  const queueTotal = reminderQueue?.total ?? 0

  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader
        title="Overview"
        actions={
          <span className="font-mono text-mono-sm text-ink-muted">
            {stamp === null ? (
              // Same glyph count in the same mono face, so the real stamp
              // lands without moving the header.
              <span aria-hidden="true" className="invisible">
                AAA 00 0000 00:00 IST
              </span>
            ) : (
              `${stamp} IST`
            )}
          </span>
        }
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatCard
            key={t.label}
            label={t.label}
            value={isLoading ? '—' : t.value}
            sub={t.sub}
            onClick={() => router.push(t.href)}
          />
        ))}
      </div>

      {/* Revenue chart + reminder queue */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={`Revenue · Trailing ${history.length || 8} months`}
          scale="LKR"
          bodyClassName="pt-2"
        >
          <BarChart
            data={chartData}
            xKey="month"
            series={[{ key: 'revenue', label: 'Collected' }]}
            valueFormatter={(v) => `LKR ${Number(v).toLocaleString('en-US')}`}
            height={160}
            label="Trailing monthly collected revenue"
            loading={!revenue}
            empty={<EmptyState title="No revenue history for this period." />}
          />
        </ChartCard>

        <Card className="flex flex-col lg:col-span-1">
          <CardHeader>
            <CardLabel>Reminder queue</CardLabel>
            <Badge variant={queueTotal > 0 ? 'warning' : 'success'}>
              {queueTotal} QUEUED
            </Badge>
          </CardHeader>
          {queue.length === 0 ? (
            <EmptyState
              className="py-10"
              title="No reminders scheduled"
              description="No automated reminders are due in the next 7 days."
            />
          ) : (
            queue.map((row) => (
              <div
                key={row.memberId}
                className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-2.5 last:border-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body text-ink">
                    {row.memberName}
                  </span>
                  <span className="font-mono text-mono-sm text-ink-muted">
                    {REMINDER_LABEL[row.reminderType] ?? 'Reminder'} ·{' '}
                    {whenLabel(row.scheduledInDays)}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-body-sm tabular-nums text-ink-secondary">
                  {fmt(row.amount)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Recent payments */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardLabel>Recent payments</CardLabel>
        </CardHeader>
        <div className="overflow-x-auto">
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
              {(collected?.payments ?? []).slice(0, 6).map((p) => (
                <TableRow key={p.paymentId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MemberAvatar
                        name={p.memberName}
                        photoPath={p.photoPath ?? null}
                        photoUpdatedAt={p.photoUpdatedAt ?? null}
                      />
                      <span className="font-medium">{p.memberName}</span>
                      {isNewMember(p.memberCreatedAt) && (
                        <Badge variant="accent">NEW</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-ink-secondary">
                    {p.planType}
                  </TableCell>
                  <TableCell className="font-mono text-mono-sm text-ink-muted">
                    {p.paymentDate}
                  </TableCell>
                  <TableCell numeric>{fmt(p.amountPaid)}</TableCell>
                </TableRow>
              ))}
              {(!collected || collected.payments.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-ink-muted"
                  >
                    No payments collected this month yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
