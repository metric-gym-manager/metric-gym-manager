import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWithDiscount } from '../types'
import EditMemberModal from '../components/EditMemberModal'

/**
 * What the edit form actually sends and what it shows when the server refuses.
 *
 * Asserts the wire format (method, URL, parsed body) because a mocked-fetch
 * screen test that only checks "a request happened" passes while the body
 * carries the wrong values — which is the symptom reported against this modal.
 */
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const DISCOUNT_ID = '6f1c1c0e-6a6f-4f3c-9d8e-3b1f6f0a1111'

const member: MemberWithDiscount = {
  id: 'member-edit-1',
  gym_id: 'gym-1',
  member_number: 46,
  name: 'Fathima Herath',
  phone_number: '+94751230428',
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: DISCOUNT_ID,
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
  discount: null,
}

const plans = [
  {
    id: 'p1',
    gym_id: 'gym-1',
    plan_type: 'monthly',
    default_amount: 3500,
    is_active: true,
  },
  {
    id: 'p2',
    gym_id: 'gym-1',
    plan_type: 'annual',
    default_amount: 35000,
    is_active: true,
  },
]

const discounts = [
  {
    id: DISCOUNT_ID,
    discount_name: 'Student',
    discount_percentage: 10,
    is_active: true,
  },
]

interface PatchCall {
  url: string
  body: Record<string, unknown>
}

/**
 * Routes GETs by path and answers the PATCH with `patchReply`. Returns the
 * recorded PATCH calls so a test can read the body the form really sent.
 */
function mockApi(
  patchReply: { status: number; body: unknown },
  lists: { plans?: typeof plans; discounts?: typeof discounts } = {}
): { patches: PatchCall[] } {
  const patches: PatchCall[] = []
  globalThis.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const respond = (status: number, body: unknown) =>
        ({
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
        }) as Response

      if (init?.method === 'PATCH') {
        patches.push({ url, body: JSON.parse(String(init.body)) })
        return respond(patchReply.status, patchReply.body)
      }
      if (url.includes('/api/billing-setup/plans')) {
        return respond(200, { success: true, data: lists.plans ?? plans })
      }
      if (url.includes('/api/billing-setup/discounts')) {
        return respond(200, {
          success: true,
          data: lists.discounts ?? discounts,
        })
      }
      throw new Error(`unrouted request: ${url}`)
    }
  ) as unknown as typeof fetch
  return { patches }
}

const ok = { status: 200, body: { success: true, data: {} } }

async function openForm(
  onClose = jest.fn(),
  target: MemberWithDiscount = member
) {
  renderScreen(<EditMemberModal open onClose={onClose} member={target} />)
  // Options load asynchronously; wait for the plan list so the selects settle.
  await screen.findByRole('option', { name: /Annual/ })
  return onClose
}

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /update member/i }))

describe('EditMemberModal — what is sent', () => {
  it('pre-fills every field from the member', async () => {
    mockApi(ok)
    await openForm()

    expect(screen.getByLabelText(/^Name/)).toHaveValue('Fathima Herath')
    expect(screen.getByLabelText(/Phone Number/)).toHaveValue('+94751230428')
    expect(screen.getByLabelText(/Plan Amount/)).toHaveValue(3500)
    expect(screen.getByLabelText(/Plan Type/)).toHaveValue('monthly')
    expect(screen.getByLabelText(/^Discount/)).toHaveValue(DISCOUNT_ID)
    expect(
      screen.getByLabelText(/Apply discount to all future payments/)
    ).toBeChecked()
  })

  it('sends exactly the values the user typed', async () => {
    const { patches } = mockApi(ok)
    await openForm()

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Fathima H. Herath' },
    })
    fireEvent.change(screen.getByLabelText(/Phone Number/), {
      target: { value: '0771234567' },
    })
    fireEvent.change(screen.getByLabelText(/Plan Type/), {
      target: { value: 'annual' },
    })
    fireEvent.change(screen.getByLabelText(/Plan Amount/), {
      target: { value: '30000' },
    })
    fireEvent.change(screen.getByLabelText(/^Discount/), {
      target: { value: 'none' },
    })
    fireEvent.click(
      screen.getByLabelText(/Apply discount to all future payments/)
    )
    submit()

    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].url).toBe('/api/members/member-edit-1')
    expect(patches[0].body).toEqual({
      name: 'Fathima H. Herath',
      phoneNumber: '+94771234567',
      planType: 'annual',
      planAmount: 30000,
      discountId: null,
      recurringDiscount: false,
    })
  })

  it('sends the unchanged values when the user edits nothing', async () => {
    const { patches } = mockApi(ok)
    await openForm()
    submit()

    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].body).toEqual({
      name: 'Fathima Herath',
      phoneNumber: '+94751230428',
      planType: 'monthly',
      planAmount: 3500,
      discountId: DISCOUNT_ID,
      recurringDiscount: true,
    })
  })
})

