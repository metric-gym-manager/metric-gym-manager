'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMemberModal } from '@/contexts/member-modal.context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/utils/date/date';
import { getPlanBadgeColor } from '@/utils/badge-colors';
import { Banknote, Users, TrendingUp } from 'lucide-react';

interface PaymentCollectedRow {
  paymentId: string;
  memberId: string;
  memberName: string;
  phoneNumber: string;
  planType: string;
  amountPaid: number;
  discountName: string | null;
  discountPct: number | null;
  paymentDate: string;
  nextDueDate: string;
}

interface PaymentCollectedSummary {
  totalRevenue: number;
  paymentCount: number;
  revenueByPlanType: Record<string, number>;
}

interface CollectedPaymentsResponse {
  payments: PaymentCollectedRow[];
  summary: PaymentCollectedSummary;
  totalCount: number;
}

/**
 * Helper function to get the current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default function PaymentCollectedTable() {
  const { openMember } = useMemberModal();
  const [month, setMonth] = useState(getCurrentMonth());
  const [planType, setPlanType] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery<CollectedPaymentsResponse>({
    queryKey: ['payment-collected', month, planType, search],
    queryFn: async () => {
      const params = new URLSearchParams({ month, planType, search });
      const res = await fetch(`/api/payment-collection/collected?${params}`);
      if (!res.ok) throw new Error('Failed to fetch collected payments');
      const r = await res.json();
      return r.data;
    },
  });

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load collected payments. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Metrics Banner */}
      {data && data.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-200 rounded-lg">
                <Banknote className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-green-900">
                  Rs. {data.summary.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-200 rounded-lg">
                <Users className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Payment Count</p>
                <p className="text-2xl font-bold text-blue-900">
                  {data.summary.paymentCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-700" />
              </div>
              <div>
                <p className="text-sm text-purple-700 font-medium">Revenue Breakdown</p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(data.summary.revenueByPlanType).map(([plan, revenue]) => (
                    <p key={plan} className="text-xs text-purple-800">
                      {plan}: Rs. {revenue.toFixed(2)}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Month</label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[200px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Plan Type</label>
          <Select value={planType} onValueChange={setPlanType}>
            <SelectTrigger id="payment-collected-plan-filter-select" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="drop-in">Drop-in</SelectItem>
              <SelectItem value="class-pack">Class Pack</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Search</label>
          <Input
            type="text"
            placeholder="Name or phone number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[250px]"
          />
        </div>

        {data && (
          <div className="ml-auto">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{data.totalCount}</span> payment
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
                <TableHead>Payment Date</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan Type</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Next Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((row) => (
                <TableRow
                  key={row.paymentId}
                  onClick={() => openMember(row.memberId)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <TableCell>{formatDate(row.paymentDate)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{row.memberName}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge className={getPlanBadgeColor(row.planType)}>
                      {row.planType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    Rs. {row.amountPaid.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {row.discountName && row.discountPct ? (
                      <span className="text-sm text-green-700">
                        {row.discountName} ({row.discountPct}%)
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(row.nextDueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center space-y-2 max-w-md mx-auto px-4">
              <p className="text-sm text-gray-500">No payments collected this month</p>
              <p className="text-xs text-gray-400">
                Payments will appear here once collected
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
