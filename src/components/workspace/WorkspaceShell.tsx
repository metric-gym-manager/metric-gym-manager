'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Button } from '@/components/ui'
import { MemberLimitBar } from '@/features/subscriptions'
import type { GymProfile } from '@/features/auth/types'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceHeader from './WorkspaceHeader'
import { WORKSPACE_NAV_ITEMS, activeNavItem } from './nav'

// Renamed from `mws-sidebar-collapsed` when the legacy layer was retired.
// One-time cost: a sidebar collapsed before the rename reopens expanded once.
const COLLAPSE_KEY = 'metric:sidebar-collapsed'

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
 * The App Workspace chrome: a fixed sidebar + breadcrumb header on desktop, and
 * a compact bar opening the same navigation in a drawer on mobile.
 *
 * The workspace sets its own type baseline (Geist at the 13px body size) here.
 * That used to come from `.mws-root`, together with a set of `--mws-*` aliases
 * for the legacy CSS layer — both removed once the last screen migrated.
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
      data-theme="dark"
      className="min-h-screen bg-surface-base font-geist text-body text-ink antialiased"
    >
      <WorkspaceSidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Offset for the fixed rail. Was a `.mws-main` CSS rule driven by a
          `--mws-sb-w` custom property set from JS; the widths are the sidebar
          token values, so a conditional class expresses it directly. */}
      <div
        className={cn(
          'flex min-h-screen flex-col',
          collapsed ? 'lg:pl-14' : 'lg:pl-60'
        )}
      >
        <WorkspaceHeader />
        <MobileTopBar />

        {/* Lite-tier remaining-slots bar + universal upgrade CTA (unchanged). */}
        <MemberLimitBar />

        <main className="flex-1 p-6 pb-24 lg:pb-6">{children}</main>

        <MobileBottomNav />
      </div>
    </div>
  )
}

/**
 * Mobile-only header: gym identity and sign-out.
 *
 * Kept deliberately close to its original shape. Mobile is being rebuilt from
 * scratch in a separate effort (ruling R6), so this pass only tokenises it —
 * the hardcoded `#fff` surfaces that would have survived the dark flip are gone,
 * and the avatar and button are DS primitives. No layout or behaviour change.
 */
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
    } finally {
      queryClient.clear()
      window.location.replace('/login')
    }
  }

  return (
    <div className="sticky top-0 z-sticky flex h-bar items-center justify-between gap-3 border-b border-line-1 bg-surface-panel px-4 lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar
          size="sm"
          name={gymProfile?.gym_name ?? 'Metric'}
          src={gymProfile?.profile_image_url ?? undefined}
        />
        <span className="truncate text-body font-semibold text-ink">
          {gymProfile?.gym_name ?? 'Metric'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Log out"
      >
        {isLoggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
      </Button>
    </div>
  )
}

/**
 * Mobile-only bottom navigation (horizontally scrollable).
 *
 * Retained as-is per R6. Known limitation, deliberately not fixed here: nine
 * destinations at a 76px minimum overflow a phone viewport, so the later items
 * sit behind a horizontal scroll with no affordance. That is a mobile
 * information-architecture problem, and mobile is being rebuilt separately.
 * `aria-current` is set, which the original omitted.
 */
function MobileBottomNav() {
  const pathname = usePathname()
  const active = activeNavItem(pathname)
  return (
    <nav
      aria-label="Workspace"
      className="scrollbar-hide fixed bottom-0 left-0 right-0 z-sticky flex overflow-x-auto border-t border-line-1 bg-surface-panel lg:hidden"
    >
      {WORKSPACE_NAV_ITEMS.map((item) => {
        const isActive = active?.href === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-[76px] shrink-0 flex-col items-center px-1.5 py-2 transition-colors duration-fast',
              isActive ? 'text-brand-link' : 'text-ink-secondary'
            )}
          >
            <Icon
              width={20}
              height={20}
              strokeWidth={1.8}
              className="mb-1"
              aria-hidden="true"
            />
            <span className="text-center text-mono-xs font-medium leading-tight">
              {item.name}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
