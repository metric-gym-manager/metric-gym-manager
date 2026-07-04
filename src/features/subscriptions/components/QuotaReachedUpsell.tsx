'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { FREE_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';

interface QuotaReachedUpsellProps {
  /** Current member count, when known (defaults to the limit copy) */
  memberCount?: number;
}

/**
 * Inline upsell rendered when member registration hits the Free-tier limit
 * (403 MEMBER_LIMIT_REACHED — plan §5.4 flow 3). Consumed by the members
 * feature via this feature's public index.
 */
export default function QuotaReachedUpsell({ memberCount }: QuotaReachedUpsellProps) {
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
            Free plan limit reached
            {typeof memberCount === 'number'
              ? ` (${memberCount}/${FREE_TIER_MEMBER_LIMIT} members)`
              : ` (${FREE_TIER_MEMBER_LIMIT}-member limit)`}
          </p>
          <p className="text-sm text-blue-800">
            Your existing members are unaffected. Upgrade to Pro for unlimited members — billed
            monthly, cancel anytime.
          </p>
          <Button asChild size="sm">
            <Link href="/settings/billing">Upgrade to Pro</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
