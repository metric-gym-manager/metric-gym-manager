import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import VerifyEmailPage from '../page'

let params = new URLSearchParams()
const push = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push }),
}))

const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const at = (query: string) => {
  params = new URLSearchParams(query)
  return render(<VerifyEmailPage />)
}

const urlsCalled = () =>
  (globalThis.fetch as jest.Mock).mock.calls.map((c) => c[0] as string)

/**
 * The server's reason must appear EXACTLY once.
 *
 * It used to appear twice: the subtitle paragraph rendered `message` on every
 * non-pending status, and the alert rendered it again directly below, so the
 * same sentence printed on two consecutive lines. The error state now has its
 * own fixed subtitle and the alert is the only carrier of the detail.
 */
const errorText = async (re: RegExp | string) => {
  const found = await screen.findAllByText(re)
  expect(found).toHaveLength(1)
  return found
}

beforeEach(() => {
  jest.clearAllMocks()
  globalThis.fetch = jest.fn(async () =>
    okJson({ success: true })
  ) as unknown as typeof fetch
})

describe('Verify email screen', () => {
  it('prompts the user to check their inbox when they arrive with no token', async () => {
    at('email=owner@gym.lk')
    expect(
      await screen.findByText(/open it to activate your workspace/i)
    ).toBeInTheDocument()
    // The address it is waiting on is echoed back, so the user can spot a typo.
    expect(screen.getByText('owner@gym.lk')).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  describe('following a verification link', () => {
    it('exchanges the token and confirms success', async () => {
      at('type=email&token_hash=abc123')

      await waitFor(() =>
        expect(urlsCalled()).toContain('/api/auth/verify-email')
      )
      expect(
        await screen.findByText(/verified successfully/i)
      ).toBeInTheDocument()
    })

    it('signs the stale session out after a verified email change', async () => {
      // The old session still carries the previous address. Leaving it live
      // would keep the user authenticated as the identity they just changed.
      at('type=email_change&token_hash=abc123')

      await waitFor(() => expect(urlsCalled()).toContain('/api/auth/logout'))
    })

    it('reports the server reason when the link is expired', async () => {
      globalThis.fetch = jest.fn(async () =>
        okJson({ success: false, error: 'Verification link has expired' }, 400)
      ) as unknown as typeof fetch

      at('type=email&token_hash=stale')

      expect((await errorText('Verification link has expired')).length).toBe(1)
      expect(urlsCalled()).not.toContain('/api/auth/logout')
    })

    it('does not leave the user on "Verifying…" when the request throws', async () => {
      // A pending state that never resolves is indistinguishable from a hung
      // page. Rule 2.8: pending and error are different things to a user.
      globalThis.fetch = jest.fn(async () => {
        throw new Error('network down')
      }) as unknown as typeof fetch

      at('type=email&token_hash=abc123')

      expect(
        (await errorText(/unexpected error occurred while verifying/i)).length
      ).toBe(1)
    })

    it('refuses a link of the right type carrying no token', async () => {
      at('type=email')
      expect((await errorText(/no token provided/i)).length).toBe(1)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })
})
