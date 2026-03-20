'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Edit, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { MemberWithDiscount, Payment } from '@/features/members/types';

interface MemberDetailModalMobileProps {
  open: boolean;
  onClose: () => void;
  member: MemberWithDiscount | null;
  payments?: Payment[];
  onEditClick: () => void;
}

export default function MemberDetailModalMobile({
  open,
  onClose,
  member,
  payments = [],
  onEditClick,
}: MemberDetailModalMobileProps) {
  const queryClient = useQueryClient();
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isMarkingRegularPaid, setIsMarkingRegularPaid] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Sync selectedStatus when member changes
  useEffect(() => {
    if (member) {
      setSelectedStatus(member.status);
    }
  }, [member?.id, member?.status]);

  // Update member status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: string; status: string }) => {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      const statusLabel = variables.status.charAt(0).toUpperCase() + variables.status.slice(1);
      toast.success(`Status updated to ${statusLabel}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    },
  });

  // Mark regular payment as paid
  const markRegularPaidMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('No member selected');

      let effectiveAmount = member.plan_amount;
      if (member.discount && member.recurring_discount) {
        const discountAmount = (member.plan_amount * member.discount.discount_percentage) / 100;
        effectiveAmount = member.plan_amount - discountAmount;
      }

      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/members/${member.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: member.plan_amount,
          paymentAmount: effectiveAmount,
          paymentDate: today,
          discountId: member.discount?.id ?? undefined,
          deductOverduePeriod: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to collect payment');
      }
      return res.json();
    },
    onMutate: () => {
      setIsMarkingRegularPaid(true);
    },
    onSuccess: () => {
      setIsMarkingRegularPaid(false);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] });
      toast.success('Payment collected — receipt sent');
    },
    onError: (error) => {
      setIsMarkingRegularPaid(false);
      toast.error(error instanceof Error ? error.message : 'Failed to collect payment');
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member deleted successfully');
      setShowDeleteDialog(false);
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete member');
    },
  });

  if (!open) return null;

  if (!member) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
        <div className="bg-white w-full h-[90vh] md:max-w-lg md:h-auto md:rounded-t-2xl rounded-t-2xl p-6 animate-pulse">
          <div className="h-6 w-40 rounded bg-gray-200 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasStatusChanged = selectedStatus !== member.status;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const formatCurrency = (amount: number) => {
    return `LKR ${amount.toFixed(2)}`;
  };

  const getStatusClassName = (status: string): string => {
    switch (status) {
      case 'active':
        return 'border-transparent bg-green-100 text-green-800';
      case 'expired':
        return 'border-transparent bg-red-100 text-red-800';
      case 'suspended':
        return 'border-transparent bg-amber-100 text-amber-800';
      case 'cancelled':
        return 'border border-gray-300 text-gray-600 bg-transparent';
      default:
        return 'border-transparent bg-green-100 text-green-800';
    }
  };

  const getPlanClassName = (planType: string): string => {
    switch (planType) {
      case 'monthly':
        return 'border-transparent bg-blue-100 text-blue-800';
      case 'daily':
        return 'border-transparent bg-orange-100 text-orange-800';
      case 'annual':
        return 'border-transparent bg-purple-100 text-purple-800';
      default:
        return 'border-transparent bg-blue-100 text-blue-800';
    }
  };

  return (
    <>
      {/* Mobile Full-Screen Modal */}
      <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
        <div className="bg-white w-full h-[90vh] md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-t-2xl rounded-t-2xl flex flex-col overflow-hidden">
          {/* Sticky Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-white sticky top-0 z-10">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{member.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{member.phone_number}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusClassName(member.status)}>
                {member.status}
              </Badge>
              <Badge className={getPlanClassName(member.plan_type)}>
                {member.plan_type}
              </Badge>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Registered Date</Label>
                <p className="text-sm font-medium">{formatDate(member.registered_date)}</p>
              </div>
            </div>

            {/* Membership Plan */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-2">Membership Plan</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Plan Amount</Label>
                  <p className="text-sm font-medium">{formatCurrency(member.plan_amount)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Next Due Date</Label>
                  <p className="text-sm font-medium">{formatDate(member.next_due_date)}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Membership Start</Label>
                <p className="text-sm font-medium">{formatDate(member.membership_start_date)}</p>
              </div>

              {member.discount && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-gray-500">Discount</Label>
                  <p className="text-sm font-medium">
                    {member.discount.discount_name} ({member.discount.discount_percentage}%)
                    {member.recurring_discount && ' • Recurring'}
                  </p>
                </div>
              )}
            </div>

            {/* Change Status */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-orange-900">Change Status</h3>
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!hasStatusChanged || updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({ memberId: member.id, status: selectedStatus })
                }
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>

            {/* Payment History */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
              <button
                onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-left">
                  <h3 className="text-sm font-semibold">Payment History</h3>
                  <p className="text-xs text-gray-500">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
                </div>
                {showPaymentHistory ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showPaymentHistory && (
                <div className="space-y-2 pt-2">
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <div key={payment.id} className="bg-white rounded-lg p-3 border">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-500">{formatDate(payment.payment_date)}</span>
                          <span className="text-sm font-semibold">{formatCurrency(payment.amount_paid)}</span>
                        </div>
                        {payment.discount_applied && (
                          <p className="text-xs text-green-600">
                            {payment.discount_applied} ({payment.discount_percentage}%)
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Next due: {formatDate(payment.next_due_date_calculated)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No payment history</p>
                  )}
                </div>
              )}
            </div>

            {/* Mark Paid Button */}
            <Button
              onClick={() => markRegularPaidMutation.mutate()}
              disabled={isMarkingRegularPaid}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12"
            >
              {isMarkingRegularPaid ? 'Processing...' : `Mark Paid (${member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1)})`}
            </Button>
          </div>

          {/* Sticky Footer Actions */}
          <div className="flex-shrink-0 px-6 py-4 border-t bg-white flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-12"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button
              onClick={onEditClick}
              className="flex-1 h-12"
            >
              <Edit className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{member.name}</strong> and all data:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>{payments.length} payment{payments.length !== 1 ? 's' : ''}</li>
                <li>SMS logs</li>
              </ul>
              <p className="mt-3 text-red-600 font-semibold text-sm">This cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMemberMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMemberMutation.mutate(member.id)}
              disabled={deleteMemberMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMemberMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
