import * as React from 'react'
import { cn } from '@/lib/utils'

/** Status tones follow the design's tint recipe (color / 10% bg / 25% border). */
export type StatusTone = 'ok' | 'warn' | 'err' | 'accent' | 'neutral'

const toneClass: Record<StatusTone, string> = {
  ok: 'mws-badge-ok',
  warn: 'mws-badge-warn',
  err: 'mws-badge-err',
  accent: 'mws-badge-accent',
  neutral: '',
}

export function statusBadgeClass(tone: StatusTone): string {
  return cn('mws-badge', toneClass[tone])
}

export function StatusBadge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: StatusTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn(statusBadgeClass(tone), className)}>{children}</span>
  )
}

/** White 1px-hairline card. */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mws-panel', className)} {...props}>
      {children}
    </div>
  )
}

/** Card header row: uppercase label on the left, optional control on the right. */
export function PanelHead({
  label,
  right,
  className,
}: {
  label: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mws-panel-head', className)}>
      <span className="mws-label">{label}</span>
      {right}
    </div>
  )
}

/** Locale-formatted integer (tabular numerics live in `.mws-mono`). */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** `LKR 3,500` style money, no decimals by default (matches the mock). */
export function formatLKR(
  n: number,
  opts?: { decimals?: boolean; prefix?: boolean }
): string {
  const value = n.toLocaleString('en-US', {
    minimumFractionDigits: opts?.decimals ? 2 : 0,
    maximumFractionDigits: opts?.decimals ? 2 : 0,
  })
  return opts?.prefix === false ? value : `LKR ${value}`
}

/** Two-letter initials from a name, for avatars. */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
