'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui'
import { UserMenu } from '@/components/common/composites'
import type { GymProfile } from '@/features/auth/types'
import { crumbForPath } from './nav'

/**
 * Breadcrumb top bar for the App Workspace — `Gym / Section`, platform status,
 * and the account menu. Desktop only.
 *
 * Composed from `Breadcrumb` + `Badge` + `UserMenu` rather than hand-written
 * markup. The previous version assembled the trail from two spans and a "/"
 * literal (so it carried no `aria-current` and no breadcrumb semantics), and
 * had no account menu at all — just a non-interactive avatar beside a bare
 * logout icon. `UserMenu` is the composite that existed for exactly this and
 * had never been mounted.
 *
 * NOTE: the "ALL SYSTEMS OPERATIONAL" indicator is static — gym managers have
 * no health endpoint by design, because technical infrastructure detail is
 * SaaS-admin-only (architecture §2.9).
 */
export default function WorkspaceHeader() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const crumb = crumbForPath(pathname)

  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const result = await response.json()
      return result.data
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  })

  // Re-entrancy guard. The previous header disabled its logout button while the
  // request was in flight; `UserMenu` exposes no pending state, so without this
  // a double-click fires two POSTs. Mobile kept its guard, so the two paths had
  // silently diverged (inverted check, probe A1).
  const loggingOut = useRef(false)
  const handleLogout = async () => {
    if (loggingOut.current) return
    loggingOut.current = true
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      queryClient.clear()
      // Full-document navigation so middleware re-runs with cleared cookies
      // (architecture §2.15) — a client router replace would keep the stale
      // signed-in Router Cache until a manual refresh.
      window.location.replace('/login')
    }
  }

  return (
    <header className="sticky top-0 z-sticky hidden h-bar items-center justify-between border-b border-line-1 bg-surface-base px-6 lg:flex">
      <Breadcrumb className="min-w-0">
        <BreadcrumbItem>{gymProfile?.gym_name ?? 'Workspace'}</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbPage className="whitespace-nowrap">{crumb}</BreadcrumbPage>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Badge variant="success" title="Platform status">
          All systems operational
        </Badge>
        <UserMenu
          name={gymProfile?.gym_name ?? 'Account'}
          email={gymProfile?.email}
          avatarSrc={gymProfile?.profile_image_url ?? undefined}
          onSignOut={handleLogout}
        />
      </div>
    </header>
  )
}
