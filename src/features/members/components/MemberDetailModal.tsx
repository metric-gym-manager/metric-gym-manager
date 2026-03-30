'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import MarkPaidDialog from '@/components/payment-collection/MarkPaidDialog';
import type { MemberWithDiscount, Payment } from '@/features/members/types';
import { parseApiError } from '@/lib/utils/api-error';

interface MemberDetailModalProps {
  open: boolean;
  onClose: () => void;
  member: MemberWithDiscount | null;
  payments?: Payment[];
  onEditClick: () => void;
}

export default function MemberDetailModal({
  open,
  onClose,
  member,
  payments = [],
  onEditClick,
}: MemberDetailModalProps) {
  const queryClient = useQueryClient();
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [isMarkingRegularPaid, setIsMarkingRegularPaid] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [activateNewDueDate, setActivateNewDueDate] = useState<string>('');

  // Suspend member mutation
  const suspendMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/members/${memberId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to suspend member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] });
      toast.success('Member suspended successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to suspend member');
    },
  });

  // Activate member mutation
  const activateMemberMutation = useMutation({
    mutationFn: async ({ memberId, newDueDate }: { memberId: string; newDueDate: string }) => {
      const response = await fetch(`/api/members/${memberId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDueDate }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to activate member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] });
      toast.success('Member activated successfully');
      setShowActivateDialog(false);
      setActivateNewDueDate('');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to activate member');
    },
  });

  // Cancel member mutation
  const cancelMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/members/${memberId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] });
      toast.success('Member cancelled successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel member');
    },
  });

  // Mark regular payment as paid
  const markRegularPaidMutation = useMutation({
    mutationFn: async (paymentDate: string) => {
      if (!member) throw new Error('No member selected');

      // Calculate effective amount after discount
      let effectiveAmount = member.plan_amount;
      if (member.discount && member.recurring_discount) {
        const discountAmount = (member.plan_amount * member.discount.discount_percentage) / 100;
        effectiveAmount = member.plan_amount - discountAmount;
      }

      const res = await fetch(`/api/members/${member.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: member.plan_amount,
          paymentAmount: effectiveAmount,
          paymentDate: paymentDate,
          discountId: member.discount?.id ?? undefined,
          deductOverduePeriod: true,
        }),
      });
      if (!res.ok) {
        const errorMessage = await parseApiError(res);
        throw new Error(errorMessage);
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
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] });
      toast.success('Payment collected — receipt SMS sent');
    },
    onError: (error) => {
      setIsMarkingRegularPaid(false);
      toast.error(error instanceof Error ? error.message : 'Failed to collect payment');
    },
  });

  // Handler for mark paid dialog confirmation
  const handleMarkPaidConfirm = (paymentDate: string) => {
    markRegularPaidMutation.mutate(paymentDate);
    setShowMarkPaidDialog(false);
  };

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorMessage = await parseApiError(res);
        throw new Error(errorMessage);
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

  // Show skeleton inside the open dialog while data is loading
  if (!member) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
            <DialogDescription>View and manage member information</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 animate-pulse">
            {/* Name + badges skeleton */}
            <div className="flex items-center justify-between">
              <div className="h-6 w-40 rounded bg-gray-200" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full bg-gray-200" />
                <div className="h-5 w-16 rounded-full bg-gray-200" />
              </div>
            </div>
            {/* Field grid skeleton */}
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-32 rounded bg-gray-200" />
                </div>
              ))}
            </div>
            {/* Plan section skeleton */}
            <div className="border-t pt-4 space-y-4">
              <div className="h-4 w-28 rounded bg-gray-200" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-3 w-24 rounded bg-gray-200" />
                    <div className="h-4 w-32 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
            {/* Status + actions skeleton */}
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="h-16 rounded-lg bg-gray-100" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `LKR ${amount.toFixed(2)}`;
  };

  // Get status badge className for semantic colors
  const getStatusClassName = (status: string): string => {
    switch (status) {
      case 'active':
        return 'border-transparent bg-green-100 text-green-800 hover:bg-green-100';
      case 'expired':
        return 'border-transparent bg-red-100 text-red-800 hover:bg-red-100';
      case 'suspended':
        return 'border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100';
      case 'cancelled':
        return 'border border-gray-300 text-gray-600 bg-transparent';
      default:
        return 'border-transparent bg-green-100 text-green-800';
    }
  };

  // Get plan type badge className for distinct colors
  const getPlanClassName = (planType: string): string => {
    switch (planType) {
      case 'monthly':
        return 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'daily':
        return 'border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'annual':
        return 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100';
      default:
        return 'border-transparent bg-blue-100 text-blue-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Member Details</DialogTitle>
          <DialogDescription>
            View and manage member information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Member Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{member.name}</h3>
              <div className="flex items-center gap-2">
                <Badge className={getStatusClassName(member.status)}>
                  {member.status}
                </Badge>
                <Badge className={getPlanClassName(member.plan_type)}>
                  {member.plan_type}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Phone Number</Label>
                <p className="text-sm font-medium">{member.phone_number}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Registered Date</Label>
                <p className="text-sm font-medium">{formatDate(member.registered_date)}</p>
              </div>
            </div>
          </div>

          {/* Membership Plan */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Membership Plan</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Plan Type</Label>
                <p className="text-sm font-medium capitalize">{member.plan_type}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Plan Amount</Label>
                <p className="text-sm font-medium">{formatCurrency(member.plan_amount)}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Membership Start</Label>
                <p className="text-sm font-medium">{formatDate(member.membership_start_date)}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Next Due Date</Label>
                <p className="text-sm font-medium">{formatDate(member.next_due_date)}</p>
              </div>

              {member.discount && (
                <>
                  <div>
                    <Label className="text-sm text-gray-500">Discount</Label>
                    <p className="text-sm font-medium">
                      {member.discount.discount_name} ({member.discount.discount_percentage}%)
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-500">Recurring Discount</Label>
                    <p className="text-sm font-medium">
                      {member.recurring_discount ? 'Yes' : 'No'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Actions — context-aware action buttons based on current status */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Status Actions</h3>
              <p className="text-xs text-blue-700 mt-0.5">
                Available actions based on current status: <strong>{member.status}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Active → Can Suspend */}
              {member.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={suspendMemberMutation.isPending}
                  onClick={() => suspendMemberMutation.mutate(member.id)}
                  className="border-amber-600 text-amber-700 hover:bg-amber-50"
                >
                  {suspendMemberMutation.isPending ? 'Suspending...' : 'Suspend Member'}
                </Button>
              )}

              {/* Expired or Suspended → Can Activate */}
              {(member.status === 'expired' || member.status === 'suspended') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activateMemberMutation.isPending}
                  onClick={() => setShowActivateDialog(true)}
                  className="border-green-600 text-green-700 hover:bg-green-50"
                >
                  {activateMemberMutation.isPending ? 'Activating...' : 'Activate Member'}
                </Button>
              )}

              {/* Expired or Suspended → Can Cancel */}
              {(member.status === 'expired' || member.status === 'suspended') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelMemberMutation.isPending}
                  onClick={() => cancelMemberMutation.mutate(member.id)}
                  className="border-red-600 text-red-700 hover:bg-red-50"
                >
                  {cancelMemberMutation.isPending ? 'Cancelling...' : 'Cancel Member'}
                </Button>
              )}

              {/* Cancelled → No actions available (terminal state) */}
              {member.status === 'cancelled' && (
                <p className="text-sm text-gray-600 italic">
                  No status actions available. Member is in terminal cancelled state.
                </p>
              )}
            </div>
          </div>

          {/* Payment History — distinct container */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
                <p className="text-xs text-gray-500 mt-0.5">{payments.length} payment{payments.length !== 1 ? 's' : ''} recorded</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                className="bg-white"
              >
                {showPaymentHistory ? 'Hide' : 'View'} Payment History
              </Button>
            </div>

            {showPaymentHistory && (
              <div className="rounded-lg border bg-white">
                {payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Next Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.payment_date)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount_paid)}
                          </TableCell>
                          <TableCell>
                            {payment.discount_applied ? (
                              <span className="text-sm text-green-600">
                                {payment.discount_applied} ({payment.discount_percentage}%)
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">None</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(payment.next_due_date_calculated)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-sm text-gray-500">No payment history</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center gap-3 border-t pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                title="Delete member"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onEditClick}
                title="Edit member"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => setShowMarkPaidDialog(true)}
                disabled={isMarkingRegularPaid}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isMarkingRegularPaid ? 'Processing...' : 'Mark Paid'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                This will permanently delete <strong>{member.name}</strong> and all associated data including:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Payment history ({payments.length} payment{payments.length !== 1 ? 's' : ''})</li>
                  <li>SMS logs</li>
                </ul>
                <p className="mt-3 text-red-600 font-semibold">This action cannot be undone.</p>
              </div>
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
              {deleteMemberMutation.isPending ? 'Deleting...' : 'Delete Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Paid Dialog */}
      <MarkPaidDialog
        open={showMarkPaidDialog}
        onOpenChange={setShowMarkPaidDialog}
        memberName={member.name}
        amount={
          member.discount && member.recurring_discount
            ? member.plan_amount - (member.plan_amount * member.discount.discount_percentage) / 100
            : member.plan_amount
        }
        planType={member.plan_type}
        onConfirm={handleMarkPaidConfirm}
      />

      {/* Activate Member Dialog */}
      <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Member</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new due date for <strong>{member.name}</strong>&apos;s membership.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="newDueDate" className="text-sm font-medium">
              New Due Date
            </Label>
            <Input
              id="newDueDate"
              type="date"
              value={activateNewDueDate}
              onChange={(e) => setActivateNewDueDate(e.target.value)}
              className="mt-2"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activateMemberMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!activateNewDueDate) {
                  toast.error('Please select a new due date');
                  return;
                }
                activateMemberMutation.mutate({
                  memberId: member.id,
                  newDueDate: activateNewDueDate,
                });
              }}
              disabled={activateMemberMutation.isPending || !activateNewDueDate}
              className="bg-green-600 hover:bg-green-700"
            >
              {activateMemberMutation.isPending ? 'Activating...' : 'Activate Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
