'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberLimitBar } from '@/features/subscriptions'
import type { GymProfile } from '@/features/auth/types'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceHeader from './WorkspaceHeader'
import { WORKSPACE_NAV_ITEMS, activeNavItem } from './nav'
import { initials } from './primitives'

const COLLAPSE_KEY = 'mws-sidebar-collapsed'

// Sidebar collapse state is persisted to localStorage and shared across the
// shell via useSyncExternalStore — SSR-safe (server snapshot = expanded) and
// free of the setState-in-effect anti-pattern.
const collapseListeners = new Set<() => void>()
function subscribeCollapse(cb: () => void): () => void {
  collapseListeners.add(cb)
  return () => collapseListeners.delete(cb)
}
function getCollapseSnapshot(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}
function getCollapseServerSnapshot(): boolean {
  return false
}
function setCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
  collapseListeners.forEach((l) => l())
}

/**
 * The App Workspace chrome: collapsible sidebar + breadcrumb header on desktop,
 * a compact top/bottom nav on mobile. Wraps every (dashboard) page in
 * `.mws-root` so the enterprise design tokens apply. Collapse state persists to
 * localStorage.
 */
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode
}) {
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    getCollapseSnapshot,
    getCollapseServerSnapshot
  )
  const toggleCollapse = () => setCollapsed(!collapsed)

  return (
    <div
      className="mws-root min-h-screen"
      style={{
        background: 'var(--mws-bg)',
        ['--mws-sb-w' as string]: collapsed ? '56px' : '240px',
      }}
    >
      <WorkspaceSidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className="mws-main flex min-h-screen flex-col">
        <WorkspaceHeader />
        <MobileTopBar />

        {/* Lite-tier remaining-slots bar + universal upgrade CTA (unchanged). */}
        <MemberLimitBar />

        <main className="flex-1" style={{ padding: '24px', paddingBottom: 96 }}>
          {children}
        </main>

        <MobileBottomNav />
      </div>
    </div>
  )
}

/** Mobile-only header: gym avatar + name + logout. */
function MobileTopBar() {
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
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

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      queryClient.clear()
      window.location.replace('/login')
    } catch {
      queryClient.clear()
      window.location.replace('/login')
    }
  }

  return (
    <div
      className="lg:hidden sticky top-0 z-40 flex items-center justify-between"
      style={{
        height: 52,
        padding: '0 16px',
        background: '#fff',
        borderBottom: '1px solid var(--mws-b1)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--mws-accent)',
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
          }}
        >
          {gymProfile?.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gymProfile.profile_image_url}
              alt={gymProfile.gym_name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(gymProfile?.gym_name ?? 'M')
          )}
        </div>
        <span className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
          {gymProfile?.gym_name ?? 'Metric'}
        </span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Log out"
        className="mws-btn mws-btn-sm"
        style={{ width: 32, padding: 0 }}
      >
        {isLoggingOut ? (
          <Loader2 width={14} height={14} className="animate-spin" />
        ) : (
          <LogOut width={14} height={14} />
        )}
      </button>
    </div>
  )
}

/** Mobile-only bottom navigation (horizontally scrollable). */
function MobileBottomNav() {
  const pathname = usePathname()
  const active = activeNavItem(pathname)
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto scrollbar-hide"
      style={{ background: '#fff', borderTop: '1px solid var(--mws-b1)' }}
    >
      {WORKSPACE_NAV_ITEMS.map((item) => {
        const isActive = active?.href === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('flex flex-col items-center shrink-0')}
            style={{
              minWidth: 76,
              padding: '8px 6px',
              color: isActive ? 'var(--mws-accent-tint)' : 'var(--mws-t2)',
            }}
          >
            <Icon width={20} height={20} strokeWidth={1.8} className="mb-1" />
            <span
              className="text-center leading-tight"
              style={{ fontSize: 10, fontWeight: 500 }}
            >
              {item.name}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
