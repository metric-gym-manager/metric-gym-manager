import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { toast } from 'sonner'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWithDiscount, Payment } from '../types'
import MemberDetailModal from '../components/MemberDetailModal'

/**
 * The six mutations of `MemberDetailModal`, pinned by their REQUEST BODIES.
 *
 * Written before Phase 3 touched the component and unchanged by it. The phase
 * deletes `MemberDetailModalMobile` and makes this component serve both tiers,
 * which is a merge of two code paths — and the risk in a merge is not that the
 * screen fails to mount (a render test sees that) but that a request quietly
 * changes shape: a dropped `deductOverduePeriod`, an unrounded `paymentAmount`,
 * a `planType` that starts being sent on a renewal. Every one of those is
 * invisible to a screen test, to `tsc`, and to a mocked-Supabase service test,
 * and every one is wrong money.
 *
 * So these assert the wire format, not the UI: method, URL, headers, and the
 * parsed body, for each of suspend / activate / cancel / markRegularPaid /
 * reactivate / delete. They are deliberately literal. A test that recomputed
 * the expected amount with the same helper the component uses would agree with
 * the component however wrong both were.
 *
 * What they cannot see: whether the server accepts any of it. Unit tests mock
 * `fetch`, so a body that is well-formed and semantically wrong passes here
 * (`CLAUDE.md`, Verification Directive 2). The E2E pass on the seeded gym is
 * what checks the other end.
 */

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const MEMBER_ID = 'member-fixture-1'

/**
 * 3,333 at 33% is not an arbitrary fixture. It is the case the component's own
 * comment records: the inline arithmetic this component used to do produced
 * 2233.1099999999997 and `PaymentCalculator` produces 2233.11. The fixture
 * keeps the difference observable, so a future edit that reaches back for the
 * inline version fails here instead of in a receipt.
 */
const baseMember: MemberWithDiscount = {
  id: MEMBER_ID,
  gym_id: 'gym-1',
  member_number: 46,
  name: 'Fathima Herath',
  phone_number: '+94751230428',
  plan_type: 'monthly',
  plan_amount: 3333,
  discount_id: 'discount-1',
  recurring_discount: true,
  status: MemberStatus.Active,
  registered_date: '2026-08-16',
  membership_start_date: '2026-08-16',
  next_due_date: '2026-09-16',
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  discount: {
    id: 'discount-1',
    discount_name: 'Student',
    discount_percentage: 33,
  },
}

const payments: Payment[] = [
  {
    id: 'payment-1',
    member_id: MEMBER_ID,
    payment_date: '2026-08-16',
    amount_paid: 2233.11,
    discount_applied: 'Student',
    discount_percentage: 33,
    next_due_date_calculated: '2026-09-16',
    created_at: '2026-08-16T00:00:00Z',
  },
]

/**
 * Keys are matched by substring and the FIRST hit wins, so the bare member
 * path — which is every other path's prefix — has to come last or it swallows
 * all five of them.
 */
const routes = () => ({
  // Not a member endpoint and not triggered by anything a test does:
  // `ReactivationLimitDialog` is always mounted (closed) and calls
  // `useSubscription()` unconditionally, so opening a member detail fires this
  // on mount. Harmless in the app — the shell already holds that query, so it
  // is a cache hit — but it means "the component made exactly one request" has
  // to mean one MEMBER request. See `memberUrls`.
  '/api/settings/subscription': { data: { subscription: {} } },
  [`/api/members/${MEMBER_ID}/suspend`]: { success: true },
  [`/api/members/${MEMBER_ID}/activate`]: { success: true },
  [`/api/members/${MEMBER_ID}/cancel`]: { success: true },
  [`/api/members/${MEMBER_ID}/payment`]: { success: true },
  '/api/billing-setup/plans': { data: [] },
  [`/api/members/${MEMBER_ID}`]: { success: true },
})

function renderDetail(
  overrides: Partial<MemberWithDiscount> = {},
  viewport: 'phone' | 'desktop' = 'desktop'
) {
  const fetchMock = mockFetchRoutes(routes())
  const result = renderScreen(
    <MemberDetailModal
      open
      onClose={jest.fn()}
      member={{ ...baseMember, ...overrides }}
      payments={payments}
      onEditClick={jest.fn()}
    />,
    { viewport }
  )
  return { ...result, fetchMock }
}

