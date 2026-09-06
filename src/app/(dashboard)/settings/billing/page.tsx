import { Metadata } from 'next'
import { Suspense } from 'react'
import BillingPageClient from './BillingPageClient'

export const metadata: Metadata = {
  title: 'Subscription | Settings',
  description: 'Manage your gym management plan, billing and invoices',
}

/**
 * Subscription & billing page (Settings sub-page).
 * Suspense boundary: BillingPageClient reads useSearchParams (PayHere return flow).
 */
export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <p className="text-caption text-ink-muted">Loading subscription…</p>
        </div>
      }
    >
      <BillingPageClient />
    </Suspense>
  )
}
