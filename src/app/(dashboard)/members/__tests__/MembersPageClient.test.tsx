import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import type {
  MemberWithDiscount,
  MembersListResponse,
} from '@/features/members/types'
import MembersPageClient from '../MembersPageClient'
import { formatDate } from '@/utils/date/date'

// The three modals are `next/dynamic` imports of the whole members feature
// barrel. They contribute nothing to what this file asserts and pull in
// Supabase clients, so they are stubbed to keep the unit under test the screen.
jest.mock('@/features/members', () => ({
  __esModule: true,
  // Initials, not the name: a stub that echoes the name makes every
  // `getByText(name)` ambiguous and forces the assertions to loosen, which is
  // how a test stops being able to tell the name cell from a decoration.
  MemberAvatar: ({ name }: { name: string }) => (
    <span data-testid="member-avatar">{name.charAt(0)}</span>
  ),
  AddMemberModal: () => null,
  BulkAddMemberModal: () => null,
  DayPassModal: () => null,
  // Added by the mobile rebuild's Phase 4. A `next/dynamic` import of a name
  // this mock does not define resolves to `{ default: undefined }`, and React
  // then throws "Element type is invalid" from `LoadableComponent` — which
  // names the loader, not the missing export, so every assertion below fails
  // at once for a reason none of them is about.
  BulkImportGuidanceSheet: () => null,
}))

const openMember = jest.fn()
jest.mock('@/contexts/member-modal.context', () => ({
  useMemberModal: () => ({ openMember: (id: string) => openMember(id) }),
}))

const member = (over: Partial<MemberWithDiscount> = {}): MemberWithDiscount =>
  ({
    id: 'm1',
    gym_id: 'g1',
    member_number: 1,
    name: 'Nimal Perera',
    phone_number: '+94770000001',
    plan_type: 'monthly',
    plan_amount: 5000,
    discount_id: null,
    recurring_discount: false,
    status: 'active',
    registered_date: '2026-08-01',
    membership_start_date: '2026-08-01',
    next_due_date: '2026-12-01',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    photo_path: null,
    photo_updated_at: null,
    registration_source: 'manual',
    verified_at: null,
    ...over,
  }) as MemberWithDiscount

const list = (
  over: Partial<MembersListResponse> = {}
): MembersListResponse => ({
  members: [member()],
  overdueMembers: [],
  totalCount: 1,
  page: 1,
  totalPages: 1,
  ...over,
})

describe('MembersPageClient', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders a member row with every column populated', async () => {
    mockFetchRoutes({ '/api/members': apiOk(list()) })
    renderScreen(<MembersPageClient />)

    expect(await screen.findByText('Nimal Perera')).toBeInTheDocument()
    expect(screen.getByText('+94770000001')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText(formatDate('2026-08-01'))).toBeInTheDocument()
    expect(screen.getByText(formatDate('2026-12-01'))).toBeInTheDocument()
    expect(screen.getByText('5,000')).toBeInTheDocument()
  })

  /**
   * "1 records" shipped to the rendered page and was caught by eye, not by any
   * check in the repo. The count is the only text in the header slot, so it is
   * cheap to pin both ways round.
   */
  it('counts records in the singular at one and the plural otherwise', async () => {
    mockFetchRoutes({ '/api/members': apiOk(list()) })
    const { unmount } = renderScreen(<MembersPageClient />)
    expect(await screen.findByText('1 record')).toBeInTheDocument()
    unmount()

    mockFetchRoutes({
      '/api/members': apiOk(
        list({ members: [member(), member({ id: 'm2' })], totalCount: 2 })
      ),
    })
    renderScreen(<MembersPageClient />)
    expect(await screen.findByText('2 records')).toBeInTheDocument()
  })

  it('sends the search term to the API and resets to page one', async () => {
    jest.useFakeTimers()
    try {
      const fetchMock = mockFetchRoutes({ '/api/members': apiOk(list()) })
      renderScreen(<MembersPageClient />)

      fireEvent.change(screen.getByLabelText('Search members'), {
        target: { value: 'nimal' },
      })
      // SearchBar debounces; without advancing timers the request never fires.
      await act(async () => {
        jest.advanceTimersByTime(500)
      })

      await waitFor(() => {
        const urls = fetchMock.mock.calls.map((c) => String(c[0]))
        expect(urls.some((u) => u.includes('search=nimal'))).toBe(true)
      })
      const searched = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .find((u) => u.includes('search=nimal'))
      expect(searched).toContain('page=1')
    } finally {
      jest.useRealTimers()
    }
  })

  it('sends the status filter to the API', async () => {
    const fetchMock = mockFetchRoutes({ '/api/members': apiOk(list()) })
    renderScreen(<MembersPageClient />)
    await screen.findByText('Nimal Perera')

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'expired' },
    })

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('status=expired'))).toBe(true)
    })
  })

  /**
   * The pre-migration table opened a member from a bare `<tr onClick>` with no
   * `tabIndex`, no key handler and no role — the main action of the main screen
   * was mouse-only. This asserts the keyboard path specifically, because that
   * is the half that regressed before.
   */
  it('opens a member by click and by keyboard', async () => {
    mockFetchRoutes({ '/api/members': apiOk(list()) })
    renderScreen(<MembersPageClient />)
    await screen.findByText('Nimal Perera')

    const row = screen.getByText('Nimal Perera').closest('tr')!
    fireEvent.click(row)
    expect(openMember).toHaveBeenCalledWith('m1')

    openMember.mockClear()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(openMember).toHaveBeenCalledWith('m1')
  })

  it('shows the empty state as a centred message, not a bare cell', async () => {
    mockFetchRoutes({
      '/api/members': apiOk(list({ members: [], totalCount: 0 })),
    })
    renderScreen(<MembersPageClient />)

    const empty = await screen.findByText('No members match your search.')
    // A string `empty` used to fall straight into the <td>, unpadded and
    // left-aligned, reading as a second header row. It is normalised into an
    // EmptyState, whose title is a heading.
    expect(empty.tagName.toLowerCase()).toBe('h3')
  })

  it('surfaces a failed request as an error, not as an empty table', async () => {
    mockFetchRoutes({ '/api/members': { status: 500, body: {} } })
    renderScreen(<MembersPageClient />)
    expect(
      await screen.findByText('Failed to load members.')
    ).toBeInTheDocument()
  })

  /**
   * Sortable headers were removed: `DataTable` sorts client-side over the 20
   * rows of the current server page, so a "Name" sort looked global and was
   * not. Nothing else in the repo would notice them coming back.
   */
  it('exposes no column sort, because paging is server-side', async () => {
    mockFetchRoutes({ '/api/members': apiOk(list()) })
    renderScreen(<MembersPageClient />)
    await screen.findByText('Nimal Perera')

    for (const header of screen.getAllByRole('columnheader')) {
      expect(header.querySelector('button')).toBeNull()
      expect(header).not.toHaveAttribute('aria-sort')
    }
  })
})
