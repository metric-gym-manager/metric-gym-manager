import { AlertCircle } from 'lucide-react';
import MetricCard from './MetricCard';

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
        <div className="flex flex-col gap-2">
          {critical > 0 && (
            <div className="flex items-center justify-between bg-red-50 rounded-md px-2.5 py-1.5">
              <span className="text-xs font-medium text-red-700">Over 14 days</span>
              <span className="text-sm font-bold text-red-900">{critical}</span>
            </div>
          )}
          {warning > 0 && (
            <div className="flex items-center justify-between bg-orange-50 rounded-md px-2.5 py-1.5">
              <span className="text-xs font-medium text-orange-700">7-14 days</span>
              <span className="text-sm font-bold text-orange-900">{warning}</span>
            </div>
          )}
          {mild > 0 && (
            <div className="flex items-center justify-between bg-yellow-50 rounded-md px-2.5 py-1.5">
              <span className="text-xs font-medium text-yellow-700">Under 7 days</span>
              <span className="text-sm font-bold text-yellow-900">{mild}</span>
            </div>
          )}
        </div>
      )}
    </MetricCard>
  );
}
