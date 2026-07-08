'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Crown, Users, Sparkles } from 'lucide-react';
import {
  SaasStatus,
  SaasTier,
  TIER_DISPLAY_NAME,
  isPaidTier,
  type PaidTier,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '../types';

interface CurrentPlanCardProps {
  subscription: SerializedSubscription;
  /** Open the upgrade dialog for the chosen paid tier. */
  onUpgradeClick: (tier: PaidTier) => void;
  onCancelClick: () => void;
}

function statusBadge(sub: SerializedSubscription) {
  if (!isPaidTier(sub.subscriptionTier)) return null;
  if (sub.isComplimentary) {
    return (
      <Badge className="border-transparent bg-purple-100 text-purple-800">Lifetime</Badge>
    );
  }
  switch (sub.subscriptionStatus) {
    case SaasStatus.Active:
      return <Badge className="border-transparent bg-green-100 text-green-800">Active</Badge>;
    case SaasStatus.PastDue:
      return <Badge className="border-transparent bg-amber-100 text-amber-800">Past due</Badge>;
    case SaasStatus.Canceled:
      return <Badge className="border-transparent bg-gray-100 text-gray-800">Canceled</Badge>;
    default:
      return null;
  }
}

/**
 * Current plan & usage panel (plan §5.3 state-to-UI mapping), generalized for
 * Starter / Growth / Enterprise. Complimentary (lifetime) subscriptions are
 * platform-managed: usage and status show, but every self-service billing
 * control is disabled — never removed.
 */
export default function CurrentPlanCard({
  subscription: sub,
  onUpgradeClick,
  onCancelClick,
}: CurrentPlanCardProps) {
  const tier = sub.subscriptionTier;
  const paid = isPaidTier(tier);
  const comped = sub.isComplimentary;

  // Usage meter renders for any capped tier (Starter 40, Growth 190).
  const capped = sub.memberLimit !== null;
  const overLimit = capped && sub.memberCount > sub.memberLimit!;
  const atLimit = capped && sub.memberCount >= sub.memberLimit!;
  const usagePercent = capped ? Math.min((sub.memberCount / sub.memberLimit!) * 100, 100) : 0;

  const canceled = paid && sub.subscriptionStatus === SaasStatus.Canceled;
  // Cancel only for a live, self-managed paid sub.
  const showCancel = paid && !comped && sub.subscriptionStatus !== SaasStatus.Canceled;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {tier === SaasTier.Enterprise ? (
              <Sparkles className="h-5 w-5 text-purple-500" />
            ) : (
              paid && <Crown className="h-5 w-5 text-amber-500" />
            )}
            {TIER_DISPLAY_NAME[tier]} Plan
          </CardTitle>
          {statusBadge(sub)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage — the quota counts ACTIVE members only */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              Active members
            </span>
            <span className={overLimit ? 'font-semibold text-red-600' : 'font-semibold'}>
              {sub.memberCount}
              {sub.memberLimit !== null ? ` / ${sub.memberLimit}` : ' — unlimited'}
            </span>
          </div>
          {capped && (
            <Progress value={usagePercent} className={atLimit ? '[&>div]:bg-red-500' : undefined} />
          )}
          <p className="mt-2 text-xs text-gray-500">
            Only members with <span className="font-medium">active</span> status count toward your
            plan limit. Expired, suspended and cancelled members never use a slot — keep as many as
            you like.
          </p>
        </div>

        {/* Period / state explanation */}
        {comped && (
          <p className="text-sm text-gray-600">
            Your {TIER_DISPLAY_NAME[tier]} plan is provided by us at no cost and never expires.
            Billing is managed on your behalf.
          </p>
        )}
        {!comped && paid && sub.subscriptionStatus === SaasStatus.Active && sub.currentPeriodEnd && (
          <p className="text-sm text-gray-600">
            Renews on <span className="font-medium">{sub.currentPeriodEnd}</span>.
          </p>
        )}
        {!comped && canceled && (
          <p className="text-sm text-gray-600">
            Subscription canceled — {TIER_DISPLAY_NAME[tier]} features continue until{' '}
            <span className="font-medium">{sub.currentPeriodEnd ?? 'the end of the paid period'}</span>,
            then your account reverts to the Starter plan.
          </p>
        )}
        {overLimit && (
          <p className="text-sm text-gray-600">
            You have more active members than the {TIER_DISPLAY_NAME[tier]} limit allows. Existing
            members are kept and stay fully manageable — adding or{' '}
            <span className="font-medium">reactivating</span> members needs a higher plan.
          </p>
        )}

        {/* Contextual CTA. Comped gyms see everything greyed out (managed by us). */}
        {comped ? (
          <div className="pt-2">
            <Button variant="outline" disabled title="Your subscription is managed by us">
              Subscription managed by us
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 pt-2">
            {/* Primary CTA to (re)subscribe to Growth; cross-tier upgrades
                (e.g. Growth -> Enterprise) live in the pricing table below. */}
            {(!paid || canceled) && (
              <Button onClick={() => onUpgradeClick(SaasTier.Growth)}>
                {canceled || overLimit ? 'Re-subscribe to Growth' : 'Upgrade to Growth'}
              </Button>
            )}
            {showCancel && (
              <Button variant="outline" onClick={onCancelClick} className="text-red-600">
                Cancel subscription
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
