'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { SaasStatus, SaasTier, STARTER_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '../types';

interface PricingTableProps {
  subscription: SerializedSubscription;
  /** Monthly Growth price in LKR, rendered from public config */
  proPriceLkr?: number | null;
  onUpgrade: () => void;
}

const FREE_FEATURES = [
  `Up to ${STARTER_TIER_MEMBER_LIMIT} members`,
  'Payment collection & SMS reminders',
  'Revenue analytics',
];

const PRO_FEATURES = [
  'Unlimited members',
  'Everything in Starter',
  'Billed monthly via PayHere — cancel anytime',
];

/**
 * Starter vs Growth comparison (plan §5.2). CTA state follows §5.3:
 * pro/active and pro/past_due cannot start a second checkout.
 */
export default function PricingTable({ subscription: sub, proPriceLkr, onUpgrade }: PricingTableProps) {
  const isPro = sub.subscriptionTier === SaasTier.Growth;
  const isProActive = isPro && sub.subscriptionStatus === SaasStatus.Active;
  const isPastDue = isPro && sub.subscriptionStatus === SaasStatus.PastDue;
  const canUpgrade = !isProActive && !isPastDue;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className={!isPro ? 'border-blue-200' : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Starter</CardTitle>
            {!isPro && (
              <Badge className="border-transparent bg-blue-100 text-blue-800">Current plan</Badge>
            )}
          </div>
          <p className="text-2xl font-bold">
            Rs. 0<span className="text-sm font-normal text-gray-500"> / month</span>
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className={isPro ? 'border-amber-300' : 'border-amber-200'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Growth</CardTitle>
            {isProActive && (
              <Badge className="border-transparent bg-amber-100 text-amber-800">Current plan</Badge>
            )}
          </div>
          <p className="text-2xl font-bold">
            {proPriceLkr ? `Rs. ${proPriceLkr.toLocaleString()}` : 'Rs. —'}
            <span className="text-sm font-normal text-gray-500"> / month</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={onUpgrade} disabled={!canUpgrade}>
            {isProActive
              ? 'Current plan'
              : isPastDue
                ? 'Resolve payment first'
                : isPro
                  ? 'Re-subscribe to Growth'
                  : 'Upgrade to Growth'}
          </Button>
          {isPastDue && (
            <p className="text-xs text-gray-500">
              Your existing subscription has a failed payment. PayHere will retry — a second
              subscription cannot be started while it is unresolved.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
