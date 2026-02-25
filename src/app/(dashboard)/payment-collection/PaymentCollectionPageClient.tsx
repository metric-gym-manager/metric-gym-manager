'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ReminderStatusTable from '@/components/payment-collection/ReminderStatusTable';

const InstallmentPaymentsTable = dynamic(
  () => import('@/components/payment-collection/InstallmentPaymentsTable'),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
  }
);
const RegularPaymentTable = dynamic(
  () => import('@/components/payment-collection/RegularPaymentTable'),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" />,
  }
);

type Tab = 'reminders' | 'installments' | 'regular';

export default function PaymentCollectionPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('reminders');

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('reminders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reminders'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          SMS Reminders
        </button>
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
          onClick={() => setActiveTab('installments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'installments'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Installment Collection
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'reminders' && <ReminderStatusTable />}
      {activeTab === 'regular' && <RegularPaymentTable />}
      {activeTab === 'installments' && <InstallmentPaymentsTable />}
    </>
  );
}
