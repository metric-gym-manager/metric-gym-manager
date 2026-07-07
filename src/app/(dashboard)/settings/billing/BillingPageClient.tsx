'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { SaasStatus, SaasTier, type PaidTier } from '@/core/utils/constants/SubscriptionConfig';
import CurrentPlanCard from '@/features/subscriptions/components/CurrentPlanCard';
import PricingTable from '@/features/subscriptions/components/PricingTable';
import UpgradeConfirmDialog from '@/features/subscriptions/components/UpgradeConfirmDialog';
import ReturnStatusPanel from '@/features/subscriptions/components/ReturnStatusPanel';
import PastDueBanner from '@/features/subscriptions/components/PastDueBanner';
import CancelSubscriptionDialog from '@/features/subscriptions/components/CancelSubscriptionDialog';
import BillingHistoryTable from '@/features/subscriptions/components/BillingHistoryTable';
import { useSubscription } from '@/features/subscriptions/hooks/useSubscription';
import { usePaymentStatusPoll } from '@/features/subscriptions/hooks/usePaymentStatusPoll';

/**
 * Subscription page under Settings (plan §5). Handles the PayHere return
 * flow (?order= -> verification poll; ?canceled=1 -> canceled panel) and
 * composes plan card, pricing, cancel dialog and billing history.
 */
export default function BillingPageClient() {
  const searchParams = useSearchParams();
  const returnedOrderId = searchParams.get('order');
  const canceledReturn = searchParams.get('canceled') === '1';

  const { data, isLoading, error, refetch } = useSubscription();
  const pollState = usePaymentStatusPoll(Boolean(returnedOrderId));

  const [upgradeTier, setUpgradeTier] = useState<PaidTier | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-500">Loading subscription…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">Could not load your subscription.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  const { subscription, proPriceLkr, enterprisePriceLkr } = data;
  const priceForTier = (tier: PaidTier | null) =>
    tier === SaasTier.Enterprise ? enterprisePriceLkr : proPriceLkr;

  return (
    <div className="space-y-6">
      {(returnedOrderId || canceledReturn) && (
        <ReturnStatusPanel
          pollState={pollState}
          canceled={canceledReturn}
          onRefresh={() => refetch()}
        />
      )}

      {subscription.subscriptionStatus === SaasStatus.PastDue && (
        <PastDueBanner subscription={subscription} />
      )}

      <CurrentPlanCard
        subscription={subscription}
        onUpgradeClick={(tier) => setUpgradeTier(tier)}
        onCancelClick={() => setCancelOpen(true)}
      />

      <PricingTable
        subscription={subscription}
        proPriceLkr={proPriceLkr}
        enterprisePriceLkr={enterprisePriceLkr}
        onUpgrade={(tier) => setUpgradeTier(tier)}
      />

      <BillingHistoryTable />

      <UpgradeConfirmDialog
        open={upgradeTier !== null}
        onClose={() => setUpgradeTier(null)}
        targetTier={upgradeTier ?? SaasTier.Growth}
        priceLkr={priceForTier(upgradeTier)}
      />
      <CancelSubscriptionDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        subscription={subscription}
      />
    </div>
  );
}
