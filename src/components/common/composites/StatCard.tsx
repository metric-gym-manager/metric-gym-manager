import * as React from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * StatCard — an operational KPI readout (Layer 3 composite).
 *
 * Renders **borderless and unfilled by default** (directive §5.5). The old
 * treatment — four floating bordered tiles across the top of every dashboard —
 * is the single most recognisable generic-SaaS pattern, and §9.3 names it first
 * in the adversarial smell test.
 *
 * Compose these into a band and let the *layout* separate them, using alignment
 * and a hairline divider rather than four boxes:
 *
 * ```tsx
 * <div className="grid grid-cols-2 divide-x divide-line-1 border-y border-line-1 lg:grid-cols-4">
 *   <StatCard label="Active members" value={312} sub="+9 today" />
 *   …
 * </div>
 * ```
 *
 * `boxed` restores the bordered container for the exceptional case where a
 * single stat is genuinely a standalone object (§5.4) — a variant, not a second
 * component (§10). Value renders in mono tabular numerics so figures align in a
 * column. `MetricCard` is an alias — one implementation.
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
  /**
   * Draw a bordered container around this stat. Exceptional (§5.4) — the
   * default is no container, with the band's dividers doing the separating.
   */
  boxed?: boolean
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
  boxed = false,
  className,
}: StatCardProps) {
  const base = cn(
    'flex flex-col gap-1.5 px-4 py-3 text-left font-geist',
    boxed && 'rounded-sm border border-line-1 bg-surface-card'
  )
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-metadata uppercase text-ink-muted">{label}</span>
        {icon && (
          <span className="text-ink-muted [&_svg]:size-3.5">{icon}</span>
        )}
      </div>
      <span className="font-mono text-readout tabular-nums text-ink">
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
          'transition-colors duration-fast hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none',
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
