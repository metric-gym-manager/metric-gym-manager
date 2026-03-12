import { cn } from '@/lib/utils';

/**
 * Props for the UrgencyBadge component
 */
export interface UrgencyBadgeProps {
  /** Number of days the payment is overdue */
  daysOverdue: number;
}

/**
 * Graduated urgency badge component for displaying overdue payment status.
 * Applies visual escalation based on severity:
 * - Critical (>14 days): Red background with "Critical" badge
 * - Warning (7-14 days): Orange background with "Warning" badge
 * - Mild (<7 days): Yellow text, no additional badge
 *
 * @example
 * ```tsx
 * // Critical urgency
 * <UrgencyBadge daysOverdue={20} />
 * // Displays: "Critical • 20d overdue" with red background
 *
 * // Warning urgency
 * <UrgencyBadge daysOverdue={10} />
 * // Displays: "Warning • 10d overdue" with orange background
 *
 * // Mild urgency
 * <UrgencyBadge daysOverdue={3} />
 * // Displays: "3d overdue" with yellow text
 * ```
 */
export default function UrgencyBadge({ daysOverdue }: UrgencyBadgeProps) {
  // Handle negative values by treating them as 0
  const days = Math.max(0, daysOverdue);

  // Determine urgency level
  const isCritical = days > 14;
  const isWarning = days >= 7 && days <= 14;
  const isMild = days > 0 && days < 7;

  // Base badge classes
  const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold';

  // Urgency-specific classes
  const urgencyClasses = isCritical
    ? 'bg-red-100 text-red-800 border border-red-200'
    : isWarning
    ? 'bg-orange-100 text-orange-800 border border-orange-200'
    : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

  // Urgency label
  const urgencyLabel = isCritical ? 'Critical' : isWarning ? 'Warning' : null;

  return (
    <span
      className={cn(baseClasses, urgencyClasses)}
      role="status"
      aria-label={`${urgencyLabel ? `${urgencyLabel}: ` : ''}${days} days overdue`}
    >
      {urgencyLabel && (
        <>
          <span className="font-bold">{urgencyLabel}</span>
          <span className="text-current">•</span>
        </>
      )}
      <span>{days}d overdue</span>
    </span>
  );
}
