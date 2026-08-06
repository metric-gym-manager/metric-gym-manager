'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Panel,
  StatusBadge,
  formatLKR,
  type StatusTone,
} from '@/components/workspace/primitives'
import { useMemberModal } from '@/contexts/member-modal.context'
import { MemberAvatar } from '@/features/members'

type Tab = 'expired' | 'due' | 'collected'

interface DueRow {
  id: string
  name: string
  planType: string
  effectiveAmount: number
  nextDueDate: string
  daysUntilDue: number
  photoPath?: string | null
  photoUpdatedAt?: string | null
}
interface RegularPaymentsResponse {
  success: boolean
  data: { payments: DueRow[]; totalCount: number }
}
interface CollectedRow {
  paymentId: string
  memberId: string
  memberName: string
  planType: string
  amountPaid: number
  paymentDate: string
  photoPath?: string | null
  photoUpdatedAt?: string | null
}
interface CollectedResponse {
  payments: CollectedRow[]
  summary: { totalRevenue: number; paymentCount: number }
}

function reminderType(daysUntilDue: number): string {
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue < 1) return 'due_today'
  if (daysUntilDue < 4) return 'reminder_3day'
  return 'reminder_7day'
}

/**
 * Renewals — App Workspace design. Three tabs (Expired / Expires this
 * week / Collected) over live data: dues come from /api/regular-payments,
 * collected from /api/payment-collection/collected. "Remind" sends a
 * per-member SMS (POST /api/sms/send); "Record payment" / "Receipt" open the
 * member drawer.
 */
export default function PaymentCollectionPageClient() {
  const [tab, setTab] = useState<Tab>('expired')
  const { openMember } = useMemberModal()
  const queryClient = useQueryClient()

  const { data: dues } = useQuery<RegularPaymentsResponse>({
    queryKey: ['regular-payments', 'all'],
    queryFn: async () => {
      const response = await fetch(
        '/api/regular-payments?filter=all&sortBy=due_date_asc'
      )
      if (!response.ok) throw new Error('Failed to fetch dues')
      return response.json()
    },
  })

  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const { data: collected } = useQuery<CollectedResponse>({
    queryKey: ['payment-collection', 'collected', month],
    queryFn: async () => {
      const response = await fetch(
        `/api/payment-collection/collected?month=${month}`
      )
      if (!response.ok) throw new Error('Failed to fetch collected payments')
      const result = await response.json()
      return result.data
    },
  })

  const [pendingId, setPendingId] = useState<string | null>(null)
  const remindMutation = useMutation({
    mutationFn: async ({
      memberId,
      smsType,
    }: {
      memberId: string
      smsType: string
    }) => {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, smsType }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send reminder')
      }
      return response.json()
    },
    onMutate: ({ memberId }) => setPendingId(memberId),
    onSuccess: () => {
      toast.success('Reminder sent')
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Failed to send reminder'),
    onSettled: () => setPendingId(null),
  })

  const allDues = dues?.data.payments ?? []
  const expired = allDues.filter((r) => r.daysUntilDue < 0)
  const dueSoon = allDues.filter(
    (r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 7
  )
  const collectedRows = collected?.payments ?? []

  const tabs: Array<{
    id: Tab
    label: string
    count: number
    tone: StatusTone
  }> = [
    { id: 'expired', label: 'Expired', count: expired.length, tone: 'err' },
    {
      id: 'due',
      label: 'Expires this week',
      count: dueSoon.length,
      tone: 'warn',
    },
    {
      id: 'collected',
      label: 'Collected',
      count: collected?.summary.paymentCount ?? 0,
      tone: 'ok',
    },
  ]

  const col3Label =
    tab === 'expired' ? 'Expired' : tab === 'due' ? 'Exp date' : 'Paid on'

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1200 }}>
      <h1 className="mws-h1">Renewals</h1>

      {/* Tabs */}
      <div
        className="flex"
        style={{ gap: 2, borderBottom: '1px solid var(--mws-b1)' }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn('mws-tab', tab === t.id && 'mws-tab-active')}
          >
            {t.label}&nbsp;
            <span
              className="mws-mono"
              style={{
                fontSize: 11,
                color: `var(--mws-${t.tone === 'err' ? 'err' : t.tone === 'warn' ? 'warn' : 'ok'})`,
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <Panel style={{ overflow: 'hidden' }}>
        <div className="mws-table-scroll">
          <table className="mws-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>{col3Label}</th>
                <th style={{ textAlign: 'right' }}>Amount (LKR)</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tab === 'collected' ? (
                collectedRows.length === 0 ? (
                  <EmptyRow label="No payments collected this month yet." />
                ) : (
                  collectedRows.map((r) => (
                    <tr key={r.paymentId}>
                      <td>
                        <div className="flex items-center gap-2">
                          <MemberAvatar
                            name={r.memberName}
                            photoPath={r.photoPath}
                            photoUpdatedAt={r.photoUpdatedAt}
                          />
                          <span style={{ fontWeight: 500 }}>
                            {r.memberName}
                          </span>
                        </div>
                      </td>
                      <td
                        className="mws-mono"
                        style={{ fontSize: 12, color: 'var(--mws-t3)' }}
                      >
                        {r.paymentDate}
                      </td>
                      <td className="mws-num">
                        {formatLKR(r.amountPaid, { prefix: false })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="mws-btn mws-btn-sm"
                          onClick={() => openMember(r.memberId)}
                        >
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                (() => {
                  const rows = tab === 'expired' ? expired : dueSoon
                  if (rows.length === 0)
                    return (
                      <EmptyRow
                        label={
                          tab === 'expired'
                            ? 'No expired members. 🎉'
                            : 'Nobody expires in the next 7 days.'
                        }
                      />
                    )
                  return rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <MemberAvatar
                            name={r.name}
                            photoPath={r.photoPath}
                            photoUpdatedAt={r.photoUpdatedAt}
                          />
                          <span style={{ fontWeight: 500 }}>{r.name}</span>
                        </div>
                      </td>
                      <td>
                        {tab === 'expired' ? (
                          <StatusBadge tone="err">
                            {Math.abs(r.daysUntilDue)} DAYS AGO
                          </StatusBadge>
                        ) : (
                          <span
                            className="mws-mono"
                            style={{ fontSize: 12, color: 'var(--mws-warn)' }}
                          >
                            {r.nextDueDate}
                          </span>
                        )}
                      </td>
                      <td className="mws-num">
                        {formatLKR(r.effectiveAmount, { prefix: false })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="inline-flex" style={{ gap: 6 }}>
                          <button
                            type="button"
                            className="mws-btn mws-btn-sm"
                            disabled={pendingId === r.id}
                            onClick={() =>
                              remindMutation.mutate({
                                memberId: r.id,
                                smsType: reminderType(r.daysUntilDue),
                              })
                            }
                          >
                            {pendingId === r.id ? 'Sending…' : 'Remind'}
                          </button>
                          <button
                            type="button"
                            className="mws-btn mws-btn-sm"
                            style={{
                              color: 'var(--mws-ok)',
                              borderColor: 'var(--mws-ok-br)',
                            }}
                            onClick={() => openMember(r.id)}
                          >
                            Record payment
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                })()
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={4}
        style={{ padding: 24, textAlign: 'center', color: 'var(--mws-t3)' }}
      >
        {label}
      </td>
    </tr>
  )
}
