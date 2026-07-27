'use client'

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Badge,
  Progress,
  Button,
} from '@/components/ui'
import { Crown, Users, Sparkles } from 'lucide-react'
import {
  SaasStatus,
  SaasTier,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig'
import type { SerializedSubscription } from '../types'

interface CurrentPlanCardProps {
  subscription: SerializedSubscription
  /** Open the upgrade dialog for the chosen tier. */
  onUpgradeClick: (tier: SaasTier) => void
  onCancelClick: () => void
}

function statusBadge(sub: SerializedSubscription) {
  if (sub.isComplimentary) {
    return <Badge variant="accent">Lifetime</Badge>
  }
  switch (sub.subscriptionStatus) {
    case SaasStatus.Trialing:
      return <Badge variant="accent">Trial</Badge>
    case SaasStatus.Active:
      return <Badge variant="success">Active</Badge>
    case SaasStatus.PastDue:
      return <Badge variant="warning">Past due</Badge>
    case SaasStatus.Suspended:
      return <Badge variant="error">Suspended</Badge>
    case SaasStatus.Canceled:
      return <Badge variant="neutral">Canceled</Badge>
    default:
      return null
  }
}

/**
 * Current plan & usage panel (plan §5.3 state-to-UI mapping) for the
 * paid-only Lite / Pro / Enterprise ladder. Complimentary (lifetime)
 * subscriptions are platform-managed: usage and status show, but every
 * self-service billing control is disabled — never removed.
 */
export default function CurrentPlanCard({
  subscription: sub,
  onUpgradeClick,
  onCancelClick,
}: CurrentPlanCardProps) {
  const tier = sub.subscriptionTier
  const comped = sub.isComplimentary

  // Usage meter renders for the capped tier (Lite 100); Pro/Enterprise are unlimited.
  const capped = sub.memberLimit !== null
  const overLimit = capped && sub.memberCount > sub.memberLimit!
  const atLimit = capped && sub.memberCount >= sub.memberLimit!
  const usagePercent = capped
    ? Math.min((sub.memberCount / sub.memberLimit!) * 100, 100)
    : 0

  const trialing = sub.subscriptionStatus === SaasStatus.Trialing
  const suspended = sub.subscriptionStatus === SaasStatus.Suspended
  const canceled = sub.subscriptionStatus === SaasStatus.Canceled
  // Checkout CTA whenever no live gateway subscription is charging.
  const canCheckout = !comped && (trialing || suspended || canceled)
  // Cancel only for a live, self-managed sub.
  const showCancel =
    !comped &&
    (sub.subscriptionStatus === SaasStatus.Active ||
      sub.subscriptionStatus === SaasStatus.PastDue)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tier === SaasTier.Enterprise ? (
            <Sparkles className="h-5 w-5 text-accentui" />
          ) : (
            <Crown className="h-5 w-5 text-warning" />
          )}
          {TIER_DISPLAY_NAME[tier]} Plan
        </CardTitle>
        {statusBadge(sub)}
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Usage — the quota counts ACTIVE members only */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2 text-ink-secondary">
              <Users className="h-4 w-4" />
              Active members
            </span>
            <span
              className={
                overLimit
                  ? 'font-semibold text-error'
                  : 'font-semibold text-ink'
              }
            >
              {sub.memberCount}
              {sub.memberLimit !== null
                ? ` / ${sub.memberLimit}`
                : ' — unlimited'}
            </span>
          </div>
          {capped && (
            <Progress
              value={usagePercent}
              tone={atLimit ? 'error' : 'accent'}
            />
          )}
          <p className="mt-2 text-xs text-ink-muted">
            Only members with{' '}
            <span className="font-medium text-ink">active</span> status count
            toward your plan limit. Expired, suspended and cancelled members
            never use a slot — keep as many as you like.
          </p>
        </div>

        {/* Period / state explanation */}
        {comped && (
          <p className="text-sm text-ink-secondary">
            Your {TIER_DISPLAY_NAME[tier]} plan is provided by us at no cost and
            never expires. Billing is managed on your behalf.
          </p>
        )}
        {!comped && trialing && (
          <p className="text-sm text-ink-secondary">
            You&apos;re on a free trial with full {TIER_DISPLAY_NAME[tier]}{' '}
            features
            {sub.trialEndsAt && (
              <>
                {' '}
                until{' '}
                <span className="font-medium text-ink">{sub.trialEndsAt}</span>
              </>
            )}
            . Subscribe before it ends to keep your account active.
          </p>
        )}
        {!comped &&
          sub.subscriptionStatus === SaasStatus.Active &&
          sub.currentPeriodEnd && (
            <p className="text-sm text-ink-secondary">
              Renews on{' '}
              <span className="font-medium text-ink">
                {sub.currentPeriodEnd}
              </span>
              .
            </p>
          )}
        {!comped && canceled && (
          <p className="text-sm text-ink-secondary">
            Subscription canceled — {TIER_DISPLAY_NAME[tier]} features continue
            until{' '}
            <span className="font-medium text-ink">
              {sub.currentPeriodEnd ?? 'the end of the paid period'}
            </span>
            , then your account is suspended until payment is received.
          </p>
        )}
        {!comped && suspended && (
          <p className="text-sm text-ink-secondary">
            Your account is{' '}
            <span className="font-medium text-ink">suspended</span> until
            payment is received. Your members and data are untouched — subscribe
            to any plan to pick up right where you left off.
          </p>
        )}
        {overLimit && (
          <p className="text-sm text-ink-secondary">
            You have more active members than the {TIER_DISPLAY_NAME[tier]}{' '}
            limit allows. Existing members are kept and stay fully manageable —
            adding or <span className="font-medium text-ink">reactivating</span>{' '}
            members needs a higher plan.
          </p>
        )}

        {/* Contextual CTA. Comped gyms see everything greyed out (managed by us). */}
        {comped ? (
          <div className="pt-2">
            <Button
              variant="secondary"
              disabled
              title="Your subscription is managed by us"
            >
              Subscription managed by us
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 pt-2">
            {/* Primary CTA (re)subscribes to the CURRENT tier; cross-tier
                changes live in the pricing table below. */}
            {canCheckout && (
              <Button variant="accent" onClick={() => onUpgradeClick(tier)}>
                Subscribe to {TIER_DISPLAY_NAME[tier]}
              </Button>
            )}
            {showCancel && (
              <Button variant="destructive-ghost" onClick={onCancelClick}>
                Cancel subscription
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
