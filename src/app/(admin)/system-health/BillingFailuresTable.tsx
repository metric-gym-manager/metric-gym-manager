'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from '@/components/ui'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface BillingFailure {
  id: string
  gym_id: string | null
  order_id: string | null
  payhere_payment_id: string | null
  payhere_subscription_id: string | null
  status_code: number
  signature_valid: boolean
  message_type: string | null
  status_message: string | null
  processed_at: string
}

interface BillingFailuresResponse {
  success: boolean
  data: {
    failures: BillingFailure[]
  }
  meta?: {
    totalCount?: number
  }
}

const STATUS_CODE_LABELS: Record<number, string> = {
  2: 'success',
  0: 'pending',
  [-1]: 'canceled',
  [-2]: 'failed',
  [-3]: 'chargedback',
}

export default function BillingFailuresTable() {
  const { data, isLoading, error, refetch, isFetching } =
    useQuery<BillingFailuresResponse>({
      queryKey: ['admin-billing-failures'],
      queryFn: async () => {
        // Same-origin fetch: the Supabase session cookie authenticates the
        // request; the API route checks saas_admins membership. No secret in JS.
        const response = await fetch(
          '/api/admin/system-health/billing-failures'
        )
        if (!response.ok) {
          throw new Error('Failed to fetch billing failures')
        }
        return response.json()
      },
      refetchInterval: 60000, // Auto-refresh every minute
    })

  const formatTimestamp = (timestamp: string): string =>
    new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const statusBadge = (failure: BillingFailure) => {
    if (!failure.signature_valid) {
      return <Badge variant="error">invalid signature</Badge>
    }
    const label =
      STATUS_CODE_LABELS[failure.status_code] ?? `code ${failure.status_code}`
    // Pending (code 0) is a warning; every other logged code is a failure.
    return (
      <Badge variant={failure.status_code === 0 ? 'warning' : 'error'}>
        {label}
      </Badge>
    )
  }

  if (error) {
    return (
      <Card className="border-error-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-error">
            <AlertTriangle className="h-5 w-5" />
            Failed to Load Billing Failures
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-error">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button
            onClick={() => refetch()}
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PayHere Billing Failures (Latest 50)</CardTitle>
        <Button
          onClick={() => refetch()}
          variant="secondary"
          size="sm"
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardBody>
        {data?.meta?.totalCount !== undefined && (
          <p className="text-sm text-ink-muted mb-4">
            Total failures:{' '}
            <span className="font-semibold">{data.meta.totalCount}</span>
          </p>
        )}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-ink-muted">
              Loading billing failures...
            </p>
          </div>
        ) : data?.data.failures && data.data.failures.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[120px]">Gym ID</TableHead>
                  <TableHead className="w-[160px]">Order ID</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[220px]">Message Type</TableHead>
                  <TableHead className="min-w-[240px]">
                    Gateway Message
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.failures.map((failure) => (
                  <TableRow key={failure.id}>
                    <TableCell className="font-mono text-xs">
                      {formatTimestamp(failure.processed_at)}
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs"
                      title={failure.gym_id ?? ''}
                    >
                      {failure.gym_id
                        ? `${failure.gym_id.substring(0, 8)}...`
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {failure.order_id ?? '—'}
                    </TableCell>
                    <TableCell>{statusBadge(failure)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {failure.message_type ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-error">
                      {failure.status_message ?? (
                        <span className="text-ink-muted italic">
                          No gateway message
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-ink-muted font-medium">
                No billing failures found
              </p>
              <p className="text-xs text-ink-muted mt-1">
                All PayHere notifications processed successfully
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
