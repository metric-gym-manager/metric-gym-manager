import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import SecurityPage from '../page'

const profile = (over: Record<string, unknown> = {}) => ({
  gym_name: 'Titan Fitness',
  username: 'titan',
  email: 'owner@titan.test',
  email_verified: true,
  phone_number: '+94770001234',
  ...over,
})

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/auth/profile': apiOk(profile()),
  ...over,
})

const rowFor = (label: string) =>
  within(screen.getByText(label).closest('div')!.parentElement!)

describe('SecurityPage', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows the current value of every credential', async () => {
    mockFetchRoutes(routes())
    renderScreen(<SecurityPage />)

    expect(await screen.findByText('titan')).toBeInTheDocument()
    expect(screen.getByText('owner@titan.test')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
  })

  /**
   * The phone number is masked in the UI. It is the OTP-login factor, so the
   * full value has no business rendering on a page someone can shoulder-surf.
   */
  it('masks the phone number, and says so when there is none', async () => {
    mockFetchRoutes(routes())
    const { unmount } = renderScreen(<SecurityPage />)
    expect(await screen.findByText('+94 XX XXX 1234')).toBeInTheDocument()
    expect(screen.queryByText('+94770001234')).not.toBeInTheDocument()
    unmount()

    mockFetchRoutes(
      routes({ '/api/auth/profile': apiOk(profile({ phone_number: null })) })
    )
    renderScreen(<SecurityPage />)
    expect(await screen.findByText('Not set')).toBeInTheDocument()
  })

  it('flags an unverified email and explains what to do', async () => {
    mockFetchRoutes(
      routes({ '/api/auth/profile': apiOk(profile({ email_verified: false })) })
    )
    renderScreen(<SecurityPage />)

    expect(await screen.findByText('Unverified')).toBeInTheDocument()
    expect(screen.getByText(/Action required:/i)).toBeInTheDocument()
  })

  /**
   * `email_verified: false` covers two different situations, and the banner has
   * to tell them apart:
   *
   *   pending_email set    -> an email CHANGE is in flight. Supabase runs with
   *                           `double_confirm_changes`, so the current address
   *                           must approve as well as the new one. Two inboxes.
   *   pending_email null   -> a signup that was never confirmed. One inbox.
   *
   * Naming one mailbox for a two-mailbox process made the change look stuck —
   * one link clicked, still Unverified, no explanation. Naming two for a
   * one-mailbox process would send the user hunting for an email that was never
   * sent. Pinned because the failure is pure copy and nothing else in the suite
   * can see it.
   */
  it('names BOTH addresses while an email change is pending', async () => {
    mockFetchRoutes(
      routes({
        '/api/auth/profile': apiOk(
          profile({ email_verified: false, pending_email: 'new@titan.test' })
        ),
      })
    )
    renderScreen(<SecurityPage />)

    const marker = await screen.findByText(/Action required:/i)
    const copy = marker.closest('div')?.textContent ?? ''

    expect(copy).toMatch(/both/i)
    expect(copy).toContain('owner@titan.test') // current
    expect(copy).toContain('new@titan.test') // pending
    expect(copy).toMatch(/only once both/i)
    expect(copy).not.toMatch(/check your inbox at/i)
  })

  it('names ONE address for a signup that was never confirmed', async () => {
    // No change in flight, so there is no second inbox to send anyone to.
    mockFetchRoutes(
      routes({
        '/api/auth/profile': apiOk(
          profile({ email_verified: false, pending_email: null })
        ),
      })
    )
    renderScreen(<SecurityPage />)

    const marker = await screen.findByText(/Action required:/i)
    const copy = marker.closest('div')?.textContent ?? ''

    expect(copy).toContain('owner@titan.test')
    expect(copy).not.toMatch(/both/i)
  })

  /**
   * The dialog is where the decision is made, so it is where the explanation
   * has to be — before the user commits, not after two emails arrive and only
   * one is expected. Pinned separately from the banner: they are different
   * strings on different surfaces and either can drift alone.
   */
  it('explains double confirmation in the dialog, before the user commits', async () => {
    mockFetchRoutes(routes())
    renderScreen(<SecurityPage />)

    await waitFor(() =>
      expect(rowFor('Email address').getByRole('button')).toBeEnabled()
    )
    fireEvent.click(rowFor('Email address').getByRole('button'))

    const dialog = await screen.findByRole('dialog')
    const copy = dialog.textContent ?? ''

    expect(copy).toMatch(/BOTH/)
    expect(copy).toMatch(/current and your new address/i)
    // Says WHY, not just what — the security reason is the justification for
    // an otherwise annoying two-step.
    expect(copy).toMatch(/gains access to your account/i)
    // And the button promises two links, not one.
    expect(
      within(dialog).getByRole('button', { name: /send confirmation links/i })
    ).toBeInTheDocument()
  })

  it('does not flag a verified email', async () => {
    mockFetchRoutes(routes())
    renderScreen(<SecurityPage />)
    await screen.findByText('titan')
    expect(screen.queryByText('Unverified')).not.toBeInTheDocument()
    expect(
      screen.getByText('Used for login and account recovery')
    ).toBeInTheDocument()
  })

  it('disables an action until the value it edits has loaded', () => {
    mockFetchRoutes(routes())
    renderScreen(<SecurityPage />)
    // Before the profile query resolves there is nothing to edit, and the
    // update modals are seeded from it.
    expect(rowFor('Username').getByRole('button')).toBeDisabled()
    expect(rowFor('Email address').getByRole('button')).toBeDisabled()
  })

  it('enables the actions once the profile arrives', async () => {
    mockFetchRoutes(routes())
    renderScreen(<SecurityPage />)
    await waitFor(() =>
      expect(rowFor('Username').getByRole('button')).toBeEnabled()
    )
    expect(rowFor('Email address').getByRole('button')).toBeEnabled()
  })

  /**
   * Directive §5.18: settings are "section headers, dividers, aligned labels
   * and controls — professional configuration software, not nested form
   * cards". This page rendered as four stacked `Card`s until the close-out
   * pass, while `/settings/gym` beside it already used `SettingsSection`; the
   * inconsistency was visible on screen and invisible to every check here.
   *
   * The assertion is on the rendered surface rather than on imports, because
   * the defect was compositional: the page could import the right primitive
   * and still stack four bordered boxes.
   */
  it('composes as one section of hairline rows, not stacked cards', async () => {
    mockFetchRoutes(routes())
    const { container } = renderScreen(<SecurityPage />)
    await screen.findByText('titan')

    const cardLike = container.querySelectorAll(
      '.bg-surface-card, [class*="rounded-sm"][class*="border-line-1"]'
    )
    expect(cardLike).toHaveLength(0)

    // One labelled section over the four credential rows.
    expect(container.querySelectorAll('section')).toHaveLength(1)
  })
})
