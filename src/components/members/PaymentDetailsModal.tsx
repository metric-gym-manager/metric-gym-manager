'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import { getPlanBadgeColor } from '@/lib/utils/badge-colors';
import UrgencyBadge from '@/components/common/UrgencyBadge';
import type { OverdueMember, MemberDetailResponse, Payment } from '@/features/members/types';

interface PaymentDetailsModalProps {
  member: OverdueMember | null;
  open: boolean;
  onClose: () => void;
}

export function PaymentDetailsModal({ member, open, onClose }: PaymentDetailsModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch member details with payment history
  const { data, isLoading } = useQuery<MemberDetailResponse>({
    queryKey: ['member-detail', member?.id],
    queryFn: async () => {
      if (!member) throw new Error('No member selected');
      const response = await fetch(`/api/members/${member.id}/detail`);
      if (!response.ok) throw new Error('Failed to fetch member details');
      const result = await response.json();
      return result.data;
    },
    enabled: open && !!member,
  });

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('No member selected');

      // Calculate amount to pay (with discount if applicable)
      const discountPct = member.recurring_discount && member.discount
        ? member.discount.discount_percentage
        : 0;
      const effectiveAmount = Math.round(
        member.plan_amount * (1 - discountPct / 100) * 100
      ) / 100;

      const response = await fetch(`/api/members/${member.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: member.plan_amount,
          discountId: member.recurring_discount && member.discount
            ? member.discount.id
            : null,
          paymentAmount: effectiveAmount,
          paymentDate: new Date().toISOString().split('T')[0],
          deductOverduePeriod: member.days_overdue > 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] });
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] });

      // Close modal
      onClose();
    },
    onError: (error: Error) => {
      alert(`Failed to record payment: ${error.message}`);
    },
  });

  const handleMarkPaid = async () => {
    if (!member || isSubmitting) return;

    const discountPct = member.recurring_discount && member.discount
      ? member.discount.discount_percentage
      : 0;
    const effectiveAmount = Math.round(
      member.plan_amount * (1 - discountPct / 100) * 100
    ) / 100;

    const confirmed = confirm(
      `Record payment of LKR ${effectiveAmount.toFixed(2)} for ${member.name}?`
    );

    if (confirmed) {
      setIsSubmitting(true);
      try {
        await markPaidMutation.mutateAsync();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!member) return null;

  // Calculate effective amount with discount
  const discountPct = member.recurring_discount && member.discount
    ? member.discount.discount_percentage
    : 0;
  const effectiveAmount = Math.round(
    member.plan_amount * (1 - discountPct / 100) * 100
  ) / 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Payment Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Member Info Card */}
          <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 truncate">{member.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{member.phone_number}</p>
              </div>
              <Badge className={getPlanBadgeColor(member.plan_type)}>
                {member.plan_type}
              </Badge>
            </div>

            {/* Amount Due */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-blue-200">
              <div>
                <p className="text-xs text-gray-600 mb-1">Amount Due</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {effectiveAmount.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">LKR</span>
                </div>
                {discountPct > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="line-through">{member.plan_amount.toFixed(2)}</span>
                    {' '}({member.discount?.discount_name} - {discountPct}% off)
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Due Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(member.next_due_date)}
                  </span>
                </div>
                <div className="mt-1">
                  <UrgencyBadge daysOverdue={member.days_overdue} />
                </div>
              </div>
            </div>
          </div>

          {/* Mark Paid Button */}
          <Button
            onClick={handleMarkPaid}
            disabled={isSubmitting || markPaidMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-6 text-base"
          >
            {isSubmitting || markPaidMutation.isPending ? 'Recording Payment...' : 'Mark as Paid'}
          </Button>

          {/* Payment History */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Payment History</h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">Loading payment history...</div>
              </div>
            ) : data && data.payments.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold hidden sm:table-cell">Discount</TableHead>
                        <TableHead className="font-semibold hidden md:table-cell">Next Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payments.map((payment: Payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {formatDate(payment.payment_date)}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-gray-900">
                              LKR {payment.amount_paid.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {payment.discount_applied ? (
                              <span className="text-sm text-gray-600">
                                {payment.discount_applied} ({payment.discount_percentage}%)
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-gray-600">
                            {formatDate(payment.next_due_date_calculated)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-500">No payment history yet</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
