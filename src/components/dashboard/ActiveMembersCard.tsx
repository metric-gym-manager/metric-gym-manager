import { Users } from 'lucide-react';
import MetricCard from './MetricCard';

interface ActiveMembersCardProps {
  count: number;
}

/**
 * Active Members metric card for dashboard.
 * Shows total count of active members.
 * Clickable to navigate to Members page filtered by active status.
 */
export default function ActiveMembersCard({ count }: ActiveMembersCardProps) {
  return (
    <MetricCard
      title="Active Members"
      value={count}
      subtitle="Currently enrolled"
      icon={Users}
      href="/members?status=active"
      variant="default"
    />
  );
}
