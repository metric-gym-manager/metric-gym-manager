'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, MessageSquare } from 'lucide-react';

interface SMSLog {
  id: string;
  sms_type: string;
  phone_number: string;
  message_body: string;
  sent_at: string;
  delivery_status: 'sent' | 'delivered' | 'failed';
  text_lk_message_id: string | null;
}

interface SMSHistoryResponse {
  member: {
    id: string;
    name: string;
    phone_number: string;
    plan_type: string;
    membership_start_date: string;
    next_due_date: string;
  };
  smsLogs: SMSLog[];
  totalCount: number;
}

interface SMSHistoryModalProps {
  memberId: string;
  open: boolean;
  onClose: () => void;
}

export default function SMSHistoryModal({ memberId, open, onClose }: SMSHistoryModalProps) {
  const { data, isLoading, error } = useQuery<SMSHistoryResponse>({
    queryKey: ['sms-history', memberId],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/sms-history`);
      if (!response.ok) throw new Error('Failed to fetch SMS history');
      const result = await response.json();
      return result.data;
    },
    enabled: open && !!memberId,
  });

  // Format date to readable format
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get SMS type label
  const getSMSTypeLabel = (smsType: string): string => {
    switch (smsType) {
      case 'reminder_7day': return '7-Day Reminder';
      case 'reminder_3day': return '3-Day Reminder';
      case 'due_today': return 'Due Today';
      case 'overdue': return 'Overdue';
      case 'receipt': return 'Payment Receipt';
      case 'welcome': return 'Welcome';
      default: return smsType;
    }
  };

  // Get SMS type badge color
  const getSMSTypeBadgeClass = (smsType: string): string => {
    switch (smsType) {
      case 'reminder_7day': return 'border-transparent bg-blue-100 text-blue-800';
      case 'reminder_3day': return 'border-transparent bg-amber-100 text-amber-800';
      case 'due_today': return 'border-transparent bg-orange-100 text-orange-800';
      case 'overdue': return 'border-transparent bg-red-100 text-red-800';
      case 'receipt': return 'border-transparent bg-green-100 text-green-800';
      case 'welcome': return 'border-transparent bg-purple-100 text-purple-800';
      default: return 'border-transparent bg-gray-100 text-gray-800';
    }
  };

  // Get delivery status badge
  const renderDeliveryStatus = (status: 'sent' | 'delivered' | 'failed') => {
    switch (status) {
      case 'delivered':
        return (
          <Badge className="border-transparent bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Delivered
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="border-transparent bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="border-transparent bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  // Filter to show only payment reminder SMS (exclude receipts, welcome)
  const paymentReminderLogs = data?.smsLogs.filter(
    (log) => ['reminder_7day', 'reminder_3day', 'due_today', 'overdue'].includes(log.sms_type)
  ) || [];

  // Group SMS logs by billing period
  const groupedByPeriod = (() => {
    if (!data) return [];

    const { member } = data;
    const logs = paymentReminderLogs;

    // Calculate billing period duration in days
    const getPeriodDuration = (planType: string): number => {
      switch (planType) {
        case 'daily': return 1;
        case 'weekly': return 7;
        case 'monthly': return 30; // approximate
        case '3-months': return 90;
        case '6-months': return 180;
        case 'annual': return 365;
        default: return 30;
      }
    };

    // Format billing period label
    const formatPeriodLabel = (planType: string, periodStart: Date, periodEnd: Date, periodNum: number): string => {
      const startStr = periodStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const endStr = periodEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      switch (planType) {
        case 'daily':
          return `${startStr}`;
        case 'weekly':
          return `Week ending ${endStr}`;
        case 'monthly':
          return periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        case '3-months':
        case '6-months':
          return `Billing Period ${periodNum} (${startStr} - ${endStr})`;
        case 'annual':
          return periodStart.toLocaleDateString('en-GB', { year: 'numeric' });
        default:
          return `${startStr} - ${endStr}`;
      }
    };

    const periodDuration = getPeriodDuration(member.plan_type);
    const membershipStart = new Date(member.membership_start_date);

    // Group logs by period
    const groups: { [key: string]: { label: string; logs: SMSLog[]; periodStart: Date } } = {};

    logs.forEach((log) => {
      const logDate = new Date(log.sent_at);

      // Calculate which period this log belongs to
      const daysSinceStart = Math.floor((logDate.getTime() - membershipStart.getTime()) / (1000 * 60 * 60 * 24));
      const periodNum = Math.floor(daysSinceStart / periodDuration) + 1;

      // Calculate period start and end dates
      const periodStart = new Date(membershipStart);
      periodStart.setDate(periodStart.getDate() + (periodNum - 1) * periodDuration);

      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + periodDuration - 1);

      const periodKey = periodNum.toString();
      const periodLabel = formatPeriodLabel(member.plan_type, periodStart, periodEnd, periodNum);

      if (!groups[periodKey]) {
        groups[periodKey] = {
          label: periodLabel,
          logs: [],
          periodStart: periodStart,
        };
      }

      groups[periodKey].logs.push(log);
    });

    // Convert to array and sort by period (most recent first)
    return Object.entries(groups)
      .map(([key, value]) => ({
        period: parseInt(key),
        label: value.label,
        logs: value.logs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
        periodStart: value.periodStart,
      }))
      .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Payment Reminder SMS History</DialogTitle>
          <DialogDescription>
            {data && (
              <span>
                <strong>{data.member.name}</strong> ({data.member.phone_number})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-gray-500">Loading SMS history...</p>
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">Failed to load SMS history. Please try again.</p>
            </div>
          ) : paymentReminderLogs.length > 0 ? (
            <div className="space-y-6">
              {groupedByPeriod.map((period) => (
                <div key={period.period} className="rounded-lg border">
                  {/* Period Header */}
                  <div className="bg-gray-50 border-b px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {period.label}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {period.logs.length} reminder{period.logs.length !== 1 ? 's' : ''} sent
                    </p>
                  </div>

                  {/* Period SMS Logs */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Sent At</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge className={getSMSTypeBadgeClass(log.sms_type)}>
                              {getSMSTypeLabel(log.sms_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDateTime(log.sent_at)}
                          </TableCell>
                          <TableCell>{renderDeliveryStatus(log.delivery_status)}</TableCell>
                          <TableCell>
                            <div className="max-w-md">
                              <details className="group">
                                <summary className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>View message</span>
                                </summary>
                                <div className="mt-2 p-3 rounded-md bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
                                  {log.message_body}
                                </div>
                              </details>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 font-medium">No payment reminders sent yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Payment reminder SMS will appear here once sent
                </p>
              </div>
            </div>
          )}
        </div>

        {data && paymentReminderLogs.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm text-gray-600">
              Total payment reminders sent: <span className="font-semibold">{paymentReminderLogs.length}</span>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
