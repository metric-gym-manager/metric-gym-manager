import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import SupportPage from '../page'

const toastSuccess = jest.fn()
const toastError = jest.fn()
jest.mock('sonner', () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}))

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /Submit ticket/i }))

describe('SupportPage', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows the support contact routes', () => {
    mockFetchRoutes({ '/api/feedback': { ok: true } })
    renderScreen(<SupportPage />)

    expect(screen.getByText('Call or WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Call now')).toBeInTheDocument()
  })

  it('submits a ticket with the category and clears the form', async () => {
    const fetchMock = mockFetchRoutes({ '/api/feedback': { ok: true } })
    renderScreen(<SupportPage />)

    fill('Subject', 'Cannot print receipts')
    fill('Message', 'The print dialog never opens.')
    fill('Email', 'owner@titan.test')
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'bug' },
    })
    submit()

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    const call = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/api/feedback')
    )!
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      // The subject is folded into the message body rather than sent as its
      // own field — the feedback endpoint takes no subject.
      message: '[Cannot print receipts] The print dialog never opens.',
      email: 'owner@titan.test',
      category: 'bug',
    })

    await waitFor(() =>
      expect(screen.getByLabelText('Subject')).toHaveValue('')
    )
    expect(screen.getByLabelText('Message')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('sends the message alone when no subject is given', async () => {
    const fetchMock = mockFetchRoutes({ '/api/feedback': { ok: true } })
    renderScreen(<SupportPage />)

    fill('Message', 'Just this.')
    submit()

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    const call = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/api/feedback')
    )!
    const body = JSON.parse(String((call[1] as RequestInit).body))
    expect(body.message).toBe('Just this.')
    // Omitted, not an empty string: the endpoint treats "" as a supplied value.
    expect(body.email).toBeUndefined()
  })

  /**
   * Two layers guard an empty ticket, and they are reached by different paths:
   * the button is disabled, so clicking it is inert, while submitting the form
   * itself (Enter in the subject field) still runs the handler's own check.
   * Asserting only the click would leave the handler branch unexercised.
   */
  it('refuses an empty message without calling the API', async () => {
    const fetchMock = mockFetchRoutes({ '/api/feedback': { ok: true } })
    const { container } = renderScreen(<SupportPage />)

    fill('Message', '   ')
    expect(
      screen.getByRole('button', { name: /Submit ticket/i })
    ).toBeDisabled()

    fireEvent.submit(container.querySelector('form')!)

    expect(toastError).toHaveBeenCalledWith('Please describe the issue')
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/feedback'))
    ).toBe(false)
  })

  it('surfaces the API error rather than reporting success', async () => {
    mockFetchRoutes({
      '/api/feedback': { status: 500, body: { error: 'Mailer down' } },
    })
    renderScreen(<SupportPage />)

    fill('Message', 'Something broke.')
    submit()

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Mailer down'))
    expect(toastSuccess).not.toHaveBeenCalled()
    // The draft must survive a failed send.
    expect(screen.getByLabelText('Message')).toHaveValue('Something broke.')
  })
})
