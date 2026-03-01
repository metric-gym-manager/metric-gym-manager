'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface AnnouncementProgressProps {
  announcementId: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

interface AnnouncementData {
  announcement: {
    id: string;
    message: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    status: 'pending' | 'sending' | 'completed' | 'failed';
    sentAt: string;
    createdAt: string;
  };
  failures: {
    retryable: Array<{
      id: string;
      member_id: string;
      member_name: string;
      phone_number: string;
      retry_count: number;
      last_error: string;
      last_attempt_at: string;
    }>;
    maxAttempts: Array<{
      id: string;
      member_id: string;
      member_name: string;
      phone_number: string;
      retry_count: number;
      last_error: string;
      last_attempt_at: string;
    }>;
  };
}

export default function AnnouncementProgress({
  announcementId,
  onComplete,
  onDismiss,
}: AnnouncementProgressProps) {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(true);

  // Dismiss mutation - clears session failures
  const dismissMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/announcements/${announcementId}/dismiss`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to dismiss');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      if (onDismiss) {
        onDismiss();
      }
      toast.success('Progress dismissed');
    },
  });

  // Poll for progress updates
  const { data, isLoading } = useQuery<AnnouncementData>({
    queryKey: ['announcement-progress', announcementId],
    queryFn: async () => {
      const response = await fetch(`/api/announcements/${announcementId}/progress`);
      if (!response.ok) throw new Error('Failed to fetch progress');
      const result = await response.json();
      return result.data;
    },
    refetchInterval: isPolling ? 2000 : false, // Poll every 2 seconds while sending
    enabled: !!announcementId,
  });

  // Stop polling when complete or failed
  useEffect(() => {
    if (data?.announcement.status === 'completed' || data?.announcement.status === 'failed') {
      setIsPolling(false);
      if (onComplete) {
        onComplete();
      }
    }
  }, [data?.announcement.status, onComplete]);

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/announcements/${announcementId}/retry`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to retry');
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['announcement-progress', announcementId] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success(
        `Retry complete: ${result.data.successCount} succeeded, ${result.data.failedCount} failed`
      );
      // Restart polling if there are still retryable failures
      if (result.data.failedCount > 0) {
        setIsPolling(true);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to retry');
    },
  });

  if (isLoading || !data) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Loading announcement progress...</p>
        </div>
      </Card>
    );
  }

  const { announcement, failures } = data;
  const progressPercentage =
    announcement.recipientCount > 0
      ? Math.round(
          ((announcement.sentCount + announcement.failedCount) / announcement.recipientCount) * 100
        )
      : 0;

  const isSending = announcement.status === 'sending';
  const isComplete = announcement.status === 'completed';
  const isFailed = announcement.status === 'failed';

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {isSending && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
              {isComplete && <CheckCircle2 className="h-6 w-6 text-green-600" />}
              {isFailed && <XCircle className="h-6 w-6 text-red-600" />}
              <div>
                <h3 className="text-lg font-semibold">
                  {isSending && 'Sending Announcement...'}
                  {isComplete && 'Announcement Sent'}
                  {isFailed && 'Announcement Failed'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(announcement.sentAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  isSending
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : isComplete
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-red-100 text-red-800 border-red-200'
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
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Message Preview */}
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{announcement.message}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">
                {announcement.sentCount + announcement.failedCount} of {announcement.recipientCount}{' '}
                processed
              </span>
              <span className="font-semibold text-gray-900">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-900">Sent</span>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{announcement.sentCount}</p>
            </div>
            <div className="rounded-md bg-red-50 p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-900">Failed</span>
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">{announcement.failedCount}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">Remaining</span>
              </div>
              <p className="text-2xl font-bold text-gray-700 mt-1">
                {announcement.recipientCount - announcement.sentCount - announcement.failedCount}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Failed Messages - Retryable */}
      {failures.retryable.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <h4 className="text-base font-semibold">
                  Failed Messages ({failures.retryable.length})
                </h4>
              </div>
              <Button
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending || isSending}
                size="sm"
                className="gap-2"
              >
                {retryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Retry All Failed
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {failures.retryable.map((failure) => (
                <div
                  key={failure.id}
                  className="flex items-start justify-between gap-4 rounded-md bg-orange-50 border border-orange-200 p-3"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{failure.member_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {failure.phone_number}
                      </Badge>
                    </div>
                    <p className="text-xs text-red-700">{failure.last_error}</p>
                    <p className="text-xs text-gray-500">
                      Last attempt:{' '}
                      {new Date(failure.last_attempt_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-700 border-orange-300">
                    Attempt {failure.retry_count}/3
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Failed Messages - Max Attempts Reached */}
      {failures.maxAttempts.length > 0 && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h4 className="text-base font-semibold text-red-900">
                Maximum Retry Attempts Reached ({failures.maxAttempts.length})
              </h4>
            </div>

            <div className="rounded-md bg-red-100 border border-red-200 p-4">
              <p className="text-sm text-red-800 font-medium">
                The following messages failed after 3 retry attempts. Please contact support for
                assistance.
              </p>
            </div>

            <div className="space-y-2">
              {failures.maxAttempts.map((failure) => (
                <div
                  key={failure.id}
                  className="flex items-start justify-between gap-4 rounded-md bg-white border border-red-300 p-3"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{failure.member_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {failure.phone_number}
                      </Badge>
                    </div>
                    <p className="text-xs text-red-700">{failure.last_error}</p>
                  </div>
                  <Badge className="bg-red-600 text-white">3/3 Failed</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
