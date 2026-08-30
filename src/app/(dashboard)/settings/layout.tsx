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
  // Setup only — the door hardware's day-to-day view is the top-level
  // /access-control page. Shown to every tier: the page itself renders the
  // Enterprise upgrade panel, which is how a gym discovers the feature exists.
  { name: 'Access Control', href: '/settings/access-control' },
  { name: 'Subscription', href: '/settings/billing' },
]

/**
 * Settings shell — a 160px sub-navigation beside the active section.
 *
 * The responsive behaviour is a master/detail: on a phone, `/settings` shows the
 * menu full-width and hides the content, a sub-page shows the content and a back
 * link instead of the menu. That was previously driven by five bespoke CSS
 * classes (`mws-settings-shell`, `-nav-root`, `-nav-sub`, `-content-root`,
 * `-content-sub`) full of `!important`; it is the same behaviour expressed in
 * layout classes, so the rules could be deleted.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isRoot = pathname === '/settings'

  return (
    <div className="flex max-w-[1000px] gap-8 max-tablet:max-w-full max-tablet:flex-col max-tablet:gap-0">
      {/* Sub-navigation */}
      <div
        className={cn(
          'w-40 shrink-0',
          isRoot ? 'max-tablet:w-full' : 'max-tablet:hidden'
        )}
      >
        <h1 className="mb-3 text-h1 text-ink">Settings</h1>
        <div className="flex flex-col gap-0.5">
          {settingsNavigation.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-[30px] items-center rounded-sm px-2.5 text-body transition-colors duration-fast focus-visible:shadow-focus focus-visible:outline-none',
                  isActive
                    ? 'bg-surface-selected text-ink'
                    : 'text-ink-secondary hover:bg-surface-active hover:text-ink',
                  // Larger touch targets when the menu is the whole screen.
                  isRoot &&
                    'max-tablet:h-12 max-tablet:justify-between max-tablet:px-3 max-tablet:text-base'
                )}
              >
                <span className="flex-1 truncate">{item.name}</span>
                {isRoot && (
                  <ChevronRight
                    className="hidden size-3.5 shrink-0 text-ink-muted max-tablet:block"
                    aria-hidden="true"
                  />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Section content */}
      <div
        className={cn(
          'min-w-0 flex-1 pt-10',
          isRoot ? 'max-tablet:hidden' : 'max-tablet:pt-0'
        )}
      >
        {!isRoot && (
          <Link
            href="/settings"
            className="mb-4 hidden items-center gap-1 text-body text-brand-link hover:text-brand-link-hover max-tablet:flex"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Settings
          </Link>
        )}
        {children}
      </div>
    </div>
  )
}
