'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'

/**
 * NotificationMenu — a bell trigger with an unread count opening a notifications
 * panel (Layer 3 composite; spec §11 App Shell). Generic: pass the list as
 * children; optional header/footer slots. The unread count is announced to
 * screen readers.
 */
export interface NotificationMenuProps {
  count?: number
  children: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  theme?: 'light' | 'dark'
  label?: string
  className?: string
}

export function NotificationMenu({
  count = 0,
  children,
  header,
  footer,
  theme,
  label = 'Notifications',
  className,
}: NotificationMenuProps) {
  const capped = count > 99 ? '99+' : String(count)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `${label}, ${count} unread` : label}
          className={cn(
            'relative inline-flex size-8 items-center justify-center rounded-sm text-ink-secondary transition-colors duration-fast hover:bg-surface-active hover:text-ink focus-visible:shadow-focus focus-visible:outline-none',
            className
          )}
        >
          <Bell className="size-4" aria-hidden="true" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 py-px font-mono text-mono-xs leading-none text-danger-text"
            >
              {capped}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent theme={theme} align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line-1 px-3 py-2.5">
          <span className="text-metadata uppercase text-ink-muted">
            {label}
          </span>
          {header}
        </div>
        <div className="max-h-80 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-line-1 px-3 py-2">{footer}</div>
        )}
      </PopoverContent>
    </Popover>
  )
}
