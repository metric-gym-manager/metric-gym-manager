import PaymentCollectionPageClient from './PaymentCollectionPageClient';

export default function PaymentCollectionPage() {
  return (
    <div className="space-y-6">
      {/* Server-rendered heading — appears in initial HTML for fast LCP */}
      <div>
        <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Fee Collection</h1>
      </div>

      <PaymentCollectionPageClient />
    </div>
  );
}
