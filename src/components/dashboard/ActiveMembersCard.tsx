import { Users } from 'lucide-react';
import MetricCard from './MetricCard';

interface ActiveMembersCardProps {
  count: number;
  expiredCount: number;
}

/**
 * Active Members metric card for dashboard.
 * Shows total count of active members.
 * Clickable to navigate to Members page filtered by active status.
 */
export default function ActiveMembersCard({ count, expiredCount }: ActiveMembersCardProps) {
  return (
    <MetricCard
      title="Active Members"
      value={count}
      subtitle="Status: Active"
      icon={Users}
      href="/members?status=active"
      variant="default"
    >
      {expiredCount > 0 && (
        <div className="bg-gray-100 rounded-md px-2.5 py-1.5">
          <p className="text-xs font-medium text-gray-600">
            {expiredCount} expired {expiredCount === 1 ? 'member' : 'members'}
          </p>
        </div>
      )}
    </MetricCard>
  );
}
