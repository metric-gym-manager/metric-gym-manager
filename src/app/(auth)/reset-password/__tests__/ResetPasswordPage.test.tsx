import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ResetPasswordPage from '../page'

const push = jest.fn()
let params = new URLSearchParams('token_hash=tok_from_email')
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
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
  params = new URLSearchParams('token_hash=tok_from_email')
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

  describe('the one-time token', () => {
    /**
     * The anti-scanner guarantee. Gmail's link scanner issues a GET before the
     * recipient clicks; if merely rendering this screen spent the token, the
     * user would arrive to a dead link. Mounting must touch the network zero
     * times. This test fails the moment a fetch is added to the mount path.
     */
    it('spends nothing on mount — no request at all until submit', () => {
      render(<ResetPasswordPage />)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('carries the token from the link into the request', async () => {
      params = new URLSearchParams('token_hash=tok_abc123')
      render(<ResetPasswordPage />)
      fill('Str0ngPassw0rd!')
      fireEvent.click(submit())

      await waitFor(() => {
        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0]
        expect(
          JSON.parse((init as RequestInit).body as string).token_hash
        ).toBe('tok_abc123')
      })
    })

    it('accepts ?token= as an alias for an older template', async () => {
      params = new URLSearchParams('token=legacy_tok')
      render(<ResetPasswordPage />)
      fill('Str0ngPassw0rd!')
      fireEvent.click(submit())

      await waitFor(() => {
        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0]
        expect(
          JSON.parse((init as RequestInit).body as string).token_hash
        ).toBe('legacy_tok')
      })
    })

    it('offers a new link instead of a form that cannot succeed', () => {
      params = new URLSearchParams()
      render(<ResetPasswordPage />)

      expect(
        screen.getByRole('link', { name: /request a new reset link/i })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /reset password/i })
      ).toBeNull()
      // The heading has to agree with the state. Found by rendering it: the
      // page said "Create a new password" above a link that cannot create one.
      expect(
        screen.getByRole('heading', { name: 'Reset link incomplete' })
      ).toBeInTheDocument()
    })
  })

  it('does not call logout — the server signs out after updating', async () => {
    // `resetPassword()` spends the token, updates the password and signs out in
    // one server round trip. A second client call would be a redundant request
    // against a session that no longer exists.
    render(<ResetPasswordPage />)
    fill('Str0ngPassw0rd!')
    fireEvent.click(submit())

    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(calledUrls()).not.toContain('/api/auth/logout')
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
  })
})
