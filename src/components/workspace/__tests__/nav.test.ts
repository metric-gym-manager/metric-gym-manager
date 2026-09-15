import {
  WORKSPACE_NAV,
  WORKSPACE_NAV_ITEMS,
  activeNavItem,
  appBarTitle,
  mobileNav,
  SETTINGS_SECTIONS,
} from '../nav'

describe('workspace navigation', () => {
  it('places Member Analytics immediately after Revenue in the Primary group', () => {
    const primary = WORKSPACE_NAV.find((g) => g.label === 'Primary')
    expect(primary).toBeDefined()
    const names = primary!.items.map((i) => i.name)
    const revenueIdx = names.indexOf('Revenue')
    expect(revenueIdx).toBeGreaterThanOrEqual(0)
    expect(names[revenueIdx + 1]).toBe('Member Analytics')
  })

  it('exposes the analytics route in the flattened nav items', () => {
    const item = WORKSPACE_NAV_ITEMS.find((i) => i.href === '/member-analytics')
    expect(item?.name).toBe('Member Analytics')
  })

  it('resolves the analytics route (and its subpaths) to its nav item', () => {
    expect(activeNavItem('/member-analytics')?.name).toBe('Member Analytics')
    expect(activeNavItem('/member-analytics/anything')?.name).toBe(
      'Member Analytics'
    )
  })
})

/**
 * The phone's split of the one list (mobile rebuild plan §5.12, §6).
 *
 * Risk r04 is "the navigation redesign hides a destination". The mitigation is
 * that there is no second list to fall out of step — so the assertions below
 * are about the SPLIT being total and disjoint, computed from `WORKSPACE_NAV`,
 * not about a hand-written set of names that would agree with a shell which
 * had quietly dropped one.
 */
describe('mobileNav', () => {
  const enterprise = { accessControlHardware: true }
  const flat = (groups: ReturnType<typeof mobileNav>['more']) =>
    groups.flatMap((g) => g.items)

  it('puts every entitled destination in exactly one of bar and More', () => {
    const { bar, more } = mobileNav(enterprise)
    const placed = [...bar, ...flat(more)].map((i) => i.href)

    expect([...placed].sort()).toEqual(
      WORKSPACE_NAV_ITEMS.map((i) => i.href).sort()
    )
    expect(new Set(placed).size).toBe(placed.length)
  })

  it('gives the bar exactly three items — the fourth slot is More (C8)', () => {
    const { bar } = mobileNav(enterprise)
    expect(bar.map((i) => i.name)).toEqual(['Dashboard', 'Members', 'Renewals'])
  })

  it('orders the bar by its declared order, not by list position', () => {
    // Renewals is declared fifth in Primary and is the third slot.
    const { bar } = mobileNav(enterprise)
    expect(bar.map((i) => i.mobile.order)).toEqual([1, 2, 3])
  })

  it('keeps the sheet in the sidebar’s own group order', () => {
    const { more } = mobileNav(enterprise)
    expect(more.map((g) => g.label)).toEqual([
      'Primary',
      'Operations',
      'Management',
    ])
  })

  it('hides a capability-gated destination from a gym without it', () => {
    const { bar, more } = mobileNav({ accessControlHardware: false })
    expect([...bar, ...flat(more)].map((i) => i.href)).not.toContain(
      '/access-control'
    )
  })

  it('hides it while the subscription is still loading', () => {
    // Undefined capabilities means "not known yet". Showing the entry and
    // then removing it is worse than showing it a moment late.
    const { more } = mobileNav(undefined)
    expect(flat(more).map((i) => i.href)).not.toContain('/access-control')
  })

  it('shows it to an Enterprise gym', () => {
    expect(flat(mobileNav(enterprise).more).map((i) => i.href)).toContain(
      '/access-control'
    )
  })

  it('drops a group that ends up empty rather than rendering a bare label', () => {
    const { more } = mobileNav(enterprise)
    expect(more.every((g) => g.items.length > 0)).toBe(true)
  })

  it('declares a mobile placement for every destination', () => {
    // A new nav entry without one would be a `undefined.placement` crash in
    // the shell; TypeScript catches it, and this catches a cast.
    for (const item of WORKSPACE_NAV_ITEMS) {
      expect(['bar', 'more']).toContain(item.mobile.placement)
    }
  })
})

/**
 * What the phone AppBar shows (plan §25.2, §6.2).
 */
describe('appBarTitle', () => {
  it('titles a root page with its crumb and offers no Back', () => {
    expect(appBarTitle('/dashboard')).toEqual({ title: 'Overview' })
    expect(appBarTitle('/members')).toEqual({ title: 'Members' })
  })

  it('titles a settings section with the section’s own name', () => {
    expect(appBarTitle('/settings/gym')).toEqual({
      title: 'Gym Information',
      parentHref: '/settings',
    })
  })

  it('points Back at the parent route, not at history', () => {
    // `router.back()` depends on how the user arrived — through the menu, from
    // a deep link, or after a form submit. The parent is the same answer
    // every time.
    for (const section of SETTINGS_SECTIONS) {
      expect(appBarTitle(section.href).parentHref).toBe('/settings')
    }
  })

  it('falls back to the parent’s crumb for an unnamed nested route', () => {
    expect(appBarTitle('/member-analytics/cohorts')).toEqual({
      title: 'Analytics',
      parentHref: '/member-analytics',
    })
  })

  it('titles nothing outside the navigation', () => {
    expect(appBarTitle('/not-a-route')).toEqual({ title: '' })
  })
})

describe('SETTINGS_SECTIONS', () => {
  it('is the one list, shared by the settings rail and the AppBar', () => {
    // Both consumers resolve a section name from here. A second copy in the
    // shell is the fork WORKSPACE_NAV exists to prevent, one level down.
    expect(
      SETTINGS_SECTIONS.every((s) => s.href.startsWith('/settings/'))
    ).toBe(true)
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.href)).size).toBe(
      SETTINGS_SECTIONS.length
    )
  })
})
