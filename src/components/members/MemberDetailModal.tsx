'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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

interface InstallmentPayment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'overdue';
}

interface MemberInstallment {
  id: string;
  template_name: string;
  total_amount: number;
  installment_count: number;
  amount_per_installment: number;
  installments_paid: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  installment_payments: InstallmentPayment[];
}

interface MemberDetailModalProps {
  open: boolean;
  onClose: () => void;
  member: MemberWithDiscount | null;
  payments?: Payment[];
  installments?: MemberInstallment[];
  onEditClick: () => void;
}

export default function MemberDetailModal({
  open,
  onClose,
  member,
  payments = [],
  installments: initialInstallments = [],
  onEditClick,
}: MemberDetailModalProps) {
  const queryClient = useQueryClient();
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [isMarkingRegularPaid, setIsMarkingRegularPaid] = useState(false);

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
      toast.success(`Member status updated to ${statusLabel}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    },
  });

  // Live installments — uses initialData from context (already fetched).
  // staleTime: Infinity prevents a spurious background re-fetch on mount;
  // invalidateQueries after Mark Paid still forces a fresh fetch when needed.
  const { data: liveInstallments } = useQuery<MemberInstallment[]>({
    queryKey: ['member-installments', member?.id],
    queryFn: async () => {
      const res = await fetch(`/api/members/${member!.id}/installments`);
      if (!res.ok) throw new Error('Failed to fetch installments');
      const r = await res.json();
      return r.data ?? [];
    },
    enabled: !!member,
    initialData: initialInstallments,
    staleTime: Infinity,
  });

  const installments = liveInstallments ?? initialInstallments;

  // Mark installment payment as paid
  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/installment-payments/${paymentId}`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to mark as paid');
      }
      return res.json();
    },
    onMutate: (paymentId) => {
      setPendingPaymentId(paymentId);
    },
    onSuccess: (result) => {
      setPendingPaymentId(null);
      queryClient.invalidateQueries({ queryKey: ['member-installments', member?.id] });
      queryClient.invalidateQueries({ queryKey: ['installment-payments'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      if (result.data?.planCompleted) {
        toast.success('Installment plan fully paid — receipt SMS sent');
      } else {
        toast.success('Payment collected — receipt SMS sent');
      }
    },
    onError: (error) => {
      setPendingPaymentId(null);
      toast.error(error instanceof Error ? error.message : 'Failed to mark as paid');
    },
  });

  // Mark regular payment as paid
  const markRegularPaidMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('No member selected');

      // Calculate effective amount after discount
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
      toast.success('Payment collected — receipt SMS sent');
    },
    onError: (error) => {
      setIsMarkingRegularPaid(false);
      toast.error(error instanceof Error ? error.message : 'Failed to collect payment');
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

  const hasStatusChanged = selectedStatus !== member.status;

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

          {/* Change Status — distinct container to signal it's an action zone */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-orange-900">Change Member Status</h3>
              <p className="text-xs text-orange-700 mt-0.5">
                Select a new status and click &quot;Update Status&quot; to save.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-[200px] bg-white">
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
                className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>

              {hasStatusChanged && !updateStatusMutation.isPending && (
                <span className="text-xs text-orange-700">Unsaved change</span>
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

          {/* Installment Plans */}
          {installments.length > 0 && (
            <div className="space-y-3">
              {installments.map((inst) => {
                const amountPaid = inst.installments_paid * inst.amount_per_installment;
                const remaining = inst.total_amount - amountPaid;
                const progressPct = Math.round((inst.installments_paid / inst.installment_count) * 100);

                return (
                  <div key={inst.id} className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-indigo-900">{inst.template_name}</h3>
                        <p className="text-xs text-indigo-700 mt-0.5">
                          {inst.installments_paid} of {inst.installment_count} installments paid
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold ${
                          inst.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : inst.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inst.status}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-indigo-700 mb-1">
                        <span>Progress</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-indigo-200">
                        <div
                          className="h-2 rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded bg-white p-2">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-sm font-semibold">{formatCurrency(inst.total_amount)}</p>
                      </div>
                      <div className="rounded bg-white p-2">
                        <p className="text-xs text-gray-500">Paid</p>
                        <p className="text-sm font-semibold text-green-700">{formatCurrency(amountPaid)}</p>
                      </div>
                      <div className="rounded bg-white p-2">
                        <p className="text-xs text-gray-500">Remaining</p>
                        <p className="text-sm font-semibold text-red-600">{formatCurrency(remaining)}</p>
                      </div>
                    </div>

                    {/* Installment schedule table */}
                    <div className="rounded border bg-white overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Due Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Paid Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                            {inst.status !== 'completed' && (
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Action</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {inst.installment_payments
                            .sort((a, b) => a.installment_number - b.installment_number)
                            .map((p) => {
                              const dueDate = new Date(p.due_date);
                              dueDate.setHours(0, 0, 0, 0);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const isOverdue = p.status !== 'paid' && dueDate < today;
                              const displayStatus = p.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

                              return (
                                <tr
                                  key={p.id}
                                  className={`border-b last:border-0 ${
                                    displayStatus === 'overdue' ? 'bg-red-50' : ''
                                  }`}
                                >
                                  <td className="px-3 py-2 font-medium">{p.installment_number}</td>
                                  <td className="px-3 py-2">{formatDate(p.due_date)}</td>
                                  <td className="px-3 py-2">{formatCurrency(p.amount)}</td>
                                  <td className="px-3 py-2">
                                    {p.paid_date ? formatDate(p.paid_date) : <span className="text-gray-400">—</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
                                        displayStatus === 'paid'
                                          ? 'bg-green-100 text-green-800'
                                          : displayStatus === 'overdue'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {displayStatus}
                                    </span>
                                  </td>
                                  {inst.status !== 'completed' && (
                                    <td className="px-3 py-2">
                                      {displayStatus !== 'paid' ? (
                                        <button
                                          type="button"
                                          onClick={() => markPaidMutation.mutate(p.id)}
                                          disabled={pendingPaymentId === p.id}
                                          className="rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          {pendingPaymentId === p.id ? 'Saving...' : 'Mark Paid'}
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {!installments.some(inst => inst.status === 'active') && (
              <Button
                onClick={() => markRegularPaidMutation.mutate()}
                disabled={isMarkingRegularPaid}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isMarkingRegularPaid ? 'Processing...' : `Mark Paid (${member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1)})`}
              </Button>
            )}
            <Button onClick={onEditClick}>
              Edit Member
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
