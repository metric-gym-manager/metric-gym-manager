'use client'

import Link from 'next/link'
import { Modal, Button } from '@/components/ui'
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

interface ReactivationLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Pop-up shown when reactivating (or collecting payment to reactivate) a
 * non-active member is blocked by the active-member quota — the API returns
 * 403 MEMBER_LIMIT_REACHED because the gym is already at its active-member
 * limit.
 *
 * Distinct from QuotaReachedUpsell (the inline add-member panel): this is a
 * modal interruption on an existing member's detail view. It states plainly
 * that only active members count and points to the upgrade.
 */
export default function ReactivationLimitDialog({
  open,
  onOpenChange,
}: ReactivationLimitDialogProps) {
  const { data } = useSubscription()
  const sub = data?.subscription

  const tier = sub?.subscriptionTier ?? SaasTier.Lite
  const limit = sub?.memberLimit ?? null
  const nextTier = NEXT_TIER[tier] ?? SaasTier.Pro
  const nextName = TIER_DISPLAY_NAME[nextTier]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Active member limit reached"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild variant="accent">
            <Link href="/settings/billing">Upgrade to {nextName}</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-secondary">
        <p>
          Your {TIER_DISPLAY_NAME[tier]} plan allows
          {limit !== null ? ` ${limit}` : ''} active members
          {limit !== null ? ' and they are all in use' : ''}. Reactivating this
          member would put you over the limit, so it was not applied and nothing
          was charged.
        </p>
        <p>
          Only members with <span className="font-medium text-ink">active</span>{' '}
          status count toward your limit — expired, suspended and cancelled
          members are unlimited. Upgrade to {nextName} to reactivate more
          members.
        </p>
      </div>
    </Modal>
  )
}
