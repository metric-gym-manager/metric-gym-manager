'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ArrowUpCircle } from 'lucide-react';
import { SaasStatus, TIER_DISPLAY_NAME } from '@/features/subscriptions/config/SubscriptionConfig';
import type { SerializedSubscription } from '../types';

interface TrialBannerProps {
  subscription: SerializedSubscription;
  /** Open the checkout dialog for the current tier (billing page); omit to link to /settings/billing. */
  onSubscribeClick?: () => void;
}

/**
 * Trial banner: renders only while `trialing` — days remaining on the trial
 * clock plus a checkout CTA. A trial that never checks out is suspended by
 * the trial-expiry cron, so the countdown is the account's real deadline.
 */
export default function TrialBanner({ subscription: sub, onSubscribeClick }: TrialBannerProps) {
  const trialEndsAt = sub.trialEndsAt;

  // Clock read scheduled asynchronously (not during render): keeps render
  // pure and avoids an SSR/client hydration mismatch on the countdown.
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDaysLeft(
        trialEndsAt
          ? Math.max(
              0,
              Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            )
          : null
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [trialEndsAt]);

  if (sub.subscriptionStatus !== SaasStatus.Trialing) return null;

  const tierName = TIER_DISPLAY_NAME[sub.subscriptionTier];

  return (
    <div
      data-testid="trial-banner"
      className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              Free trial{daysLeft !== null && <> — {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</>}
            </p>
            <p className="text-sm text-blue-700 mt-1">
              You have full {tierName} features
              {trialEndsAt && (
                <>
                  {' '}
                  until <span className="font-semibold">{trialEndsAt}</span>
                </>
              )}
              . Subscribe before then to keep your account active — otherwise it will be suspended
              (your members and data are kept).
            </p>
          </div>
        </div>
        {onSubscribeClick ? (
          <button
            type="button"
            onClick={onSubscribeClick}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
            Subscribe
          </button>
        ) : (
          <Link
            href="/settings/billing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
            Subscribe
          </Link>
        )}
      </div>
    </div>
  );
}
