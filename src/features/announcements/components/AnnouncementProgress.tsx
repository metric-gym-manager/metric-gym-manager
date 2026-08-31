'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Badge, Progress } from '@/components/ui'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
  AlertTriangle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface AnnouncementProgressProps {
  announcementId: string
  onComplete?: () => void
  onDismiss?: () => void
}

interface AnnouncementData {
  announcement: {
    id: string
    message: string
    recipientCount: number
    sentCount: number
    failedCount: number
    status: 'pending' | 'sending' | 'completed' | 'failed'
    sentAt: string
    createdAt: string
  }
  failures: {
    retryable: Array<{
      id: string
      member_id: string
      member_name: string
      phone_number: string
      retry_count: number
      last_error: string
      last_attempt_at: string
    }>
    maxAttempts: Array<{
      id: string
      member_id: string
      member_name: string
      phone_number: string
      retry_count: number
      last_error: string
      last_attempt_at: string
    }>
  }
}

export default function AnnouncementProgress({
  announcementId,
  onComplete,
  onDismiss,
}: AnnouncementProgressProps) {
  const queryClient = useQueryClient()

  // Dismiss mutation - clears session failures
  const dismissMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/announcements/${announcementId}/dismiss`,
        {
          method: 'POST',
        }
      )
      if (!response.ok) {
        throw new Error('Failed to dismiss')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      if (onDismiss) {
        onDismiss()
      }
      toast.success('Progress dismissed')
    },
  })

  // Poll for progress updates
  const { data, isLoading } = useQuery<AnnouncementData>({
    queryKey: ['announcement-progress', announcementId],
    queryFn: async () => {
      const response = await fetch(
        `/api/announcements/${announcementId}/progress`
      )
      if (!response.ok) throw new Error('Failed to fetch progress')
      const result = await response.json()
      return result.data
    },
    // Poll every 2 seconds while sending; stop once finished
    refetchInterval: (query) => {
      const status = query.state.data?.announcement.status
      return status === 'completed' || status === 'failed' ? false : 2000
    },
    enabled: !!announcementId,
  })

  // Notify the parent when complete or failed (polling stops via refetchInterval)
  useEffect(() => {
    if (
      data?.announcement.status === 'completed' ||
      data?.announcement.status === 'failed'
    ) {
      if (onComplete) {
        onComplete()
      }
    }
  }, [data?.announcement.status, onComplete])

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/announcements/${announcementId}/retry`,
        {
          method: 'POST',
        }
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to retry')
      }
      return response.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['announcement-progress', announcementId],
      })
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast.success(
        `Retry complete: ${result.data.successCount} succeeded, ${result.data.failedCount} failed`
      )
      // Polling resumes automatically: the invalidation above refetches,
      // and refetchInterval re-evaluates from the announcement status.
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to retry')
    },
  })

  if (isLoading || !data) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accentui" />
          <p className="text-sm text-ink-secondary">
            Loading announcement progress...
          </p>
        </div>
      </Card>
    )
  }

  const { announcement, failures } = data
  const progressPercentage =
    announcement.recipientCount > 0
      ? Math.round(
          ((announcement.sentCount + announcement.failedCount) /
            announcement.recipientCount) *
            100
        )
      : 0

  const isSending = announcement.status === 'sending'
  const isComplete = announcement.status === 'completed'
  const isFailed = announcement.status === 'failed'

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Progress Card */}
      <Card className="p-4 md:p-6">
        <div className="space-y-3 md:space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              {isSending && (
                <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin text-accentui shrink-0" />
              )}
              {isComplete && (
                <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-success shrink-0" />
              )}
              {isFailed && (
                <XCircle className="h-5 w-5 md:h-6 md:w-6 text-error shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-ink">
                  {isSending && (
                    <span>
                      <span className="hidden sm:inline">
                        Sending Announcement...
                      </span>
                      <span className="sm:hidden">Sending...</span>
                    </span>
                  )}
                  {isComplete && (
                    <span>
                      <span className="hidden sm:inline">
                        Announcement Sent
                      </span>
                      <span className="sm:hidden">Sent</span>
                    </span>
                  )}
                  {isFailed && (
                    <span>
                      <span className="hidden sm:inline">
                        Announcement Failed
                      </span>
                      <span className="sm:hidden">Failed</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs md:text-sm text-ink-muted mt-0.5 md:mt-1">
                  <span className="hidden sm:inline">
                    {new Date(announcement.sentAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="sm:hidden">
                    {new Date(announcement.sentAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    {new Date(announcement.sentAt).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <Badge
                variant={
                  isSending ? 'accent' : isComplete ? 'success' : 'error'
                }
              >
                {announcement.status}
              </Badge>
              {!isSending && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissMutation.mutate()}
                  disabled={dismissMutation.isPending}
                  className="h-7 w-7 md:h-8 md:w-8 p-0"
                >
                  <X className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Message Preview */}
          <div className="rounded-sm p-2.5 md:p-3">
            <p className="text-xs md:text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {announcement.message}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span className="font-medium text-ink-secondary">
                <span className="hidden sm:inline">
                  {announcement.sentCount + announcement.failedCount} of{' '}
                  {announcement.recipientCount} processed
                </span>
                <span className="sm:hidden">
                  {announcement.sentCount + announcement.failedCount}/
                  {announcement.recipientCount}
                </span>
              </span>
              <span className="font-semibold text-ink">
                {progressPercentage}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-1.5 md:h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="rounded-sm bg-success-bg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2">
                <Send className="h-3 w-3 md:h-4 md:w-4 text-success shrink-0" />
                <span className="text-[10px] md:text-xs font-medium text-success">
                  Sent
                </span>
              </div>
              <p className="text-h2 md:text-readout text-success mt-0.5 md:mt-1">
                {announcement.sentCount}
              </p>
            </div>
            <div className="rounded-sm bg-error-bg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2">
                <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-error shrink-0" />
                <span className="text-[10px] md:text-xs font-medium text-error">
                  Failed
                </span>
              </div>
              <p className="text-h2 md:text-readout text-error mt-0.5 md:mt-1">
                {announcement.failedCount}
              </p>
            </div>
            <div className="rounded-sm p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2">
                <Clock className="h-3 w-3 md:h-4 md:w-4 text-ink-secondary shrink-0" />
                <span className="text-[10px] md:text-xs font-medium text-ink truncate">
                  <span className="hidden sm:inline">Remaining</span>
                  <span className="sm:hidden">Left</span>
                </span>
              </div>
              <p className="text-h2 md:text-readout text-ink-secondary mt-0.5 md:mt-1">
                {announcement.recipientCount -
                  announcement.sentCount -
                  announcement.failedCount}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Failed Messages - Retryable */}
      {failures.retryable.length > 0 && (
        <Card className="p-4 md:p-6">
          <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-warning shrink-0" />
                <h4 className="text-sm md:text-base font-semibold text-ink">
                  <span className="hidden sm:inline">
                    Failed Messages ({failures.retryable.length})
                  </span>
                  <span className="sm:hidden">
                    Failed ({failures.retryable.length})
                  </span>
                </h4>
              </div>
              <Button
                variant="primary"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending || isSending}
                size="sm"
                className="gap-2 w-full sm:w-auto text-xs md:text-sm"
              >
                {retryMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                    <span className="hidden sm:inline">Retrying...</span>
                    <span className="sm:hidden">Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Retry All Failed</span>
                    <span className="sm:hidden">Retry All</span>
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {failures.retryable.map((failure) => (
                <div
                  key={failure.id}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 rounded-sm bg-warning-bg border border-warning-border p-2.5 md:p-3"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <p className="text-xs md:text-sm font-medium text-ink truncate">
                        {failure.member_name}
                      </p>
                      <Badge variant="neutral" className="w-fit">
                        {failure.phone_number}
                      </Badge>
                    </div>
                    <p className="text-[10px] md:text-xs text-error leading-tight">
                      {failure.last_error}
                    </p>
                    <p className="text-[10px] md:text-xs text-ink-muted">
                      <span className="hidden sm:inline">Last attempt: </span>
                      {new Date(failure.last_attempt_at).toLocaleString(
                        'en-GB',
                        {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </p>
                  </div>
                  <Badge variant="warning" className="w-fit shrink-0">
                    {failure.retry_count}/3
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Failed Messages - Max Attempts Reached */}
      {failures.maxAttempts.length > 0 && (
        <Card className="p-4 md:p-6 border-error-border bg-error-bg">
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-error shrink-0" />
              <h4 className="text-sm md:text-base font-semibold text-error">
                <span className="hidden sm:inline">
                  Maximum Retry Attempts Reached ({failures.maxAttempts.length})
                </span>
                <span className="sm:hidden">
                  Max Attempts ({failures.maxAttempts.length})
                </span>
              </h4>
            </div>

            <div className="rounded-sm bg-error-bg border border-error-border p-3 md:p-4">
              <p className="text-xs md:text-sm text-error font-medium leading-relaxed">
                <span className="hidden sm:inline">
                  The following messages failed after 3 retry attempts. Please
                  contact support for assistance.
                </span>
                <span className="sm:hidden">
                  Failed after 3 attempts. Contact support.
                </span>
              </p>
            </div>

            <div className="space-y-2">
              {failures.maxAttempts.map((failure) => (
                <div
                  key={failure.id}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 border-b border-line-subtle py-2.5 last:border-0"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <p className="text-xs md:text-sm font-medium text-ink truncate">
                        {failure.member_name}
                      </p>
                      <Badge variant="neutral" className="w-fit">
                        {failure.phone_number}
                      </Badge>
                    </div>
                    <p className="text-[10px] md:text-xs text-error leading-tight">
                      {failure.last_error}
                    </p>
                  </div>
                  <Badge variant="error" className="w-fit shrink-0">
                    3/3 Failed
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
