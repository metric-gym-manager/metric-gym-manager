'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/features/subscriptions'
import type { GymProfile } from '@/features/auth/types'
import { WORKSPACE_NAV, activeNavItem } from './nav'

/**
 * App Workspace sidebar — collapsible 240px / 56px rail with a workspace
 * selector (gym name + tier), grouped navigation and a collapse toggle.
 * Mirrors the sidebar in `App Workspace.dc.html`; routes map onto the existing
 * (dashboard) segments. Desktop only — the mobile shell keeps the existing
 * top/bottom bars.
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

  return (
    <aside
      className="mws-sidebar hidden lg:flex lg:fixed lg:inset-y-0 lg:z-50 flex-col"
      style={{
        width: collapsed ? 56 : 240,
        minWidth: collapsed ? 56 : 240,
        background: '#ffffff',
        borderRight: '1px solid var(--mws-b1)',
        transition: 'width 0.15s ease, min-width 0.15s ease',
      }}
    >
      {/* Workspace selector */}
      <div
        className="flex items-center gap-2.5"
        style={{
          height: 52,
          padding: '0 12px',
          borderBottom: '1px solid var(--mws-b1)',
        }}
      >
        <Image
          src="/logo.svg"
          alt="Metric"
          width={22}
          height={22}
          className="shrink-0"
          style={{ width: 22, height: 22 }}
        />
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <div
              className="truncate"
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              {gymProfile?.gym_name ?? 'Metric'}
            </div>
            {subtitle && (
              <div
                className="mws-mono truncate"
                style={{ fontSize: 11, color: 'var(--mws-t3)' }}
              >
                {subtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grouped nav */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col"
        style={{ padding: '12px 8px', gap: 2 }}
      >
        {WORKSPACE_NAV.map((group) => (
          <div key={group.label} className="flex flex-col" style={{ gap: 2 }}>
            {!collapsed && (
              <div className="mws-label" style={{ padding: '10px 8px 6px' }}>
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = active?.href === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    'mws-nav-item',
                    isActive && 'mws-nav-item-active'
                  )}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    height: 32,
                    padding: '0 8px',
                    borderRadius: 5,
                    fontSize: 13,
                    fontWeight: 500,
                    color: isActive ? 'var(--mws-t1)' : 'var(--mws-t2)',
                    background: isActive ? 'rgba(0,0,0,0.09)' : 'transparent',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <Icon
                    width={15}
                    height={15}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
                  {!collapsed && (
                    <span className="whitespace-nowrap">{item.name}</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div style={{ borderTop: '1px solid var(--mws-b1)', padding: 8 }}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mws-nav-item w-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 32,
            padding: '0 8px',
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--mws-t3)',
            fontSize: 12,
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <PanelLeft width={14} height={14} strokeWidth={1.8} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
