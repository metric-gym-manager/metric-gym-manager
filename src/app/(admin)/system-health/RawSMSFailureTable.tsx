'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Input,
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
import { RefreshCw, AlertTriangle, Copy, Check, Filter, X } from 'lucide-react'
import { useState } from 'react'

interface SMSFailure {
  id: string
  gym_id: string
  member_id: string
  sms_type: string
  phone_number: string
  message_body: string
  sent_at: string
  delivery_status: string
  error_message: string | null
  text_lk_message_id: string | null
}

interface SMSFailuresResponse {
  success: boolean
  data: {
    failures: SMSFailure[]
    totalCount: number
    filters: {
      gymId: string | null
    }
  }
}

type BadgeTone = 'accent' | 'warning' | 'error' | 'success' | 'neutral'

const smsTypeVariant = (smsType: string): BadgeTone => {
  switch (smsType) {
    case 'reminder_7day':
      return 'accent'
    case 'reminder_3day':
    case 'due_today':
      return 'warning'
    case 'overdue':
      return 'error'
    case 'receipt':
      return 'success'
    case 'welcome':
      return 'accent'
    default:
      return 'neutral'
  }
}

export default function RawSMSFailureTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [gymIdFilter, setGymIdFilter] = useState<string>('')
  const [activeGymId, setActiveGymId] = useState<string | null>(null)

  const { data, isLoading, error, refetch, isFetching } =
    useQuery<SMSFailuresResponse>({
      queryKey: ['admin-sms-failures', activeGymId],
      queryFn: async () => {
        const url = activeGymId
          ? `/api/admin/system-health/sms-failures?gymId=${activeGymId}`
          : '/api/admin/system-health/sms-failures'

        // Same-origin fetch: the Supabase session cookie authenticates the
        // request; the API route checks saas_admins membership. No secret in JS.
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to fetch SMS failures')
        }

        return response.json()
      },
      refetchInterval: 60000, // Auto-refresh every minute
    })

  const handleApplyFilter = () => {
    if (gymIdFilter.trim()) {
      setActiveGymId(gymIdFilter.trim())
    }
  }

  const handleClearFilter = () => {
    setGymIdFilter('')
    setActiveGymId(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyFilter()
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getSMSTypeBadge = (smsType: string) => (
    <Badge variant={smsTypeVariant(smsType)}>{smsType}</Badge>
  )

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (error) {
    return (
      <Card className="border-error-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-error">
            <AlertTriangle className="h-5 w-5" />
            Failed to Load SMS Failures
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
        <CardTitle>SMS Delivery Failures (Latest 50)</CardTitle>
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
        <div className="mb-4 space-y-2">
          {/* Gym-Specific Drilldown Filter */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Filter by Gym ID (UUID)"
              value={gymIdFilter}
              onChange={(e) => setGymIdFilter(e.target.value)}
              onKeyDown={handleKeyPress}
              className="max-w-xs font-mono text-sm"
            />
            <Button
              variant="accent"
              onClick={handleApplyFilter}
              size="sm"
              disabled={!gymIdFilter.trim()}
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
            {activeGymId && (
              <Button onClick={handleClearFilter} variant="secondary" size="sm">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {activeGymId && (
            <div className="p-2 bg-accentui-bg border border-accentui-border rounded-md">
              <p className="text-sm text-accentui-text">
                <span className="font-semibold">Filtered by Gym ID:</span>{' '}
                <span className="font-mono text-xs">{activeGymId}</span>
              </p>
            </div>
          )}

          {data?.data && (
            <p className="text-sm text-ink-muted">
              Total failures:{' '}
              <span className="font-semibold">{data.data.totalCount}</span>
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-ink-muted">Loading SMS failures...</p>
          </div>
        ) : data?.data.failures && data.data.failures.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[120px]">Gym ID</TableHead>
                  <TableHead className="w-[140px]">SMS Type</TableHead>
                  <TableHead className="w-[140px]">Phone Number</TableHead>
                  <TableHead className="min-w-[300px]">
                    Raw Error Trace
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.failures.map((failure) => (
                  <TableRow key={failure.id}>
                    <TableCell className="font-mono text-xs">
                      {formatTimestamp(failure.sent_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate max-w-[80px]"
                          title={failure.gym_id}
                        >
                          {failure.gym_id.substring(0, 8)}...
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(failure.gym_id, `gym-${failure.id}`)
                          }
                          className="p-1 hover:bg-surface-hover rounded"
                          title="Copy Gym ID"
                        >
                          {copiedId === `gym-${failure.id}` ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3 text-ink-muted" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>{getSMSTypeBadge(failure.sms_type)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {failure.phone_number}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[500px]">
                        {failure.error_message ? (
                          <details className="group">
                            <summary className="cursor-pointer text-sm text-error hover:text-error flex items-center gap-2">
                              <span className="truncate max-w-[400px]">
                                {failure.error_message}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  copyToClipboard(
                                    failure.error_message!,
                                    `error-${failure.id}`
                                  )
                                }}
                                className="p-1 hover:bg-surface-hover rounded"
                                title="Copy Error Message"
                              >
                                {copiedId === `error-${failure.id}` ? (
                                  <Check className="h-3 w-3 text-success" />
                                ) : (
                                  <Copy className="h-3 w-3 text-ink-muted" />
                                )}
                              </button>
                            </summary>
                            <div className="mt-2 p-3 bg-error-bg rounded border border-error-border">
                              <pre className="text-xs text-error whitespace-pre-wrap break-all">
                                {failure.error_message}
                              </pre>
                              {failure.text_lk_message_id && (
                                <div className="mt-2 text-xs text-ink-muted">
                                  <span className="font-semibold">
                                    TextLK Message ID:
                                  </span>{' '}
                                  <span className="font-mono">
                                    {failure.text_lk_message_id}
                                  </span>
                                </div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span className="text-sm text-ink-muted italic">
                            No error message
                          </span>
                        )}
                      </div>
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
                No SMS failures found
              </p>
              <p className="text-xs text-ink-muted mt-1">
                All SMS deliveries are currently successful
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
