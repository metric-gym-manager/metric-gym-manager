'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMemberModal } from '@/contexts/member-modal.context'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  Select,
} from '@/components/ui'
import MarkPaidDialog from '@/features/payments/components/MarkPaidDialog'
import { formatDate } from '@/utils/date/date'
import { getPlanBadgeColor } from '@/utils/badge-colors'
import { parseApiError } from '@/utils/api-error'

interface RegularPaymentRow {
  id: string
  name: string
  phoneNumber: string
  planType: string
  planAmount: number
  discountId: string | null
  discountName: string | null
  discountPct: number | null
  recurringDiscount: boolean
  effectiveAmount: number
  nextDueDate: string
  daysUntilDue: number
  memberStatus: string
}

interface RegularPaymentsResponse {
  payments: RegularPaymentRow[]
  totalCount: number
}

export default function RegularPaymentTable() {
  const { openMember } = useMemberModal()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due_date_asc')
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingPayment, setPendingPayment] =
    useState<RegularPaymentRow | null>(null)

  const { data, isLoading, error } = useQuery<RegularPaymentsResponse>({
    queryKey: ['regular-payments', filter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({ filter, sortBy })
      const res = await fetch(`/api/regular-payments?${params}`)
      if (!res.ok) throw new Error('Failed to fetch regular payments')
      const r = await res.json()
      return r.data
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: async (data: RegularPaymentRow & { paymentDate: string }) => {
      const res = await fetch(`/api/members/${data.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: data.planAmount,
          paymentAmount: data.effectiveAmount,
          paymentDate: data.paymentDate,
          discountId: data.discountId ?? undefined,
          deductOverduePeriod: true,
        }),
      })
      if (!res.ok) {
        const errorMessage = await parseApiError(res)
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onMutate: (data) => {
      setPendingMemberId(data.id)
    },
    onSuccess: () => {
      setPendingMemberId(null)
      toast.success('Payment collected — receipt SMS sent')
      // Batch invalidations to reduce refetch overhead
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'regular-payments' ||
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'sms-reminders' ||
          query.queryKey[0] === 'payment-collected',
      })
    },
    onError: (error) => {
      setPendingMemberId(null)
      toast.error(
        error instanceof Error ? error.message : 'Failed to collect payment'
      )
    },
  })

  const getDueInText = (daysUntilDue: number) => {
    if (daysUntilDue >= 0 && daysUntilDue < 1) {
      return <Badge variant="warning">Due today</Badge>
    } else if (daysUntilDue > 0) {
      return <Badge variant="success">{Math.floor(daysUntilDue)}d left</Badge>
    } else {
      const days = Math.abs(Math.floor(daysUntilDue))
      return <Badge variant="error">{days}d overdue</Badge>
    }
  }

  const handleMarkPaidClick = (row: RegularPaymentRow) => {
    setPendingPayment(row)
    setConfirmDialogOpen(true)
  }

  const handleConfirmPayment = (paymentDate: string) => {
    if (pendingPayment) {
      markPaidMutation.mutate({ ...pendingPayment, paymentDate })
      setConfirmDialogOpen(false)
      setPendingPayment(null)
    }
  }

  if (error) {
    return (
      <div className="rounded-md bg-error-bg p-4">
        <p className="text-sm text-error">
          Failed to load regular payments. Please try again.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Filter</label>
          <div className="w-[200px]">
            <Select
              id="payment-regular-filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="overdue">Overdue Only</option>
              <option value="due_today">Due Today</option>
              <option value="upcoming">Upcoming (1–7 days)</option>
              <option value="all">All Members</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Sort By</label>
          <div className="w-[200px]">
            <Select
              id="payment-regular-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="due_date_asc">Due Date (Soonest First)</option>
              <option value="member_name">Member Name</option>
            </Select>
          </div>
        </div>

        {data && (
          <div className="ml-auto">
            <p className="text-sm text-ink-secondary">
              Total:{' '}
              <span className="font-semibold text-ink">{data.totalCount}</span>{' '}
              member
              {data.totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-line-1 bg-surface-card">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-ink-muted">Loading payments...</p>
          </div>
        ) : data && data.payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Plan Amount</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Amount Due</TableHead>
                <TableHead>Next Due Date</TableHead>
                <TableHead>Due In</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((row) => (
                <TableRow
                  key={row.id}
                  clickable
                  onClick={() => openMember(row.id)}
                  className={
                    row.daysUntilDue < 0
                      ? 'bg-error-bg'
                      : row.daysUntilDue >= 0 && row.daysUntilDue < 1
                        ? 'bg-warning-bg'
                        : ''
                  }
                >
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge className={getPlanBadgeColor(row.planType)}>
                      {row.planType}
                    </Badge>
                  </TableCell>
                  <TableCell>Rs. {row.planAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    {row.discountName && row.discountPct ? (
                      <span className="text-sm text-success">
                        {row.discountName} ({row.discountPct}%)
                      </span>
                    ) : (
                      <span className="text-sm text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    Rs. {row.effectiveAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>{formatDate(row.nextDueDate)}</TableCell>
                  <TableCell>{getDueInText(row.daysUntilDue)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMarkPaidClick(row)
                      }}
                      disabled={pendingMemberId === row.id}
                    >
                      {pendingMemberId === row.id ? 'Saving...' : 'Mark Paid'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center space-y-2 max-w-md mx-auto px-4">
              <p className="text-sm text-ink-muted">No payments found</p>
              {filter !== 'all' ? (
                <p className="text-xs text-ink-muted">
                  Try adjusting your filters
                </p>
              ) : (
                <p className="text-xs text-ink-muted">
                  All members are up to date with their payments. Upcoming
                  payments will appear here as they approach their due date.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Payment Dialog */}
      <MarkPaidDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        memberName={pendingPayment?.name || ''}
        amount={pendingPayment?.effectiveAmount || 0}
        planType={pendingPayment?.planType || 'monthly'}
        onConfirm={handleConfirmPayment}
      />
    </div>
  )
}
