import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RegisterPage from '../page'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const field = (id: string) => document.getElementById(id) as HTMLInputElement
const set = (id: string, value: string) =>
  fireEvent.change(field(id), { target: { value } })

const GOOD = {
  'register-username': 'ironhouse',
  'register-email': 'owner@gym.lk',
  'register-password': 'Str0ngPassw0rd',
  'register-confirm-password': 'Str0ngPassw0rd',
}

const fillStep1 = (over: Partial<typeof GOOD> = {}) => {
  for (const [id, value] of Object.entries({ ...GOOD, ...over })) set(id, value)
}
const continueBtn = () => screen.getByRole('button', { name: 'Continue' })

beforeEach(() => {
  jest.clearAllMocks()
  globalThis.fetch = jest.fn(async () =>
    okJson({ success: true })
  ) as unknown as typeof fetch
})

describe('Register screen', () => {
  describe('step 1 — credentials', () => {
    it('starts on the credentials step, with no gym fields on screen', () => {
      render(<RegisterPage />)
      expect(field('register-username')).toBeInTheDocument()
      expect(field('register-gym-name')).toBeNull()
    })

    it('advances once the credentials are valid', () => {
      render(<RegisterPage />)
      fillStep1()
      fireEvent.click(continueBtn())
      expect(field('register-gym-name')).toBeInTheDocument()
    })

    it.each([
      ['a short username', { 'register-username': 'ab' }],
      ['a short password', { 'register-password': 'Ab1' }],
      ['a password with no digit', { 'register-password': 'Passwordd' }],
      ['a password with no uppercase', { 'register-password': 'passw0rdd' }],
      [
        'a mismatched confirmation',
        { 'register-confirm-password': 'Different1' },
      ],
    ])('refuses to advance with %s', (_name, over) => {
      render(<RegisterPage />)
      fillStep1(over as Partial<typeof GOOD>)
      fireEvent.click(continueBtn())
      // Still on step 1 — the gym fields never appear.
      expect(field('register-gym-name')).toBeNull()
    })

    it('never contacts the server from step 1', () => {
      render(<RegisterPage />)
      fillStep1()
      fireEvent.click(continueBtn())
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })

  describe('password strength meter', () => {
    it.each([
      // The score counts five independent traits (length>=8, lower, upper,
      // digit, symbol) and buckets <=2 / 3 / 4 / 5. Worth pinning at the
      // boundaries: this is the only feedback a user gets before the server's
      // policy rejects them.
      ['1 trait', 'abc', 'WEAK'],
      ['2 traits', 'abcdefgh', 'WEAK'],
      ['3 traits', 'Abcdefgh', 'FAIR'],
      ['4 traits', 'Abcdefg1', 'GOOD'],
      ['5 traits', 'Abcdefg1!', 'STRONG'],
    ])('rates a password with %s', (_name, value, label) => {
      render(<RegisterPage />)
      set('register-password', value)
      expect(screen.getByText(label)).toBeInTheDocument()
    })

    it('shows no rating for an untouched field', () => {
      render(<RegisterPage />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('step 2 — submission', () => {
    const reachStep2 = () => {
      render(<RegisterPage />)
      fillStep1()
      fireEvent.click(continueBtn())
      set('register-gym-name', 'Iron House')
      set('register-gym-address', '12 Galle Road, Colombo')
    }

    it('posts the whole registration', async () => {
      reachStep2()
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0]
        expect(url).toBe('/api/auth/register')
        const body = JSON.parse((init as RequestInit).body as string)
        expect(body.email).toBe('owner@gym.lk')
        expect(body.gymName).toBe('Iron House')
      })
    })

    it('hands the email to the verify screen, URL-encoded', async () => {
      // The address goes into a query string. An unencoded `+` or `&` in an
      // address would silently truncate it and the verify screen would prompt
      // for the wrong mailbox.
      render(<RegisterPage />)
      fillStep1({ 'register-email': 'owner+gym@example.lk' })
      fireEvent.click(continueBtn())
      set('register-gym-name', 'Iron House')
      set('register-gym-address', '12 Galle Road, Colombo')
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          '/verify-email?email=owner%2Bgym%40example.lk'
        )
      )
    })

    it('keeps the user on the form when the server refuses', async () => {
      globalThis.fetch = jest.fn(async () =>
        okJson({ success: false, error: 'Username already taken' }, 409)
      ) as unknown as typeof fetch

      reachStep2()
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      expect(
        await screen.findByText('Username already taken')
      ).toBeInTheDocument()
      expect(push).not.toHaveBeenCalled()
    })

    it('goes back to step 1 with the credentials still filled in', () => {
      reachStep2()
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))

      expect(field('register-username')).toHaveValue('ironhouse')
      expect(field('register-gym-name')).toBeNull()
    })
  })
})
