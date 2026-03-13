import { Calendar } from 'lucide-react';
import MetricCard from './MetricCard';

interface DueSoonCardProps {
  count: number;
  totalAmount: number;
}

/**
 * Due Soon metric card for dashboard.
 * Shows members with payments due within the next 7 days.
 * Clickable to navigate to Payment Collection filtered by upcoming.
 */
export default function DueSoonCard({ count, totalAmount }: DueSoonCardProps) {
  const formattedAmount = `Rs. ${totalAmount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <MetricCard
      title="Due This Week"
      value={count}
      subtitle={`Expected: ${formattedAmount}`}
      icon={Calendar}
      href="/payment-collection?filter=upcoming"
      variant={count > 0 ? 'warning' : 'default'}
    >
      {count > 0 && (
        <p className="text-xs text-gray-600">
          {count} {count === 1 ? 'member' : 'members'} with upcoming payments
        </p>
      )}
    </MetricCard>
  );
}
