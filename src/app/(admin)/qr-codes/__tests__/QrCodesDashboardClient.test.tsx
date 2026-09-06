import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import QrCodesDashboardClient from '../QrCodesDashboardClient'

// Canvas is unimplemented in jsdom; the QR image itself is qrcode.react's
// concern, not this screen's.
jest.mock('qrcode.react', () => ({
  __esModule: true,
  QRCodeCanvas: ({ value }: { value: string }) => (
    <div data-testid="qr" data-value={value} />
  ),
}))

const printPosterImages = jest.fn()
const downloadPosterImage = jest.fn<Promise<void>, [string, string]>(
  async () => undefined
)
jest.mock('@/features/registration/utils/print-qr', () => ({
  __esModule: true,
  printPosterImages: (urls: string[]) => printPosterImages(urls),
  downloadPosterImage: (url: string, filename: string) =>
    downloadPosterImage(url, filename),
  posterFilename: (name: string) => `${name}.png`,
}))

const toastSuccess = jest.fn()
const toastError = jest.fn()
jest.mock('sonner', () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}))

/** The card is the `h3`'s own div; walking one level further lands on the grid. */
const cardFor = (name: string) => within(screen.getByText(name).closest('div')!)

const gym = (over: Record<string, unknown> = {}) => ({
  gymId: 'g1',
  gymName: 'Titan Fitness',
  username: 'titan',
  email: 'owner@titan.test',
  joinUrl: 'https://metric.test/join/tok1',
  ...over,
})

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/admin/qr-codes/regenerate': apiOk({ joinUrl: 'https://x/join/tok2' }),
  '/api/admin/qr-codes': apiOk([
    gym(),
    gym({
      gymId: 'g2',
      gymName: 'Iron House',
      username: 'iron',
      email: 'hi@iron.test',
      joinUrl: 'https://metric.test/join/tok9',
    }),
  ]),
  ...over,
})

describe('QrCodesDashboardClient', () => {
  afterEach(() => jest.clearAllMocks())

  it('lists each gym with its own join link encoded', async () => {
    mockFetchRoutes(routes())
    renderScreen(<QrCodesDashboardClient />)

    expect(await screen.findByText('Titan Fitness')).toBeInTheDocument()
    expect(screen.getByText('Iron House')).toBeInTheDocument()
    const codes = screen.getAllByTestId('qr').map((n) => n.dataset.value)
    expect(codes).toEqual([
      'https://metric.test/join/tok1',
      'https://metric.test/join/tok9',
    ])
  })

  /**
   * A gym with no registration link has nothing to print, and rendering a QR
   * for `undefined` would produce a scannable code pointing nowhere.
   */
  it('omits gyms that have no join link', async () => {
    mockFetchRoutes(
      routes({
        '/api/admin/qr-codes': apiOk([
          gym(),
          gym({ gymId: 'g3', gymName: 'No Link Gym', joinUrl: null }),
        ]),
      })
    )
    renderScreen(<QrCodesDashboardClient />)

    expect(await screen.findByText('Titan Fitness')).toBeInTheDocument()
    expect(screen.queryByText('No Link Gym')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Print All \(1\)/ })
    ).toBeEnabled()
  })

  it.each([
    ['iron', 'Iron House', 'Titan Fitness'],
    ['titan', 'Titan Fitness', 'Iron House'],
    ['hi@iron.test', 'Iron House', 'Titan Fitness'],
  ])('filters on %s', async (query, kept, dropped) => {
    mockFetchRoutes(routes())
    renderScreen(<QrCodesDashboardClient />)
    await screen.findByText('Titan Fitness')

    fireEvent.change(screen.getByPlaceholderText('Search gyms...'), {
      target: { value: query },
    })

    expect(screen.getByText(kept)).toBeInTheDocument()
    expect(screen.queryByText(dropped)).not.toBeInTheDocument()
  })

  it('says so when a search matches nothing', async () => {
    mockFetchRoutes(routes())
    renderScreen(<QrCodesDashboardClient />)
    await screen.findByText('Titan Fitness')

    fireEvent.change(screen.getByPlaceholderText('Search gyms...'), {
      target: { value: 'nothing matches this' },
    })
    expect(screen.getByText('No gyms found')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Print All \(0\)/ })
    ).toBeDisabled()
  })

  it('prints one gym, and prints only the filtered set in bulk', async () => {
    mockFetchRoutes(routes())
    renderScreen(<QrCodesDashboardClient />)
    await screen.findByText('Titan Fitness')

    fireEvent.click(
      cardFor('Titan Fitness').getByRole('button', { name: 'Print' })
    )
    expect(printPosterImages).toHaveBeenCalledWith([
      expect.stringContaining('g1'),
    ])

    printPosterImages.mockClear()
    fireEvent.change(screen.getByPlaceholderText('Search gyms...'), {
      target: { value: 'iron' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Print All/ }))
    expect(printPosterImages).toHaveBeenCalledWith([
      expect.stringContaining('g2'),
    ])
  })

  /**
   * Regenerating a token invalidates every printed poster for that gym, so it
   * is confirmed before it runs — §2.21's "rotation is a SaaS-operator-only
   * operation" is about authority, and this is the part that stops it being
   * done by accident.
   */
  it('confirms before rotating a token, and warns that printed posters die', async () => {
    const fetchMock = mockFetchRoutes(routes())
    renderScreen(<QrCodesDashboardClient />)
    await screen.findByText('Titan Fitness')

    fireEvent.click(
      cardFor('Titan Fitness').getByRole('button', { name: 'New QR' })
    )

    // Nothing has been sent yet — the dialog is a real gate, not a notice.
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('/regenerate'))
    ).toBe(false)

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Generate New QR' })
    )

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/api/admin/qr-codes/regenerate')
      )
      expect(call).toBeDefined()
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
        gymId: 'g1',
      })
    })
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('no longer work')
      )
    )
  })

  it('reports a failed rotation instead of implying success', async () => {
    mockFetchRoutes(
      routes({
        '/api/admin/qr-codes/regenerate': {
          status: 500,
          body: { success: false, error: { message: 'nope' } },
        },
      })
    )
    renderScreen(<QrCodesDashboardClient />)
    await screen.findByText('Titan Fitness')

    fireEvent.click(
      cardFor('Titan Fitness').getByRole('button', { name: 'New QR' })
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Generate New QR' })
    )

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('shows an error state when the list cannot be loaded', async () => {
    mockFetchRoutes(
      routes({
        '/api/admin/qr-codes': {
          status: 500,
          body: { success: false, error: { message: 'boom' } },
        },
      })
    )
    renderScreen(<QrCodesDashboardClient />)
    expect(
      await screen.findByText('Failed to load QR codes. Please try again.')
    ).toBeInTheDocument()
  })
})
