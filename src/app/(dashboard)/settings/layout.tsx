'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Left sub-navigation column (design §4 Settings shell). Routes are unchanged;
// "Subscription" points at /settings/billing — the gym's own SaaS plan, not the
// sidebar's Billing Setup (member plan-type config).
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

  return (
    <div
      className="mws-settings-shell"
      style={{ display: 'flex', gap: 32, maxWidth: 1000 }}
    >
      <div
        style={{ width: 160, flexShrink: 0 }}
        className="flex flex-col gap-0.5"
      >
        <h1 className="mws-h1" style={{ marginBottom: 12 }}>
          Settings
        </h1>
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
              {item.name}
            </Link>
          )
        })}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 40 }}>{children}</div>
    </div>
  )
}
