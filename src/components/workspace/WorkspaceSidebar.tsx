'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SideNav } from '@/components/common/composites'
import { useSubscription } from '@/features/subscriptions'
import type { GymProfile } from '@/features/auth/types'
import { WORKSPACE_NAV, activeNavItem } from './nav'

/**
 * App Workspace sidebar — system navigation (directive §5.14).
 *
 * Composes the `SideNav` composite rather than hand-writing the rail. The
 * previous version was bespoke markup in the retired `mws-*` language: it
 * signalled the active item with `rgba(0,0,0,0.09)` (invisible on the dark
 * ground), set no `aria-current`, left the `<nav>` unlabelled, and gave the
 * collapse button no accessible name once collapsed. `SideNav` supplies all
 * four, so this file is now composition and data only.
 *
 * Desktop only — the mobile shell opens the same navigation in a drawer.
 */
export default function WorkspaceSidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const pathname = usePathname()
  const active = activeNavItem(pathname)

  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const result = await response.json()
      return result.data
    },
    staleTime: 30000,
  })

  const { data: subscription } = useSubscription()
  const tier = subscription?.subscription.subscriptionTier
  const location = gymProfile?.gym_address?.split(',').pop()?.trim() || null
  const subtitle = [location, tier?.toUpperCase()].filter(Boolean).join(' · ')

  const groups = WORKSPACE_NAV.map((group) => ({
    label: group.label,
    items: group.items.map((item) => {
      const Icon = item.icon
      return {
        label: item.name,
        href: item.href,
        icon: <Icon strokeWidth={1.8} aria-hidden="true" />,
        active: active?.href === item.href,
      }
    }),
  }))

  return (
    <SideNav
      groups={groups}
      linkComponent={Link}
      collapsed={collapsed}
      ariaLabel="Workspace"
      className="fixed inset-y-0 z-sticky hidden bg-surface-panel lg:flex"
      header={
        <div className="flex h-bar items-center gap-2.5 px-3">
          <Image
            src="/logo.svg"
            alt="Metric"
            width={22}
            height={22}
            className="size-[22px] shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <div className="truncate text-body font-semibold tracking-tight text-ink">
                {gymProfile?.gym_name ?? 'Metric'}
              </div>
              {subtitle && (
                <div className="truncate font-mono text-mono-sm text-ink-muted">
                  {subtitle}
                </div>
              )}
            </div>
          )}
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-caption text-ink-muted transition-colors duration-fast hover:bg-surface-active hover:text-ink focus-visible:shadow-focus focus-visible:outline-none',
            collapsed && 'justify-center'
          )}
        >
          <PanelLeft className="size-3.5 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Collapse</span>}
        </button>
      }
    />
  )
}
