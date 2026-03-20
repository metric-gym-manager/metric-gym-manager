'use client';

import { useQuery } from '@tanstack/react-query';
import OverdueMembersCard from '@/components/dashboard/OverdueMembersCard';
import RevenueSummaryCard from '@/components/dashboard/RevenueSummaryCard';
import DueSoonCard from '@/components/dashboard/DueSoonCard';
import ActiveMembersCard from '@/components/dashboard/ActiveMembersCard';

interface DashboardMetrics {
  overdueMembers: {
    count: number;
    critical: number;
    warning: number;
    mild: number;
  };
  revenueThisMonth: number;
  membersDueThisWeek: {
    count: number;
    totalAmount: number;
  };
  activeMembers: number;
}

/**
 * Dashboard client component.
 * Fetches and displays key business metrics using metric cards.
 */
export default function DashboardClient() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardMetrics }>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard metrics');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-100 animate-pulse rounded-xl"
              aria-label="Loading metric card"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <p className="text-sm text-red-800 font-medium">Failed to load dashboard metrics. Please try again.</p>
        </div>
      </div>
    );
  }

  const metrics = data.data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OverdueMembersCard
          count={metrics.overdueMembers.count}
          critical={metrics.overdueMembers.critical}
          warning={metrics.overdueMembers.warning}
          mild={metrics.overdueMembers.mild}
        />

        <RevenueSummaryCard amount={metrics.revenueThisMonth} />

        <DueSoonCard
          count={metrics.membersDueThisWeek.count}
          totalAmount={metrics.membersDueThisWeek.totalAmount}
        />

        <ActiveMembersCard
          count={metrics.activeMembers}
          expiredCount={metrics.overdueMembers.count}
        />
      </div>
    </div>
  );
}
