import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ResetPasswordPage from '../page'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const assign = jest.fn()

const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const newPassword = () =>
  screen.getByPlaceholderText('Create a strong password')
const confirmPassword = () =>
  screen.getByPlaceholderText('Re-enter your password')
const submit = () => screen.getByRole('button', { name: /reset password/i })

const fill = (a: string, b = a) => {
  fireEvent.change(newPassword(), { target: { value: a } })
  fireEvent.change(confirmPassword(), { target: { value: b } })
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign, href: 'http://localhost/reset-password' },
  })
  globalThis.fetch = jest.fn(async () =>
    okJson({ success: true })
  ) as unknown as typeof fetch
})

const calledUrls = () =>
  (globalThis.fetch as jest.Mock).mock.calls.map((c) => c[0] as string)

describe('Reset password screen', () => {
  it('posts the new password once both fields agree', async () => {
    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!')
    fireEvent.click(submit())

    await waitFor(() => {
      const [url] = (globalThis.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/auth/reset-password')
    })
  })

  it('refuses a mismatched confirmation without contacting the server', async () => {
    // The confirmation field only means something if a mismatch is caught
    // client-side; the server sees one password either way.
    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!', 'Str0ngPassw0rd?')
    fireEvent.click(submit())

    expect(
      await screen.findByText('Please fix the errors below')
    ).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('rejects a weak password client-side', async () => {
    render(<ResetPasswordPage />)
    fill('short')
    fireEvent.click(submit())

    expect(
      await screen.findByText('Please fix the errors below')
    ).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sends the user to login with the flag that shows the success banner', async () => {
    // The login screen reads `?reset=success` to confirm the change. Dropping
    // the parameter leaves the user at a bare login form with no feedback that
    // anything happened.
    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!')
    fireEvent.click(submit())

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('/login?reset=success')
    )
  })

  it('drops the recovery session before leaving', async () => {
    // `/auth/callback?type=recovery` signs the user in to authorise the reset,
    // so the session outlives the password it was created against. Leaving it
    // live would strand the user signed in while being told to sign in.
    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!')
    fireEvent.click(submit())

    await waitFor(() => expect(calledUrls()).toContain('/api/auth/logout'))
    const order = calledUrls()
    expect(order.indexOf('/api/auth/logout')).toBeGreaterThan(
      order.indexOf('/api/auth/reset-password')
    )
  })

  it('leaves via a full-document navigation, never the router (§2.15)', async () => {
    // The session is mutated server-side by the logout above, so an SPA
    // navigation would serve the cached route without re-running middleware.
    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!')
    fireEvent.click(submit())

    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })

  it('stays put and explains when the server rejects the token', async () => {
    globalThis.fetch = jest.fn(async () =>
      okJson({ success: false, error: 'Reset link has expired' }, 400)
    ) as unknown as typeof fetch

    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!')
    fireEvent.click(submit())

    expect(
      await screen.findByText('Reset link has expired')
    ).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
    // A failed reset must not sign the user out — the recovery session is
    // their only way to retry without requesting a fresh link.
    expect(calledUrls()).not.toContain('/api/auth/logout')
  })
})
