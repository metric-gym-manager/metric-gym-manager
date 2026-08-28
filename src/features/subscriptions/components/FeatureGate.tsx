'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lock, ArrowUpCircle } from 'lucide-react'
import { Card, Button } from '@/components/ui'
import { useSubscription } from '../hooks/useSubscription'
import { useIsHydrated } from '@/hooks/useIsHydrated'
import type { RestrictedFeature } from '@/features/subscriptions/domain/PlanRestrictions'
import {
  SaasTier,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig'

interface FeatureGateProps {
  /** Capability key from the PlanRestrictions matrix. */
  feature: RestrictedFeature
  /** Human name shown in the upgrade panel ("Access control", ...). */
  featureLabel: string
  /** Optional extra line under the headline. */
  description?: string
  children: ReactNode
}

/**
 * Client-side gate for plan-restricted pages/sections. Reads the
 * server-computed `capabilities` from the subscription serializer — never
 * local tier math — and renders the upgrade panel instead of the feature for
 * plans that lack it.
 *
 * With the paid-only ladder the only tier-gated capability left is
 * `accessControlHardware` (Enterprise); `automatedReminders`/`announcements`
 * are true on every tier, so this gate passes them through unchanged. The
 * member CAP has its own surfaces (MemberLimitBar, QuotaReachedUpsell —
 * upsell target Pro).
 *
 * UX layer only: every gated feature MUST also be enforced at its API/cron
 * entry point.
 */
export default function FeatureGate({
  feature,
  featureLabel,
  description,
  children,
}: FeatureGateProps) {
  const { data, isLoading } = useSubscription()
  const hydrated = useIsHydrated()

  // No flash of a restricted feature while the subscription loads.
  //
  // `hydrated` is load-bearing, not belt-and-braces. This gate decides the
  // *shape* of the tree — nothing, the children, or the upsell — from query
  // state, and query state is not guaranteed to be identical on the server and
  // in the hydrating client render. When it differs, React finds one subtree
  // where it rendered another, discards it and remounts: on
  // /settings/access-control that surfaced as a mismatch between the children
  // and a Suspense placeholder. Holding the first client render to what the
  // server produced makes the two agree by construction, and the real decision
  // lands on the very next render. A gate that renders a different structure
  // before its data arrives has to be pinned this way.
  if (!hydrated || isLoading || !data?.subscription) return null

  if (data.subscription.capabilities[feature]) {
    return <>{children}</>
  }

  // Hardware support is the Enterprise differentiator; everything else
  // (the member cap) upsells to Pro.
  const upsellTier =
    feature === 'accessControlHardware' ? SaasTier.Enterprise : SaasTier.Pro
  const upsellName = TIER_DISPLAY_NAME[upsellTier]

  return (
    <Card
      data-testid="feature-gate-upsell"
      className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-4 p-8 text-center"
    >
      <div className="rounded-full bg-accentui-bg p-3">
        <Lock className="h-6 w-6 text-brand-link" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink">
          {featureLabel} is a {upsellName} feature
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Upgrade to use this feature.
          {description ? ` ${description}` : ''}
        </p>
      </div>
      <Button asChild variant="accent">
        <Link href="/settings/billing">
          <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
          Upgrade to {upsellName}
        </Link>
      </Button>
    </Card>
  )
}
