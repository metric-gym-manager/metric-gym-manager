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
  value: string | number;
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
    default: 'bg-white border-gray-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-orange-50 border-orange-200',
    danger: 'bg-red-50 border-red-200',
  };

  const iconStyles = {
    default: 'text-blue-600 bg-blue-100',
    success: 'text-green-600 bg-green-100',
    warning: 'text-orange-600 bg-orange-100',
    danger: 'text-red-600 bg-red-100',
  };

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          'p-3 rounded-full shrink-0',
          iconStyles[variant]
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {children && <div className="mt-4 pt-4 border-t border-gray-100">{children}</div>}
    </>
  );

  const baseClasses = cn(
    'rounded-lg border p-6 shadow-sm',
    variantStyles[variant]
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          baseClasses,
          'block transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer'
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
