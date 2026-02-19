'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReminderStatusTable from '@/components/payment-collection/ReminderStatusTable';
import InstallmentPaymentsTable from '@/components/payment-collection/InstallmentPaymentsTable';
import RegularPaymentTable from '@/components/payment-collection/RegularPaymentTable';

type Tab = 'reminders' | 'installments' | 'regular';

export default function PaymentCollectionPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('reminders');

  const handleMemberClick = (memberId: string) => {
    router.push(`/members?memberId=${memberId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Collection</h1>
        <p className="text-sm text-gray-600 mt-1">
          Track payment reminders, SMS delivery status, and installment collection
        </p>
      </div>

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
      {activeTab === 'reminders' && (
        <ReminderStatusTable onMemberClick={handleMemberClick} />
      )}
      {activeTab === 'regular' && (
        <RegularPaymentTable onMemberClick={handleMemberClick} />
      )}
      {activeTab === 'installments' && (
        <InstallmentPaymentsTable onMemberClick={handleMemberClick} />
      )}
    </div>
  );
}
