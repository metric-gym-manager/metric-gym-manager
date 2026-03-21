'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import PaymentRemindersTable from '@/components/payment-collection/PaymentRemindersTable';

const RegularPaymentTable = dynamic(
  () => import('@/components/payment-collection/RegularPaymentTable'),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
  }
);

type Tab = 'reminders' | 'regular';

export default function PaymentCollectionPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('regular');

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('regular')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'regular'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Regular Payments
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
      {activeTab === 'regular' && <RegularPaymentTable />}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">About Reminders:</span> SMS reminders are sent automatically based on your schedule (7 days, 3 days, and due date). You can also send manual reminders at any time using the "Send Reminder" button.
            </p>
          </div>
          <PaymentRemindersTable />
        </div>
      )}
    </>
  );
}
