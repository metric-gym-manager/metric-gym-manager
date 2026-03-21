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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, Clock, AlertCircle, XCircle, History, Info } from 'lucide-react';
import type { ReminderStatusResponse, MemberReminderStatus } from '@/features/sms/types';
import SMSHistoryModal from './SMSHistoryModal';

export default function PaymentRemindersTable() {
  const { openMember } = useMemberModal();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date_asc');
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [smsHistoryMemberId, setSmsHistoryMemberId] = useState<string | null>(null);

  // Fetch reminder status
  const { data, isLoading, error } = useQuery<ReminderStatusResponse>({
    queryKey: ['payment-reminders', filter, sortBy],
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
      queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
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

  // Get individual SMS type status (Option A Fix: Use individual tracking fields)
  const getSMSTypeStatus = (
    reminder: MemberReminderStatus,
    targetDays: number,
    expectedType: string
  ): 'sent' | 'not_sent' | 'not_applicable' => {
    const { days_until_due, plan_type, reminder_7day_sent, reminder_3day_sent, due_today_sent } = reminder;

    // Daily members: no automatic reminders
    if (plan_type === 'daily') {
      return 'not_applicable';
    }

    // Monthly members: no 7-day reminder
    if (plan_type === 'monthly' && expectedType === 'reminder_7day') {
      return 'not_applicable';
    }

    // Check if this specific reminder was sent (using individual tracking fields)
    let wasSent = false;
    if (expectedType === 'reminder_7day') {
      wasSent = !!reminder_7day_sent;
    } else if (expectedType === 'reminder_3day') {
      wasSent = !!reminder_3day_sent;
    } else if (expectedType === 'due_today') {
      wasSent = !!due_today_sent;
    }

    if (wasSent) {
      return 'sent';
    }

    // If we're past this reminder window and it wasn't sent
    if (days_until_due < targetDays) {
      return 'not_sent';
    }

    // Not yet time for this reminder
    return 'not_applicable';
  };

  // Render SMS status badge with improved labels
  const renderSMSStatusBadge = (
    status: 'sent' | 'not_sent' | 'not_applicable',
    reminder: MemberReminderStatus,
    targetDays: number
  ) => {
    // Disabled: Reminder not applicable for this plan type
    if (status === 'not_applicable') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <XCircle className="h-3.5 w-3.5" />
          <span>Disabled</span>
        </div>
      );
    }

    // Sent: Reminder was successfully sent
    if (status === 'sent') {
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Sent</span>
        </div>
      );
    }

    // Not Sent / Pending: Depends on whether we're past the reminder window
    const { days_until_due } = reminder;

    // If we're still before or at the target window, show "Pending"
    if (days_until_due >= targetDays) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Pending</span>
        </div>
      );
    }

    // If we're past the target window and it wasn't sent, show "Not Sent"
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Not Sent</span>
      </div>
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
      case '3-months': return 'border-transparent bg-teal-100 text-teal-800 hover:bg-teal-100';
      case '6-months': return 'border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-100';
      default:        return 'border-transparent bg-blue-100 text-blue-800';
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
        <p className="text-sm text-red-800">Failed to load payment reminders. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">About Automatic Reminders:</span> The table below shows the status of automatic payment reminders only.
          These are sent automatically by the system based on due dates (7-day, 3-day, and due-today reminders).
          Manual reminders sent via the "Send Now" button are tracked separately and do not appear in these columns.
        </p>
      </div>

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
      <div className="rounded-lg border bg-white overflow-x-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">Loading payment reminders...</p>
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
                <TableHead>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 cursor-help">
                          7-Day Reminder
                          <Info className="h-3 w-3 text-gray-400" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatic reminder sent 7 days before due date</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 cursor-help">
                          3-Day Reminder
                          <Info className="h-3 w-3 text-gray-400" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatic reminder sent 3 days before due date</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 cursor-help">
                          Due Date Reminder
                          <Info className="h-3 w-3 text-gray-400" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Automatic reminder sent on the due date</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reminders.map((reminder) => {
                const sevenDayStatus = getSMSTypeStatus(reminder, 7, 'reminder_7day');
                const threeDayStatus = getSMSTypeStatus(reminder, 3, 'reminder_3day');
                const dueDateStatus = getSMSTypeStatus(reminder, 0, 'due_today');

                return (
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
                    <TableCell>{renderSMSStatusBadge(sevenDayStatus, reminder, 7)}</TableCell>
                    <TableCell>{renderSMSStatusBadge(threeDayStatus, reminder, 3)}</TableCell>
                    <TableCell>{renderSMSStatusBadge(dueDateStatus, reminder, 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
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
                            {pendingMemberId === reminder.id ? 'Sending...' : 'Send Now'}
                          </Button>
                          {getRecentlySentLabel(reminder.last_reminder_sent) && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                              <Clock className="h-3 w-3" />
                              {getRecentlySentLabel(reminder.last_reminder_sent)}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSmsHistoryMemberId(reminder.id);
                          }}
                          title="View SMS History"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">No payment reminders found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </div>

      {/* SMS History Modal */}
      {smsHistoryMemberId && (
        <SMSHistoryModal
          memberId={smsHistoryMemberId}
          open={!!smsHistoryMemberId}
          onClose={() => setSmsHistoryMemberId(null)}
        />
      )}
    </div>
  );
}
