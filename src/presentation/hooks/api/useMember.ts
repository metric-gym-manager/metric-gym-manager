import { useQuery } from '@tanstack/react-query';
import type { Member } from './useMembers';

// ============================================================
// useMember - Fetch single member by ID
// ============================================================

export function useMember(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['member', memberId],
    queryFn: async (): Promise<Member> => {
      if (!memberId) {
        throw new Error('Member ID is required');
      }

      const response = await fetch(`/api/members/${memberId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch member');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!memberId, // Only fetch if memberId is provided
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================
// useMemberStatus - Fetch member status summary
// ============================================================

export interface MemberStatusSummary {
  active: number;
  expired: number;
  cancelled: number;
  suspended: number;
  total: number;
}

export function useMemberStatus() {
  return useQuery({
    queryKey: ['member-status-summary'],
    queryFn: async (): Promise<MemberStatusSummary> => {
      const response = await fetch('/api/members/status/summary', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch member status summary');
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
