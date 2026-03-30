import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MemberStatus } from '@/core/domain/member/Member';
import type { PlanType } from '@/core/utils/constants/PlanConfig';

// ============================================================
// Types
// ============================================================

export interface MemberFilters {
  search?: string;
  status?: MemberStatus;
  planType?: PlanType;
  sortBy?: 'name' | 'nextDueDate' | 'createdAt';
  page?: number;
  limit?: number;
}

export interface Member {
  id: string;
  gym_id: string;
  name: string;
  phone_number: string;
  plan_type: PlanType;
  plan_amount: number;
  status: MemberStatus;
  next_due_date: string;
  membership_start_date: string;
  recurring_discount: boolean;
  discount_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembersResponse {
  members: Member[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface CreateMemberInput {
  name: string;
  phoneNumber: string;
  planType: PlanType;
  planAmount: number;
  discountId?: string | null;
  recurringDiscount?: boolean;
  membershipStartDate: string;
  paymentAmount: number;
}

// ============================================================
// useMembers - Fetch members list with filters
// ============================================================

export function useMembers(filters?: MemberFilters) {
  const buildQueryString = () => {
    if (!filters) return '';

    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.planType) params.append('planType', filters.planType);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return params.toString();
  };

  return useQuery({
    queryKey: ['members', filters],
    queryFn: async (): Promise<MembersResponse> => {
      const queryString = buildQueryString();
      const url = `/api/members${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch members');
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================
// useCreateMember - Create new member
// ============================================================

export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMemberInput): Promise<Member> => {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create member');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (member) => {
      toast.success(`Member ${member.name} registered successfully`);

      // Invalidate members queries to refetch
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create member');
    },
  });
}

// ============================================================
// useUpdateMember - Update existing member
// ============================================================

export interface UpdateMemberInput {
  id: string;
  name?: string;
  phoneNumber?: string;
  planType?: PlanType;
  planAmount?: number;
  status?: MemberStatus;
  recurringDiscount?: boolean;
  discountId?: string | null;
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMemberInput): Promise<Member> => {
      const { id, ...updateData } = input;

      const response = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update member');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (member) => {
      toast.success(`Member ${member.name} updated successfully`);

      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', member.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update member');
    },
  });
}

// ============================================================
// useDeleteMember - Delete member
// ============================================================

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete member');
      }
    },
    onSuccess: () => {
      toast.success('Member deleted successfully');

      // Invalidate members queries to refetch
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete member');
    },
  });
}
