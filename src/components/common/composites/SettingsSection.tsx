import * as React from 'react'
import { cn } from '@/lib/utils'
import { SectionHeader } from './SectionHeader'

/**
 * SettingsSection — a configuration group (Layer 3 composite).
 *
 * Renders as a **labelled section over hairline-separated rows**, not a card
 * (directive §5.18: "section headers, dividers, aligned labels and controls —
 * professional configuration software, not nested form cards"). The previous
 * version wrapped everything in a bordered surface, which made every settings
 * page an instance of the `Page → SettingsCard → SettingsRow` composition §5.3
 * names as banned.
 *
 * `boxed` restores the container for the exceptional standalone block (§5.4).
 */
export interface SettingsSectionProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  boxed?: boolean
  className?: string
}

export function SettingsSection({
  title,
  description,
  actions,
  children,
  boxed = false,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        'font-geist',
        boxed && 'rounded-sm border border-line-1 bg-surface-card',
        className
      )}
    >
      <SectionHeader
        variant="metadata"
        divider
        title={title}
        description={description}
        actions={actions}
        className={cn(boxed && 'px-4 pt-3')}
      />
      <div className={cn(boxed && 'px-4')}>{children}</div>
    </section>
  )
}

export interface SettingsRowProps {
  label: React.ReactNode
  description?: React.ReactNode
  control?: React.ReactNode
  /** Stack the control under the label — for controls that need the full width. */
  stacked?: boolean
  className?: string
}

export function SettingsRow({
  label,
  description,
  control,
  stacked = false,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'gap-4 border-b border-line-subtle py-3 last:border-0',
        stacked
          ? 'flex flex-col'
          : 'flex flex-col tablet:flex-row tablet:items-center tablet:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-body font-medium text-ink">{label}</p>
        {description && (
          <p className="mt-0.5 text-caption text-ink-muted">{description}</p>
        )}
      </div>
      {control && (
        <div
          className={cn(
            'flex items-center gap-2',
            stacked ? 'w-full' : 'shrink-0 tablet:w-72 tablet:justify-end'
          )}
        >
          {control}
        </div>
      )}
    </div>
  )
}
