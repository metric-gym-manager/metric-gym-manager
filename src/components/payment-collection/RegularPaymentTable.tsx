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

interface RegularPaymentRow {
  id: string;
  name: string;
  phoneNumber: string;
  planType: string;
  planAmount: number;
  discountId: string | null;
  discountName: string | null;
  discountPct: number | null;
  recurringDiscount: boolean;
  effectiveAmount: number;
  nextDueDate: string;
  daysUntilDue: number;
  memberStatus: string;
}

interface RegularPaymentsResponse {
  payments: RegularPaymentRow[];
  totalCount: number;
}

export default function RegularPaymentTable() {
  const { openMember } = useMemberModal();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_date_asc');
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<RegularPaymentsResponse>({
    queryKey: ['regular-payments', filter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({ filter, sortBy });
      const res = await fetch(`/api/regular-payments?${params}`);
      if (!res.ok) throw new Error('Failed to fetch regular payments');
      const r = await res.json();
      return r.data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (row: RegularPaymentRow) => {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/members/${row.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: row.planAmount,
          paymentAmount: row.effectiveAmount,
          paymentDate: today,
          discountId: row.discountId ?? undefined,
          deductOverduePeriod: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to collect payment');
      }
      return res.json();
    },
    onMutate: (row) => {
      setPendingMemberId(row.id);
    },
    onSuccess: () => {
      setPendingMemberId(null);
      toast.success('Payment collected — receipt SMS sent');
      // Batch invalidations to reduce refetch overhead
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'regular-payments' ||
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'sms-reminders'
      });
    },
    onError: (error) => {
      setPendingMemberId(null);
      toast.error(error instanceof Error ? error.message : 'Failed to collect payment');
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
        <p className="text-sm text-red-800">Failed to load regular payments. Please try again.</p>
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
              <SelectItem value="overdue">Overdue Only</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="upcoming">Upcoming (1–7 days)</SelectItem>
              <SelectItem value="all">All Members</SelectItem>
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
            <p className="text-sm text-gray-500">Loading payments...</p>
          </div>
        ) : data && data.payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Plan Amount</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Amount Due</TableHead>
                <TableHead>Next Due Date</TableHead>
                <TableHead>Due In</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => openMember(row.id)}
                  className={`cursor-pointer ${row.daysUntilDue < 0 ? 'bg-red-50 hover:bg-red-100/70' : row.daysUntilDue === 0 ? 'bg-orange-50 hover:bg-orange-100/70' : 'hover:bg-gray-50'}`}
                >
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge className={getPlanClassName(row.planType)}>
                      {row.planType}
                    </Badge>
                  </TableCell>
                  <TableCell>LKR {row.planAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    {row.discountName && row.discountPct ? (
                      <span className="text-sm text-green-700">
                        {row.discountName} ({row.discountPct}%)
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    LKR {row.effectiveAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>{formatDate(row.nextDueDate)}</TableCell>
                  <TableCell>{getDueInText(row.daysUntilDue)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); markPaidMutation.mutate(row); }}
                      disabled={pendingMemberId === row.id}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {pendingMemberId === row.id ? 'Saving...' : 'Mark Paid'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">No payments found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
