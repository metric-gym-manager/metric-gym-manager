import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Home, Users, CreditCard } from 'lucide-react'
import { AppBar } from '../AppBar'
import { BottomNav } from '../BottomNav'

/**
 * The phone chrome (mobile rebuild plan §5.11, §25.2, §25.3, §6).
 *
 * Built in Phase 1, wired into `WorkspaceShell` in Phase 2 — so these test
 * the composites' own contract, not the shell's. The shell's job (deriving
 * the items from `WORKSPACE_NAV`, so no destination can go missing — risk
 * r04) is Phase 2's test.
 */

const items = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Renewals', href: '/payment-collection', icon: CreditCard },
]

describe('AppBar', () => {
  it('is a banner landmark with the section name as its heading', () => {
    render(<AppBar title="Overview" />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Overview' })
    ).toBeInTheDocument()
  })

  it('leads with the gym identity on a root page, and it opens More', () => {
    const onOpen = jest.fn()
    render(
      <AppBar
        title="Overview"
        identity={{ name: 'Colombo Iron', onOpen, expanded: false }}
      />
    )
    const button = screen.getByRole('button', {
      name: /Colombo Iron/,
    })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('leads with Back on a nested page, and Back wins over the identity', () => {
    const onBack = jest.fn()
    const onOpen = jest.fn()
    render(
      <AppBar
        title="Gym profile"
        onBack={onBack}
        identity={{ name: 'Colombo Iron', onOpen }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    // A nested screen leads with Back — never two leading controls.
    expect(
      screen.queryByRole('button', { name: /Colombo Iron/ })
    ).not.toBeInTheDocument()
  })

  it('gives the leading control the primary touch target', () => {
    render(<AppBar title="Gym profile" onBack={() => {}} />)
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
      'size-touch'
    )
  })

  it('carries no action slot (correction C7)', () => {
    render(
      <AppBar
        title="Members"
        identity={{ name: 'Colombo Iron', onOpen: () => {} }}
      />
    )
    // One control: the leading one. A trailing action slot would mean every
    // page pushing its buttons up into shared chrome through context.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('keeps clear of the notch', () => {
    render(<AppBar title="Overview" />)
    expect(screen.getByRole('banner')).toHaveClass('pt-safe-top')
  })
})

describe('BottomNav', () => {
  it('is the Workspace navigation landmark', () => {
    render(<BottomNav items={items} />)
    expect(
      screen.getByRole('navigation', { name: 'Workspace' })
    ).toBeInTheDocument()
  })

  it('renders one link per destination, in order', () => {
    render(<BottomNav items={items} />)
    const links = within(
      screen.getByRole('navigation', { name: 'Workspace' })
    ).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Members',
      'Renewals',
    ])
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/dashboard',
      '/members',
      '/payment-collection',
    ])
  })

  it('marks the current destination, and only that one', () => {
    render(<BottomNav items={items} activeHref="/members" />)
    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Members')
  })

  it('adds More as a fourth slot that reports whether it is open', () => {
    const onToggle = jest.fn()
    render(<BottomNav items={items} more={{ open: false, onToggle }} />)
    const more = screen.getByRole('button', { name: 'More' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('gives every slot the primary touch target', () => {
    render(
      <BottomNav items={items} more={{ open: false, onToggle: () => {} }} />
    )
    for (const el of [
      ...screen.getAllByRole('link'),
      screen.getByRole('button', { name: 'More' }),
    ]) {
      expect(el).toHaveClass('min-h-touch')
      // `flex-1`: the four slots share the width, so the bar cannot overflow
      // and become the horizontal scroller it replaces (audit §D: 754px on a
      // 390px screen).
      expect(el).toHaveClass('flex-1')
    }
  })

  it('keeps clear of the home indicator', () => {
    render(<BottomNav items={items} />)
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toHaveClass(
      'pb-safe-bottom'
    )
  })

  it('can be taken out of the fixed position for the showcase', () => {
    render(<BottomNav items={items} className="static" />)
    const nav = screen.getByRole('navigation', { name: 'Workspace' })
    expect(nav).toHaveClass('static')
    expect(nav).not.toHaveClass('fixed')
  })
})
