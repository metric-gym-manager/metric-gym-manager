'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Crown, Users } from 'lucide-react';
import { SaasStatus, SaasTier } from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '../types';

interface CurrentPlanCardProps {
  subscription: SerializedSubscription;
  onUpgradeClick: () => void;
  onCancelClick: () => void;
}

function statusBadge(sub: SerializedSubscription) {
  if (sub.subscriptionTier === SaasTier.Pro) {
    switch (sub.subscriptionStatus) {
      case SaasStatus.Active:
        return <Badge className="border-transparent bg-green-100 text-green-800">Active</Badge>;
      case SaasStatus.PastDue:
        return <Badge className="border-transparent bg-amber-100 text-amber-800">Past due</Badge>;
      case SaasStatus.Canceled:
        return <Badge className="border-transparent bg-gray-100 text-gray-800">Canceled</Badge>;
    }
  }
  return null;
}

/**
 * Current plan & usage panel (plan §5.3 state-to-UI mapping).
 */
export default function CurrentPlanCard({
  subscription: sub,
  onUpgradeClick,
  onCancelClick,
}: CurrentPlanCardProps) {
  const isPro = sub.subscriptionTier === SaasTier.Pro;
  const isFree = !isPro;
  const overLimit = isFree && sub.memberLimit !== null && sub.memberCount > sub.memberLimit;
  const atLimit = isFree && sub.memberLimit !== null && sub.memberCount >= sub.memberLimit;
  const usagePercent =
    isFree && sub.memberLimit ? Math.min((sub.memberCount / sub.memberLimit) * 100, 100) : 0;

  const showCancel = isPro && sub.subscriptionStatus !== SaasStatus.Canceled;
  const proCanceled = isPro && sub.subscriptionStatus === SaasStatus.Canceled;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isPro && <Crown className="h-5 w-5 text-amber-500" />}
            {isPro ? 'Pro Plan' : 'Free Plan'}
          </CardTitle>
          {statusBadge(sub)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              Members
            </span>
            <span className={overLimit ? 'font-semibold text-red-600' : 'font-semibold'}>
              {sub.memberCount}
              {sub.memberLimit !== null ? ` / ${sub.memberLimit}` : ' — unlimited'}
            </span>
          </div>
          {isFree && sub.memberLimit !== null && (
            <Progress
              value={usagePercent}
              className={atLimit ? '[&>div]:bg-red-500' : undefined}
            />
          )}
        </div>

        {/* Period / state explanation */}
        {isPro && sub.subscriptionStatus === SaasStatus.Active && sub.currentPeriodEnd && (
          <p className="text-sm text-gray-600">
            Renews on <span className="font-medium">{sub.currentPeriodEnd}</span>.
          </p>
        )}
        {proCanceled && (
          <p className="text-sm text-gray-600">
            Subscription canceled — Pro features continue until{' '}
            <span className="font-medium">{sub.currentPeriodEnd ?? 'the end of the paid period'}</span>,
            then your account reverts to the Free plan.
          </p>
        )}
        {overLimit && (
          <p className="text-sm text-gray-600">
            You have more members than the Free limit allows. Existing members are kept and stay
            fully manageable — adding <span className="font-medium">new</span> members needs Pro.
          </p>
        )}

        {/* Contextual CTA */}
        <div className="flex gap-2 pt-2">
          {(isFree || proCanceled) && (
            <Button onClick={onUpgradeClick}>
              {proCanceled || overLimit ? 'Re-subscribe to Pro' : 'Upgrade to Pro'}
            </Button>
          )}
          {showCancel && (
            <Button variant="outline" onClick={onCancelClick} className="text-red-600">
              Cancel subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
