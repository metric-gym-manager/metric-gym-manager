'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lock, ArrowUpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useSubscription } from '../hooks/useSubscription';
import type { RestrictedFeature } from '@/core/domain/subscription/PlanRestrictions';
import { SaasTier, TIER_DISPLAY_NAME } from '@/core/utils/constants/SubscriptionConfig';

interface FeatureGateProps {
  /** Capability key from the PlanRestrictions matrix. */
  feature: RestrictedFeature;
  /** Human name shown in the upgrade panel ("Announcements", ...). */
  featureLabel: string;
  /** Optional extra line under the headline. */
  description?: string;
  children: ReactNode;
}

/**
 * Client-side gate for plan-restricted pages/sections. Reads the
 * server-computed `capabilities` from the subscription serializer — never
 * local tier math — and renders the upgrade panel instead of the feature for
 * plans that lack it.
 *
 * UX layer only: every gated feature MUST also be enforced at its API/cron
 * entry point (e.g. POST /api/announcements returns 403 FEATURE_NOT_AVAILABLE).
 */
export default function FeatureGate({
  feature,
  featureLabel,
  description,
  children,
}: FeatureGateProps) {
  const { data, isLoading } = useSubscription();

  // No flash of a restricted feature while the subscription loads.
  if (isLoading || !data?.subscription) return null;

  if (data.subscription.capabilities[feature]) {
    return <>{children}</>;
  }

  const growth = TIER_DISPLAY_NAME[SaasTier.Growth];

  return (
    <Card
      data-testid="feature-gate-upsell"
      className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-4 p-8 text-center"
    >
      <div className="rounded-full bg-blue-100 p-3">
        <Lock className="h-6 w-6 text-blue-600" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {featureLabel} is a {growth} feature
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Upgrade to use this feature.
          {description ? ` ${description}` : ''}
        </p>
      </div>
      <Link
        href="/settings/billing"
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
        Upgrade to {growth}
      </Link>
    </Card>
  );
}
