import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { TRIAL_PERIOD_DAYS } from '@/features/subscriptions/config/SubscriptionConfig'

/**
 * Metadata for /register (client page). Indexable and canonicalised; the
 * trial length is the subscriptions feature's constant, not a copy.
 */
export const metadata: Metadata = {
  title: 'Create your gym account',
  description: `Create a Metric Gym OS account for your gym and start a ${TRIAL_PERIOD_DAYS}-day free trial. No payment details needed.`,
  alternates: { canonical: '/register' },
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children
}
