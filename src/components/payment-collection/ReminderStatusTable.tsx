'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ReminderStatusResponse } from '@/features/sms/types';

interface ReminderStatusTableProps {
  onMemberClick?: (memberId: string) => void;
}

export default function ReminderStatusTable({ onMemberClick }: ReminderStatusTableProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date_asc');

  // Fetch reminder status
  const { data, isLoading, error } = useQuery<ReminderStatusResponse>({
    queryKey: ['sms-reminders', filter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('filter', filter);
      if (sortBy) params.append('sortBy', sortBy);

      const response = await fetch(`/api/sms/reminders?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reminders');
      const result = await response.json();
      return result.data;
    },
  });

  // Resend reminder mutation
  const resendMutation = useMutation({
    mutationFn: async ({ memberId, smsType }: { memberId: string; smsType: string }) => {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          smsType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-reminders'] });
    },
  });

  // Format date to DD/MM/YYYY HH:MM
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format due date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Get due in text
  const getDueInText = (daysUntilDue: number) => {
    if (daysUntilDue === 0) {
      return <span className="font-medium text-orange-600">Due today</span>;
    } else if (daysUntilDue > 0) {
      return <span className="text-gray-600">Due in {daysUntilDue} day{daysUntilDue > 1 ? 's' : ''}</span>;
    } else {
      return (
        <span className="font-medium text-red-600">
          Overdue by {Math.abs(daysUntilDue)} day{Math.abs(daysUntilDue) > 1 ? 's' : ''}
        </span>
      );
    }
  };

  // Get reminder type label
  const getReminderTypeLabel = (smsType: string | null) => {
    if (!smsType) return '-';
    switch (smsType) {
      case 'reminder_7day':
        return '7-Day Notice';
      case 'reminder_3day':
        return '3-Day Notice';
      case 'due_today':
        return 'Due Today';
      case 'overdue':
        return 'Overdue';
      case 'receipt':
        return 'Receipt';
      default:
        return smsType;
    }
  };

  // Get delivery status badge
  const getDeliveryStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Not Sent</Badge>;
    switch (status) {
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      case 'delivered':
        return <Badge variant="default">Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get plan type badge variant
  const getPlanVariant = (planType: string): 'default' | 'secondary' | 'outline' => {
    switch (planType) {
      case 'monthly':
        return 'default';
      case 'daily':
        return 'secondary';
      case 'annual':
        return 'outline';
      default:
        return 'default';
    }
  };

  // Determine SMS type for resend
  const getResendSMSType = (daysUntilDue: number): string => {
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue === 0) return 'due_today';
    if (daysUntilDue <= 3) return 'reminder_3day';
    if (daysUntilDue <= 7) return 'reminder_7day';
    return 'reminder_7day';
  };

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load reminders. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Filter</label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Show All</SelectItem>
              <SelectItem value="upcoming">Upcoming (1-7 days)</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date_asc">Due Date (Soonest First)</SelectItem>
              <SelectItem value="last_reminder_desc">Last Reminder Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data && (
          <div className="ml-auto">
            <p className="text-sm text-gray-600">
              Total: <span className="font-semibold">{data.totalCount}</span> member
              {data.totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">Loading reminders...</p>
          </div>
        ) : data && data.reminders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Plan Type</TableHead>
                <TableHead>Next Due Date</TableHead>
                <TableHead>Due In</TableHead>
                <TableHead>Last Reminder Sent</TableHead>
                <TableHead>Reminder Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reminders.map((reminder) => (
                <TableRow key={reminder.id}>
                  <TableCell>
                    {onMemberClick ? (
                      <button
                        onClick={() => onMemberClick(reminder.id)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {reminder.name}
                      </button>
                    ) : (
                      <span className="font-medium">{reminder.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{reminder.phone_number}</TableCell>
                  <TableCell>
                    <Badge variant={getPlanVariant(reminder.plan_type)}>
                      {reminder.plan_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(reminder.next_due_date)}</TableCell>
                  <TableCell>{getDueInText(reminder.days_until_due)}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(reminder.last_reminder_sent)}
                  </TableCell>
                  <TableCell>
                    {getReminderTypeLabel(reminder.last_reminder_type)}
                  </TableCell>
                  <TableCell>
                    {getDeliveryStatusBadge(reminder.last_delivery_status)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={reminder.last_delivery_status === 'failed' ? 'destructive' : 'outline'}
                      onClick={() =>
                        resendMutation.mutate({
                          memberId: reminder.id,
                          smsType: getResendSMSType(reminder.days_until_due),
                        })
                      }
                      disabled={resendMutation.isPending}
                    >
                      {resendMutation.isPending ? 'Sending...' : 'Send Reminder'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">No reminders found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {resendMutation.isError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {resendMutation.error instanceof Error
              ? resendMutation.error.message
              : 'Failed to send reminder'}
          </p>
        </div>
      )}
    </div>
  );
}
