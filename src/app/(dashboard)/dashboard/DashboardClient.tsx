'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Panel,
  PanelHead,
  StatusBadge,
  formatNumber,
  formatLKR,
  type StatusTone,
} from '@/components/workspace/primitives'
import type { MonthlyRevenueResponse } from '@/features/revenue/types'

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
  amountPaid: number
  paymentDate: string
}

interface CollectedResponse {
  payments: CollectedPayment[]
  summary: { totalRevenue: number; paymentCount: number }
}

/**
 * Dashboard "Overview" — App Workspace design (Enterprise UI/UX overhaul).
 *
 * Wired to live data: stat tiles → /api/dashboard/metrics, revenue chart →
 * /api/revenue/monthly (trailing months), recent payments →
 * /api/payment-collection/collected. The reminder-queue panel is a design-only
 * surface — there is no reminder-queue API yet (see docs/architecture/
 * feature-gaps-app-workspace.md), so it renders representative rows.
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

  const stamp = now
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

  if (error) {
    return (
      <div style={{ maxWidth: 1200 }} className="flex flex-col gap-4">
        <h1 className="mws-h1">Overview</h1>
        <Panel
          style={{
            borderColor: 'var(--mws-err-br)',
            background: 'var(--mws-err-bg)',
          }}
        >
          <div style={{ padding: 16, fontSize: 13, color: 'var(--mws-err)' }}>
            Failed to load dashboard metrics. Please try again.
          </div>
        </Panel>
      </div>
    )
  }

  const m = metricsRes?.data
  const tiles: Array<{
    label: string
    value: string
    sub: string
    color: string
    href: string
  }> = [
    {
      label: 'Overdue members',
      value: m ? formatNumber(m.overdueMembers.count) : '—',
      sub: m
        ? `${m.overdueMembers.critical} critical · ${m.overdueMembers.warning} warning · ${m.overdueMembers.mild} mild`
        : ' ',
      color: 'var(--mws-err)',
      href: '/payment-collection',
    },
    {
      label: `Revenue · ${now.toLocaleString('en-US', { month: 'long' })}`,
      value: m ? formatLKR(m.revenueThisMonth, { prefix: false }) : '—',
      sub: 'LKR · collected this month',
      color: 'var(--mws-t1)',
      href: '/revenue',
    },
    {
      label: 'Expires this week',
      value: m ? formatNumber(m.membersDueThisWeek.count) : '—',
      sub: m ? `${formatLKR(m.membersDueThisWeek.totalAmount)} expected` : ' ',
      color: 'var(--mws-warn)',
      href: '/payment-collection',
    },
    {
      label: 'Active members',
      value: m ? formatNumber(m.activeMembers) : '—',
      sub: 'Currently active subscriptions',
      color: 'var(--mws-ok)',
      href: '/members',
    },
  ]

  // Trailing revenue bars (last 8 months, ×1,000, current month accented).
  const history = (revenue?.historicalData ?? []).slice(-8)
  const maxRev = Math.max(1, ...history.map((h) => h.collectedRevenue))

  return (
    <div style={{ maxWidth: 1200 }} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="mws-h1">Overview</h1>
        <span
          className="mws-mono"
          style={{ fontSize: 11, color: 'var(--mws-t3)' }}
        >
          {stamp} IST
        </span>
      </div>

      {/* Stat tiles */}
      <div
        className="mws-stat-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => router.push(t.href)}
            className="mws-stat"
          >
            <div className="mws-label">{t.label}</div>
            <div className="mws-stat-value" style={{ color: t.color }}>
              {isLoading ? '—' : t.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mws-t2)' }}>{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Revenue chart + reminder queue */}
      <div
        className="mws-dash-split"
        style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 12 }}
      >
        <Panel className="flex flex-col" style={{ padding: 16, gap: 12 }}>
          <div className="flex items-center justify-between">
            <span className="mws-label">
              Revenue · Trailing {history.length || 8} months
            </span>
            <span
              className="mws-mono"
              style={{ fontSize: 11, color: 'var(--mws-t2)' }}
            >
              LKR ×1,000
            </span>
          </div>
          <div
            className="flex items-end"
            style={{ gap: 10, height: 120, paddingTop: 8 }}
          >
            {history.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      height: 8,
                      background: 'var(--mws-b1)',
                      borderRadius: '2px 2px 0 0',
                      alignSelf: 'flex-end',
                    }}
                  />
                ))
              : history.map((h, i) => {
                  const barH = Math.max(
                    2,
                    Math.round((h.collectedRevenue / maxRev) * 96)
                  )
                  const isCurrent = i === history.length - 1
                  return (
                    <div
                      key={h.monthLabel}
                      className="flex-1 flex flex-col items-center justify-end"
                      style={{ gap: 6, height: '100%' }}
                    >
                      <span
                        className="mws-mono"
                        style={{ fontSize: 10, color: 'var(--mws-t3)' }}
                      >
                        {Math.round(h.collectedRevenue / 1000)}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: barH,
                          background: isCurrent
                            ? 'var(--mws-accent)'
                            : 'rgba(0,0,0,0.14)',
                          borderRadius: '2px 2px 0 0',
                        }}
                      />
                      <span
                        className="mws-mono"
                        style={{
                          fontSize: 10,
                          color: 'var(--mws-t3)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {h.monthLabel.split(' ')[0]}
                      </span>
                    </div>
                  )
                })}
          </div>
        </Panel>

        <ReminderQueue dueCount={m?.membersDueThisWeek.count ?? 0} />
      </div>

      {/* Recent payments */}
      <Panel style={{ overflow: 'hidden' }}>
        <PanelHead label="Recent payments" />
        <table className="mws-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount (LKR)</th>
            </tr>
          </thead>
          <tbody>
            {(collected?.payments ?? []).slice(0, 6).map((p) => (
              <tr key={p.paymentId}>
                <td style={{ fontWeight: 500 }}>{p.memberName}</td>
                <td
                  style={{
                    color: 'var(--mws-t2)',
                    textTransform: 'capitalize',
                  }}
                >
                  {p.planType}
                </td>
                <td
                  className="mws-mono"
                  style={{ fontSize: 12, color: 'var(--mws-t3)' }}
                >
                  {p.paymentDate}
                </td>
                <td className="mws-num">
                  {formatLKR(p.amountPaid, { prefix: false })}
                </td>
              </tr>
            ))}
            {(!collected || collected.payments.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: 16,
                    textAlign: 'center',
                    color: 'var(--mws-t3)',
                  }}
                >
                  No payments collected this month yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

