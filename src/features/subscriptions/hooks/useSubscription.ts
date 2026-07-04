'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSubscription, type SubscriptionWithPrice } from '../services/subscriptions.service';

export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

/**
 * Current gym's subscription state (tier, status, usage, grace dates) plus
 * the Pro price for the pricing UI. Serialized server-side; `canAddMember`
 * is display-only — the FOR UPDATE-locked RPC is the real quota authority.
 */
export function useSubscription() {
  return useQuery<SubscriptionWithPrice>({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: getSubscription,
    staleTime: 30_000,
  });
}

/**
 * Invalidate the subscription cache (after upgrade/cancel mutations).
 */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
}
