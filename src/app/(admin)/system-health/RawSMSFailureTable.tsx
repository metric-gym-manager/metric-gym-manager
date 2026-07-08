'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { RefreshCw, AlertTriangle, Copy, Check, Filter, X } from 'lucide-react';
import { useState } from 'react';

interface SMSFailure {
  id: string;
  gym_id: string;
  member_id: string;
  sms_type: string;
  phone_number: string;
  message_body: string;
  sent_at: string;
  delivery_status: string;
  error_message: string | null;
  text_lk_message_id: string | null;
}

interface SMSFailuresResponse {
  success: boolean;
  data: {
    failures: SMSFailure[];
    totalCount: number;
    filters: {
      gymId: string | null;
    };
  };
}

export default function RawSMSFailureTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gymIdFilter, setGymIdFilter] = useState<string>('');
  const [activeGymId, setActiveGymId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<SMSFailuresResponse>({
    queryKey: ['admin-sms-failures', activeGymId],
    queryFn: async () => {
      // Authorized by the operator's session cookie (sent automatically on this
      // same-origin request). No secret is held in the browser.
      const url = activeGymId
        ? `/api/admin/system-health/sms-failures?gymId=${activeGymId}`
        : '/api/admin/system-health/sms-failures';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch SMS failures');
      }

      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const handleApplyFilter = () => {
    if (gymIdFilter.trim()) {
      setActiveGymId(gymIdFilter.trim());
    }
  };

  const handleClearFilter = () => {
    setGymIdFilter('');
    setActiveGymId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyFilter();
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getSMSTypeBadge = (smsType: string) => {
    const badges: Record<string, string> = {
      'reminder_7day': 'border-transparent bg-blue-100 text-blue-800',
      'reminder_3day': 'border-transparent bg-amber-100 text-amber-800',
      'due_today': 'border-transparent bg-orange-100 text-orange-800',
      'overdue': 'border-transparent bg-red-100 text-red-800',
      'receipt': 'border-transparent bg-green-100 text-green-800',
      'welcome': 'border-transparent bg-purple-100 text-purple-800',
    };

    return (
      <Badge className={badges[smsType] || 'border-transparent bg-gray-100 text-gray-800'}>
        {smsType}
      </Badge>
    );
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Failed to Load SMS Failures
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
          <CardTitle>SMS Delivery Failures (Latest 50)</CardTitle>
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

        {/* Gym-Specific Drilldown Filter */}
        <div className="mt-4 flex items-center gap-2">
          <Input
            type="text"
            placeholder="Filter by Gym ID (UUID)"
            value={gymIdFilter}
            onChange={(e) => setGymIdFilter(e.target.value)}
            onKeyDown={handleKeyPress}
            className="max-w-xs font-mono text-sm"
          />
          <Button
            onClick={handleApplyFilter}
            variant="default"
            size="sm"
            disabled={!gymIdFilter.trim()}
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filter
          </Button>
          {activeGymId && (
            <Button
              onClick={handleClearFilter}
              variant="outline"
              size="sm"
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        {activeGymId && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Filtered by Gym ID:</span>{' '}
              <span className="font-mono text-xs">{activeGymId}</span>
            </p>
          </div>
        )}

        {data?.data && (
          <p className="text-sm text-gray-600 mt-2">
            Total failures: <span className="font-semibold">{data.data.totalCount}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">Loading SMS failures...</p>
          </div>
        ) : data?.data.failures && data.data.failures.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[120px]">Gym ID</TableHead>
                  <TableHead className="w-[140px]">SMS Type</TableHead>
                  <TableHead className="w-[140px]">Phone Number</TableHead>
                  <TableHead className="min-w-[300px]">Raw Error Trace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.failures.map((failure) => (
                  <TableRow key={failure.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-xs">
                      {formatTimestamp(failure.sent_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[80px]" title={failure.gym_id}>
                          {failure.gym_id.substring(0, 8)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(failure.gym_id, `gym-${failure.id}`)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Copy Gym ID"
                        >
                          {copiedId === `gym-${failure.id}` ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-500" />
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
                            <summary className="cursor-pointer text-sm text-red-600 hover:text-red-700 flex items-center gap-2">
                              <span className="truncate max-w-[400px]">
                                {failure.error_message}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  copyToClipboard(failure.error_message!, `error-${failure.id}`);
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Copy Error Message"
                              >
                                {copiedId === `error-${failure.id}` ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-gray-500" />
                                )}
                              </button>
                            </summary>
                            <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                              <pre className="text-xs text-red-800 whitespace-pre-wrap break-all">
                                {failure.error_message}
                              </pre>
                              {failure.text_lk_message_id && (
                                <div className="mt-2 text-xs text-gray-600">
                                  <span className="font-semibold">TextLK Message ID:</span>{' '}
                                  <span className="font-mono">{failure.text_lk_message_id}</span>
                                </div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span className="text-sm text-gray-500 italic">No error message</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500 font-medium">No SMS failures found</p>
              <p className="text-xs text-gray-400 mt-1">
                All SMS deliveries are currently successful
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
