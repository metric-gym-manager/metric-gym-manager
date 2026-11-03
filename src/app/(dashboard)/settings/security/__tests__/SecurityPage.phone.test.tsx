import { screen, fireEvent, within, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import SecurityPage from '../page'

const profile = {
  gym_name: 'Titan Fitness',
  username: 'titan',
  email: 'owner@titan.test',
  email_verified: true,
  phone_number: '+94770001234',
}

afterEach(() => jest.clearAllMocks())

/**
 * §8.14: Security's four dialogs are `sheet`s.
 *
 * Every one is a short credential form — one decision, ≤ 4 controls — which is
 * §11's definition of a sheet, and the audit called these "the squeezed-dialog
 * shape" on a phone: the `center` placement is a desktop geometry baked into
 * the primitive (`top-24`, `max-h-[calc(100vh-96px)]`), so on a 568 px screen
 * a keyboard leaves almost nothing of the form visible.
 *
 * `placement` is entirely `phone:`-scoped inside `Modal`, so the desktop
 * renders each of these exactly as before — which is why the assertion is on
 * the attribute rather than on geometry jsdom cannot compute.
 */
describe('Security — dialog placement', () => {
  it.each([
    ['Username', 0],
    ['Email address', 1],
    ['Phone number', 2],
    ['Password', 3],
  ])('opens the %s dialog as a sheet', async (label) => {
    mockFetchRoutes({ '/api/auth/profile': apiOk(profile) })
    renderScreen(<SecurityPage />, { viewport: 'phone' })
    await screen.findByText('titan')

    const row = screen.getByText(label).closest('div')!.parentElement!
    fireEvent.click(
      within(row).getByRole('button', { name: /Update|Change|Set/ })
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-placement', 'sheet')
  })

  /**
   * The same attribute on the desktop tier: `sheet` is not a tier switch, it
   * is a placement whose every effect is `phone:`-scoped. If this ever reads
   * `center` on one tier and `sheet` on the other, something has started
   * branching on the tier that should not.
   */
  it('carries the same placement on the desktop tier', async () => {
    mockFetchRoutes({ '/api/auth/profile': apiOk(profile) })
    renderScreen(<SecurityPage />, { viewport: 'desktop' })
    await screen.findByText('titan')

    const row = screen.getByText('Username').closest('div')!.parentElement!
    fireEvent.click(within(row).getByRole('button', { name: 'Update' }))

    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'data-placement',
      'sheet'
    )
  })
})

/**
 * The owner changes their own phone number in one step. There was a two-step
 * "send a code, enter the code" dialog here whose two endpoints never existed,
 * so every attempt failed; the signed-in session is the proof of ownership.
 */
describe('Security — phone number', () => {
  async function openPhoneDialog(phoneRoute: unknown = apiOk(profile)) {
    const fetchMock = mockFetchRoutes({
      '/api/settings/security/phone': phoneRoute,
      '/api/auth/profile': apiOk(profile),
    })
    renderScreen(<SecurityPage />, { viewport: 'desktop' })
    await screen.findByText('titan')
    const row = screen.getByText('Phone number').closest('div')!.parentElement!
    fireEvent.click(within(row).getByRole('button', { name: 'Update' }))
    const dialog = within(await screen.findByRole('dialog'))
    return { fetchMock, dialog }
  }

  const phoneRequests = (fetchMock: jest.Mock) =>
    (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url]) => url === '/api/settings/security/phone'
    )

  it('saves the new number in one step, sent in its stored +94 form', async () => {
    const { fetchMock, dialog } = await openPhoneDialog()

    expect(dialog.queryByText(/Verification Code/)).not.toBeInTheDocument()
    expect(
      dialog.queryByRole('button', { name: /Send OTP/ })
    ).not.toBeInTheDocument()

    fireEvent.change(dialog.getByLabelText(/New Phone Number/), {
      target: { value: '077 123 4567' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(phoneRequests(fetchMock)).toHaveLength(1))
    const [, init] = phoneRequests(fetchMock)[0]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      phone_number: '+94771234567',
    })
    expect(
      await dialog.findByText('Phone number updated successfully')
    ).toBeInTheDocument()
  })

  it('shows the server’s reason when another gym already uses the number', async () => {
    const { fetchMock, dialog } = await openPhoneDialog({
      status: 409,
      body: ResponseBuilder.conflict(
        'This phone number is already used by another gym account.'
      ),
    })

    fireEvent.change(dialog.getByLabelText(/New Phone Number/), {
      target: { value: '0771234567' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    expect(
      await dialog.findByText(
        'This phone number is already used by another gym account.'
      )
    ).toBeInTheDocument()
    expect(phoneRequests(fetchMock)).toHaveLength(1)
  })

  it('refuses a number that is not a Sri Lankan mobile without asking the server', async () => {
    const { fetchMock, dialog } = await openPhoneDialog()

    fireEvent.change(dialog.getByLabelText(/New Phone Number/), {
      target: { value: '0112345678' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    expect(
      await dialog.findByText(
        'Invalid Sri Lankan mobile number. Use format: 0771234567'
      )
    ).toBeInTheDocument()
    expect(phoneRequests(fetchMock)).toHaveLength(0)
  })
})
