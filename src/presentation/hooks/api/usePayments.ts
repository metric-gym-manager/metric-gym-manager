import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

export interface Payment {
  id: string;
  member_id: string;
  payment_date: string;
  payment_amount: number;
  plan_amount: number;
  discount_id: string | null;
  discount_name: string | null;
  discount_percentage: number | null;
  next_due_date: string;
  created_at: string;
}

export interface PaymentFilters {
  memberId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaymentsResponse {
  payments: Payment[];
  totalCount: number;
  page: number;
  totalPages: number;
  totalRevenue: number;
}

export interface CollectPaymentInput {
  memberId: string;
  paymentDate: string;
  paymentAmount: number;
  planAmount: number;
  discountId?: string | null;
  deductOverduePeriod?: boolean;
}

export interface CollectPaymentResponse {
  member: {
    id: string;
    name: string;
    status: string;
    next_due_date: string;
  };
  payment: Payment;
}

// ============================================================
// usePayments - Fetch payments list with filters
// ============================================================

export function usePayments(filters?: PaymentFilters) {
  const buildQueryString = () => {
    if (!filters) return '';

    const params = new URLSearchParams();
    if (filters.memberId) params.append('memberId', filters.memberId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return params.toString();
  };

  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async (): Promise<PaymentsResponse> => {
      const queryString = buildQueryString();
      const url = `/api/payments${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch payments');
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================
// useMemberPayments - Fetch payments for specific member
// ============================================================

export function useMemberPayments(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['member-payments', memberId],
    queryFn: async (): Promise<Payment[]> => {
      if (!memberId) {
        throw new Error('Member ID is required');
      }

      const response = await fetch(`/api/members/${memberId}/payments`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch member payments');
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
// useCollectPayment - Collect payment for member
// ============================================================

export function useCollectPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CollectPaymentInput): Promise<CollectPaymentResponse> => {
      const { memberId, ...paymentData } = input;

      const response = await fetch(`/api/members/${memberId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to collect payment');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data) => {
      toast.success('Payment collected — receipt SMS sent');

      // Invalidate relevant queries to refetch
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', data.member.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['member-payments', data.member.id] });
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] });
      queryClient.invalidateQueries({ queryKey: ['sms-reminders'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to collect payment');
    },
  });
}

// ============================================================
// usePaymentPreview - Preview payment calculation
// ============================================================

export interface PaymentPreviewInput {
  memberId: string;
  paymentDate: string;
  deductOverduePeriod: boolean;
}

export interface PaymentPreviewResponse {
  nextDueDate: string;
  nextDueDateFormatted: string;
  planType: string;
  currentDueDate: string;
  deductOverduePeriod: boolean;
}

export function usePaymentPreview(input: PaymentPreviewInput | null) {
  return useQuery({
    queryKey: ['payment-preview', input?.memberId, input?.paymentDate, input?.deductOverduePeriod],
    queryFn: async (): Promise<PaymentPreviewResponse> => {
      if (!input) {
        throw new Error('Payment preview input is required');
      }

      const { memberId, ...previewData } = input;

      const response = await fetch(`/api/members/${memberId}/payment/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to preview payment');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!input && !!input.memberId && !!input.paymentDate, // Only fetch if input is provided
    staleTime: 10000, // 10 seconds (short stale time for preview)
    gcTime: 60 * 1000, // 1 minute
  });
}
