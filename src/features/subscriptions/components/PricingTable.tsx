'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import {
  SaasStatus,
  SaasTier,
  STARTER_TIER_MEMBER_LIMIT,
  GROWTH_TIER_MEMBER_LIMIT,
  TIER_DISPLAY_NAME,
  type PaidTier,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '../types';

interface PricingTableProps {
  subscription: SerializedSubscription;
  /** Monthly Growth price in LKR, from public config */
  proPriceLkr?: number | null;
  /** Monthly Enterprise price in LKR, from public config */
  enterprisePriceLkr?: number | null;
  /** Open the upgrade dialog for the chosen paid tier. */
  onUpgrade: (tier: PaidTier) => void;
}

interface Column {
  tier: SaasTier;
  priceLabel: (p: { proPriceLkr?: number | null; enterprisePriceLkr?: number | null }) => string;
  features: string[];
  accent: string;
}

const COLUMNS: Column[] = [
  {
    tier: SaasTier.Starter,
    priceLabel: () => 'Rs. 0',
    features: [
      `Up to ${STARTER_TIER_MEMBER_LIMIT} active members`,
      'Payment collection & manual receipts',
      'Revenue analytics',
    ],
    accent: 'border-blue-200',
  },
  {
    tier: SaasTier.Growth,
    priceLabel: ({ proPriceLkr }) => (proPriceLkr ? `Rs. ${proPriceLkr.toLocaleString()}` : 'Rs. —'),
    features: [
      `Up to ${GROWTH_TIER_MEMBER_LIMIT} active members`,
      'Everything in Starter',
      'Automated SMS reminders',
      'Bulk SMS announcements',
    ],
    accent: 'border-amber-300',
  },
  {
    tier: SaasTier.Enterprise,
    priceLabel: ({ enterprisePriceLkr }) =>
      enterprisePriceLkr ? `Rs. ${enterprisePriceLkr.toLocaleString()}` : 'Rs. —',
    features: ['Unlimited active members', 'Everything in Growth', 'Priority support'],
    accent: 'border-purple-300',
  },
];

/**
 * Starter / Growth / Enterprise comparison (plan §5.2). CTA state per §5.3:
 * an active or past-due paid subscription cannot start a second checkout
 * (a plan change requires cancelling first). Complimentary subscriptions
 * show no purchase CTAs (platform-managed).
 */
export default function PricingTable({
  subscription: sub,
  proPriceLkr,
  enterprisePriceLkr,
  onUpgrade,
}: PricingTableProps) {
  const currentTier = sub.subscriptionTier;
  const active = sub.subscriptionStatus === SaasStatus.Active;
  const pastDue = sub.subscriptionStatus === SaasStatus.PastDue;
  // A live paid subscription blocks any new checkout (must cancel to change).
  const hasLivePaidSub = (currentTier === SaasTier.Growth || currentTier === SaasTier.Enterprise) &&
    (active || pastDue);

  function cta(tier: SaasTier) {
    if (tier === SaasTier.Starter) return null;
    const paidTier = tier as PaidTier;
    const isCurrent = currentTier === tier && active;

    if (sub.isComplimentary) {
      return (
        <Button className="w-full" disabled>
          {isCurrent ? 'Current plan' : 'Managed by us'}
        </Button>
      );
    }
    if (isCurrent) {
      return (
        <Button className="w-full" disabled>
          Current plan
        </Button>
      );
    }
    if (currentTier === tier && pastDue) {
      return (
        <Button className="w-full" disabled>
          Resolve payment first
        </Button>
      );
    }
    // Different paid tier while a live sub exists -> must cancel first
    const label = currentTier === tier ? `Re-subscribe to ${TIER_DISPLAY_NAME[tier]}` : `Upgrade to ${TIER_DISPLAY_NAME[tier]}`;
    return (
      <Button
        className="w-full"
        onClick={() => onUpgrade(paidTier)}
        disabled={hasLivePaidSub}
        title={hasLivePaidSub ? 'Cancel your current subscription before changing plans' : undefined}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const isCurrent = currentTier === col.tier && (col.tier === SaasTier.Starter || active);
        return (
          <Card key={col.tier} className={isCurrent ? col.accent : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{TIER_DISPLAY_NAME[col.tier]}</CardTitle>
                {isCurrent && (
                  <Badge className="border-transparent bg-blue-100 text-blue-800">
                    {sub.isComplimentary && col.tier !== SaasTier.Starter ? 'Lifetime' : 'Current plan'}
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold">
                {col.priceLabel({ proPriceLkr, enterprisePriceLkr })}
                <span className="text-sm font-normal text-gray-500"> / month</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {col.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              {cta(col.tier)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