describe('EditMemberModal — what else must refresh after a save', () => {
  // The renewals list is where the desk collects the fee, and the dashboard
  // queue previews the reminder text. Both quote the member's amount, name and
  // plan, and both are cached for 1–5 minutes: without an invalidation they
  // keep showing — and the desk keeps charging — the fee as it was.
  it.each([
    ['the renewals list the desk collects from', 'regular-payments'],
    ['the dashboard reminder queue', 'reminder-queue'],
    ['revenue, which bills from the plan amount', 'revenue'],
    ['the members list', 'members'],
  ])('refreshes %s', async (_label, key) => {
    mockApi(ok)
    const { queryClient } = renderScreen(
      <EditMemberModal open onClose={jest.fn()} member={member} />
    )
    await screen.findByRole('option', { name: /Annual/ })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    submit()

    await waitFor(() => {
      const keys = invalidate.mock.calls.map(
        ([filters]) => (filters as { queryKey: unknown[] }).queryKey[0]
      )
      expect(keys).toContain(key)
    })
  })
})

describe('EditMemberModal — validation', () => {
  it('asks for an amount instead of printing zod internals when it is cleared', async () => {
    const { patches } = mockApi(ok)
    await openForm()

    fireEvent.change(screen.getByLabelText(/Plan Amount/), {
      target: { value: '' },
    })
    submit()

    expect(await screen.findByText('Enter a plan amount')).toBeVisible()
    expect(screen.queryByText(/received nan/i)).toBeNull()
    expect(patches).toHaveLength(0)
  })
})

describe('EditMemberModal — when the server refuses', () => {
  it('shows the server message, never "[object Object]"', async () => {
    // The exact envelope ResponseBuilder.error() produces (§2.3).
    mockApi({
      status: 500,
      body: {
        success: false,
        error: { message: 'Failed to update member', code: 'UPDATE_ERROR' },
      },
    })
    await openForm()
    submit()

    expect(await screen.findByText('Failed to update member')).toBeVisible()
    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
  })

  it('keeps the modal open and the typed values after a failure', async () => {
    mockApi({
      status: 409,
      body: {
        success: false,
        error: { message: 'Phone number already in use', code: 'CONFLICT' },
      },
    })
    const onClose = await openForm()

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Typed Name' },
    })
    submit()

    expect(await screen.findByText('Phone number already in use')).toBeVisible()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Typed Name')
  })
})

describe('EditMemberModal — a value that is no longer on offer', () => {
  // A gym deactivates a plan or a discount; members already on it keep it. The
  // select must still SHOW what is stored, or the form displays one thing and
  // saves another.
  it('shows the stored plan type when that plan has been deactivated', async () => {
    mockApi(ok, {
      plans: [
        ...plans,
        {
          id: 'p3',
          gym_id: 'gym-1',
          plan_type: 'weekly',
          default_amount: 1000,
          is_active: false,
        },
      ],
    })
    await openForm(jest.fn(), { ...member, plan_type: 'weekly' })

    const select = screen.getByLabelText(/Plan Type/) as HTMLSelectElement
    expect(select.value).toBe('weekly')
    expect(select.selectedOptions[0]?.textContent).toMatch(/Weekly/)
  })

  it('shows the stored discount when that discount has been deactivated', async () => {
    const { patches } = mockApi(ok, {
      discounts: [{ ...discounts[0], is_active: false }],
    })
    await openForm()

    const select = screen.getByLabelText(/^Discount/) as HTMLSelectElement
    expect(select.value).toBe(DISCOUNT_ID)

    submit()
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].body.discountId).toBe(DISCOUNT_ID)
  })
})
