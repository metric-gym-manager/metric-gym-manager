'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSubscription } from '../services/subscriptions.service';
import { SUBSCRIPTION_QUERY_KEY } from './useSubscription';
import type { PaymentPollState } from '../types';
import {
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  SaasTier,
  SaasStatus,
} from '@/core/utils/constants/SubscriptionConfig';

/**
 * Post-redirect verification poll (TOCTOU mitigation, plan §5.4 flow 1).
 *
 * While `active`, polls the subscription every PAYMENT_POLL_INTERVAL_MS up to
 * PAYMENT_POLL_TIMEOUT_MS. pro/active -> 'success'. Window elapsed ->
 * 'pending' (NOT failure: the webhook is the source of truth and may arrive
 * later — the caller renders PENDING_CONFIRMATION with a manual refresh).
 */
export function usePaymentStatusPoll(active: boolean): PaymentPollState {
  const [state, setState] = useState<PaymentPollState>(active ? 'verifying' : 'idle');
  const queryClient = useQueryClient();

  useEffect(() => {
    // All setState calls are scheduled asynchronously (timeout/microtask) —
    // never synchronously inside the effect body (react-hooks lint).
    if (!active) {
      const idleTimer = setTimeout(() => setState('idle'), 0);
      return () => clearTimeout(idleTimer);
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      setState((prev) => (prev === 'verifying' ? prev : 'verifying'));
      try {
        const result = await getSubscription();
        if (cancelled) return;
        if (
          result.subscription.subscriptionTier === SaasTier.Pro &&
          result.subscription.subscriptionStatus === SaasStatus.Active
        ) {
          queryClient.setQueryData(SUBSCRIPTION_QUERY_KEY, result);
          setState('success');
          return;
        }
      } catch {
        // transient poll failure — keep polling until the window closes
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= PAYMENT_POLL_TIMEOUT_MS) {
        setState('pending');
        return;
      }
      timer = setTimeout(tick, PAYMENT_POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, queryClient]);

  return state;
}
