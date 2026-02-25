import RevenuePageClient from './RevenuePageClient';

export default function RevenuePage() {
  return (
    <div className="space-y-6">
      {/* Server-rendered heading — appears in initial HTML for fast LCP */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Revenue</h1>
        </div>
      </div>

      <RevenuePageClient />
    </div>
  );
}