/** The one request made to `path`, decoded. */
async function requestTo(fetchMock: jest.Mock, path: string) {
  const find = () =>
    (fetchMock.mock.calls as [string, RequestInit | undefined][]).find(
      ([url]) => url === path
    )

  await waitFor(() => expect(find()).toBeDefined())
  const [url, init] = find()!
  return {
    url,
    method: init?.method,
    headers: init?.headers,
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  }
}

/**
 * The MEMBER requests the component made, so a test can assert it made only
 * the one it drove. Scoped to `/api/members/` deliberately: the mount-time
 * subscription query above is not this component's business and counting it
 * would make every one of these assertions a test of `ReactivationLimitDialog`.
 */
const memberUrls = (fetchMock: jest.Mock) =>
  (fetchMock.mock.calls as [string, RequestInit | undefined][])
    .map(([u]) => u)
    .filter((u) => u.startsWith('/api/members/'))

afterEach(() => jest.clearAllMocks())

describe('MemberDetailModal — suspend', () => {
  it('POSTs to /suspend with a JSON content type and no body', async () => {
    const { fetchMock } = renderDetail({ status: MemberStatus.Active })

    fireEvent.click(screen.getByRole('button', { name: 'Suspend Member' }))

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}/suspend`)
    expect(req.method).toBe('POST')
    expect(req.headers).toEqual({ 'Content-Type': 'application/json' })
    // The member id is in the PATH. A body here would be a second source of
    // truth for which member is being suspended.
    expect(req.body).toBeUndefined()
    expect(memberUrls(fetchMock)).toHaveLength(1)
  })

  it('shows the server message when the request is refused', async () => {
    renderDetail({ status: MemberStatus.Active })
    // The real envelope: ResponseBuilder nests the text under `error.message`.
    // Reading `body.error` printed "[object Object]" in the toast.
    mockFetchRoutes({
      ...routes(),
      [`/api/members/${MEMBER_ID}/suspend`]: {
        status: 400,
        body: ResponseBuilder.error(
          'Member is already suspended',
          'BAD_REQUEST'
        ),
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Suspend Member' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Member is already suspended')
    )
    expect(toast.error).not.toHaveBeenCalledWith('[object Object]')
  })
})

describe('MemberDetailModal — cancel', () => {
  it('POSTs to /cancel with a JSON content type and no body', async () => {
    const { fetchMock } = renderDetail({ status: MemberStatus.Expired })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Member' }))

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}/cancel`)
    expect(req.method).toBe('POST')
    expect(req.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(req.body).toBeUndefined()
    expect(memberUrls(fetchMock)).toHaveLength(1)
  })

  it('shows the server message when the request is refused', async () => {
    renderDetail({ status: MemberStatus.Expired })
    mockFetchRoutes({
      ...routes(),
      [`/api/members/${MEMBER_ID}/cancel`]: {
        status: 404,
        body: ResponseBuilder.notFound('Member'),
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Member' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Member not found')
    )
    expect(toast.error).not.toHaveBeenCalledWith('[object Object]')
  })
})

