'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SaasTier, TIER_DISPLAY_NAME } from '@/core/utils/constants/SubscriptionConfig';

/** Next paid tier to upsell from a capped tier (Starter -> Growth -> Enterprise). */
const NEXT_TIER: Partial<Record<SaasTier, SaasTier>> = {
  [SaasTier.Starter]: SaasTier.Growth,
  [SaasTier.Growth]: SaasTier.Enterprise,
};

/**
 * Inline upsell rendered when member registration hits the current tier's cap
 * (403 MEMBER_LIMIT_REACHED — plan §5.4 flow 3). Tier-aware: Starter (40) →
 * Growth, Growth (190) → Enterprise (unlimited). Consumed by the members
 * feature via this feature's public index.
 */
export default function QuotaReachedUpsell() {
  const { data } = useSubscription();
  const sub = data?.subscription;

  const tier = sub?.subscriptionTier ?? SaasTier.Starter;
  const limit = sub?.memberLimit ?? null;
  const nextTier = NEXT_TIER[tier] ?? SaasTier.Growth;
  const nextName = TIER_DISPLAY_NAME[nextTier];
  const nextIsUnlimited = nextTier === SaasTier.Enterprise;

  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg p-4"
      role="alert"
      data-testid="quota-reached-upsell"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-lg shrink-0">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-blue-900">
            {TIER_DISPLAY_NAME[tier]} plan limit reached
            {limit !== null
              ? ` (${sub?.memberCount ?? limit}/${limit} members)`
              : ''}
          </p>
          <p className="text-sm text-blue-800">
            Your existing members are unaffected. Upgrade to {nextName} for{' '}
            {nextIsUnlimited ? 'unlimited members' : 'a higher member limit'} — billed monthly,
            cancel anytime.
          </p>
          <Button asChild size="sm">
            <Link href="/settings/billing">Upgrade to {nextName}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
