'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Drawer, ListRow } from '@/components/ui'
import { AppBar, BottomNav } from '@/components/common/composites'
import { useViewportTier } from '@/hooks/useViewportTier'
import { useHistoryBack } from '@/hooks/useHistoryBack'
import { MemberLimitBar, useSubscription } from '@/features/subscriptions'
import type { GymProfile } from '@/features/auth/types'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceHeader from './WorkspaceHeader'
import { activeNavItem, appBarTitle, mobileNav } from './nav'

// Renamed from `mws-sidebar-collapsed` when the legacy layer was retired.
// One-time cost: a sidebar collapsed before the rename reopens expanded once.
const COLLAPSE_KEY = 'metric:sidebar-collapsed'

/**
 * Widths that get the sidebar collapsed by default (plan §4, decision o02).
 *
 * 768–1023 is the tablet band: the desktop composition, but not the room for
 * a 240 px rail beside it. This is a *default*, not a rule — a stored choice
 * wins at every width, which is why the snapshot below checks storage first.
 */
const TABLET_QUERY = '(max-width: 1023px)'

// Sidebar collapse state is persisted to localStorage and shared across the
// shell via useSyncExternalStore — SSR-safe (server snapshot = expanded) and
// free of the setState-in-effect anti-pattern.
const collapseListeners = new Set<() => void>()
function subscribeCollapse(cb: () => void): () => void {
  collapseListeners.add(cb)
  // Also re-read when the tablet boundary is crossed: with no stored choice
  // the answer depends on the width, so a resize changes it.
  const mq =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(TABLET_QUERY)
      : null
  mq?.addEventListener('change', cb)
  return () => {
    collapseListeners.delete(cb)
    mq?.removeEventListener('change', cb)
  }
}
function getCollapseSnapshot(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    /* ignore */
  }
  // No stored choice: collapsed on a tablet, expanded on a desktop.
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(TABLET_QUERY).matches
    : false
}
function getCollapseServerSnapshot(): boolean {
  // The server cannot measure a width and the tablet band shares its UA with
  // the desktop (ruling M5), so the server renders expanded and the client
  // corrects on its first commit. Visible only at 768–1023, on a first visit
  // with no stored choice — a band that today gets different chrome entirely,
  // so there is no existing desktop rendering to disturb (correction C20).
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
 * The App Workspace chrome.
 *
 * Desktop (≥ 768) is the fixed sidebar + breadcrumb header, unchanged. Phone
 * (< 768) is the `AppBar` above the content and the `BottomNav` below it, with
 * everything that does not fit the bar's three slots in a More sheet.
 *
 * Both tiers read one list — `WORKSPACE_NAV` — so a destination cannot exist
 * on one and be missing from the other (risk r04). The bars themselves are
 * design-system composites; this file is composition and data.
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
  const tier = useViewportTier()
  const [moreOpen, setMoreOpen] = useState(false)

  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    getCollapseSnapshot,
    getCollapseServerSnapshot
  )
  const toggleCollapse = () => setCollapsed(!collapsed)

  return (
    <div
      data-theme="dark"
      data-tier={tier}
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
          collapsed ? 'tablet:pl-14' : 'tablet:pl-60'
        )}
      >
        <WorkspaceHeader />
        <PhoneAppBar moreOpen={moreOpen} onOpenMore={() => setMoreOpen(true)} />

        {/* Lite-tier remaining-slots bar + universal upgrade CTA (unchanged). */}
        <MemberLimitBar />

        {/* The bottom padding is the bar's own height plus the home-indicator
            inset, derived from the token rather than a number, so the last row
            of any list clears the fixed bar. */}
        <main className="flex-1 p-6 phone:px-4 phone:pb-[calc(theme(spacing[bottom-nav])+var(--ds-safe-bottom))] phone:pt-3">
          {children}
        </main>

        <PhoneBottomNav open={moreOpen} onOpenChange={setMoreOpen} />
      </div>
    </div>
  )
}

/** The gym profile both phone surfaces show. Same query key as the desktop chrome. */
function useGymProfile() {
  return useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const result = await response.json()
      return result.data
    },
    staleTime: 30000,
  })
}

