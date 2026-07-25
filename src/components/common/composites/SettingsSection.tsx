import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * SettingsSection + SettingsRow — a settings group with hairline-separated
 * label/control rows (Layer 3 composite; spec §11 Key-Value / settings rows).
 * Business-free: pass the control (Switch, Select, Button…) per row.
 *
 * ```tsx
 * <SettingsSection title="Notifications" description="How members are reminded">
 *   <SettingsRow label="SMS reminders" description="Send before due date" control={<Switch/>} />
 * </SettingsSection>
 * ```
 */
export interface SettingsSectionProps {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-line-1 bg-surface-card font-geist',
        className
      )}
    >
      <div className="border-b border-line-1 px-4 py-3">
        <h3 className="text-h3 text-ink">{title}</h3>
        {description && (
          <p className="mt-1 text-caption text-ink-muted">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </section>
  )
}

export interface SettingsRowProps {
  label: React.ReactNode
  description?: React.ReactNode
  control?: React.ReactNode
  className?: string
}

export function SettingsRow({
  label,
  description,
  control,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-line-subtle px-4 py-3 last:border-0',
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
        <div className="flex shrink-0 items-center gap-2">{control}</div>
      )}
    </div>
  )
}
