'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cancelSubscription,
  ApiRequestError,
  type SubscriptionWithPrice,
} from '../services/subscriptions.service';
import { SUBSCRIPTION_QUERY_KEY } from './useSubscription';

/**
 * Cancel the subscription. The server cancels at the gateway FIRST; on
 * gateway failure nothing changes locally and the error says so.
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (sub) => {
      queryClient.setQueryData<SubscriptionWithPrice>(SUBSCRIPTION_QUERY_KEY, (old) => ({
        subscription: sub,
        litePriceLkr: old?.litePriceLkr ?? null,
        proPriceLkr: old?.proPriceLkr ?? null,
        enterprisePriceLkr: old?.enterprisePriceLkr ?? null,
      }));
      toast.success(
        sub.currentPeriodEnd
          ? `Subscription canceled — your plan's features continue until ${sub.currentPeriodEnd}.`
          : 'Subscription canceled.'
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiRequestError
          ? error.message
          : 'Could not cancel the subscription. Please try again.'
      );
    },
  });
}
