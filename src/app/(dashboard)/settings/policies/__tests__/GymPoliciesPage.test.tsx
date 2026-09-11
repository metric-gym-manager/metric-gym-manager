import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import GymPoliciesPage from '../page'
import {
  DEFAULT_GYM_RULES,
  DEFAULT_GYM_TERMS,
} from '@/features/settings/config/defaultGymPolicies'

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))
import { toast } from 'sonner'

const SAVED = { gym_rules: 'House rules', gym_terms: 'Our terms' }

const routes = (over: Record<string, unknown> = {}) =>
  mockFetchRoutes({ '/api/settings/policies': apiOk(SAVED), ...over })

/** The two textareas are distinguished only by placeholder. */
const rulesBox = () =>
  screen.getByPlaceholderText('Enter your gym rules and guidelines')
const termsBox = () =>
  screen.getByPlaceholderText('Enter your terms of service')
const resetButtons = () => screen.getAllByRole('button', { name: /reset/i })
const saveButton = () => screen.getByRole('button', { name: /save changes/i })

beforeEach(() => jest.clearAllMocks())

describe('Settings → Rules & Terms', () => {
  it('renders both documents from the API envelope', async () => {
    routes()
    renderScreen(<GymPoliciesPage />)

    expect(
      screen.getByRole('heading', { name: 'Rules & Terms' })
    ).toBeInTheDocument()
    await waitFor(() => expect(rulesBox()).toHaveValue('House rules'))
    expect(termsBox()).toHaveValue('Our terms')
  })

  it('unwraps result.data, not the envelope', async () => {
    // A fixture without the ResponseBuilder wrapper must not read as content.
    // This is the mistake renderScreen's `apiOk` exists to prevent.
    routes({ '/api/settings/policies': SAVED })
    renderScreen(<GymPoliciesPage />)
    await waitFor(() => expect(rulesBox()).toHaveValue(''))
  })

  it('keeps the two Reset buttons independent', async () => {
    // Both sections are structurally identical, so a copy-paste slip in either
    // handler resets the wrong document with nothing else to notice it.
    routes()
    renderScreen(<GymPoliciesPage />)
    await waitFor(() => expect(rulesBox()).toHaveValue('House rules'))

    fireEvent.click(resetButtons()[0])
    expect(rulesBox()).toHaveValue(DEFAULT_GYM_RULES)
    expect(termsBox()).toHaveValue('Our terms')

    fireEvent.click(resetButtons()[1])
    expect(termsBox()).toHaveValue(DEFAULT_GYM_TERMS)
    expect(rulesBox()).toHaveValue(DEFAULT_GYM_RULES)
  })

  it('does not wipe the other document when edited before the fetch lands', async () => {
    // Regression, found by the inverted check on 2026-09-09. The draft was one
    // whole `GymPolicies` object, so typing into Rules while the GET was still
    // in flight built a draft carrying `gym_terms: ''` — and the draft masked
    // the response for the rest of the session. Terms rendered empty and Save
    // PATCHed that empty string over the gym's real Terms of Service, the
    // document members legally agree to at registration.
    let release: (v: unknown) => void = () => {}
    const pending = new Promise((r) => (release = r))
    globalThis.fetch = jest.fn(async (_u, init?: RequestInit) => {
      if (init?.method === 'PATCH')
        return {
          ok: true,
          status: 200,
          json: async () => apiOk(SAVED),
        } as Response
      await pending
      return {
        ok: true,
        status: 200,
        json: async () => apiOk(SAVED),
      } as Response
    }) as unknown as typeof fetch

    renderScreen(<GymPoliciesPage />)
    fireEvent.change(rulesBox(), { target: { value: 'my new rules' } })
    release(null)

    // Wait on the SERVER value: the draft is already on screen, so waiting on
    // it settles before the query resolves and asserts nothing.
    await waitFor(() => expect(termsBox()).toHaveValue(SAVED.gym_terms))
    expect(rulesBox()).toHaveValue('my new rules')
  })

  it('PATCHes both documents together', async () => {
    const fetchMock = routes()
    renderScreen(<GymPoliciesPage />)
    await waitFor(() => expect(rulesBox()).toHaveValue('House rules'))

    fireEvent.change(rulesBox(), { target: { value: 'Edited rules' } })
    fireEvent.click(saveButton())

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH'
      )
      expect(patch).toBeDefined()
      expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({
        gym_rules: 'Edited rules',
        gym_terms: 'Our terms',
      })
    })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Rules & terms saved')
    )
  })

  it('surfaces the server message when the save is rejected', async () => {
    routes({
      '/api/settings/policies': {
        status: 200,
        body: apiOk(SAVED),
      },
    })
    renderScreen(<GymPoliciesPage />)
    await waitFor(() => expect(rulesBox()).toHaveValue('House rules'))

    // Re-point only the PATCH at a failure.
    globalThis.fetch = jest.fn(async (_url, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return {
          ok: false,
          status: 422,
          json: async () => ({ error: { message: 'Rules are too long' } }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => apiOk(SAVED),
      } as Response
    }) as unknown as typeof fetch

    fireEvent.click(saveButton())
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Rules are too long')
    )
  })

  it('disables the save button while the request is in flight', async () => {
    let release: (v: unknown) => void = () => {}
    routes()
    renderScreen(<GymPoliciesPage />)
    await waitFor(() => expect(rulesBox()).toHaveValue('House rules'))

    globalThis.fetch = jest.fn(
      () => new Promise((resolve) => (release = resolve))
    ) as unknown as typeof fetch

    fireEvent.click(saveButton())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    )
    release({ ok: true, status: 200, json: async () => apiOk(SAVED) })
  })
})