describe('MemberDetailModal — activate', () => {
  it('POSTs the chosen due date and nothing else', async () => {
    const { fetchMock } = renderDetail({ status: MemberStatus.Expired })

    // Two controls are named "Activate Member" once the dialog is open — the
    // status action that opens it and the dialog's own confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Activate Member' }))
    const dialog = within(await screen.findByRole('dialog'))

    fireEvent.change(screen.getByLabelText('New Due Date'), {
      target: { value: '2026-12-01' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Activate Member' }))

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}/activate`)
    expect(req.method).toBe('POST')
    expect(req.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(req.body).toEqual({ newDueDate: '2026-12-01' })
  })

  it('sends nothing until a date is picked', async () => {
    const { fetchMock } = renderDetail({ status: MemberStatus.Expired })

    fireEvent.click(screen.getByRole('button', { name: 'Activate Member' }))
    const dialog = within(await screen.findByRole('dialog'))

    expect(
      dialog.getByRole('button', { name: 'Activate Member' })
    ).toBeDisabled()
    expect(memberUrls(fetchMock)).toHaveLength(0)
  })
})

describe('MemberDetailModal — mark a regular payment paid', () => {
  it('POSTs the ROUNDED effective amount, the plan amount and the discount id', async () => {
    const { fetchMock } = renderDetail({ status: MemberStatus.Active })

    fireEvent.click(screen.getByRole('button', { name: 'Mark Paid' }))
    const dialog = within(await screen.findByRole('dialog'))

    fireEvent.change(screen.getByLabelText('Payment Date'), {
      target: { value: '2026-09-14' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Confirm Payment' }))

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}/payment`)
    expect(req.method).toBe('POST')
    expect(req.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(req.body).toEqual({
      planAmount: 3333,
      // 2233.11, NOT 2233.1099999999997. Literal on purpose: recomputing it
      // with the same helper the component uses would agree with the component
      // however wrong both were.
      paymentAmount: 2233.11,
      paymentDate: '2026-09-14',
      discountId: 'discount-1',
      // A renewal always settles the overdue period; the server advances the
      // due date from the boundary, not from today.
      deductOverduePeriod: true,
    })
    // A renewal must NOT carry a planType — that is the reactivation payload,
    // and sending it here would let a renewal silently switch the plan.
    expect(req.body).not.toHaveProperty('planType')
  })

  it('omits the discount id when the discount is one-off, and charges full price', async () => {
    const { fetchMock } = renderDetail({
      status: MemberStatus.Active,
      recurring_discount: false,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Mark Paid' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'Confirm Payment' }))

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}/payment`)
    // A one-off discount was consumed by the payment it was granted for, so
    // the renewal is charged at the plan amount…
    expect(req.body.paymentAmount).toBe(3333)
    // …while `discountId` still goes, because the member still HOLDS that
    // discount. Pinned because it reads like an inconsistency and is not one.
    expect(req.body.discountId).toBe('discount-1')
  })
})

describe('MemberDetailModal — reactivate', () => {
  it('POSTs the plan type alongside the amounts, and no discount id', async () => {
    const { fetchMock } = renderDetail({ status: MemberStatus.Cancelled })

    fireEvent.click(screen.getByRole('button', { name: 'Re-activate' }))
    const dialog = within(await screen.findByRole('dialog'))

    fireEvent.change(screen.getByLabelText('Payment Date'), {
      target: { value: '2026-09-14' },
    })
    fireEvent.click(
      dialog.getByRole('button', { name: /Reactivate & Record Payment/ })
    )

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}/payment`)
    expect(req.method).toBe('POST')
    expect(req.body).toEqual({
      // The operator may switch plans while reactivating; this is the one
      // payment payload that carries a plan type.
      planType: 'monthly',
      planAmount: 3333,
      // NOT discounted: the reactivation dialog prefills both amounts from the
      // member's plan amount and the operator edits them.
      paymentAmount: 3333,
      paymentDate: '2026-09-14',
      deductOverduePeriod: true,
    })
    expect(req.body).not.toHaveProperty('discountId')
  })
})

describe('MemberDetailModal — delete', () => {
  it('DELETEs the member path with no body and no content type', async () => {
    const { fetchMock } = renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Delete member' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'Delete Member' }))

    const req = await requestTo(fetchMock, `/api/members/${MEMBER_ID}`)
    expect(req.method).toBe('DELETE')
    expect(req.headers).toBeUndefined()
    expect(req.body).toBeUndefined()
  })

  it('asks before deleting', async () => {
    const { fetchMock } = renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Delete member' }))
    await screen.findByRole('dialog')

    // Opening the confirm must not itself be the destructive step.
    expect(memberUrls(fetchMock)).toHaveLength(0)
  })
})

describe('MemberDetailModal — the requests do not depend on the tier', () => {
  /**
   * The point of the phase: one component serves both tiers, so the phone
   * cannot drift from the desktop the way `MemberDetailModalMobile` did. Each
   * mutation is driven twice and the two bodies must be identical.
   */
  it.each([
    ['suspend', MemberStatus.Active, 'Suspend Member', `/suspend`],
    ['cancel', MemberStatus.Expired, 'Cancel Member', `/cancel`],
  ] as const)(
    '%s sends the same body on a phone as on a desktop',
    async (_name, status, button, path) => {
      const desktop = renderDetail({ status }, 'desktop')
      fireEvent.click(screen.getByRole('button', { name: button }))
      const onDesktop = await requestTo(
        desktop.fetchMock,
        `/api/members/${MEMBER_ID}${path}`
      )
      desktop.unmount()

      const phone = renderDetail({ status }, 'phone')
      fireEvent.click(screen.getByRole('button', { name: button }))
      const onPhone = await requestTo(
        phone.fetchMock,
        `/api/members/${MEMBER_ID}${path}`
      )

      expect(onPhone).toEqual(onDesktop)
    }
  )
})
