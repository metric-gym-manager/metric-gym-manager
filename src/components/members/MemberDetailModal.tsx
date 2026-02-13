'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import type { MemberWithDiscount, Payment } from '@/features/members/types';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  if (!member) return null;

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `LKR ${amount.toFixed(2)}`;
  };

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'expired':
        return 'destructive';
      case 'suspended':
        return 'secondary';
      case 'cancelled':
        return 'outline';
      default:
        return 'default';
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
                <Badge variant={getStatusVariant(member.status)}>
                  {member.status}
                </Badge>
                <Badge variant={getPlanVariant(member.plan_type)}>
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

              {member.emergency_contact_name && (
                <div>
                  <Label className="text-sm text-gray-500">Emergency Contact</Label>
                  <p className="text-sm font-medium">{member.emergency_contact_name}</p>
                </div>
              )}

              {member.emergency_contact_phone && (
                <div>
                  <Label className="text-sm text-gray-500">Emergency Phone</Label>
                  <p className="text-sm font-medium">{member.emergency_contact_phone}</p>
                </div>
              )}
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

          {/* Change Status */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Change Status</h3>

            <div className="flex items-center gap-4">
              <Select
                value={member.status}
                onValueChange={(value) => {
                  if (confirm(`Are you sure you want to change status to "${value}"?`)) {
                    updateStatusMutation.mutate({ memberId: member.id, status: value });
                  }
                }}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              {updateStatusMutation.isError && (
                <p className="text-sm text-red-600">
                  {updateStatusMutation.error instanceof Error
                    ? updateStatusMutation.error.message
                    : 'Failed to update status'}
                </p>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Payment History</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPaymentHistory(!showPaymentHistory)}
              >
                {showPaymentHistory ? 'Hide' : 'Show'} ({payments.length})
              </Button>
            </div>

            {showPaymentHistory && (
              <div className="rounded-lg border">
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
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onEditClick}>
              Edit Member
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
