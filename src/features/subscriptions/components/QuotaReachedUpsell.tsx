'use client'

import Link from 'next/link'
import { Button } from '@/components/ui'
import { Users } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import {
  SaasTier,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig'

/**
 * Next tier to upsell from the capped tier: Lite (100) -> Pro (unlimited).
 * Pro/Enterprise are uncapped and can never trigger a quota upsell.
 */
const NEXT_TIER: Partial<Record<SaasTier, SaasTier>> = {
  [SaasTier.Lite]: SaasTier.Pro,
}

/**
 * Inline upsell rendered when member registration hits the current tier's cap
 * (403 MEMBER_LIMIT_REACHED — plan §5.4 flow 3). Only Lite is capped, so the
 * upsell always targets Pro (removes the cap). Consumed by the members
 * feature via this feature's public index.
 */
export default function QuotaReachedUpsell() {
  const { data } = useSubscription()
  const sub = data?.subscription

  const tier = sub?.subscriptionTier ?? SaasTier.Lite
  const limit = sub?.memberLimit ?? null
  const nextTier = NEXT_TIER[tier] ?? SaasTier.Pro
  const nextName = TIER_DISPLAY_NAME[nextTier]

  return (
    <div
      className="bg-accentui-bg border border-accentui-border rounded-lg p-4"
      role="alert"
      data-testid="quota-reached-upsell"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-surface-card rounded-lg shrink-0">
          <Users className="h-5 w-5 text-brand-link" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">
            {TIER_DISPLAY_NAME[tier]} plan active-member limit reached
            {limit !== null
              ? ` (${sub?.memberCount ?? limit}/${limit} active members)`
              : ''}
          </p>
          <p className="text-sm text-ink-secondary">
            Only active members count — expired, suspended and cancelled members
            are unlimited and unaffected. Upgrade to {nextName} for unlimited
            active members — billed monthly, cancel anytime.
          </p>
          <Button asChild size="sm" variant="accent">
            <Link href="/settings/billing">Upgrade to {nextName}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
