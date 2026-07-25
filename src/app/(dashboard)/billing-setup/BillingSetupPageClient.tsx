'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

// Full-CRUD tab bodies (plan-type + discount management) are preserved as-is
// and rendered inside the App Workspace frame (heading + mws tab bar).
const PlanTypesTab = dynamic(() => import('./PlanTypesTab'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 240 }}
      className="animate-pulse rounded bg-gray-100"
    />
  ),
})
const DiscountsTab = dynamic(() => import('./DiscountsTab'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 240 }}
      className="animate-pulse rounded bg-gray-100"
    />
  ),
})
const AdmissionFeeTab = dynamic(() => import('./AdmissionFeeTab'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 240 }}
      className="animate-pulse rounded bg-gray-100"
    />
  ),
})

type Tab = 'plans' | 'discounts' | 'admission-fee'

export default function BillingSetupPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('plans')

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1200 }}>
      <div>
        <h1 className="mws-h1">Membership Setup</h1>
        <p className="mws-row-sub" style={{ marginTop: 4 }}>
          Configure membership plan types and discount presets
        </p>
      </div>

      <div
        className="flex"
        style={{ gap: 2, borderBottom: '1px solid var(--mws-b1)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={cn('mws-tab', activeTab === 'plans' && 'mws-tab-active')}
        >
          Plan types
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discounts')}
          className={cn(
            'mws-tab',
            activeTab === 'discounts' && 'mws-tab-active'
          )}
        >
          Discounts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('admission-fee')}
          className={cn(
            'mws-tab',
            activeTab === 'admission-fee' && 'mws-tab-active'
          )}
        >
          Admission fee
        </button>
      </div>

      <div>
        {activeTab === 'plans' && <PlanTypesTab />}
        {activeTab === 'discounts' && <DiscountsTab />}
        {activeTab === 'admission-fee' && <AdmissionFeeTab />}
      </div>
    </div>
  )
}
