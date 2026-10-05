'use client'

import { ConfirmDialog } from '@/components/common/composites'
import { TIER_DISPLAY_NAME } from '@/features/subscriptions/config/SubscriptionConfig'
import { useCancelSubscription } from '../hooks/useCancelSubscription'
import type { SerializedSubscription } from '../types'
import { formatDate } from '@/utils/date/date'

interface CancelSubscriptionDialogProps {
  open: boolean
  onClose: () => void
  subscription: SerializedSubscription
}

/**
 * Cancel confirmation with full consequence disclosure (plan §5.4 flow 4).
 * Composes the DS `ConfirmDialog` (Layer 3) in its destructive variant.
 */
export default function CancelSubscriptionDialog({
  open,
  onClose,
  subscription: sub,
}: CancelSubscriptionDialogProps) {
  const cancel = useCancelSubscription()
  const tierName = TIER_DISPLAY_NAME[sub.subscriptionTier]

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !cancel.isPending && onClose()}
      title={`Cancel your ${tierName} subscription?`}
      confirmLabel="Cancel subscription"
      cancelLabel={`Keep ${tierName}`}
      destructive
      onConfirm={async () => {
        // Mutation hook surfaces its own error handling; swallow here so the
        // dialog closes on settle (matching the previous onSettled behavior).
        try {
          await cancel.mutateAsync()
        } catch {
          /* handled by the mutation's onError */
        }
      }}
    >
      <ul className="list-disc pl-5 space-y-1 text-sm text-ink-secondary">
        <li>
          You keep {tierName} features until{' '}
          <span className="font-semibold text-ink">
            {sub.currentPeriodEnd
              ? formatDate(sub.currentPeriodEnd)
              : 'the end of the current paid period'}
          </span>
          .
        </li>
        <li>
          After that, your account is{' '}
          <span className="font-semibold text-ink">suspended</span> until you
          subscribe again — no new or reactivated members while suspended.
        </li>
        <li>Your {sub.memberCount} members and all data are kept.</li>
        <li>No further charges will be made.</li>
        <li>
          This cannot be undone from here — re-subscribing starts a new billing
          cycle.
        </li>
      </ul>
    </ConfirmDialog>
  )
}
