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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InstallmentPaymentRow {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  status: string;
  planId: string;
  templateName: string;
  installmentCount: number;
  installmentsPaid: number;
  memberId: string;
  memberName: string;
  phoneNumber: string;
  planType: string;
}

interface InstallmentPaymentsResponse {
  payments: InstallmentPaymentRow[];
  totalCount: number;
}

export default function InstallmentPaymentsTable() {
  const { openMember } = useMemberModal();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [sortBy, setSortBy] = useState('due_date_asc');
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<InstallmentPaymentsResponse>({
    queryKey: ['installment-payments', filter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({ filter, sortBy });
      const res = await fetch(`/api/installment-payments?${params}`);
      if (!res.ok) throw new Error('Failed to fetch installment payments');
      const r = await res.json();
      return r.data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/installment-payments/${paymentId}`, { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to mark as paid');
      }
      return res.json();
    },
    onMutate: (paymentId) => setPendingPaymentId(paymentId),
    onSuccess: (result) => {
      setPendingPaymentId(null);
      queryClient.invalidateQueries({ queryKey: ['installment-payments'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['sms-reminders'] });
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

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-GB');

  const getDueInText = (daysUntilDue: number) => {
    if (daysUntilDue === 0) {
      return <span className="font-medium text-orange-600">Due today</span>;
    } else if (daysUntilDue > 0) {
      return (
        <span className="text-gray-600">
          Due in {daysUntilDue} day{daysUntilDue > 1 ? 's' : ''}
        </span>
      );
    } else {
      const days = Math.abs(daysUntilDue);
      return (
        <span className="font-medium text-red-600">
          Overdue by {days} day{days > 1 ? 's' : ''}
        </span>
      );
    }
  };

  const getPlanClassName = (planType: string): string => {
    switch (planType) {
      case 'monthly': return 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'daily':   return 'border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'annual':  return 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100';
      default:        return 'border-transparent bg-blue-100 text-blue-800';
    }
  };

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load installment payments. Please try again.</p>
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
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">All Pending</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
              <SelectItem value="upcoming">Upcoming (1–7 days)</SelectItem>
              <SelectItem value="all">All (incl. future)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date_asc">Due Date (Soonest First)</SelectItem>
              <SelectItem value="member_name">Member Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data && (
          <div className="ml-auto">
            <p className="text-sm text-gray-600">
              Total: <span className="font-semibold">{data.totalCount}</span> payment
              {data.totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">Loading installment payments...</p>
          </div>
        ) : data && data.payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Installment Plan</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Due In</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => openMember(row.memberId)}
                  className={`cursor-pointer ${row.daysUntilDue < 0 ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-gray-50'}`}
                >
                  <TableCell>
                    <span className="font-medium">{row.memberName}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge className={getPlanClassName(row.planType)}>
                      {row.planType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{row.templateName}</p>
                      <p className="text-xs text-gray-500">
                        {row.installmentsPaid}/{row.installmentCount} paid
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    #{row.installmentNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    LKR {row.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{formatDate(row.dueDate)}</TableCell>
                  <TableCell>{getDueInText(row.daysUntilDue)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); markPaidMutation.mutate(row.id); }}
                      disabled={pendingPaymentId === row.id}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {pendingPaymentId === row.id ? 'Saving...' : 'Mark Paid'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">No pending installment payments</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
