'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * SideNav — generic sidebar navigation (Layer 3 composite; spec §11 App Shell →
 * Sidebar). Data-driven groups + items; 240px expanded / 56px collapsed. Renders
 * an <a> when `href` is set, else a <button>. Active item uses the selected
 * surface; labels collapse to icons (kept for screen readers). Business-free —
 * the app supplies items, header (workspace selector), and footer (search/collapse).
 */
export interface SideNavItem {
  label: string
  href?: string
  icon?: React.ReactNode
  active?: boolean
  onClick?: () => void
  badge?: React.ReactNode
}

export interface SideNavGroup {
  label?: string
  items: SideNavItem[]
}

export interface SideNavProps {
  groups: SideNavGroup[]
  /**
   * Element used for items that have an `href`. Defaults to a plain `<a>`,
   * which triggers a full document load — apps on a client router must pass
   * their own link (e.g. `next/link`) or every navigation reloads the page.
   */
  linkComponent?: React.ElementType
  collapsed?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
  ariaLabel?: string
  className?: string
}

export function SideNav({
  groups,
  linkComponent,
  collapsed = false,
  header,
  footer,
  ariaLabel = 'Sidebar',
  className,
}: SideNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex h-full flex-col border-r border-line-1 bg-surface-card font-geist transition-[width] duration-fast',
        collapsed ? 'w-14' : 'w-60',
        className
      )}
    >
      {header && (
        <div className="shrink-0 border-b border-line-1">{header}</div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        {groups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-3.5')}>
            {group.label && !collapsed && (
              <p className="px-2 pb-1 pt-2 text-metadata uppercase text-ink-muted">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item, ii) => (
                <li key={ii}>
                  <SideNavLink
                    item={item}
                    collapsed={collapsed}
                    linkComponent={linkComponent}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-line-1 p-2">{footer}</div>
      )}
    </nav>
  )
}

function SideNavLink({
  item,
  collapsed,
  linkComponent,
}: {
  item: SideNavItem
  collapsed: boolean
  linkComponent?: React.ElementType
}) {
  const cls = cn(
    'flex h-8 items-center gap-2.5 rounded-sm px-2 text-body transition-colors duration-fast focus-visible:shadow-focus focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0',
    collapsed && 'justify-center',
    item.active
      ? 'bg-surface-selected font-medium text-ink'
      : 'text-ink-secondary hover:bg-surface-active hover:text-ink'
  )
  const inner = (
    <>
      {item.icon}
      <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>
        {item.label}
      </span>
      {item.badge && !collapsed && (
        <span className="shrink-0">{item.badge}</span>
      )}
    </>
  )

  if (item.href) {
    const Link = linkComponent ?? 'a'
    return (
      <Link
        href={item.href}
        aria-current={item.active ? 'page' : undefined}
        className={cls}
        title={collapsed ? item.label : undefined}
      >
        {inner}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-current={item.active ? 'page' : undefined}
      className={cn(cls, 'w-full text-left')}
      title={collapsed ? item.label : undefined}
    >
      {inner}
    </button>
  )
}
