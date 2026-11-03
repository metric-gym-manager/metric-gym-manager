import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ViewportTierProvider } from '@/hooks/useViewportTier'
import { apiOk } from '@/test-utils/renderScreen'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWithDiscount } from '@/features/members/types'
import { MemberModalProvider, useMemberModal } from '../member-modal.context'

/**
 * The provider's edit-then-reopen path, run with the PRODUCTION query defaults.
 *
 * `renderScreen` builds its client with `gcTime: 0`, which evicts an unobserved
 * query the instant it loses its observer. That is right for most screen tests
 * and exactly wrong here: the defect lives in a cache entry that outlives the
 * edit modal. After a save the provider dropped its member id but left the
 * pre-edit copy cached, so the next open rendered the old name until the
 * refetch landed — which reads, to the person who just saved, as "it did not
 * save". The client below copies `QueryProvider`'s numbers for that reason.
 *
 * The heavy detail modal and the access panel are stood in for; the edit modal
 * is the real one, because the save is what this exercises.
 */
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

jest.mock('@/features/members', () => ({
  __esModule: true,
  MemberDetailModal: ({
    open,
    member,
    onEditClick,
  }: {
    open: boolean
    member: MemberWithDiscount | null
    onEditClick: () => void
  }) =>
    open ? (
      <div data-testid="detail">
        <span>{member ? `detail:${member.name}` : 'detail:loading'}</span>
        <button onClick={onEditClick}>Edit member</button>
      </div>
    ) : null,
  EditMemberModal: jest.requireActual(
    '@/features/members/components/EditMemberModal'
  ).default,
}))

jest.mock('@/features/access-control/components/MemberAccessPanel', () => ({
  __esModule: true,
  default: () => null,
}))

const MEMBER_ID = 'member-ctx-1'

const baseMember: MemberWithDiscount = {
  id: MEMBER_ID,
  gym_id: 'gym-1',
  member_number: 7,
  name: 'Old Name',
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

function productionClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  })
}

function Opener() {
  const { openMember } = useMemberModal()
  return <button onClick={() => openMember(MEMBER_ID)}>Open member</button>
}

/**
 * Serves the detail endpoint from `current` — a live reference, so a test can
 * change what the "server" holds between the save and the reopen. A `gate`
 * holds the response open to observe the in-between render.
 */
function serve(state: {
  current: MemberWithDiscount
  gate?: Promise<void>
}): jest.Mock {
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const respond = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => body }) as Response

    if (init?.method === 'PATCH') {
      const patch = JSON.parse(init.body as string)
      state.current = {
        ...state.current,
        name: patch.name ?? state.current.name,
      }
      return respond(apiOk({}))
    }
    if (url.includes('/detail')) {
      await state.gate
      return respond(apiOk({ member: state.current, payments: [] }))
    }
    if (url.includes('/api/billing-setup/plans')) return respond(apiOk([]))
    if (url.includes('/api/billing-setup/discounts')) return respond(apiOk([]))
    throw new Error(`unrouted request: ${url}`)
  })
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

function mount(queryClient = productionClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <ViewportTierProvider tier="desktop">
        <MemberModalProvider>
          <Opener />
        </MemberModalProvider>
      </ViewportTierProvider>
    </QueryClientProvider>
  )
  return queryClient
}

async function editNameAndSave(newName: string) {
  fireEvent.click(screen.getByText('Open member'))
  await screen.findByText('detail:Old Name')
  fireEvent.click(screen.getByText('Edit member'))

  const name = await screen.findByLabelText(/^Name/)
  fireEvent.change(name, { target: { value: newName } })
  fireEvent.click(screen.getByRole('button', { name: 'Update Member' }))

  await waitFor(() =>
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
  )
}

describe('MemberModalProvider — edit then reopen', () => {
  it('does not show the pre-edit copy while the member reloads', async () => {
    const state: { current: MemberWithDiscount; gate?: Promise<void> } = {
      current: baseMember,
    }
    serve(state)
    mount()

    await editNameAndSave('New Name')

    // Hold the next detail read open so the in-between render is observable.
    let release!: () => void
    state.gate = new Promise<void>((resolve) => (release = resolve))

    fireEvent.click(screen.getByText('Open member'))

    expect(await screen.findByText('detail:loading')).toBeInTheDocument()
    expect(screen.queryByText('detail:Old Name')).not.toBeInTheDocument()

    release()
    expect(await screen.findByText('detail:New Name')).toBeInTheDocument()
  })

  it('refreshes the other screens’ member-derived queries after a save', async () => {
    const state = { current: baseMember }
    serve(state)
    const queryClient = productionClient()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
    mount(queryClient)

    await editNameAndSave('New Name')

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    for (const owned of [
      ['regular-payments'],
      ['payment-collection'],
      ['dashboard'],
      ['dashboard-metrics'],
      ['reminder-queue'],
    ]) {
      expect(keys).toContainEqual(owned)
    }
  })

  it('does not touch those queries when the edit is cancelled', async () => {
    const state = { current: baseMember }
    serve(state)
    const queryClient = productionClient()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
    mount(queryClient)

    fireEvent.click(screen.getByText('Open member'))
    await screen.findByText('detail:Old Name')
    fireEvent.click(screen.getByText('Edit member'))
    await screen.findByLabelText(/^Name/)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
    )
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ['regular-payments'],
    })
  })
})
