import { screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWithDiscount } from '../types'
import EditMemberModal from '../components/EditMemberModal'

/**
 * What the edit form puts on the wire, and what it does to the user's input.
 *
 * The reported symptoms were "changes are not saved" and "the data is not what
 * I typed". Two defects produced them, and both are invisible to a test that
 * only checks that the form mounts:
 *
 * 1. The form re-initialised from `member` on every change of the prop's
 *    identity, so a refetch handed back a new object and wiped the input.
 * 2. It sent every field on every save, so a form filled from a stale copy
 *    wrote the old values of fields the user never touched back over newer ones.
 *
 * These assert the PATCH body and the field values, not the layout.
 */
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const member: MemberWithDiscount = {
  id: 'member-edit-1',
  gym_id: 'gym-1',
  member_number: 46,
  name: 'Fathima Herath',
  phone_number: '+94751230428',
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: null,
  recurring_discount: false,
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
    default_amount: 36000,
    is_active: true,
  },
]

const STUDENT = '11111111-1111-4111-8111-111111111111'
const discounts = [
  {
    id: STUDENT,
    discount_name: 'Student',
    discount_percentage: 10,
    is_active: true,
  },
]

function routes() {
  return mockFetchRoutes({
    '/api/billing-setup/plans': apiOk(plans),
    '/api/billing-setup/discounts': apiOk(discounts),
    '/api/members/member-edit-1': apiOk({}),
  })
}

function patchBodies(fetchMock: jest.Mock): Record<string, unknown>[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

const nameInput = () => screen.getByLabelText(/^Name/)
const amountInput = () => screen.getByLabelText(/^Plan Amount/)
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Update Member' }))

describe('EditMemberModal — what gets submitted', () => {
  it('sends every field the user changed, normalised', async () => {
    const fetchMock = routes()
    renderScreen(<EditMemberModal open onClose={jest.fn()} member={member} />)
    await screen.findByRole('option', { name: /Annual/ })

    fireEvent.change(nameInput(), { target: { value: 'Fathima H. Herath' } })
    fireEvent.change(screen.getByLabelText(/^Phone Number/), {
      target: { value: '0771234567' },
    })
    fireEvent.change(amountInput(), { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText(/^Plan Type/), {
      target: { value: 'annual' },
    })
    fireEvent.change(screen.getByLabelText(/^Discount/), {
      target: { value: STUDENT },
    })
    fireEvent.click(screen.getByLabelText(/Apply discount to all future/))
    submit()

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1))
    expect(patchBodies(fetchMock)[0]).toEqual({
      name: 'Fathima H. Herath',
      phoneNumber: '+94771234567',
      planType: 'annual',
      planAmount: 4200,
      discountId: STUDENT,
      recurringDiscount: true,
    })
  })

  it('sends only the changed field, leaving the rest to the server', async () => {
    const fetchMock = routes()
    renderScreen(<EditMemberModal open onClose={jest.fn()} member={member} />)
    await screen.findByRole('option', { name: /Annual/ })

    fireEvent.change(nameInput(), { target: { value: 'Fathima H. Herath' } })
    submit()

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1))
    expect(patchBodies(fetchMock)[0]).toEqual({ name: 'Fathima H. Herath' })
  })

  it('removes a discount with an explicit null', async () => {
    const fetchMock = routes()
    renderScreen(
      <EditMemberModal
        open
        onClose={jest.fn()}
        member={{ ...member, discount_id: STUDENT, recurring_discount: true }}
      />
    )
    await screen.findByRole('option', { name: /Student/ })

    fireEvent.change(screen.getByLabelText(/^Discount/), {
      target: { value: 'none' },
    })
    submit()

    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1))
    expect(patchBodies(fetchMock)[0]).toEqual({ discountId: null })
  })

  it('closes without a request when nothing was changed', async () => {
    const fetchMock = routes()
    const onClose = jest.fn()
    renderScreen(<EditMemberModal open onClose={onClose} member={member} />)
    await screen.findByRole('option', { name: /Annual/ })

    submit()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(patchBodies(fetchMock)).toHaveLength(0)
  })

  it('reports the save to the host before closing', async () => {
    routes()
    const calls: string[] = []
    renderScreen(
      <EditMemberModal
        open
        onClose={() => calls.push('close')}
        onSaved={() => calls.push('saved')}
        member={member}
      />
    )
    await screen.findByRole('option', { name: /Annual/ })

    fireEvent.change(nameInput(), { target: { value: 'Someone Else' } })
    submit()

    await waitFor(() => expect(calls).toEqual(['saved', 'close']))
  })
})

describe('EditMemberModal — input survives a refreshed member', () => {
  it('keeps what the user typed when the member prop is re-sent', async () => {
    routes()
    const { rerender } = renderScreen(
      <EditMemberModal open onClose={jest.fn()} member={member} />
    )

    fireEvent.change(nameInput(), { target: { value: 'Typed Name' } })

    // A background refetch hands the modal a new object, same contents.
    rerender(
      <EditMemberModal open onClose={jest.fn()} member={{ ...member }} />
    )

    expect(nameInput()).toHaveValue('Typed Name')
  })

  it('takes the fresh server value for fields the user has not touched', async () => {
    const fetchMock = routes()
    const { rerender } = renderScreen(
      <EditMemberModal open onClose={jest.fn()} member={member} />
    )
    await screen.findByRole('option', { name: /Annual/ })

    fireEvent.change(nameInput(), { target: { value: 'Typed Name' } })

    // Meanwhile somebody else changed the amount and the stored name.
    rerender(
      <EditMemberModal
        open
        onClose={jest.fn()}
        member={{ ...member, name: 'Server Name', plan_amount: 4000 }}
      />
    )

    expect(nameInput()).toHaveValue('Typed Name')
    expect(amountInput()).toHaveValue(4000)

    submit()
    await waitFor(() => expect(patchBodies(fetchMock)).toHaveLength(1))
    // The amount was never touched here, so it is not written back.
    expect(patchBodies(fetchMock)[0]).toEqual({ name: 'Typed Name' })
  })

  it('starts clean when the modal is closed and opened again', async () => {
    routes()
    const { rerender } = renderScreen(
      <EditMemberModal open onClose={jest.fn()} member={member} />
    )

    fireEvent.change(nameInput(), { target: { value: 'Abandoned Edit' } })

    rerender(
      <EditMemberModal open={false} onClose={jest.fn()} member={member} />
    )
    rerender(<EditMemberModal open onClose={jest.fn()} member={member} />)

    expect(nameInput()).toHaveValue('Fathima Herath')
  })

  it('starts clean when it is opened on a different member', async () => {
    routes()
    const { rerender } = renderScreen(
      <EditMemberModal open onClose={jest.fn()} member={member} />
    )

    fireEvent.change(nameInput(), { target: { value: 'Abandoned Edit' } })

    rerender(
      <EditMemberModal
        open
        onClose={jest.fn()}
        member={{ ...member, id: 'member-edit-2', name: 'Another Member' }}
      />
    )

    expect(nameInput()).toHaveValue('Another Member')
  })
})
