'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface RecipientLog {
  name: string;
  phone: string;
  type: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

interface CronLog {
  id: string;
  cron_job_name: string;
  executed_at: string;
  duration_ms: number;
  status: 'success' | 'partial' | 'failed';
  total_processed: number;
  total_successful: number;
  total_failed: number;
  breakdown: Record<string, number>;
  recipients: RecipientLog[];
  errors: string[] | null;
  triggered_by: string;
}

interface CronLogsResponse {
  logs: CronLog[];
  totalCount: number;
  limit: number;
  offset: number;
}

export default function CronLogsTable() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch cron logs
  const { data, isLoading, error } = useQuery<{ success: boolean; data: CronLogsResponse }>({
    queryKey: ['cron-logs'],
    queryFn: async () => {
      const response = await fetch('/api/cron/logs?job=send-reminders&limit=20');
      if (!response.ok) throw new Error('Failed to fetch cron logs');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 border-transparent hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-transparent hover:bg-yellow-100">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-transparent hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSMSTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      reminder_7day: 'bg-blue-100 text-blue-800',
      reminder_3day: 'bg-purple-100 text-purple-800',
      due_today: 'bg-orange-100 text-orange-800',
      overdue: 'bg-red-100 text-red-800',
    };

    const labels: Record<string, string> = {
      reminder_7day: '7-Day',
      reminder_3day: '3-Day',
      due_today: 'Due Today',
      overdue: 'Overdue',
    };

    return (
      <Badge className={`${colors[type] || 'bg-gray-100 text-gray-800'} border-transparent hover:${colors[type] || 'bg-gray-100'}`}>
        {labels[type] || type}
      </Badge>
    );
  };

  const getRecipientStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load cron execution logs.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-500">Loading cron logs...</p>
      </div>
    );
  }

  const logs = data?.data.logs || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">SMS Reminder Cron History</h3>
          <p className="text-sm text-gray-500 mt-1">
            Track automatic reminder executions and delivery status
          </p>
        </div>
        {data && (
          <div className="text-sm text-gray-600">
            Total executions: <span className="font-semibold">{data.data.totalCount}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {logs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Executed At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Successful</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Breakdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <Collapsible
                  key={log.id}
                  open={expandedRow === log.id}
                  onOpenChange={(open) => setExpandedRow(open ? log.id : null)}
                  asChild
                >
                  <>
                    <TableRow className="cursor-pointer hover:bg-gray-50">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {expandedRow === log.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>{formatDate(log.executed_at)}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>{log.total_processed}</TableCell>
                      <TableCell className="text-green-700 font-medium">{log.total_successful}</TableCell>
                      <TableCell className="text-red-700 font-medium">{log.total_failed}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="h-3 w-3" />
                          {log.duration_ms}ms
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(log.breakdown || {}).map(([type, count]) => {
                            if (count === 0) return null;
                            return (
                              <span key={type} className="text-xs">
                                {getSMSTypeBadge(type)} {count}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>

                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={8} className="bg-gray-50 p-0">
                          <div className="p-4 space-y-4">
                            {/* Errors */}
                            {log.errors && log.errors.length > 0 && (
                              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                <h4 className="text-sm font-semibold text-red-900 mb-2">Errors</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {log.errors.map((error, idx) => (
                                    <li key={idx} className="text-xs text-red-800">{error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Recipients */}
                            {log.recipients && log.recipients.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                  Recipients ({log.recipients.length})
                                </h4>
                                <div className="max-h-64 overflow-y-auto border rounded-md">
                                  <Table>
                                    <TableHeader className="sticky top-0 bg-white">
                                      <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Member</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Error</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {log.recipients.map((recipient, idx) => (
                                        <TableRow key={idx} className="text-xs">
                                          <TableCell>{getRecipientStatusIcon(recipient.status)}</TableCell>
                                          <TableCell className="font-medium">{recipient.name}</TableCell>
                                          <TableCell className="text-gray-600">{recipient.phone}</TableCell>
                                          <TableCell>{getSMSTypeBadge(recipient.type)}</TableCell>
                                          <TableCell className="text-red-600 text-xs">
                                            {recipient.error || '—'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center space-y-2 max-w-md mx-auto px-4">
              <p className="text-sm text-gray-500">No cron execution logs found</p>
              <p className="text-xs text-gray-400">
                Cron logs will appear here after the reminder system runs automatically at 9:00 AM Sri Lanka time daily.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
