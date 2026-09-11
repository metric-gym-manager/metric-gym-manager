import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginPage from '../page'

/**
 * The login screen had no test of any kind. It is also where two directives
 * with recorded incident history meet:
 *
 * - **§2.15** — the session is written server-side by `/api/auth/login`, so the
 *   post-login navigation must be a FULL-DOCUMENT one. An SPA `router.push`
 *   serves the stale App Router Cache, never re-runs middleware, and leaves the
 *   user staring at the login form until they refresh by hand.
 * - **`getSafeRedirect`** — `?redirect=` is attacker-controlled. Passing it
 *   through unsanitised turns the login page into an open redirect.
 *
 * Neither is visible in `tsc` or in any other test in this repository.
 */
let params = new URLSearchParams()
const routerPush = jest.fn()
const routerReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

const assign = jest.fn()
const replace = jest.fn()

const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const email = () => screen.getByLabelText(/email/i)
const password = () => screen.getByLabelText(/password/i)
const submit = () => screen.getByRole('button', { name: /^sign in$/i })

const fillAndSubmit = (e = 'owner@gym.lk', p = 'correct-horse') => {
  fireEvent.change(email(), { target: { value: e } })
  fireEvent.change(password(), { target: { value: p } })
  fireEvent.click(submit())
}

beforeEach(() => {
  params = new URLSearchParams()
  jest.clearAllMocks()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign, replace, href: 'http://localhost/login' },
  })
  globalThis.fetch = jest.fn(async () =>
    okJson({ success: true })
  ) as unknown as typeof fetch
})

describe('Login screen', () => {
  it('renders the form', () => {
    render(<LoginPage />)
    expect(email()).toBeInTheDocument()
    expect(password()).toBeInTheDocument()
    expect(submit()).toBeInTheDocument()
  })

  describe('post-login navigation (§2.15)', () => {
    it('leaves via a full-document navigation, never the router', async () => {
      render(<LoginPage />)
      fillAndSubmit()

      await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'))
      // The whole point of the rule: an SPA navigation here is the bug.
      expect(routerPush).not.toHaveBeenCalled()
      expect(routerReplace).not.toHaveBeenCalled()
    })

    it('does not navigate when the credentials are rejected', async () => {
      globalThis.fetch = jest.fn(async () =>
        okJson({ success: false, error: 'Invalid credentials' }, 401)
      ) as unknown as typeof fetch

      render(<LoginPage />)
      fillAndSubmit()

      expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
      expect(assign).not.toHaveBeenCalled()
    })
  })

  describe('?redirect= sanitisation', () => {
    it('honours an internal path', async () => {
      params = new URLSearchParams('redirect=/members')
      render(<LoginPage />)
      fillAndSubmit()
      await waitFor(() => expect(assign).toHaveBeenCalledWith('/members'))
    })

    it.each([
      ['an absolute external URL', 'https://evil.example/steal'],
      ['a protocol-relative URL', '//evil.example/steal'],
      ['a javascript: URL', 'javascript:alert(1)'],
    ])('refuses %s and falls back to the dashboard', async (_name, hostile) => {
      params = new URLSearchParams()
      params.set('redirect', hostile)
      render(<LoginPage />)
      fillAndSubmit()

      await waitFor(() => expect(assign).toHaveBeenCalled())
      const target = assign.mock.calls[0][0] as string
      expect(target).toBe('/dashboard')
      expect(target).not.toContain('evil.example')
    })
  })

  describe('query-string banners', () => {
    it('explains why the user was bounced back here', () => {
      params = new URLSearchParams('error=unexpected_error')
      render(<LoginPage />)
      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument()
    })

    it('confirms a completed password reset', () => {
      params = new URLSearchParams('reset=success')
      render(<LoginPage />)
      expect(
        screen.getByText('Password reset. Sign in with your new password.')
      ).toBeInTheDocument()
    })

    it('ignores an unrecognised error code rather than echoing it', () => {
      // The banner is looked up in a fixed map; rendering the raw parameter
      // would put attacker-controlled text on the page.
      params = new URLSearchParams('error=<script>evil</script>')
      render(<LoginPage />)
      expect(screen.queryByText(/script/i)).toBeNull()
    })
  })

  describe('unverified email', () => {
    it('offers to resend the verification mail, but only for that error', async () => {
      globalThis.fetch = jest.fn(async () =>
        okJson(
          {
            success: false,
            error: 'Please verify your email',
            errorCode: 'email_verification_required',
          },
          403
        )
      ) as unknown as typeof fetch

      render(<LoginPage />)
      fillAndSubmit()

      expect(
        await screen.findByRole('button', { name: /resend/i })
      ).toBeInTheDocument()
    })

    it('does not offer a resend for an ordinary bad password', async () => {
      globalThis.fetch = jest.fn(async () =>
        okJson({ success: false, error: 'Invalid credentials' }, 401)
      ) as unknown as typeof fetch

      render(<LoginPage />)
      fillAndSubmit()

      await screen.findByText('Invalid credentials')
      expect(screen.queryByRole('button', { name: /resend/i })).toBeNull()
    })
  })

  describe('validation', () => {
    it('sends nothing when the email is malformed', async () => {
      // `type="email"` means the BROWSER rejects this first — the form never
      // submits and the Zod branch never runs. Asserting on the Zod message
      // here would be asserting against a layer that is never reached.
      render(<LoginPage />)
      fillAndSubmit('not-an-email', 'x')

      await waitFor(() => expect(globalThis.fetch).not.toHaveBeenCalled())
      expect(assign).not.toHaveBeenCalled()
    })

    it('reports a missing password without contacting the server', async () => {
      // A well-formed email with an empty password passes native validation, so
      // this is the path that actually exercises the Zod handler.
      render(<LoginPage />)
      fireEvent.change(email(), { target: { value: 'owner@gym.lk' } })
      fireEvent.click(submit())

      expect(
        await screen.findByText('Please fix the errors below')
      ).toBeVisible()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })
})
