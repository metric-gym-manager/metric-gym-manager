import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ViewportTierProvider } from '@/hooks/useViewportTier'
import {
  MemberModalProvider,
  useMemberModal,
} from '@/contexts/member-modal.context'

/**
 * The open → edit → save → reopen loop, driven through the real provider.
 *
 * The edit form and the detail view are two components fed by ONE query
 * (`['member-detail', id]`). Everything a gym owner reads as "my change was not
 * saved" lives in the seams between them, which no single-component test sees:
 * the request can be right while the screen the owner returns to is not.
 */
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/access-control/components/MemberAccessPanel', () => ({
  __esModule: true,
  default: () => null,
}))

const MEMBER_ID = 'member-1'

const serverRow = (name: string) => ({
  id: MEMBER_ID,
  gym_id: 'gym-1',
  member_number: 7,
  name,
  phone_number: '+94751230428',
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: null,
  recurring_discount: false,
  status: 'active',
  registered_date: '2026-08-16',
  membership_start_date: '2026-08-16',
  next_due_date: '2026-12-16',
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  discount: null,
})

interface Deferred {
  resolve: () => void
}

/**
 * A tiny in-memory server. `holdDetail` makes the NEXT detail GET wait until
 * the test releases it, so the window between "owner clicked the member" and
 * "fresh data arrived" can be inspected rather than raced.
 */
function createServer(initialName: string) {
  let name = initialName
  let hold: Promise<void> | null = null
  const server = {
    detailGets: 0,
    holdDetail(): Deferred {
      let resolve!: () => void
      hold = new Promise<void>((r) => (resolve = r))
      return { resolve }
    },
    setName(next: string) {
      name = next
    },
  }

  globalThis.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const respond = (body: unknown, status = 200) =>
        ({ ok: status < 400, status, json: async () => body }) as Response

      if (init?.method === 'PATCH') {
        name = JSON.parse(String(init.body)).name ?? name
        return respond({ success: true, data: {} })
      }
      if (url.includes('/detail')) {
        server.detailGets += 1
        const gate = hold
        hold = null
        if (gate) await gate
        return respond({
          success: true,
          data: { member: serverRow(name), payments: [] },
        })
      }
      if (url.includes('/api/billing-setup/plans')) {
        return respond({ success: true, data: [] })
      }
      if (url.includes('/api/billing-setup/discounts')) {
        return respond({ success: true, data: [] })
      }
      throw new Error(`unrouted request: ${url}`)
    }
  ) as unknown as typeof fetch

  return server
}

function Opener() {
  const { openMember } = useMemberModal()
  return <button onClick={() => openMember(MEMBER_ID)}>open-member</button>
}

/**
 * Mirrors `QueryProvider`'s cache policy, NOT `renderScreen`'s. The shared
 * harness sets `gcTime: 0` so a deliberate failure case does not linger — which
 * also discards the detail query the moment the edit form closes, and with it
 * the very stale copy these tests exist to catch. Production keeps unused
 * entries for 10 minutes and treats data as fresh for 5.
 */
function mount() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
      mutations: { retry: false },
    },
  })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ViewportTierProvider tier="desktop">
        <MemberModalProvider>
          <Opener />
        </MemberModalProvider>
      </ViewportTierProvider>
    </QueryClientProvider>
  )
  return { ...result, queryClient }
}

const nameInput = () => screen.getByLabelText(/^Name/) as HTMLInputElement

async function openAndEdit() {
  fireEvent.click(screen.getByText('open-member'))
  fireEvent.click(await screen.findByLabelText('Edit member'))
  await screen.findByLabelText(/^Name/)
}

describe('member modal — open → edit → save → reopen', () => {
  it('edit form opens pre-filled with the stored values', async () => {
    createServer('Original Name')
    mount()
    await openAndEdit()
    expect(nameInput()).toHaveValue('Original Name')
  })

  it('never shows the pre-edit values after a successful save', async () => {
    const server = createServer('Original Name')
    mount()
    await openAndEdit()

    fireEvent.change(nameInput(), { target: { value: 'Edited Name' } })
    fireEvent.click(screen.getByRole('button', { name: /update member/i }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
    )

    // Reopen the same member; the refetch is still in flight.
    const gate = server.holdDetail()
    fireEvent.click(screen.getByText('open-member'))

    await waitFor(() => expect(server.detailGets).toBeGreaterThanOrEqual(2))
    // While the request is out, the detail view must not present the
    // pre-edit name as if it were the member's current record.
    expect(screen.queryByText('Original Name')).toBeNull()

    await act(async () => gate.resolve())
    expect(await screen.findByText('Edited Name')).toBeInTheDocument()
  })

  it('does not wipe what the owner is typing when a refetch lands', async () => {
    const server = createServer('Original Name')
    const { queryClient } = mount()

    // Detail open and loaded.
    fireEvent.click(screen.getByText('open-member'))
    const editButton = await screen.findByLabelText('Edit member')

    // Something refetches the record while detail is still open — collecting a
    // payment does exactly this — and the response is slow.
    const gate = server.holdDetail()
    await act(async () => {
      queryClient.invalidateQueries({ queryKey: ['member-detail', MEMBER_ID] })
    })
    await waitFor(() => expect(server.detailGets).toBeGreaterThanOrEqual(2))

    // The owner does not wait: straight into Edit, and starts typing.
    server.setName('Changed Elsewhere')
    fireEvent.click(editButton)
    await screen.findByLabelText(/^Name/)
    fireEvent.change(nameInput(), { target: { value: 'Typed Mid-Flight' } })

    await act(async () => {
      gate.resolve()
      // Let the response, the cache write and the resulting re-render all land
      // before asserting; an assertion that races them passes either way.
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(nameInput()).toHaveValue('Typed Mid-Flight')
  })
})
