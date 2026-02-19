'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { CreditCard, X } from 'lucide-react';

interface MembersListResponse {
  members: MemberWithDiscount[];
  overdueMembers: OverdueMember[];
  totalCount: number;
  page: number;
  totalPages: number;
}

interface SearchSuggestion {
  id: string;
  name: string;
  phone_number: string;
}

interface MembersTableProps {
  onMemberClick: (member: MemberWithDiscount) => void;
  onPaymentClick: (member: OverdueMember) => void;
}

export default function MembersTable({ onMemberClick, onPaymentClick }: MembersTableProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [planType, setPlanType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [page, setPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounce the search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search suggestions
  const { data: suggestions } = useQuery<SearchSuggestion[]>({
    queryKey: ['member-suggestions', inputValue],
    queryFn: async () => {
      if (!inputValue || inputValue.trim().length < 1) return [];
      const response = await fetch(`/api/members/suggestions?q=${encodeURIComponent(inputValue)}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.data ?? [];
    },
    enabled: inputValue.trim().length >= 1,
    staleTime: 30000,
  });

  // Fetch members data
  const { data, isLoading, error } = useQuery<MembersListResponse>({
    queryKey: ['members', debouncedSearch, status, planType, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (status !== 'all') params.append('status', status);
      if (planType !== 'all') params.append('planType', planType);
      if (sortBy) params.append('sortBy', sortBy);

      const response = await fetch(`/api/members?${params}`);
      if (!response.ok) throw new Error('Failed to fetch members');
      const result = await response.json();
      return result.data;
    },
  });

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    setInputValue(suggestion.name);
    setDebouncedSearch(suggestion.name);
    setShowSuggestions(false);
    setPage(1);
  }, []);

  const handleClearSearch = () => {
    setInputValue('');
    setDebouncedSearch('');
    setShowSuggestions(false);
    setPage(1);
  };

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Format phone number
  const formatPhone = (phone: string) => {
    return phone;
  };

  // Get status dot color class
  const getStatusDotClass = (status: string): string => {
    switch (status) {
      case 'active':    return 'bg-green-500';
      case 'expired':   return 'bg-red-500';
      case 'suspended': return 'bg-amber-400';
      case 'cancelled': return 'bg-gray-400';
      default:          return 'bg-green-500';
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

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load members. Please try again.</p>
      </div>
    );
  }

  const hasSuggestions = showSuggestions && suggestions && suggestions.length > 0 && inputValue.trim().length >= 1;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          {/* Search with type-ahead dropdown */}
          <div className="relative max-w-sm flex-1" ref={searchContainerRef}>
            <Input
              placeholder="Search by name or phone..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (inputValue.trim().length >= 1) setShowSuggestions(true);
              }}
              autoComplete="off"
              className={inputValue ? 'pr-8' : ''}
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {hasSuggestions && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                <ul className="max-h-60 overflow-auto py-1">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault(); // prevent blur before click
                          handleSuggestionClick(s);
                        }}
                      >
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <span className="text-gray-400 text-xs">{s.phone_number}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Select value={status} onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  Active
                </span>
              </SelectItem>
              <SelectItem value="expired">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  Expired
                </span>
              </SelectItem>
              <SelectItem value="suspended">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                  Suspended
                </span>
              </SelectItem>
              <SelectItem value="cancelled">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                  Cancelled
                </span>
              </SelectItem>
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

      {/* Active search status bar */}
      {debouncedSearch && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Searching for:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700">
            {debouncedSearch}
            <button
              type="button"
              onClick={handleClearSearch}
              className="ml-0.5 rounded-full hover:text-blue-900 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
          {data && (
            <span className="text-xs text-gray-500">
              — {data.totalCount} result{data.totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Total Count */}
      {data && !debouncedSearch && (
        <div className="text-sm text-gray-600">
          Total Members: <span className="font-semibold">{data.totalCount}</span>
        </div>
      )}

      {/* Overdue Members Section */}
      {data && data.overdueMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-red-600">Overdue Members</h3>
          <div className="rounded-lg border bg-[#FFE5E5] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-[#FFE5E5]">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdueMembers.map((member) => (
                  <TableRow
                    key={member.id}
                    onClick={() => onMemberClick(member)}
                    className="cursor-pointer hover:bg-red-100/60"
                  >
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium" title={member.status}>
                        <span className={`h-2 w-2 rounded-full shrink-0 ${getStatusDotClass(member.status)}`} />
                        {member.name}
                      </span>
                    </TableCell>
                    <TableCell>{formatPhone(member.phone_number)}</TableCell>
                    <TableCell>{formatDate(member.registered_date)}</TableCell>
                    <TableCell>
                      <Badge className={getPlanClassName(member.plan_type)}>
                        {member.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.next_due_date)}</TableCell>
                    <TableCell className="font-semibold text-red-600">
                      {member.days_overdue} days
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onPaymentClick(member); }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Mark Paid
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
        <div className="rounded-lg border bg-white overflow-auto max-h-[600px]">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-sm text-gray-500">Loading members...</div>
            </div>
          ) : data && data.members.length > 0 ? (
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Next Due Date</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Installment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow
                    key={member.id}
                    onClick={() => onMemberClick(member)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium" title={member.status}>
                        <span className={`h-2 w-2 rounded-full shrink-0 ${getStatusDotClass(member.status)}`} />
                        {member.name}
                      </span>
                    </TableCell>
                    <TableCell>{formatPhone(member.phone_number)}</TableCell>
                    <TableCell>{formatDate(member.registered_date)}</TableCell>
                    <TableCell>
                      <Badge className={getPlanClassName(member.plan_type)}>
                        {member.plan_type}
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
                    <TableCell>
                      {member.has_installment ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-transparent bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800"
                          title="Member is on an installment plan"
                        >
                          <CreditCard className="h-3 w-3" />
                          Installment
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
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
