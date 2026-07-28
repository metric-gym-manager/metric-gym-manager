'use client'

import Link from 'next/link'
import { MetricCard as DSMetricCard } from '@/components/common/composites'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  href?: string
}

/**
 * Revenue metric tile — composes the Metric Design System `MetricCard`
 * (Layer 3 composite). Feature-level wrapper that maps revenue-shaped props onto
 * the composite and adds optional link navigation.
 */
export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  href,
}: MetricCardProps) {
  const card = (
    <DSMetricCard
      label={title}
      value={value}
      sub={subtitle}
      icon={icon}
      delta={
        trend
          ? {
              value: `${Math.abs(trend.value)}% from last period`,
              direction: trend.isPositive ? 'up' : 'down',
            }
          : undefined
      }
    />
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block transition-transform hover:scale-[1.02]"
      >
        {card}
      </Link>
    )
  }

  return card
}
