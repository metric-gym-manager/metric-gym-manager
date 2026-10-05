'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  RecurringFailureClass,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig'
import type { SerializedSubscription } from '../types'
import { formatDate } from '@/utils/date/date'

interface PastDueBannerProps {
  subscription: SerializedSubscription
}

/**
 * Past-due banner with grace countdown. Copy branches on the sanitized
 * failure class (plan C-22): retriable = PayHere retries; hard = no retry
 * is coming. Raw gateway messages never reach this surface.
 */
export default function PastDueBanner({
  subscription: sub,
}: PastDueBannerProps) {
  const graceEndsAt = sub.graceEndsAt

  // Clock read scheduled asynchronously (not during render, not synchronously
  // in the effect): keeps render pure, satisfies react-hooks/set-state-in-effect,
  // and avoids an SSR/client hydration mismatch on the countdown.
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDaysLeft(
        graceEndsAt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(graceEndsAt).getTime() - Date.now()) /
                  (24 * 60 * 60 * 1000)
              )
            )
          : null
      )
    }, 0)
    return () => clearTimeout(timer)
  }, [graceEndsAt])

  const isHard = sub.pastDueReason === RecurringFailureClass.Hard

  return (
    <div
      className="border border-warning-border bg-warning-bg p-3"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-warning">
            {isHard ? 'Payment method declined' : 'Payment failed'}
          </p>
          <p className="text-sm text-warning mt-1">
            {isHard
              ? 'Your payment method was declined and won’t be retried automatically. '
              : 'PayHere will retry the charge automatically — make sure your card has funds. '}
            {TIER_DISPLAY_NAME[sub.subscriptionTier]} features continue until{' '}
            <span className="font-semibold">
              {graceEndsAt
                ? formatDate(graceEndsAt)
                : 'the end of the grace period'}
            </span>
            {daysLeft !== null && (
              <>
                {' '}
                ({daysLeft} {daysLeft === 1 ? 'day' : 'days'} left)
              </>
            )}
            {isHard &&
              ' — re-subscribe before then to avoid your account being suspended'}
            .
          </p>
        </div>
      </div>
    </div>
  )
}
