'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startCheckout, ApiRequestError } from '../services/subscriptions.service';
import { submitPayHereCheckout } from '../components/PayHereRedirectForm';

/**
 * Start a checkout into any tier: create the checkout intent, then hand the
 * browser to PayHere via a plain form POST (card entry happens entirely on
 * PayHere).
 */
export function useCheckout() {
  return useMutation({
    mutationFn: startCheckout,
    onSuccess: (redirect) => {
      submitPayHereCheckout(redirect);
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError && error.code === 'CONFLICT'
          ? error.message
          : 'Could not start the upgrade. Please try again.';
      toast.error(message);
    },
  });
}
