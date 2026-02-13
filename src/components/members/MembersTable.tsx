'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { MemberWithDiscount, OverdueMember } from '@/features/members/types';

interface MembersListResponse {
  members: MemberWithDiscount[];
  overdueMembers: OverdueMember[];
  totalCount: number;
  page: number;
  totalPages: number;
}

interface MembersTableProps {
  onMemberClick: (member: MemberWithDiscount) => void;
  onPaymentClick: (member: OverdueMember) => void;
}

export default function MembersTable({ onMemberClick, onPaymentClick }: MembersTableProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [planType, setPlanType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [page, setPage] = useState(1);

  // Fetch members data
  const { data, isLoading, error } = useQuery<MembersListResponse>({
    queryKey: ['members', search, status, planType, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (search) params.append('search', search);
      if (status !== 'all') params.append('status', status);
      if (planType !== 'all') params.append('planType', planType);
      if (sortBy) params.append('sortBy', sortBy);

      const response = await fetch(`/api/members?${params}`);
      if (!response.ok) throw new Error('Failed to fetch members');
      const result = await response.json();
      return result.data;
    },
  });

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Format phone number
  const formatPhone = (phone: string) => {
    // Assuming +94XXXXXXXXX format
    return phone;
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

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load members. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset to first page on search
            }}
            className="max-w-sm"
          />
          <Select value={status} onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planType} onValueChange={(value) => {
            setPlanType(value);
            setPage(1);
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plan Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="upcoming_due">Upcoming Payments</SelectItem>
            <SelectItem value="recently_expired">Recently Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Total Count */}
      {data && (
        <div className="text-sm text-gray-600">
          Total Members: <span className="font-semibold">{data.totalCount}</span>
        </div>
      )}

      {/* Overdue Members Section */}
      {data && data.overdueMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-red-600">Overdue Members</h3>
          <div className="rounded-lg border bg-[#FFE5E5]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdueMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <button
                        onClick={() => onMemberClick(member)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {member.name}
                      </button>
                    </TableCell>
                    <TableCell>{formatPhone(member.phone_number)}</TableCell>
                    <TableCell>{formatDate(member.registered_date)}</TableCell>
                    <TableCell>
                      <Badge variant={getPlanVariant(member.plan_type)}>
                        {member.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.next_due_date)}</TableCell>
                    <TableCell className="font-semibold text-red-600">
                      {member.days_overdue} days
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => onPaymentClick(member)}
                      >
                        Payment Collected
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* All Members Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">All Members</h3>
        <div className="rounded-lg border bg-white">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-sm text-gray-500">Loading members...</div>
            </div>
          ) : data && data.members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Due Date</TableHead>
                  <TableHead>Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <button
                        onClick={() => onMemberClick(member)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {member.name}
                      </button>
                    </TableCell>
                    <TableCell>{formatPhone(member.phone_number)}</TableCell>
                    <TableCell>{formatDate(member.registered_date)}</TableCell>
                    <TableCell>
                      <Badge variant={getPlanVariant(member.plan_type)}>
                        {member.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.next_due_date)}</TableCell>
                    <TableCell>
                      {member.discount ? (
                        <span className="text-sm text-gray-600">
                          {member.discount.discount_name} ({member.discount.discount_percentage}%)
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-500">No members found</p>
                <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {data.page} of {data.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
