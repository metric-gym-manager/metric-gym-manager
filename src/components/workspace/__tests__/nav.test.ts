import { WORKSPACE_NAV, WORKSPACE_NAV_ITEMS, activeNavItem } from '../nav'

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

  it('lists Door Access in the Operations group', () => {
    const operations = WORKSPACE_NAV.find((g) => g.label === 'Operations')
    expect(operations?.items.map((i) => i.href)).toContain('/access-control')
  })

  it('resolves the door-access route to its own nav item', () => {
    expect(activeNavItem('/access-control')?.name).toBe('Door Access')
  })

  it('does not steal the access-control settings page from Settings', () => {
    // Longest-prefix matching compares '/access-control' (15) against
    // '/settings' (9), and the settings sub-page must still highlight
    // Settings — the two screens are different jobs for different people.
    expect(activeNavItem('/settings/access-control')?.name).toBe('Settings')
  })

  it('resolves the analytics route (and its subpaths) to its nav item', () => {
    expect(activeNavItem('/member-analytics')?.name).toBe('Member Analytics')
    expect(activeNavItem('/member-analytics/anything')?.name).toBe(
      'Member Analytics'
    )
  })
})
