'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  changePlan,
  ApiRequestError,
  type SubscriptionWithPrice,
} from '../services/subscriptions.service';
import { SUBSCRIPTION_QUERY_KEY } from './useSubscription';
import { TIER_DISPLAY_NAME } from '@/core/utils/constants/SubscriptionConfig';

/**
 * One-click plan change against the stored card token. On success the
 * subscription cache is updated in place (the ring/limit bar/plan card all
 * react immediately). NO_SAVED_CARD errors are NOT toasted here — the
 * dialog catches that code and falls back to the full PayHere checkout.
 */
export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: changePlan,
    onSuccess: ({ subscription, outcome }) => {
      queryClient.setQueryData<SubscriptionWithPrice>(SUBSCRIPTION_QUERY_KEY, (old) => ({
        subscription,
        litePriceLkr: old?.litePriceLkr ?? null,
        proPriceLkr: old?.proPriceLkr ?? null,
        enterprisePriceLkr: old?.enterprisePriceLkr ?? null,
      }));
      if (outcome === 'applied') {
        toast.success(
          `You're on ${TIER_DISPLAY_NAME[subscription.subscriptionTier]}` +
            (subscription.currentPeriodEnd
              ? ` — paid through ${subscription.currentPeriodEnd}.`
              : '.')
        );
      } else {
        toast.info(
          'Payment received — still confirming with PayHere. Your plan will update automatically.'
        );
      }
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === 'NO_SAVED_CARD') {
        return; // the dialog falls back to checkout — not an error to show
      }
      toast.error(
        error instanceof ApiRequestError && error.code === 'CHARGE_FAILED'
          ? 'Your saved card was declined — nothing was changed. Try the full checkout instead.'
          : error instanceof ApiRequestError
            ? error.message
            : 'Could not change the plan. Please try again.'
      );
    },
  });
}
