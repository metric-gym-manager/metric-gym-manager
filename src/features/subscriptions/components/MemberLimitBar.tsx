'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpCircle, Users } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { TIER_DISPLAY_NAME } from '@/core/utils/constants/SubscriptionConfig';

/**
 * Site-wide member-usage bar: remaining member slots + universal Upgrade CTA.
 *
 * Renders for any CAPPED tier (Starter 40, Growth 190) on every page EXCEPT
 * /settings/* (the billing page lives there — upselling on it is noise).
 * Unlimited tiers (Enterprise), complimentary subs and loading states render
 * nothing, so the bar can never block chrome.
 *
 * Slot math comes from the serializer (`remainingMemberSlots`, computed by the
 * PlanRestrictions container server-side) — never local tier arithmetic.
 */
export default function MemberLimitBar() {
  const pathname = usePathname();
  const { data } = useSubscription();

  const sub = data?.subscription;
  if (!sub) return null;
  if (pathname?.startsWith('/settings')) return null;

  const remaining = sub.remainingMemberSlots;
  const limit = sub.memberLimit;
  // Unlimited (Enterprise) or no data -> nothing to show.
  if (remaining === null || limit === null) return null;

  const tierName = TIER_DISPLAY_NAME[sub.subscriptionTier];
  const atLimit = remaining <= 0;
  const nearLimit = !atLimit && remaining <= 5;

  const tone = atLimit
    ? 'border-red-200 bg-red-50 text-red-800'
    : nearLimit
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-gray-200 bg-white text-gray-600';

  return (
    <div
      data-testid="member-limit-bar"
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 lg:px-8 ${tone}`}
    >
      <p className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
        {atLimit ? (
          <span>
            <span className="font-semibold">Member limit reached</span> ({limit} of {limit} on the{' '}
            {tierName} plan)
          </span>
        ) : (
          <span>
            <span className="font-semibold">
              {remaining} of {limit}
            </span>{' '}
            member slots left on the {tierName} plan
          </span>
        )}
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
        Upgrade
      </Link>
    </div>
  );
}
