'use client'

import Link from 'next/link'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { iconSize } from '@/components/ui'

/**
 * BottomNav — the phone's persistent navigation (mobile rebuild plan §5.11,
 * §25.3, §6).
 *
 * Not `SideNav`, which is a vertical desktop rail, and not `Tabs`, which
 * switch content inside a page. This is a fixed bar of destinations with an
 * icon over a label, the current one marked with `aria-current`.
 *
 * **Four slots, and the fourth is More** (plan decision C8). The bar it
 * replaces put all nine destinations in a horizontal scroller 754 px wide on
 * a 390 px screen, so five of them sat off-screen behind a scroll with no
 * affordance. Four items fit 320 px without truncation; the rest live in the
 * More sheet.
 *
 * This composite is presentational: it is handed the items to show. The list
 * itself stays `WORKSPACE_NAV` — one navigation list for both tiers — and the
 * shell selects from it.
 */
export interface BottomNavItem {
  name: string
  href: string
  icon: LucideIcon
}

export interface BottomNavProps {
  /** The bar's destinations, in order. Three, with More as the fourth. */
  items: BottomNavItem[]
  /** The destination the current route resolves to (longest-prefix match). */
  activeHref?: string
  /** The More sheet's trigger. Omit to render destinations only. */
  more?: {
    label?: string
    icon?: LucideIcon
    open: boolean
    onToggle: () => void
  }
  className?: string
}

const itemClassName =
  'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors duration-fast focus-visible:shadow-focus focus-visible:outline-none active:bg-surface-active'

export function BottomNav({
  items,
  activeHref,
  more,
  className,
}: BottomNavProps) {
  const MoreIcon = more?.icon ?? MoreHorizontal

  return (
    <nav
      aria-label="Workspace"
      className={cn(
        'fixed inset-x-0 bottom-0 z-sticky border-t border-line-1 bg-surface-panel pb-safe-bottom',
        'pl-safe-left pr-safe-right',
        className
      )}
    >
      <div className="flex h-bottom-nav items-stretch">
        {items.map((item) => {
          const isActive = activeHref === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                itemClassName,
                isActive ? 'text-brand-link' : 'text-ink-secondary'
              )}
            >
              <Icon
                width={iconSize.lg}
                height={iconSize.lg}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="font-mono text-mono-xs uppercase tracking-wide">
                {item.name}
              </span>
            </Link>
          )
        })}

        {more && (
          <button
            type="button"
            onClick={more.onToggle}
            aria-expanded={more.open}
            className={cn(
              itemClassName,
              more.open ? 'text-brand-link' : 'text-ink-secondary'
            )}
          >
            <MoreIcon
              width={iconSize.lg}
              height={iconSize.lg}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="font-mono text-mono-xs uppercase tracking-wide">
              {more.label ?? 'More'}
            </span>
          </button>
        )}
      </div>
    </nav>
  )
}
