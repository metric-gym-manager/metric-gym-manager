import PaymentCollectionPageClient from './PaymentCollectionPageClient';

export default function PaymentCollectionPage() {
  return (
    <div className="space-y-6">
      {/* Server-rendered heading — appears in initial HTML for fast LCP */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Collection</h1>
        <p className="text-sm text-gray-600 mt-1">
          Track payment reminders, SMS delivery status, and installment collection
        </p>
      </div>

      <PaymentCollectionPageClient />
    </div>
  );
}