/**
 * Reminder-queue panel — DESIGN-ONLY (feature gap). No API surfaces the
 * scheduled automated-reminder queue to the dashboard; automated reminders are
 * dispatched by the send-reminders cron. Rendered as dead-code with
 * representative rows so the design is complete; the header count reflects the
 * real "expires this week" figure. See the gap report.
 */
function ReminderQueue({ dueCount }: { dueCount: number }) {
  const sample: Array<{
    name: string
    channel: string
    when: string
    amount: string
  }> = [
    { name: 'Kasun Silva', channel: 'SMS', when: 'in 12 min', amount: '3,500' },
    {
      name: 'Chamara Dissanayake',
      channel: 'SMS',
      when: 'in 12 min',
      amount: '3,500',
    },
    {
      name: 'Tharindu Bandara',
      channel: 'SMS',
      when: 'tomorrow 09:00',
      amount: '15,500',
    },
    {
      name: 'Dinithi Samaraweera',
      channel: 'SMS',
      when: 'tomorrow 09:00',
      amount: '3,500',
    },
  ]
  const tone: StatusTone = dueCount > 0 ? 'warn' : 'ok'
  return (
    <Panel className="flex flex-col">
      <PanelHead
        label="Reminder queue"
        right={<StatusBadge tone={tone}>{dueCount} QUEUED</StatusBadge>}
      />
      {sample.map((q, i) => (
        <div
          key={i}
          className="flex items-center justify-between"
          style={{
            padding: '9px 16px',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex flex-col min-w-0">
            <span className="truncate" style={{ fontSize: 13 }}>
              {q.name}
            </span>
            <span
              className="mws-mono"
              style={{ fontSize: 11, color: 'var(--mws-t3)' }}
            >
              {q.channel} · {q.when}
            </span>
          </div>
          <span
            className="mws-mono"
            style={{ fontSize: 12, color: 'var(--mws-t2)' }}
          >
            {q.amount}
          </span>
        </div>
      ))}
    </Panel>
  )
}
