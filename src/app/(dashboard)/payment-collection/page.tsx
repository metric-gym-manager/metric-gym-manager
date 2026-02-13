'use client';

import { useRouter } from 'next/navigation';
import ReminderStatusTable from '@/components/payment-collection/ReminderStatusTable';

export default function PaymentCollectionPage() {
  const router = useRouter();

  const handleMemberClick = (memberId: string) => {
    // Navigate to members page with member detail
    router.push(`/members?memberId=${memberId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Collection</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track payment reminders and SMS delivery status
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-lg border bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div>
            <h3 className="font-semibold text-blue-900">SMS Mock Mode Active</h3>
            <p className="text-sm text-blue-700 mt-1">
              SMS messages are currently being logged to the console and database instead of
              being sent via text.lk. This allows you to test the payment reminder workflow
              without incurring SMS costs.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              To enable real SMS sending, configure your text.lk API credentials and set
              the <code className="bg-blue-100 px-1 py-0.5 rounded">ENABLE_REAL_SMS=true</code> environment variable.
            </p>
          </div>
        </div>
      </div>

      {/* Reminder Status Table */}
      <ReminderStatusTable onMemberClick={handleMemberClick} />
    </div>
  );
}
