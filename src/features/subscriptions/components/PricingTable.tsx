'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import {
  SaasStatus,
  SaasTier,
  LITE_TIER_MEMBER_LIMIT,
  TIER_DISPLAY_NAME,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '../types';

interface PricingTableProps {
  subscription: SerializedSubscription;
  /** Monthly Lite price in LKR, from public config */
  litePriceLkr?: number | null;
  /** Monthly Pro price in LKR, from public config */
  proPriceLkr?: number | null;
  /** Monthly Enterprise price in LKR, from public config */
  enterprisePriceLkr?: number | null;
  /** Open the upgrade dialog for the chosen tier. */
  onUpgrade: (tier: SaasTier) => void;
}

interface PriceInputs {
  litePriceLkr?: number | null;
  proPriceLkr?: number | null;
  enterprisePriceLkr?: number | null;
}

interface Column {
  tier: SaasTier;
  priceLabel: (p: PriceInputs) => string;
  features: string[];
  accent: string;
}

const price = (v: number | null | undefined): string =>
  v ? `Rs. ${v.toLocaleString()}` : 'Rs. —';

/** All three tiers are paid and carry a CTA — there is no free / no-CTA column. */
const COLUMNS: Column[] = [
  {
    tier: SaasTier.Lite,
    priceLabel: ({ litePriceLkr }) => price(litePriceLkr),
    features: [
      `Up to ${LITE_TIER_MEMBER_LIMIT} active members`,
      'Payment collection & manual receipts',
      'Revenue analytics',
      'Automated SMS reminders',
      'Bulk SMS announcements',
    ],
    accent: 'border-blue-200',
  },
  {
    tier: SaasTier.Pro,
    priceLabel: ({ proPriceLkr }) => price(proPriceLkr),
    features: ['Unlimited active members', 'Everything in Lite'],
    accent: 'border-amber-300',
  },
  {
    tier: SaasTier.Enterprise,
    priceLabel: ({ enterprisePriceLkr }) => price(enterprisePriceLkr),
    features: [
      'Unlimited active members',
      'Everything in Pro',
      'Access-control hardware support',
      'Priority support',
    ],
    accent: 'border-purple-300',
  },
];

/**
 * Lite / Pro / Enterprise comparison (plan §5.2). CTA state per §5.3:
 * an active or past-due subscription cannot start a second checkout
 * (a plan change requires cancelling first). Complimentary subscriptions
 * show no purchase CTAs (platform-managed). Trialing/suspended/canceled
 * accounts can check out into any tier.
 */
export default function PricingTable({
  subscription: sub,
  litePriceLkr,
  proPriceLkr,
  enterprisePriceLkr,
  onUpgrade,
}: PricingTableProps) {
  const currentTier = sub.subscriptionTier;
  const active = sub.subscriptionStatus === SaasStatus.Active;
  const pastDue = sub.subscriptionStatus === SaasStatus.PastDue;
  // A live subscription blocks any new checkout (must cancel to change).
  const hasLiveSub = active || pastDue;

  function cta(tier: SaasTier) {
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
    const label =
      currentTier === tier
        ? `Subscribe to ${TIER_DISPLAY_NAME[tier]}`
        : `Upgrade to ${TIER_DISPLAY_NAME[tier]}`;
    return (
      <Button
        className="w-full"
        onClick={() => onUpgrade(tier)}
        disabled={hasLiveSub}
        title={hasLiveSub ? 'Cancel your current subscription before changing plans' : undefined}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const isCurrent = currentTier === col.tier && active;
        return (
          <Card key={col.tier} className={isCurrent ? col.accent : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{TIER_DISPLAY_NAME[col.tier]}</CardTitle>
                {isCurrent && (
                  <Badge className="border-transparent bg-blue-100 text-blue-800">
                    {sub.isComplimentary ? 'Lifetime' : 'Current plan'}
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold">
                {col.priceLabel({ litePriceLkr, proPriceLkr, enterprisePriceLkr })}
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
