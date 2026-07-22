'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Loader2 } from 'lucide-react'
import type { GymProfile } from '@/features/auth/types'
import { initials } from './primitives'
import { crumbForPath } from './nav'

/**
 * Breadcrumb top bar for the App Workspace — `Gym / Section`, a platform
 * status pill, the signed-in account and a logout affordance. Mirrors the
 * header in `App Workspace.dc.html`. Desktop only.
 *
 * NOTE: the "ALL SYSTEMS OPERATIONAL" pill is a static indicator — see the
 * gap report; gym managers have no health endpoint by design (technical
 * infra detail is SaaS-admin-only, architecture §2.9).
 */
export default function WorkspaceHeader() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
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

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      queryClient.clear()
      // Full-document navigation so middleware re-runs with cleared cookies
      // (architecture §2.15) — a client router replace would keep the stale
      // signed-in Router Cache until a manual refresh.
      window.location.replace('/login')
    } catch {
      queryClient.clear()
      window.location.replace('/login')
    }
  }

  return (
    <header
      className="mws-header hidden lg:flex items-center justify-between sticky top-0 z-40"
      style={{
        height: 52,
        padding: '0 24px',
        borderBottom: '1px solid var(--mws-b1)',
        background: 'var(--mws-bg)',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ fontSize: 13, minWidth: 0 }}
      >
        <span className="truncate" style={{ color: 'var(--mws-t3)' }}>
          {gymProfile?.gym_name ?? 'Workspace'}
        </span>
        <span style={{ color: 'var(--mws-t4)' }}>/</span>
        <span
          className="whitespace-nowrap"
          style={{ color: 'var(--mws-t1)', fontWeight: 500 }}
        >
          {crumb}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="mws-badge mws-badge-ok" title="Platform status">
          ALL SYSTEMS OPERATIONAL
        </span>
        <span
          className="hidden xl:block truncate"
          style={{ fontSize: 12, color: 'var(--mws-t2)', maxWidth: 180 }}
        >
          {gymProfile?.email ?? ''}
        </span>
        <div
          className="flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: gymProfile?.profile_image_url
              ? undefined
              : 'var(--mws-accent)',
            border: '1px solid var(--mws-b2)',
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
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Log out"
          className="mws-btn mws-btn-sm"
          style={{ width: 32, height: 26, padding: 0 }}
        >
          {isLoggingOut ? (
            <Loader2 width={14} height={14} className="animate-spin" />
          ) : (
            <LogOut width={14} height={14} />
          )}
        </button>
      </div>
    </header>
  )
}
