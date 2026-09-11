import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import MakeAnnouncementPage from '../page'
import type { Announcement } from '@/features/announcements/types'

// The gate passes on every paid tier today; the screen under test is the
// composer, not the entitlement check (which has server authority anyway).
jest.mock('@/features/subscriptions', () => ({
  __esModule: true,
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Polls its own endpoint on an interval; out of scope here and it would make
// every test in this file wait on timers.
jest.mock('@/features/announcements/components/AnnouncementProgress', () => ({
  __esModule: true,
  default: ({ announcementId }: { announcementId: string }) => (
    <div data-testid="progress">{announcementId}</div>
  ),
}))

const announcement = (over: Partial<Announcement> = {}): Announcement =>
  ({
    id: 'a1',
    message: 'Pool closed Sunday',
    sent_at: '2026-09-01T00:00:00.000Z',
    recipient_count: 10,
    sent_count: 10,
    failed_count: 0,
    status: 'completed',
    ...over,
  }) as Announcement

const routes = (list: Announcement[] = []) =>
  mockFetchRoutes({ '/api/announcements': apiOk(list) })

/**
 * The list GET and the send POST share one URL, so a mock that routes on URL
 * alone feeds the POST's `{ announcement }` payload to the list query — which
 * then calls `.map()` on an object and takes the whole screen down. Route on
 * the method.
 */
function mockAnnouncementApi(
  opts: {
    list?: Announcement[]
    post?: { status?: number; body?: unknown }
  } = {}
) {
  const mock = jest.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const status = opts.post?.status ?? 200
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () =>
            opts.post?.body ?? apiOk({ announcement: { id: 'new-1' } }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => apiOk(opts.list ?? []),
      } as Response
    }
  )
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

const messageBox = () => screen.getByLabelText('Message')
const audienceBox = () => screen.getByLabelText('Audience')
const sendButton = () => screen.getByRole('button', { name: /send broadcast/i })

describe('Announcements composer', () => {
  it('renders the compose form and the delivery log', async () => {
    routes()
    renderScreen(<MakeAnnouncementPage />)

    expect(
      screen.getByRole('heading', { name: 'Announcements' })
    ).toBeInTheDocument()
    expect(audienceBox()).toBeInTheDocument()
    await screen.findByText('No announcements sent yet.')
  })

  describe('character counter', () => {
    it('reports one segment for an empty message, not zero', async () => {
      // segments = max(1, ceil(0/160)) — the max() is the whole point, and an
      // off-by-one here would advertise "0 segment(s)" on an untouched form.
      routes()
      renderScreen(<MakeAnnouncementPage />)
      expect(screen.getByText('0/160 · 1 segment(s)')).toBeInTheDocument()
    })

    it('stays at one segment at exactly the limit', async () => {
      routes()
      renderScreen(<MakeAnnouncementPage />)
      fireEvent.change(messageBox(), { target: { value: 'x'.repeat(160) } })
      expect(screen.getByText('160/160 · 1 segment(s)')).toBeInTheDocument()
    })
  })

  describe('two-step confirmation', () => {
    it('asks for confirmation before sending, naming the audience', async () => {
      const fetchMock = routes()
      renderScreen(<MakeAnnouncementPage />)
      fireEvent.change(messageBox(), { target: { value: 'Closed today' } })

      fireEvent.click(sendButton())

      expect(
        screen.getByRole('button', { name: 'Confirm — send to all members' })
      ).toBeInTheDocument()
      // Nothing may leave the browser on the first click.
      expect(
        fetchMock.mock.calls.filter(
          (c) => (c[1] as RequestInit | undefined)?.method === 'POST'
        )
      ).toHaveLength(0)
    })

    it('sends the message and audience on the second click', async () => {
      const fetchMock = mockAnnouncementApi()
      renderScreen(<MakeAnnouncementPage />)
      fireEvent.change(messageBox(), { target: { value: 'Closed today' } })
      fireEvent.change(audienceBox(), { target: { value: 'expired' } })
      // Audience changes disarm the confirmation, so arm it AFTER choosing.
      fireEvent.click(sendButton())
      fireEvent.click(
        screen.getByRole('button', { name: /confirm — send to expired/i })
      )

      await waitFor(() => {
        const post = fetchMock.mock.calls.find(
          (c) => (c[1] as RequestInit | undefined)?.method === 'POST'
        )
        expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({
          message: 'Closed today',
          audience: 'expired',
        })
      })
    })

    it('re-arms the confirmation when the message changes', async () => {
      // Confirming, then editing, then clicking would otherwise send text the
      // operator never confirmed.
      routes()
      renderScreen(<MakeAnnouncementPage />)
      fireEvent.change(messageBox(), { target: { value: 'First' } })
      fireEvent.click(sendButton())
      expect(screen.getByRole('button', { name: /confirm/i })).toBeVisible()

      fireEvent.change(messageBox(), { target: { value: 'Second' } })
      expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull()
      expect(sendButton()).toBeInTheDocument()
    })

    it('re-arms the confirmation when the audience changes', async () => {
      routes()
      renderScreen(<MakeAnnouncementPage />)
      fireEvent.change(messageBox(), { target: { value: 'First' } })
      fireEvent.click(sendButton())
      fireEvent.change(audienceBox(), { target: { value: 'active' } })
      expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull()
    })

    it('refuses to send a message that is only whitespace', async () => {
      routes()
      renderScreen(<MakeAnnouncementPage />)
      fireEvent.change(messageBox(), { target: { value: '   ' } })
      expect(sendButton()).toBeDisabled()
    })
  })

  describe('delivery log', () => {
    it.each([
      ['completed with no failures', { status: 'completed' }, 'DELIVERED'],
      [
        'completed with failures',
        { status: 'completed', failed_count: 2 },
        'PARTIAL',
      ],
      ['still sending', { status: 'sending' }, 'SENDING'],
      ['failed outright', { status: 'failed' }, 'FAILED'],
      ['queued', { status: 'pending' }, 'PENDING'],
    ])('badges a broadcast %s as %s', async (_name, over, label) => {
      routes([announcement(over as Partial<Announcement>)])
      renderScreen(<MakeAnnouncementPage />)
      expect(await screen.findByText(label)).toBeInTheDocument()
    })

    it('separates delivered from failed counts', async () => {
      routes([
        announcement({ sent_count: 8, recipient_count: 10, failed_count: 2 }),
      ])
      renderScreen(<MakeAnnouncementPage />)

      const row = (await screen.findByText('Pool closed Sunday')).closest('tr')!
      expect(within(row).getByText('8/10')).toBeInTheDocument()
      expect(within(row).getByText('2 failed')).toBeInTheDocument()
    })

    it('omits the failure note when nothing failed', async () => {
      routes([announcement({ failed_count: 0 })])
      renderScreen(<MakeAnnouncementPage />)
      await screen.findByText('Pool closed Sunday')
      expect(screen.queryByText(/failed$/)).toBeNull()
    })
  })

  it('shows live progress for the broadcast just sent', async () => {
    mockAnnouncementApi()
    renderScreen(<MakeAnnouncementPage />)
    fireEvent.change(messageBox(), { target: { value: 'Closed today' } })
    fireEvent.click(sendButton())
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(await screen.findByTestId('progress')).toHaveTextContent('new-1')
    // The composer clears so the same text cannot be broadcast twice by reflex.
    await waitFor(() => expect(messageBox()).toHaveValue(''))
  })

  it('keeps the message on screen when the send fails', async () => {
    mockAnnouncementApi({
      post: { status: 500, body: { error: 'SMS gateway down' } },
    })
    renderScreen(<MakeAnnouncementPage />)
    fireEvent.change(messageBox(), { target: { value: 'Closed today' } })
    fireEvent.click(sendButton())
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(await screen.findByText('SMS gateway down')).toBeInTheDocument()
    expect(messageBox()).toHaveValue('Closed today')
  })
})
