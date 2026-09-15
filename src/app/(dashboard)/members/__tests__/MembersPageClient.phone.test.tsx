import { screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import type {
  MemberWithDiscount,
  MembersListResponse,
} from '@/features/members/types'
import MembersPageClient from '../MembersPageClient'

/**
 * The Members screen on a phone (mobile rebuild plan §8.2, §9.4, §25.4).
 *
 * A separate file from the desktop suite on purpose: the desktop composition
 * is unchanged by this phase and its tests must stay untouched, so the thing
 * that proves it is that they were never edited.
 *
 * What §9.4 actually demands is stricter than "the row renders": a list has a
 * VISIBLE set, a DISCLOSED set, and columns that may leave the row **only**
 * because they have a listed home elsewhere. A row that quietly drops the
 * joined date is indistinguishable, to a render test, from one that never had
 * it — so these assert the absences too.
 *
 * What they cannot see: whether any of it fits. jsdom computes no geometry;
 * the widths are the probe's, in a browser, and the numbers are in the
 * rebuild log.
 */

jest.mock('@/features/members', () => ({
  __esModule: true,
  MemberAvatar: ({ name }: { name: string }) => (
    <span data-testid="member-avatar">{name.charAt(0)}</span>
  ),
  AddMemberModal: () => null,
  BulkAddMemberModal: () => null,
  DayPassModal: () => null,
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
    member_number: 46,
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

const renderPhone = (payload = list()) => {
  mockFetchRoutes({ '/api/members': apiOk(payload) })
  return renderScreen(<MembersPageClient />, { viewport: 'phone' })
}

/**
 * The first REAL row.
 *
 * `DataTable`'s list path renders skeleton `<li>`s while the query is in
 * flight, so `findAllByRole('listitem')[0]` resolves immediately — to a
 * placeholder. Waiting for content and walking up from it is what makes the
 * assertions about the row rather than about the skeleton.
 */
const row = async (text: string | RegExp = 'Nimal Perera') =>
  (await screen.findByText(text)).closest('li')!

afterEach(() => jest.clearAllMocks())

describe('Members on a phone — §9.4 visible set', () => {
  it('shows the name, the status, the due date, the plan and the fee', async () => {
    renderPhone()
    const r = within(await row())

    expect(r.getByText('Nimal Perera')).toBeInTheDocument()
    expect(r.getByText('Active')).toBeInTheDocument()
    expect(r.getByText('2026-12-01')).toBeInTheDocument()
    expect(r.getByText(/Monthly/)).toBeInTheDocument()
    expect(r.getByText(/5,000/)).toBeInTheDocument()
  })

  it('puts the status and the due date on ONE line, from two columns', async () => {
    renderPhone()
    const r = await row()
    // §8.2: "status = status badge + due". The desktop keeps them as two
    // separately sortable columns, so the row reads them as a pair rather
    // than a combined column being added to the table.
    const statusLine = within(r)
      .getByText('Active')
      .closest('span')?.parentElement
    expect(statusLine).toHaveTextContent('Active')
    expect(statusLine).toHaveTextContent('2026-12-01')
  })

  it('carries the avatar as the row leading, not inside the name', async () => {
    renderPhone()
    const r = within(await row())
    expect(r.getByTestId('member-avatar')).toBeInTheDocument()
    // One avatar, not two: the name column drops its own on this tier
    // precisely because the row renders it in the leading slot.
    expect(r.getAllByTestId('member-avatar')).toHaveLength(1)
  })
})

describe('Members on a phone — §9.4 disclosed set', () => {
  it('offers the phone number as a dialable link', async () => {
    renderPhone()
    const link = within(await row()).getByRole('link', {
      name: '+94770000001',
    })
    expect(link).toHaveAttribute('href', 'tel:+94770000001')
  })

  it('marks that link as an inline text link for the touch rule', async () => {
    renderPhone()
    const link = within(await row()).getByRole('link', {
      name: '+94770000001',
    })
    // §15.1 holds a control to 44 px and a text link to a 24 px line box.
    // `data-inline-link` is the probe's only opt-in into the second rule, and
    // Phase 0 added it to `INLINE_LINK_ALLOW` naming this very link. Without
    // it the row fails the touch rule at every width.
    expect(link).toHaveAttribute('data-inline-link')
  })

  it('does not open the member when the phone link is tapped', async () => {
    renderPhone()
    fireEvent.click(
      within(await row()).getByRole('link', { name: '+94770000001' })
    )
    // The row opens the member; the link dials. Without the stopPropagation
    // a tap would do both.
    expect(openMember).not.toHaveBeenCalled()
  })
})

describe('Members on a phone — what the row must NOT carry', () => {
  it('drops the joined date and the member number', async () => {
    renderPhone()
    const r = await row()
    // Both have a listed home in §9.4 — the member detail — which is the only
    // reason they may leave the row at all. If detail ever stops showing
    // them, this row is where they have to come back.
    expect(r).not.toHaveTextContent('2026-08-01')
    expect(r).not.toHaveTextContent('#0046')
    expect(r).not.toHaveTextContent('46')
  })

  it('renders no table at all', async () => {
    renderPhone()
    await row()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('Members on a phone — the toolbar', () => {
  it('puts search, Add and an overflow menu on the first row', async () => {
    renderPhone()
    // A `textbox`, not a `searchbox`: `SearchBar` composes the plain `Input`
    // primitive with a leading icon rather than `type="search"`.
    expect(
      await screen.findByRole('textbox', { name: 'Search members' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More member actions' })
    ).toBeInTheDocument()
  })

  it('folds Day pass and Bulk import into that menu', async () => {
    renderPhone()
    // Radix opens this on `pointerdown`, which jsdom does not synthesise —
    // `fireEvent.click` leaves the menu closed and the test times out looking
    // for it. Enter on the trigger is the keyboard path and works here, and
    // it is the interaction that has to work anyway.
    fireEvent.keyDown(
      await screen.findByRole('button', { name: 'More member actions' }),
      { key: 'Enter' }
    )
    const menu = within(await screen.findByRole('menu'))
    expect(
      menu.getByRole('menuitem', { name: 'Create day pass' })
    ).toBeInTheDocument()
    expect(
      menu.getByRole('menuitem', { name: 'Bulk import' })
    ).toBeInTheDocument()
    // Three buttons in a row do not fit beside a search field at 320; the
    // desktop keeps all three, which is the other branch of the tier switch.
    expect(
      screen.queryByRole('button', { name: 'Create day pass' })
    ).not.toBeInTheDocument()
  })

  it('moves the record count beside the status filter', async () => {
    renderPhone(list({ totalCount: 46 }))
    // On a desktop the count lives in `PageHeader`, whose title is
    // `phone:sr-only` since Phase 2 — so on a phone it needs a home in the
    // content or it is announced next to a hidden heading.
    expect(await screen.findByText('46 records')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
  })
})

describe('Members on a phone — the list still behaves like the table', () => {
  it('opens a member on tap', async () => {
    renderPhone()
    fireEvent.click(within(await row()).getByRole('button', { name: /Nimal/ }))
    expect(openMember).toHaveBeenCalledWith('m1')
  })

  it('shows the empty state', async () => {
    renderPhone(list({ members: [], totalCount: 0 }))
    expect(
      await screen.findByText('No members match your search.')
    ).toBeInTheDocument()
  })

  it('collapses pagination to the compact form', async () => {
    renderPhone(list({ totalPages: 4 }))
    // §5.6: seven 32 px numbered targets do not fit 320 px, and each is under
    // the §15.1 minimum. `responsive` keeps Prev and Next at the dense size
    // and replaces the numbers with a count.
    expect(await screen.findByText(/1 of 4/)).toBeInTheDocument()
    // Both forms stay in the DOM with one hidden per width (ruling M12), so
    // the numbered button EXISTS here — jsdom applies no CSS. What the test
    // can check is that it is the hidden one.
    const numbered = screen
      .getByRole('button', { name: 'Page 2' })
      .closest('span')
    expect(numbered).toHaveClass('phone:hidden')
  })
})
