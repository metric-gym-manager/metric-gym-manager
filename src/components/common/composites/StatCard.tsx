import * as React from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * StatCard — labeled metric tile (Layer 3 composite; spec §11 Stat Cards). Value
 * renders in mono tabular numerics. Optional `delta` (with direction arrow),
 * `trend` slot (e.g. a Sparkline), and `icon`. Becomes a button when `onClick`
 * is provided. `MetricCard` is an alias for the richer usage — one implementation.
 */
export interface StatDelta {
  value: React.ReactNode
  direction?: 'up' | 'down' | 'flat'
  /** Overrides the default color (up→success, down→error, flat→muted). */
  tone?: 'success' | 'error' | 'neutral'
}

export interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ReactNode
  delta?: StatDelta
  trend?: React.ReactNode
  onClick?: () => void
  className?: string
}

const deltaToneClass = {
  success: 'text-success',
  error: 'text-error',
  neutral: 'text-ink-muted',
} as const

const deltaIcon = { up: ArrowUp, down: ArrowDown, flat: Minus } as const

function DeltaBadge({ delta }: { delta: StatDelta }) {
  const dir = delta.direction ?? 'flat'
  const tone =
    delta.tone ??
    (dir === 'up' ? 'success' : dir === 'down' ? 'error' : 'neutral')
  const Icon = deltaIcon[dir]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono text-mono-sm tabular-nums',
        deltaToneClass[tone]
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {delta.value}
    </span>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  trend,
  onClick,
  className,
}: StatCardProps) {
  const base =
    'flex flex-col gap-2 rounded-lg border border-line-1 bg-surface-card p-4 text-left font-geist'
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-metadata uppercase text-ink-muted">{label}</span>
        {icon && (
          <span className="text-ink-muted [&_svg]:size-3.5">{icon}</span>
        )}
      </div>
      <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
        {value}
      </span>
      {(sub || delta) && (
        <div className="flex items-center gap-2">
          {delta && <DeltaBadge delta={delta} />}
          {sub && (
            <span className="text-caption text-ink-secondary">{sub}</span>
          )}
        </div>
      )}
      {trend && <div className="mt-1">{trend}</div>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          base,
          'transition-colors duration-fast hover:border-line-hover focus-visible:shadow-focus focus-visible:outline-none',
          className
        )}
      >
        {content}
      </button>
    )
  }
  return <div className={cn(base, className)}>{content}</div>
}

/** MetricCard — semantic alias of StatCard for trend/delta-focused tiles. */
export const MetricCard = StatCard
export type MetricCardProps = StatCardProps
