import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ForgotPasswordPage from '../page'

const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const emailBox = () => screen.getByLabelText(/email/i)
const submit = () => screen.getByRole('button', { name: /send reset link/i })

beforeEach(() => {
  jest.clearAllMocks()
  globalThis.fetch = jest.fn(async () =>
    okJson({ success: true })
  ) as unknown as typeof fetch
})

describe('Forgot password screen', () => {
  it('posts the address to the reset endpoint', async () => {
    render(<ForgotPasswordPage />)
    fireEvent.change(emailBox(), { target: { value: 'owner@gym.lk' } })
    fireEvent.click(submit())

    await waitFor(() => {
      const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/auth/forgot-password')
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        email: 'owner@gym.lk',
      })
    })
  })

  it('does not disclose whether the account exists', async () => {
    // Account enumeration. The copy is deliberately conditional — "If an
    // account exists" — and must stay that way whatever the server returns,
    // because the server answers identically either way by design.
    render(<ForgotPasswordPage />)
    fireEvent.change(emailBox(), { target: { value: 'stranger@nowhere.lk' } })
    fireEvent.click(submit())

    const panel = await screen.findByText(/if an account exists/i)
    expect(panel).toBeInTheDocument()
    expect(screen.queryByText(/no account|not found|unknown/i)).toBeNull()
  })

  it('replaces the form with the confirmation, so it cannot be resubmitted', async () => {
    render(<ForgotPasswordPage />)
    fireEvent.change(emailBox(), { target: { value: 'owner@gym.lk' } })
    fireEvent.click(submit())

    await screen.findByText(/if an account exists/i)
    expect(
      screen.queryByRole('button', { name: /send reset link/i })
    ).toBeNull()
  })

  it('surfaces a server refusal instead of claiming success', async () => {
    globalThis.fetch = jest.fn(async () =>
      okJson({ success: false, error: 'Too many requests' }, 429)
    ) as unknown as typeof fetch

    render(<ForgotPasswordPage />)
    fireEvent.change(emailBox(), { target: { value: 'owner@gym.lk' } })
    fireEvent.click(submit())

    expect(await screen.findByText('Too many requests')).toBeInTheDocument()
    expect(screen.queryByText(/if an account exists/i)).toBeNull()
  })

  it('re-enables the button after a failure so the user can retry', async () => {
    globalThis.fetch = jest.fn(async () =>
      okJson({ success: false, error: 'Too many requests' }, 429)
    ) as unknown as typeof fetch

    render(<ForgotPasswordPage />)
    fireEvent.change(emailBox(), { target: { value: 'owner@gym.lk' } })
    fireEvent.click(submit())

    await screen.findByText('Too many requests')
    // The `finally` clearing isLoading is the whole mechanism.
    await waitFor(() => expect(submit()).toBeEnabled())
  })
})
