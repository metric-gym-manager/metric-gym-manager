'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Printer, RefreshCw } from 'lucide-react';
import { useBillingHistory } from '../hooks/useBillingHistory';
import type { BillingHistoryRow } from '../types';

const STATUS_BADGES: Record<BillingHistoryRow['status'], string> = {
  paid: 'border-transparent bg-green-100 text-green-800',
  pending: 'border-transparent bg-amber-100 text-amber-800',
  failed: 'border-transparent bg-red-100 text-red-800',
};

/**
 * SaaS billing history (plan §5.4 flow 5). Source: saas_payment_logs via
 * GET /api/billing/history — whitelisted fields only. Print uses the browser
 * dialog ("save as PDF" gives a downloadable invoice without a PDF library).
 */
export default function BillingHistoryTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useBillingHistory(page);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Billing History</CardTitle>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-gray-500">Loading billing history…</p>
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-600">Could not load billing history.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </div>
        ) : !data || data.payments.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500 font-medium">No payments yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Invoices appear here after your first Pro payment.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
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
                      <TableCell className="text-sm">{row.date}</TableCell>
                      <TableCell className="font-mono text-xs">{row.orderId ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {row.amount ? `${row.currency ?? ''} ${row.amount}`.trim() : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGES[row.status]}>{row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Page {data.page} of {data.totalPages} ({data.totalCount} payments)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
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
      </CardContent>
    </Card>
  );
}
