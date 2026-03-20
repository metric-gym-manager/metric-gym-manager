import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for the MetricCard component
 */
export interface MetricCardProps {
  /** Card title */
  title: string;
  /** Main metric value to display */
  value: string | number | React.ReactNode;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Icon to display */
  icon: LucideIcon;
  /** Optional link href for clickable cards */
  href?: string;
  /** Card color variant */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Optional children for additional content */
  children?: React.ReactNode;
}

/**
 * Reusable metric card component for dashboard.
 * Displays a key metric with icon, value, and optional link.
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="Active Members"
 *   value={50}
 *   icon={Users}
 *   variant="success"
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Clickable card
 * <MetricCard
 *   title="Overdue Members"
 *   value={10}
 *   subtitle="Requires attention"
 *   icon={AlertCircle}
 *   href="/payment-collection?filter=overdue"
 *   variant="danger"
 * />
 * ```
 */
export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  variant = 'default',
  children,
}: MetricCardProps) {
  // Variant-specific styling
  const variantStyles = {
    default: 'bg-white border-gray-200 shadow-sm',
    success: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm',
    warning: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 shadow-sm',
    danger: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 shadow-sm',
  };

  const iconStyles = {
    default: 'text-blue-600 bg-blue-100',
    success: 'text-green-700 bg-green-200',
    warning: 'text-orange-700 bg-orange-200',
    danger: 'text-red-700 bg-red-200',
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 break-words">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          'p-2.5 rounded-lg shrink-0',
          iconStyles[variant]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children && <div className="mt-3 pt-3 border-t border-gray-200">{children}</div>}
    </>
  );

  const baseClasses = cn(
    'rounded-xl border p-4 sm:p-5',
    variantStyles[variant]
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          baseClasses,
          'block transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:translate-y-0'
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
