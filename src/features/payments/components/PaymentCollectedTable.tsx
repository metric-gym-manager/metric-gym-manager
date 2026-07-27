'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMemberModal } from '@/contexts/member-modal.context'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Select,
  Input,
} from '@/components/ui'
import { formatDate } from '@/utils/date/date'
import { getPlanBadgeColor } from '@/utils/badge-colors'
import { Banknote, Users, TrendingUp } from 'lucide-react'

interface PaymentCollectedRow {
  paymentId: string
  memberId: string
  memberName: string
  phoneNumber: string
  planType: string
  amountPaid: number
  discountName: string | null
  discountPct: number | null
  paymentDate: string
  nextDueDate: string
}

interface PaymentCollectedSummary {
  totalRevenue: number
  paymentCount: number
  revenueByPlanType: Record<string, number>
}

interface CollectedPaymentsResponse {
  payments: PaymentCollectedRow[]
  summary: PaymentCollectedSummary
  totalCount: number
}

/**
 * Helper function to get the current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export default function PaymentCollectedTable() {
  const { openMember } = useMemberModal()
  const [month, setMonth] = useState(getCurrentMonth())
  const [planType, setPlanType] = useState('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery<CollectedPaymentsResponse>({
    queryKey: ['payment-collected', month, planType, search],
    queryFn: async () => {
      const params = new URLSearchParams({ month, planType, search })
      const res = await fetch(`/api/payment-collection/collected?${params}`)
      if (!res.ok) throw new Error('Failed to fetch collected payments')
      const r = await res.json()
      return r.data
    },
  })

  if (error) {
    return (
      <div className="rounded-md bg-error-bg p-4">
        <p className="text-sm text-error">
          Failed to load collected payments. Please try again.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Metrics Banner */}
      {data && data.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-success-bg border border-success-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-card rounded-lg">
                <Banknote className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-success font-medium">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-ink">
                  Rs. {data.summary.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-accentui-bg border border-accentui-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-card rounded-lg">
                <Users className="h-6 w-6 text-brand-link" />
              </div>
              <div>
                <p className="text-sm text-brand-link font-medium">
                  Payment Count
                </p>
                <p className="text-2xl font-bold text-ink">
                  {data.summary.paymentCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-input border border-line-1 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-card rounded-lg">
                <TrendingUp className="h-6 w-6 text-ink-secondary" />
              </div>
              <div>
                <p className="text-sm text-ink-secondary font-medium">
                  Revenue Breakdown
                </p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(data.summary.revenueByPlanType).map(
                    ([plan, revenue]) => (
                      <p key={plan} className="text-xs text-ink-muted">
                        {plan}: Rs. {revenue.toFixed(2)}
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Month</label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[200px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Plan Type</label>
          <div className="w-[200px]">
            <Select
              id="payment-collected-plan-filter-select"
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
            >
              <option value="all">All Plans</option>
              <option value="drop-in">Drop-in</option>
              <option value="class-pack">Class Pack</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Search</label>
          <Input
            type="text"
            placeholder="Name or phone number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[250px]"
          />
        </div>

        {data && (
          <div className="ml-auto">
            <p className="text-sm text-ink-secondary">
              Showing{' '}
              <span className="font-semibold text-ink">{data.totalCount}</span>{' '}
              payment
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
                <TableHead>Payment Date</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan Type</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Next Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((row) => (
                <TableRow
                  key={row.paymentId}
                  clickable
                  onClick={() => openMember(row.memberId)}
                >
                  <TableCell>{formatDate(row.paymentDate)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{row.memberName}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge className={getPlanBadgeColor(row.planType)}>
                      {row.planType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    Rs. {row.amountPaid.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {row.discountName && row.discountPct ? (
                      <span className="text-sm text-success">
                        {row.discountName} ({row.discountPct}%)
                      </span>
                    ) : (
                      <span className="text-sm text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(row.nextDueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center space-y-2 max-w-md mx-auto px-4">
              <p className="text-sm text-ink-muted">
                No payments collected this month
              </p>
              <p className="text-xs text-ink-muted">
                Payments will appear here once collected
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
