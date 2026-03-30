'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMemberModal } from '@/contexts/member-modal.context';
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
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { ReminderStatusResponse, MemberReminderStatus } from '@/features/sms/types';

export default function ReminderStatusTable() {
  const { openMember } = useMemberModal();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date_asc');
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

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
        body: JSON.stringify({ memberId, smsType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      return response.json();
    },
    onMutate: ({ memberId }) => {
      setPendingMemberId(memberId);
    },
    onSuccess: () => {
      setPendingMemberId(null);
      queryClient.invalidateQueries({ queryKey: ['sms-reminders'] });
      toast.success('Reminder sent successfully');
    },
    onError: (error) => {
      setPendingMemberId(null);
      toast.error(error instanceof Error ? error.message : 'Failed to send reminder');
    },
  });

  // Format due date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Get due in text
  const getDueInText = (daysUntilDue: number) => {
    if (daysUntilDue >= 0 && daysUntilDue < 1) {
      return <span className="font-medium text-orange-600">Due today</span>;
    } else if (daysUntilDue > 0) {
      return <span className="text-gray-600">Due in {Math.floor(daysUntilDue)} day{Math.floor(daysUntilDue) > 1 ? 's' : ''}</span>;
    } else {
      return (
        <span className="font-medium text-red-600">
          Overdue by {Math.abs(Math.floor(daysUntilDue))} day{Math.abs(Math.floor(daysUntilDue)) > 1 ? 's' : ''}
        </span>
      );
    }
  };

  // Automated reminder status: did the cron already send for this member's current interval?
  const getAutoStatus = (reminder: MemberReminderStatus) => {
    const { days_until_due, last_reminder_type } = reminder;

    let expectedType: string | null = null;
    if (days_until_due >= 7 && days_until_due < 8) expectedType = 'reminder_7day';
    else if (days_until_due >= 3 && days_until_due < 4) expectedType = 'reminder_3day';
    else if (days_until_due >= 0 && days_until_due < 1) expectedType = 'due_today';
    else if (days_until_due < 0) expectedType = 'overdue';

    if (!expectedType) {
      return <span className="text-xs text-gray-400">—</span>;
    }

    if (last_reminder_type === expectedType) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Auto sent
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <AlertCircle className="h-3.5 w-3.5" />
        Not sent
      </span>
    );
  };

  // Recently-sent indicator: was a reminder sent in the last 24 hours?
  const getRecentlySentLabel = (lastSent: string | null): string | null => {
    if (!lastSent) return null;
    const minutesAgo = Math.floor((Date.now() - new Date(lastSent).getTime()) / 60000);
    if (minutesAgo > 1440) return null; // older than 24h — no indicator
    if (minutesAgo < 60) return `Sent ${minutesAgo}m ago`;
    return `Sent ${Math.floor(minutesAgo / 60)}h ago`;
  };

// Get plan type badge className for distinct colors
  const getPlanClassName = (planType: string): string => {
    switch (planType) {
      case 'monthly': return 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'daily':   return 'border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'annual':  return 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100';
      default:        return 'border-transparent bg-blue-100 text-blue-800';
    }
  };

  // Determine SMS type for resend
  const getResendSMSType = (daysUntilDue: number): string => {
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue >= 0 && daysUntilDue < 1) return 'due_today';
    if (daysUntilDue < 4) return 'reminder_3day';
    if (daysUntilDue < 8) return 'reminder_7day';
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
                <TableHead>Auto Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reminders.map((reminder) => (
                <TableRow
                  key={reminder.id}
                  onClick={() => openMember(reminder.id)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <TableCell>
                    <span className="font-medium">{reminder.name}</span>
                  </TableCell>
                  <TableCell>{reminder.phone_number}</TableCell>
                  <TableCell>
                    <Badge className={getPlanClassName(reminder.plan_type)}>
                      {reminder.plan_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(reminder.next_due_date)}</TableCell>
                  <TableCell>{getDueInText(reminder.days_until_due)}</TableCell>
                  <TableCell>{getAutoStatus(reminder)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          resendMutation.mutate({
                            memberId: reminder.id,
                            smsType: getResendSMSType(reminder.days_until_due),
                          });
                        }}
                        disabled={pendingMemberId === reminder.id}
                      >
                        {pendingMemberId === reminder.id ? 'Sending...' : 'Send Reminder'}
                      </Button>
                      {getRecentlySentLabel(reminder.last_reminder_sent) && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="h-3 w-3" />
                          {getRecentlySentLabel(reminder.last_reminder_sent)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center space-y-2 max-w-md mx-auto px-4">
              <p className="text-sm text-gray-500">No reminders found</p>
              {filter !== 'all' ? (
                <p className="text-xs text-gray-400">Try adjusting your filters</p>
              ) : (
                <p className="text-xs text-gray-400">
                  Payment reminders are sent automatically 7 days, 3 days, and on the due date. Manual reminders can be sent anytime using the "Send Reminder" button.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