/**
 * The phone top bar: gym identity (which opens More) on a root page, Back on a
 * nested one, and the section title. Hidden at ≥ 768 by CSS rather than by the
 * tier hook, so the header cannot mismatch on hydration.
 */
function PhoneAppBar({
  moreOpen,
  onOpenMore,
}: {
  moreOpen: boolean
  onOpenMore: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: gymProfile } = useGymProfile()
  const { title, parentHref } = appBarTitle(pathname)

  return (
    <AppBar
      className="tablet:hidden"
      title={title}
      // The PARENT route, not `router.back()`: Back must mean the same thing
      // however the user arrived (plan §6.2).
      onBack={parentHref ? () => router.push(parentHref) : undefined}
      identity={{
        name: gymProfile?.gym_name ?? 'Metric',
        imageUrl: gymProfile?.profile_image_url ?? undefined,
        onOpen: onOpenMore,
        expanded: moreOpen,
      }}
    />
  )
}

/**
 * The phone bottom bar and the More sheet it opens.
 *
 * The bar carries three destinations; everything else in `WORKSPACE_NAV` is in
 * the sheet, grouped as the sidebar groups it. The nine-item horizontal
 * scroller this replaces was 754 px wide on a 390 px screen, with five
 * destinations off-screen behind a scroll with no affordance (audit §D).
 */
function PhoneBottomNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: gymProfile } = useGymProfile()
  const { data: subscription } = useSubscription()

  const active = activeNavItem(pathname)
  const { bar, more } = mobileNav(subscription?.subscription.capabilities)

  // A row's navigation runs only after the sheet's own history entry is gone.
  //
  // Tapping a link while the entry is live would push the new route ON TOP of
  // it, leaving a dead entry behind that swallows one Back press — and another
  // for every subsequent trip through More. So a row records where it is going
  // and asks the browser to go back; `useHistoryBack` then closes the sheet and
  // this runs the navigation, on a stack with nothing left over.
  const pendingHref = useRef<string | null>(null)
  const closeMore = () => {
    onOpenChange(false)
    const href = pendingHref.current
    pendingHref.current = null
    if (href) router.push(href)
  }
  useHistoryBack(open, closeMore)

  const go = (href: string) => (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    pendingHref.current = href
    window.history.back()
  }

  // Sign-out, moved from the deleted `MobileTopBar` unchanged — including its
  // re-entrancy guard, and the full-document navigation §2.15 requires so
  // middleware re-runs with cleared cookies.
  const [isLoggingOut, setIsLoggingOut] = useState(false)
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
    <>
      <BottomNav
        className="tablet:hidden"
        items={bar}
        activeHref={active?.href}
        more={{ open, onToggle: () => onOpenChange(!open) }}
      />

      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        size="auto"
        title="Navigation"
      >
        <div className="-mx-4 -mt-4 flex flex-col">
          <div className="flex items-center gap-3 border-b border-line-1 px-4 py-3">
            <Avatar
              size="md"
              name={gymProfile?.gym_name ?? 'Metric'}
              src={gymProfile?.profile_image_url ?? undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-ink">
                {gymProfile?.gym_name ?? 'Metric'}
              </p>
              {gymProfile?.email && (
                <p className="truncate font-mono text-mono-sm text-ink-muted">
                  {gymProfile.email}
                </p>
              )}
            </div>
            {subscription?.subscription.subscriptionTier && (
              <Badge variant="accent">
                {subscription.subscription.subscriptionTier}
              </Badge>
            )}
          </div>

          {more.map((group) => (
            <div key={group.label}>
              <p className="px-4 pb-1 pt-3 text-metadata uppercase text-ink-muted">
                {group.label}
              </p>
              <ul role="list">
                {group.items.map((item) => (
                  <ListRow
                    key={item.href}
                    href={item.href}
                    onClick={go(item.href)}
                    primary={item.name}
                    selected={active?.href === item.href}
                    value={
                      <ChevronRight
                        className="size-4 text-ink-muted"
                        aria-hidden="true"
                      />
                    }
                  />
                ))}
              </ul>
            </div>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex min-h-touch items-center gap-2 px-4 py-3 text-left text-body text-error transition-colors duration-fast hover:bg-error-bg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </Drawer>
    </>
  )
}
