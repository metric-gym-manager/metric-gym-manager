'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface CronExecution {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failure';
  summary: Record<string, any> | null;
  errors: string[] | null;
}

interface CronStatsResponse {
  success: boolean;
  data: Record<string, CronExecution[]>;
}

export default function CronStatusGrid() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<CronStatsResponse>({
    queryKey: ['admin-cron-stats'],
    queryFn: async () => {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
      const response = await fetch('/api/admin/system-health/cron-stats', {
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cron stats');
      }

      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const formatDuration = (started: string, completed: string | null): string => {
    if (!completed) return 'Running...';
    const start = new Date(started).getTime();
    const end = new Date(completed).getTime();
    const durationMs = end - start;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: 'running' | 'success' | 'failure') => {
    switch (status) {
      case 'success':
        return (
          <Badge className="border-transparent bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failure':
        return (
          <Badge className="border-transparent bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'running':
        return (
          <Badge className="border-transparent bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
    }
  };

  const getJobDisplayName = (jobName: string): string => {
    const names: Record<string, string> = {
      'send-reminders': 'Send Reminders',
      'update-expired-status': 'Update Expired Status',
      'cancel-overdue-members': 'Cancel Overdue Members',
      'expire-suspended-members': 'Expire Suspended Members',
    };
    return names[jobName] || jobName;
  };

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Failed to Load Cron Stats
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cron Job Status</h2>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(data.data).map(([jobName, executions]) => {
            const latestRun = executions[0];
            const isFailed = latestRun?.status === 'failure';

            return (
              <Card
                key={jobName}
                className={isFailed ? 'border-red-500 border-2' : ''}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    {getJobDisplayName(jobName)}
                    {isFailed && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestRun ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        {getStatusBadge(latestRun.status)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Duration:</span>
                        <span className="text-sm font-medium">
                          {formatDuration(latestRun.started_at, latestRun.completed_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Last Run:</span>
                        <span className="text-sm font-medium">
                          {formatTimestamp(latestRun.started_at)}
                        </span>
                      </div>
                      {latestRun.errors && latestRun.errors.length > 0 && (
                        <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                          <p className="text-xs font-semibold text-red-800 mb-1">
                            Errors ({latestRun.errors.length}):
                          </p>
                          <p className="text-xs text-red-700 truncate">
                            {latestRun.errors[0]}
                          </p>
                        </div>
                      )}
                      {latestRun.summary && (
                        <div className="mt-3 text-xs text-gray-600">
                          <details className="cursor-pointer">
                            <summary className="font-semibold">Summary</summary>
                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify(latestRun.summary, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No executions found</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No cron jobs found</p>
      )}
    </div>
  );
}
