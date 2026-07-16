'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import PaymentRemindersTable from '@/features/payments/components/PaymentRemindersTable';

const RegularPaymentTable = dynamic(
  () => import('@/features/payments/components/RegularPaymentTable'),
  {
    loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
  }
);

const PaymentCollectedTable = dynamic(
  () => import('@/features/payments/components/PaymentCollectedTable'),
  {
    loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
  }
);

type Tab = 'reminders' | 'dues' | 'collected';

export default function PaymentCollectionPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('collected');

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('collected')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'collected'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Collected
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dues')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dues'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Dues
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reminders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reminders'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Reminders
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'dues' && <RegularPaymentTable />}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">About Reminders:</span> SMS reminders are sent automatically based on your schedule (7 days, 3 days, and due date). You can also send manual reminders at any time using the &quot;Send Reminder&quot; button.
            </p>
          </div>
          <PaymentRemindersTable />
        </div>
      )}
      {activeTab === 'collected' && <PaymentCollectedTable />}
    </>
  );
}
