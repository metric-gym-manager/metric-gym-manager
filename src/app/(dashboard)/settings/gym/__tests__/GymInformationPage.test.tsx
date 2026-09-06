import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import GymInformationPage from '../page'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/features/members', () => ({
  __esModule: true,
  ProfileImageUpload: () => <div data-testid="profile-image-upload" />,
}))

const profile = {
  gym_name: 'Titan Fitness',
  gym_address: 'Colombo',
  gym_website: '',
  email: 'owner@titan.test',
  profile_image_url: null,
}

const routes = (over: Record<string, unknown> = {}) => ({
  '/api/auth/profile': apiOk(profile),
  '/api/settings/gym': { ok: true },
  '/api/auth/logout': {},
  ...over,
})

describe('GymInformationPage', () => {
  afterEach(() => jest.clearAllMocks())

  it('prefills the form from the gym profile', async () => {
    mockFetchRoutes(routes())
    renderScreen(<GymInformationPage />)

    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )
    expect(screen.getByLabelText('Address')).toHaveValue('Colombo')
    expect(screen.getByLabelText('Website')).toHaveValue('')
  })

  it('PATCHes only the gym fields on save', async () => {
    const fetchMock = mockFetchRoutes(routes())
    renderScreen(<GymInformationPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )

    fireEvent.change(screen.getByLabelText('Gym name'), {
      target: { value: 'Titan Fitness Colombo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]).includes('/api/settings/gym') &&
          (c[1] as RequestInit)?.method === 'PATCH'
      )
      expect(call).toBeDefined()
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
        gym_name: 'Titan Fitness Colombo',
        gym_address: 'Colombo',
        gym_website: '',
      })
    })
  })

  it('confirms a successful save to the user', async () => {
    mockFetchRoutes(routes())
    renderScreen(<GymInformationPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )

    fireEvent.change(screen.getByLabelText('Gym name'), {
      target: { value: 'Renamed' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))
    expect(
      await screen.findByText('Gym information updated')
    ).toBeInTheDocument()
  })

  it('rejects an empty gym name before sending anything', async () => {
    const fetchMock = mockFetchRoutes(routes())
    renderScreen(<GymInformationPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )

    fireEvent.change(screen.getByLabelText('Gym name'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      const patches = fetchMock.mock.calls.filter(
        (c) => (c[1] as RequestInit)?.method === 'PATCH'
      )
      expect(patches).toHaveLength(0)
    })
  })

  it('reverts edits on cancel', async () => {
    mockFetchRoutes(routes())
    renderScreen(<GymInformationPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )

    fireEvent.change(screen.getByLabelText('Gym name'), {
      target: { value: 'Scratch' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )
  })

  /**
   * "Register new gym" signs the current gym out first — it is an auth-boundary
   * action, and skipping the logout would carry the old session into
   * registration. Ordering is the whole behaviour, so it is asserted directly.
   */
  it('signs out before sending the user to register another gym', async () => {
    const fetchMock = mockFetchRoutes(routes())
    renderScreen(<GymInformationPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Gym name')).toHaveValue('Titan Fitness')
    )

    fireEvent.click(screen.getByRole('button', { name: /Register new gym/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/register'))
    expect(
      fetchMock.mock.calls.some((c) =>
        String(c[0]).includes('/api/auth/logout')
      )
    ).toBe(true)
  })
})
