'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy load tab content for better performance
const PlanTypesTab = dynamic(() => import('./PlanTypesTab'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
});

const DiscountsTab = dynamic(() => import('./DiscountsTab'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
});

type Tab = 'plans' | 'discounts';

export default function BillingSetupPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');

  return (
    <>
      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Billing Setup">
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'plans'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Plan Types
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discounts')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'discounts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Discounts
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'plans' && <PlanTypesTab />}
        {activeTab === 'discounts' && <DiscountsTab />}
      </div>
    </>
  );
}
