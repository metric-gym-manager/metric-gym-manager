'use client';

import { useQuery } from '@tanstack/react-query';
import { getBillingHistory } from '../services/subscriptions.service';
import type { BillingHistoryPage } from '../types';

/**
 * Paginated SaaS billing history from saas_payment_logs (the authoritative
 * source for the gym-facing UI — plan C-12).
 */
export function useBillingHistory(page: number) {
  return useQuery<BillingHistoryPage>({
    queryKey: ['billing-history', page],
    queryFn: () => getBillingHistory(page),
    staleTime: 60_000,
  });
}
