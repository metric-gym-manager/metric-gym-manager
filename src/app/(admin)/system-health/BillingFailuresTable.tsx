'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface BillingFailure {
  id: string;
  gym_id: string | null;
  order_id: string | null;
  payhere_payment_id: string | null;
  payhere_subscription_id: string | null;
  status_code: number;
  signature_valid: boolean;
  message_type: string | null;
  status_message: string | null;
  processed_at: string;
}

interface BillingFailuresResponse {
  success: boolean;
  data: {
    failures: BillingFailure[];
  };
  meta?: {
    totalCount?: number;
  };
}

const STATUS_CODE_LABELS: Record<number, string> = {
  2: 'success',
  0: 'pending',
  [-1]: 'canceled',
  [-2]: 'failed',
  [-3]: 'chargedback',
};

export default function BillingFailuresTable() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<BillingFailuresResponse>({
    queryKey: ['admin-billing-failures'],
    queryFn: async () => {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
      const response = await fetch('/api/admin/system-health/billing-failures', {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch billing failures');
      }
      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const formatTimestamp = (timestamp: string): string =>
    new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const statusBadge = (failure: BillingFailure) => {
    if (!failure.signature_valid) {
      return (
        <Badge className="border-transparent bg-red-100 text-red-800">invalid signature</Badge>
      );
    }
    const label = STATUS_CODE_LABELS[failure.status_code] ?? `code ${failure.status_code}`;
    const cls =
      failure.status_code === 0
        ? 'border-transparent bg-amber-100 text-amber-800'
        : 'border-transparent bg-orange-100 text-orange-800';
    return <Badge className={cls}>{label}</Badge>;
  };

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Failed to Load Billing Failures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-800">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>PayHere Billing Failures (Latest 50)</CardTitle>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {data?.meta?.totalCount !== undefined && (
          <p className="text-sm text-gray-600 mt-2">
            Total failures: <span className="font-semibold">{data.meta.totalCount}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">Loading billing failures...</p>
          </div>
        ) : data?.data.failures && data.data.failures.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[120px]">Gym ID</TableHead>
                  <TableHead className="w-[160px]">Order ID</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[220px]">Message Type</TableHead>
                  <TableHead className="min-w-[240px]">Gateway Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.failures.map((failure) => (
                  <TableRow key={failure.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-xs">
                      {formatTimestamp(failure.processed_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={failure.gym_id ?? ''}>
                      {failure.gym_id ? `${failure.gym_id.substring(0, 8)}...` : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {failure.order_id ?? '—'}
                    </TableCell>
                    <TableCell>{statusBadge(failure)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {failure.message_type ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-red-700">
                      {failure.status_message ?? (
                        <span className="text-gray-500 italic">No gateway message</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500 font-medium">No billing failures found</p>
              <p className="text-xs text-gray-400 mt-1">
                All PayHere notifications processed successfully
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
