'use client'

import { useState } from 'react'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  type BadgeProps,
  ListRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { ChevronLeft, ChevronRight, Printer, RefreshCw } from 'lucide-react'
import { useViewportTier } from '@/hooks/useViewportTier'
import { useBillingHistory } from '../hooks/useBillingHistory'
import type { BillingHistoryRow } from '../types'
import { formatDate } from '@/utils/date/date'

const STATUS_VARIANTS: Record<
  BillingHistoryRow['status'],
  BadgeProps['variant']
> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
}

/**
 * SaaS billing history (plan §5.4 flow 5). Source: saas_payment_logs via
 * GET /api/billing/history — whitelisted fields only. Print uses the browser
 * dialog ("save as PDF" gives a downloadable invoice without a PDF library).
 */
export default function BillingHistoryTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useBillingHistory(page)
  const phone = useViewportTier() === 'phone'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing History</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-ink-muted">Loading billing history…</p>
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <p className="text-sm text-error">
              Could not load billing history.
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </div>
        ) : !data || data.payments.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-ink-muted font-medium">
                No payments yet
              </p>
              <p className="text-xs text-ink-muted mt-1">
                Invoices appear here after your first subscription payment.
              </p>
            </div>
          </div>
        ) : (
          <>
            {phone ? (
              /*
               * §9.4 "Billing history": date, amount and status in the row;
               * the order id disclosed on the meta line. The desktop keeps its
               * four-column `Table`, which sits in an `overflow-x-auto` div —
               * a scroller that hid two of those columns on a phone rather
               * than widening the page (probe rule 3).
               */
              <ul role="list">
                {data.payments.map((row) => (
                  <ListRow
                    key={row.id}
                    primary={formatDate(row.date)}
                    status={
                      <Badge variant={STATUS_VARIANTS[row.status]}>
                        {row.status}
                      </Badge>
                    }
                    meta={[row.orderId ?? '—']}
                    value={
                      row.amount
                        ? `${row.currency ?? ''} ${row.amount}`.trim()
                        : '—'
                    }
                  />
                ))}
              </ul>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">
                          {formatDate(row.date)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.orderId ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.amount
                            ? `${row.currency ?? ''} ${row.amount}`.trim()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[row.status]}>
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-ink-muted">
                  Page {data.page} of {data.totalPages} ({data.totalCount}{' '}
                  payments)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}
