import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SectionHeader } from '../SectionHeader'
import { PageHeader } from '../PageHeader'
import { Toolbar } from '../Toolbar'
import { SearchBar } from '../SearchBar'
import { StatCard } from '../StatCard'
import { ChartCard } from '../ChartCard'
import { EmptyStateLayout, LoadingLayout } from '../StateLayouts'
import { SettingsSection, SettingsRow } from '../SettingsSection'
import { ConfirmDialog } from '../ConfirmDialog'
import { DeleteDialog } from '../DeleteDialog'
import { SideNav } from '../SideNav'
import { UserMenu } from '../UserMenu'
import { NotificationMenu } from '../NotificationMenu'

describe('Headers & toolbar', () => {
  it('SectionHeader renders title, description, actions', () => {
    render(
      <SectionHeader
        title="Members"
        description="Everyone"
        actions={<button>Add</button>}
      />
    )
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument()
    expect(screen.getByText('Everyone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('PageHeader renders an h1 and breadcrumb slot', () => {
    render(
      <PageHeader
        title="Dashboard"
        breadcrumb={<nav aria-label="Breadcrumb">crumbs</nav>}
      />
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' })
    ).toBeInTheDocument()
  })

  it('Toolbar exposes a toolbar role with start/end slots', () => {
    render(<Toolbar start={<span>left</span>} end={<span>right</span>} />)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
    expect(screen.getByText('left')).toBeInTheDocument()
    expect(screen.getByText('right')).toBeInTheDocument()
  })
})

describe('SearchBar', () => {
  it('debounces onSearch and does not fire on mount', () => {
    jest.useFakeTimers()
    try {
      const onSearch = jest.fn()
      render(<SearchBar onSearch={onSearch} />)
      expect(onSearch).not.toHaveBeenCalled()
      fireEvent.change(screen.getByLabelText('Search'), {
        target: { value: 'nim' },
      })
      expect(onSearch).not.toHaveBeenCalled()
      act(() => {
        jest.advanceTimersByTime(300)
      })
      expect(onSearch).toHaveBeenCalledWith('nim')
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('StatCard', () => {
  it('renders label and value', () => {
    render(
      <StatCard label="Active members" value="1,284" sub="+12 this week" />
    )
    expect(screen.getByText('Active members')).toBeInTheDocument()
    expect(screen.getByText('1,284')).toBeInTheDocument()
  })

  it('becomes a button when clickable', () => {
    const onClick = jest.fn()
    render(<StatCard label="Revenue" value="LKR 4,990" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})

describe('ChartCard & state layouts', () => {
  it('ChartCard renders title, scale and child chart', () => {
    render(
      <ChartCard title="Revenue" scale="LKR ×1,000">
        <div>chart</div>
      </ChartCard>
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('LKR ×1,000')).toBeInTheDocument()
    expect(screen.getByText('chart')).toBeInTheDocument()
  })

  it('EmptyStateLayout renders the empty state', () => {
    render(<EmptyStateLayout title="No members yet" description="Add one" />)
    expect(screen.getByText('No members yet')).toBeInTheDocument()
  })

  it('LoadingLayout is a polite busy region', () => {
    render(<LoadingLayout variant="cards" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
  })
})

describe('SettingsSection', () => {
  it('renders a titled group with rows', () => {
    render(
      <SettingsSection
        title="Notifications"
        description="How members are reminded"
      >
        <SettingsRow
          label="SMS reminders"
          description="Before due date"
          control={<span>toggle</span>}
        />
      </SettingsSection>
    )
    expect(
      screen.getByRole('heading', { name: 'Notifications' })
    ).toBeInTheDocument()
    expect(screen.getByText('SMS reminders')).toBeInTheDocument()
    expect(screen.getByText('toggle')).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('calls onConfirm then closes', async () => {
    const onConfirm = jest.fn()
    const onOpenChange = jest.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel subscription"
        description="This cannot be undone."
        onConfirm={onConfirm}
        destructive
      />
    )
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})

describe('DeleteDialog', () => {
  it('gates deletion behind type-to-confirm', async () => {
    const onConfirm = jest.fn()
    render(
      <DeleteDialog
        open
        onOpenChange={() => {}}
        title="Delete member"
        onConfirm={onConfirm}
        confirmWord="DELETE"
      />
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'DELETE' },
    })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
  })
})

describe('SideNav', () => {
  it('marks the active item and renders links', () => {
    render(
      <SideNav
        groups={[
          {
            label: 'Main',
            items: [
              { label: 'Dashboard', href: '/', active: true },
              { label: 'Members', href: '/members' },
            ],
          },
        ]}
      />
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'href',
      '/members'
    )
  })

  it('keeps labels accessible when collapsed', () => {
    render(
      <SideNav
        collapsed
        groups={[{ items: [{ label: 'Members', href: '/members' }] }]}
      />
    )
    expect(screen.getByRole('link', { name: 'Members' })).toBeInTheDocument()
  })
})

describe('UserMenu & NotificationMenu triggers', () => {
  it('UserMenu shows the account name and email in the trigger', () => {
    render(
      <UserMenu
        name="Nimal Perera"
        email="nimal@example.com"
        onSignOut={() => {}}
      />
    )
    expect(screen.getByText('Nimal Perera')).toBeInTheDocument()
    expect(screen.getByText('nimal@example.com')).toBeInTheDocument()
  })

  it('NotificationMenu announces the unread count', () => {
    render(<NotificationMenu count={3}>list</NotificationMenu>)
    expect(
      screen.getByRole('button', { name: 'Notifications, 3 unread' })
    ).toBeInTheDocument()
  })
})
