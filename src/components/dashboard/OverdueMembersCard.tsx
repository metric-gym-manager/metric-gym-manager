import { AlertCircle } from 'lucide-react';
import MetricCard from './MetricCard';
import UrgencyBadge from '../common/UrgencyBadge';

interface OverdueMembersCardProps {
  count: number;
  critical: number;
  warning: number;
  mild: number;
}

/**
 * Overdue Members metric card for dashboard.
 * Shows total overdue count with urgency breakdown.
 * Clickable to navigate to Payment Collection filtered by overdue.
 */
export default function OverdueMembersCard({
  count,
  critical,
  warning,
  mild,
}: OverdueMembersCardProps) {
  return (
    <MetricCard
      title="Overdue Members"
      value={count}
      subtitle={count > 0 ? 'Requires immediate attention' : 'All payments up to date'}
      icon={AlertCircle}
      href="/payment-collection?filter=overdue"
      variant={count > 0 ? 'danger' : 'success'}
    >
      {count > 0 && (
        <div className="flex flex-wrap gap-2">
          {critical > 0 && (
            <div className="text-xs">
              <span className="font-semibold text-red-700">{critical}</span>
              <span className="text-gray-600 ml-1">critical (>14d)</span>
            </div>
          )}
          {warning > 0 && (
            <div className="text-xs">
              <span className="font-semibold text-orange-700">{warning}</span>
              <span className="text-gray-600 ml-1">warning (7-14d)</span>
            </div>
          )}
          {mild > 0 && (
            <div className="text-xs">
              <span className="font-semibold text-yellow-700">{mild}</span>
              <span className="text-gray-600 ml-1">mild (<7d)</span>
            </div>
          )}
        </div>
      )}
    </MetricCard>
  );
}
