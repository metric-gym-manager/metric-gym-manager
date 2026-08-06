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

  it('resolves the analytics route (and its subpaths) to its nav item', () => {
    expect(activeNavItem('/member-analytics')?.name).toBe('Member Analytics')
    expect(activeNavItem('/member-analytics/anything')?.name).toBe(
      'Member Analytics'
    )
  })
})
