import BillingSetupPageClient from './BillingSetupPageClient';

export default function BillingSetupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Billing Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure membership plan types and discount presets
        </p>
      </div>
      <BillingSetupPageClient />
    </div>
  );
}
