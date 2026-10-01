'use client'

import { Card, CardBody, CardTitle, Button, Badge } from '@/components/ui'
import { Check } from 'lucide-react'
import {
  SaasStatus,
  SaasTier,
  LITE_TIER_MEMBER_LIMIT,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig'
import type { SerializedSubscription } from '../types'

interface PricingTableProps {
  subscription: SerializedSubscription
  /** Monthly Lite price in LKR, from public config */
  litePriceLkr?: number | null
  /** Monthly Pro price in LKR, from public config */
  proPriceLkr?: number | null
  /** Monthly Enterprise price in LKR, from public config */
  enterprisePriceLkr?: number | null
  /** Open the upgrade dialog for the chosen tier. */
  onUpgrade: (tier: SaasTier) => void
}

interface PriceInputs {
  litePriceLkr?: number | null
  proPriceLkr?: number | null
  enterprisePriceLkr?: number | null
}

interface Column {
  tier: SaasTier
  priceLabel: (p: PriceInputs) => string
  features: string[]
  /** Highlight border applied when this tier is the current plan. */
  accent: string
}

const price = (v: number | null | undefined): string =>
  v ? `Rs. ${v.toLocaleString()}` : 'Rs. —'

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
    accent: 'border-accentui-border',
  },
  {
    tier: SaasTier.Pro,
    priceLabel: ({ proPriceLkr }) => price(proPriceLkr),
    features: ['Unlimited active members', 'Everything in Lite'],
    accent: 'border-warning-border',
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
    accent: 'border-accentui-border',
  },
]

/**
 * Lite / Pro / Enterprise comparison (plan §5.2). CTA state per §5.3:
 *
 * - Active WITH a saved card: other tiers get a live one-click "Switch to X"
 *   CTA — the dialog charges the stored token and the change applies
 *   immediately (unused days banked, C-33).
 * - Active WITHOUT a saved card (legacy recurring): a plan change still
 *   requires cancelling first (PayHere has no in-place swap on recurring
 *   subscriptions) — CTAs disabled with the explanation.
 * - past_due blocks everything until the payment resolves.
 * - Complimentary subscriptions show no purchase CTAs (platform-managed).
 * - Trialing/suspended/canceled accounts can buy into any tier.
 */
export default function PricingTable({
  subscription: sub,
  litePriceLkr,
  proPriceLkr,
  enterprisePriceLkr,
  onUpgrade,
}: PricingTableProps) {
  const currentTier = sub.subscriptionTier
  const active = sub.subscriptionStatus === SaasStatus.Active
  const pastDue = sub.subscriptionStatus === SaasStatus.PastDue
  // One-click switching needs a stored card token; without one, a live
  // subscription blocks new checkouts (must cancel to change).
  const canInstantChange = active && sub.hasSavedCard && !sub.isComplimentary
  const blocked = (active && !canInstantChange) || pastDue

  function cta(tier: SaasTier) {
    const isCurrent = currentTier === tier && active

    if (sub.isComplimentary) {
      return (
        <Button variant="secondary" className="w-full" disabled>
          {isCurrent ? 'Current plan' : 'Managed by us'}
        </Button>
      )
    }
    if (isCurrent) {
      return (
        <Button variant="secondary" className="w-full" disabled>
          Current plan
        </Button>
      )
    }
    if (pastDue) {
      return (
        <Button variant="secondary" className="w-full" disabled>
          Resolve payment first
        </Button>
      )
    }
    const label = canInstantChange
      ? `Switch to ${TIER_DISPLAY_NAME[tier]}`
      : currentTier === tier
        ? `Subscribe to ${TIER_DISPLAY_NAME[tier]}`
        : `Upgrade to ${TIER_DISPLAY_NAME[tier]}`
    return (
      <Button
        variant="accent"
        className="w-full"
        onClick={() => onUpgrade(tier)}
        disabled={blocked}
        title={
          blocked
            ? 'Cancel your current subscription before changing plans'
            : undefined
        }
      >
        {label}
      </Button>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const isCurrent = currentTier === col.tier && active
        return (
          <Card key={col.tier} className={isCurrent ? col.accent : undefined}>
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <CardTitle>{TIER_DISPLAY_NAME[col.tier]}</CardTitle>
                {isCurrent && (
                  <Badge variant="accent">
                    {sub.isComplimentary ? 'Lifetime' : 'Current plan'}
                  </Badge>
                )}
              </div>
              <p className="text-readout text-ink">
                {col.priceLabel({
                  litePriceLkr,
                  proPriceLkr,
                  enterprisePriceLkr,
                })}
                <span className="text-sm font-normal text-ink-muted">
                  {' '}
                  / month
                </span>
              </p>
            </div>
            <CardBody className="space-y-4 pt-0">
              <ul className="space-y-2">
                {col.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-ink-secondary"
                  >
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              {cta(col.tier)}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
