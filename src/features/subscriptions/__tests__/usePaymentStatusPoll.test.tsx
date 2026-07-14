import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaymentStatusPoll } from '@/features/subscriptions/hooks/usePaymentStatusPoll';
import { getSubscription } from '@/features/subscriptions/services/subscriptions.service';
import {
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  SaasTier,
  SaasStatus,
} from '@/core/utils/constants/SubscriptionConfig';

jest.mock('@/features/subscriptions/services/subscriptions.service', () => ({
  getSubscription: jest.fn(),
}));

const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>;

function subResult(tier: SaasTier, status: SaasStatus) {
  return {
    litePriceLkr: 2990,
    proPriceLkr: 4990,
    enterprisePriceLkr: 6990,
    subscription: {
      subscriptionTier: tier,
      subscription_tier: tier,
      subscriptionStatus: status,
      subscription_status: status,
      memberCount: 10,
      member_count: 10,
      memberLimit: tier === SaasTier.Lite ? 100 : null,
      member_limit: tier === SaasTier.Lite ? 100 : null,
      currentPeriodEnd: null,
      current_period_end: null,
      trialEndsAt: null,
      trial_ends_at: null,
      graceEndsAt: null,
      grace_ends_at: null,
      pastDueReason: null,
      past_due_reason: null,
      canAddMember: true,
      capabilities: {
        automatedReminders: true,
        announcements: true,
        accessControlHardware: false,
      },
      remainingMemberSlots: 30,
      remaining_member_slots: 30,
      isComplimentary: false,
      is_complimentary: false,
      hasSavedCard: false,
      has_saved_card: false,
    },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePaymentStatusPoll', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSubscription.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays idle when not active', () => {
    const { result } = renderHook(() => usePaymentStatusPoll(false), { wrapper });
    expect(result.current).toBe('idle');
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it('reaches SUCCESS when the webhook lands mid-poll (status flips to active)', async () => {
    mockGetSubscription
      .mockResolvedValueOnce(subResult(SaasTier.Lite, SaasStatus.Trialing))
      .mockResolvedValueOnce(subResult(SaasTier.Lite, SaasStatus.Active));

    const { result } = renderHook(() => usePaymentStatusPoll(true), { wrapper });
    expect(result.current).toBe('verifying');

    // first tick (immediate) still sees trialing
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    // second tick sees the activated subscription
    await act(async () => {
      jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS + 1);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current).toBe('success'));
    expect(mockGetSubscription).toHaveBeenCalledTimes(2);
  });

  it('reaches PENDING (not failure) when the window elapses without the webhook', async () => {
    mockGetSubscription.mockResolvedValue(subResult(SaasTier.Lite, SaasStatus.Trialing));

    const { result } = renderHook(() => usePaymentStatusPoll(true), { wrapper });

    const ticks = Math.ceil(PAYMENT_POLL_TIMEOUT_MS / PAYMENT_POLL_INTERVAL_MS) + 2;
    for (let i = 0; i < ticks; i++) {
      await act(async () => {
        jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS + 1);
        await Promise.resolve();
      });
    }

    await waitFor(() => expect(result.current).toBe('pending'));
  });

  it('keeps polling through transient fetch failures', async () => {
    mockGetSubscription
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(subResult(SaasTier.Pro, SaasStatus.Active));

    const { result } = renderHook(() => usePaymentStatusPoll(true), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS + 1);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current).toBe('success'));
  });
});
