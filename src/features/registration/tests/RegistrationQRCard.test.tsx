import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import RegistrationQRCard from '../components/RegistrationQRCard'

// jsdom implements no canvas, so the real QR renderer throws on mount. The
// value it is asked to encode is the thing worth asserting anyway: a QR built
// from the wrong URL is indistinguishable from a correct one by eye, and this
// poster gets printed and stuck on a wall.
jest.mock('qrcode.react', () => ({
  __esModule: true,
  QRCodeCanvas: ({ value }: { value: string }) => (
    <div data-testid="qr" data-value={value} />
  ),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))
import { toast } from 'sonner'

jest.mock('../utils/print-qr', () => ({
  __esModule: true,
  printPosterImages: jest.fn(),
  downloadPosterImage: jest.fn(async () => undefined),
  posterFilename: (gymName: string) => `${gymName}-poster.png`,
}))
import { printPosterImages, downloadPosterImage } from '../utils/print-qr'

const LINK = {
  token: 'tok_abc',
  joinUrl: 'https://app.metric.lk/join/tok_abc',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  rotatedAt: null,
}

const routes = (over: Record<string, unknown> = {}) =>
  mockFetchRoutes({ '/api/settings/registration-link': apiOk(LINK), ...over })

const render = () => renderScreen(<RegistrationQRCard gymName="Iron House" />)

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn(async () => undefined) },
  })
})

describe('RegistrationQRCard', () => {
  it('encodes the join URL the server issued, not a locally built one', async () => {
    routes()
    render()
    const qr = await screen.findByTestId('qr')
    expect(qr).toHaveAttribute('data-value', LINK.joinUrl)
    expect(screen.getByText(LINK.joinUrl)).toBeInTheDocument()
  })

  it('shows a skeleton until the link arrives', () => {
    routes()
    const { container } = render()
    expect(screen.queryByTestId('qr')).toBeNull()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('stays on the skeleton when the request fails, never rendering an empty QR', async () => {
    // A QR encoding `undefined` would print and scan — to nothing.
    routes({
      '/api/settings/registration-link': {
        status: 500,
        body: { success: false, error: { message: 'nope' } },
      },
    })
    render()
    await waitFor(() => expect(screen.queryByTestId('qr')).toBeNull())
  })

  it('copies the join URL', async () => {
    routes()
    render()
    await screen.findByTestId('qr')

    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(LINK.joinUrl)
    )
    expect(toast.success).toHaveBeenCalledWith('Link copied')
  })

  it('prints the server-rendered poster, not the on-screen QR', async () => {
    // §2.16: print and download share one PNG so the sheet on the wall matches
    // the file. Printing the canvas instead would drop the gym logo and name.
    routes()
    render()
    await screen.findByTestId('qr')

    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(printPosterImages).toHaveBeenCalledWith(['/api/settings/qr-poster'])
  })

  it('names the download after the gym', async () => {
    routes()
    render()
    await screen.findByTestId('qr')

    fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    await waitFor(() =>
      expect(downloadPosterImage).toHaveBeenCalledWith(
        '/api/settings/qr-poster',
        'Iron House-poster.png'
      )
    )
  })

  it('reports a failed poster render and re-enables the button', async () => {
    ;(downloadPosterImage as jest.Mock).mockRejectedValueOnce(
      new Error('satori blew up')
    )
    routes()
    render()
    await screen.findByTestId('qr')

    fireEvent.click(screen.getByRole('button', { name: /download png/i }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not generate the poster. Please try again.'
      )
    )
    // The `finally` is what makes a second attempt possible — without it the
    // button stays on "Preparing…" for the rest of the session.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /download png/i })
      ).toBeEnabled()
    )
  })
})
