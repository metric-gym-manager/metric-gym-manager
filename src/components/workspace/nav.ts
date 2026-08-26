import {
  Home,
  Users,
  BarChart3,
  LineChart,
  CreditCard,
  Megaphone,
  ScrollText,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react'

export interface WorkspaceNavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Breadcrumb label shown in the top bar (defaults to `name`). */
  crumb?: string
}

export interface WorkspaceNavGroup {
  label: string
  items: WorkspaceNavItem[]
}

/**
 * Grouped navigation for the App Workspace shell (PRIMARY / OPERATIONS /
 * MANAGEMENT), mirroring `App Workspace.dc.html`. Routes map to the existing
 * (dashboard) segments so the design wires straight onto current pages.
 */
export const WORKSPACE_NAV: WorkspaceNavGroup[] = [
  {
    label: 'Primary',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home, crumb: 'Overview' },
      { name: 'Members', href: '/members', icon: Users },
      { name: 'Revenue', href: '/revenue', icon: BarChart3 },
      {
        name: 'Member Analytics',
        href: '/member-analytics',
        icon: LineChart,
        crumb: 'Analytics',
      },
      { name: 'Renewals', href: '/payment-collection', icon: CreditCard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Announcements', href: '/make-announcement', icon: Megaphone },
      {
        name: 'Membership Setup',
        href: '/billing-setup',
        icon: ScrollText,
        crumb: 'Billing Setup',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
      { name: 'Support', href: '/support', icon: LifeBuoy },
    ],
  },
]

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = WORKSPACE_NAV.flatMap(
  (g) => g.items
)

/** Longest-prefix match so nested routes (e.g. /settings/gym) resolve correctly. */
export function activeNavItem(pathname: string): WorkspaceNavItem | undefined {
  return [...WORKSPACE_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    )
}

/** Breadcrumb section label for the current route. */
export function crumbForPath(pathname: string): string {
  const item = activeNavItem(pathname)
  if (!item) return ''
  return item.crumb ?? item.name
}
