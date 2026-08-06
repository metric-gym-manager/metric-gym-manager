'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const settingsNavigation = [
  { name: 'Gym Information', href: '/settings/gym' },
  { name: 'Registration', href: '/settings/registration' },
  { name: 'Rules & Terms', href: '/settings/policies' },
  { name: 'Security', href: '/settings/security' },
  { name: 'Subscription', href: '/settings/billing' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isRoot = pathname === '/settings'

  return (
    <div
      className="mws-settings-shell"
      style={{ display: 'flex', gap: 32, maxWidth: 1000 }}
    >
      {/* Sub-navigation column
          Desktop: always 160px wide
          Mobile/root (/settings): full-width menu with large touch targets
          Mobile/sub-page: hidden */}
      <div
        className={cn(
          isRoot ? 'mws-settings-nav-root' : 'mws-settings-nav-sub'
        )}
        style={{ width: 160, flexShrink: 0 }}
      >
        <h1 className="mws-h1" style={{ marginBottom: 12 }}>
          Settings
        </h1>
        <div className="flex flex-col gap-0.5">
          {settingsNavigation.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('mws-subnav', isActive && 'mws-subnav-active')}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span className="flex-1">{item.name}</span>
                {/* Chevron only visible on mobile (overridden by mws-settings-nav-root) */}
                <ChevronRight
                  className="mws-settings-chevron"
                  style={{ width: 14, height: 14, flexShrink: 0 }}
                />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Content column
          Desktop: always visible with top padding
          Mobile/root: hidden (nav takes full width)
          Mobile/sub-page: full width, no top padding, back button shown */}
      <div
        className={cn(
          isRoot ? 'mws-settings-content-root' : 'mws-settings-content-sub'
        )}
        style={{ flex: 1, minWidth: 0, paddingTop: 40 }}
      >
        {/* Back link — only visible on mobile (CSS toggles display) */}
        <Link href="/settings" className="mws-back-btn">
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Settings
        </Link>
        {children}
      </div>
    </div>
  )
}
