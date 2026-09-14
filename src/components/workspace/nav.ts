import {
  Home,
  Users,
  BarChart3,
  LineChart,
  CreditCard,
  Megaphone,
  ScrollText,
  DoorOpen,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react'

/**
 * Capabilities a navigation entry can require. One member today
 * (`accessControlHardware`, Enterprise) — the paid-only ladder's single
 * tier-gated feature. Typed against the `PlanRestrictions` key rather than
 * `string` so a typo fails `tsc` instead of hiding a destination.
 */
export type NavCapability = 'accessControlHardware'

export interface WorkspaceNavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Breadcrumb label shown in the top bar (defaults to `name`). */
  crumb?: string
  /**
   * Where this destination lives on a phone (mobile rebuild plan §5.12, §6).
   *
   * `bar` is the persistent bottom bar, `more` the sheet behind it; `order`
   * sorts within each. Metadata, not a second list: `WORKSPACE_NAV` below
   * stays the only enumeration of the product's destinations, and the desktop
   * sidebar ignores this field entirely.
   *
   * Exactly three items are `bar` (decision C8) — the fourth slot is More.
   */
  mobile: { placement: 'bar' | 'more'; order: number }
  /**
   * Hide this entry unless the gym's plan carries the capability. UX only:
   * every gated destination enforces the same check at its API entry point,
   * and the page itself renders the upgrade panel (`FeatureGate`).
   */
  capability?: NavCapability
}

export interface WorkspaceNavGroup {
  label: string
  items: WorkspaceNavItem[]
}

/**
 * Grouped navigation for the App Workspace shell (PRIMARY / OPERATIONS /
 * MANAGEMENT), mirroring `App Workspace.dc.html`. Routes map to the existing
 * (dashboard) segments so the design wires straight onto current pages.
 *
 * **One list, both tiers.** The desktop sidebar renders the groups as they
 * are; the phone reads `mobile` to split them between the bottom bar and the
 * More sheet (`mobileNav`). A hard-coded mobile list is the fork the plan
 * forbids — it is how a destination goes missing on one tier and nobody
 * notices (risk r04).
 */
export const WORKSPACE_NAV: WorkspaceNavGroup[] = [
  {
    label: 'Primary',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: Home,
        crumb: 'Overview',
        mobile: { placement: 'bar', order: 1 },
      },
      {
        name: 'Members',
        href: '/members',
        icon: Users,
        mobile: { placement: 'bar', order: 2 },
      },
      {
        name: 'Revenue',
        href: '/revenue',
        icon: BarChart3,
        // Read-only and weekly, and already one tap from the dashboard's
        // Revenue tile — which is why the bar has four slots and not five
        // (plan §6.1, option C).
        mobile: { placement: 'more', order: 1 },
      },
      {
        name: 'Member Analytics',
        href: '/member-analytics',
        icon: LineChart,
        crumb: 'Analytics',
        mobile: { placement: 'more', order: 2 },
      },
      {
        name: 'Renewals',
        href: '/payment-collection',
        icon: CreditCard,
        mobile: { placement: 'bar', order: 3 },
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        name: 'Announcements',
        href: '/make-announcement',
        icon: Megaphone,
        mobile: { placement: 'more', order: 1 },
      },
      {
        name: 'Membership Setup',
        href: '/billing-setup',
        icon: ScrollText,
        crumb: 'Billing Setup',
        mobile: { placement: 'more', order: 2 },
      },
      {
        // OPEN-1, closed. The daily door-hardware screen has existed since the
        // access-control feature shipped and has never been in the navigation:
        // it was reachable only by typing the URL or following a link from
        // Settings. Enterprise-gated, so gyms without the hardware never see
        // it (plan §6.2; open decision o12 — default "yes" applied).
        name: 'Door Access',
        href: '/access-control',
        icon: DoorOpen,
        mobile: { placement: 'more', order: 3 },
        capability: 'accessControlHardware',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        name: 'Settings',
        href: '/settings',
        icon: Settings,
        mobile: { placement: 'more', order: 1 },
      },
      {
        name: 'Support',
        href: '/support',
        icon: LifeBuoy,
        mobile: { placement: 'more', order: 2 },
      },
    ],
  },
]

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = WORKSPACE_NAV.flatMap(
  (g) => g.items
)

/** True when the gym's plan carries whatever this entry requires. */
function isEntitled(
  item: WorkspaceNavItem,
  capabilities?: Partial<Record<NavCapability, boolean>>
): boolean {
  if (!item.capability) return true
  return capabilities?.[item.capability] === true
}

/**
 * The phone's split of {@link WORKSPACE_NAV} (plan §6, §5.12).
 *
 * @param capabilities The gym's plan capabilities, from the subscription
 *   serializer. **Undefined while that query is in flight**, and a
 *   capability-gated entry is hidden until it resolves — a destination that
 *   appears and then disappears is worse than one that arrives a moment late.
 *
 * @returns `bar` — the bottom bar's destinations in order; `more` — the
 *   remaining groups, in `WORKSPACE_NAV` order, with their labels, empty
 *   groups dropped. Every entitled item is in exactly one of the two.
 */
export function mobileNav(
  capabilities?: Partial<Record<NavCapability, boolean>>
): { bar: WorkspaceNavItem[]; more: WorkspaceNavGroup[] } {
  const entitled = (items: WorkspaceNavItem[]) =>
    items.filter((item) => isEntitled(item, capabilities))

  const bar = entitled(WORKSPACE_NAV_ITEMS)
    .filter((item) => item.mobile.placement === 'bar')
    .sort((a, b) => a.mobile.order - b.mobile.order)

  const more = WORKSPACE_NAV.map((group) => ({
    label: group.label,
    items: entitled(group.items)
      .filter((item) => item.mobile.placement === 'more')
      .sort((a, b) => a.mobile.order - b.mobile.order),
  })).filter((group) => group.items.length > 0)

  return { bar, more }
}

/**
 * Settings' own sub-navigation — the sections under `/settings`.
 *
 * Here rather than inside `settings/layout.tsx` because there are now **two**
 * consumers: that layout's 160 px rail, and the phone `AppBar`, which has to
 * name the section a nested route is showing. A second copy in the shell is
 * exactly the fork `WORKSPACE_NAV` exists to prevent, one level down.
 */
export const SETTINGS_SECTIONS: ReadonlyArray<{
  name: string
  href: string
}> = [
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
 * What the phone `AppBar` shows for a route (plan §25.2).
 *
 * A root page gets its `crumb` and no Back. A page nested under one gets that
 * section's own name and a Back target — **the parent route, not
 * `router.back()`**, so Back is the same wherever the user arrived from
 * (§6.2). Settings sections are named from {@link SETTINGS_SECTIONS}; any
 * other nested route falls back to its parent's crumb, which is still a true
 * statement of where the user is.
 */
export function appBarTitle(pathname: string): {
  title: string
  parentHref?: string
} {
  const item = activeNavItem(pathname)
  if (!item) return { title: '' }

  const crumb = item.crumb ?? item.name
  if (pathname === item.href) return { title: crumb }

  const section = SETTINGS_SECTIONS.find(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/')
  )
  return { title: section?.name ?? crumb, parentHref: item.href }
}

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
