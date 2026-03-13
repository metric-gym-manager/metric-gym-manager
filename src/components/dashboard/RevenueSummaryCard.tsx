import { DollarSign } from 'lucide-react';
import MetricCard from './MetricCard';

interface RevenueSummaryCardProps {
  amount: number;
}

/**
 * Revenue Summary metric card for dashboard.
 * Shows total revenue collected for the current month.
 * Clickable to navigate to Revenue page.
 */
export default function RevenueSummaryCard({ amount }: RevenueSummaryCardProps) {
  const formattedAmount = `Rs. ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const currentMonth = new Date().toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <MetricCard
      title="Revenue This Month"
      value={formattedAmount}
      subtitle={currentMonth}
      icon={DollarSign}
      href="/revenue"
      variant="success"
    />
  );
}
