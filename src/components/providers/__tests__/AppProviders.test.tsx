import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AppProviders } from '../AppProviders'

jest.mock('@/features/auth/components/AuthRecovery', () => ({
  AuthRecovery: () => <div data-testid="auth-recovery" />,
}))
jest.mock('@/components/pwa/ServiceWorkerRegistration', () => ({
  ServiceWorkerRegistration: () => <div data-testid="sw-registration" />,
}))

/** Throws unless rendered inside a QueryClientProvider. */
function NeedsQueryClient() {
  useQueryClient()
  return <p>screen</p>
}

/**
 * AppProviders is what the root layout used to mount around every page. The
 * signed-in and sign-in layouts now mount it themselves (SEO-060), so it must
 * provide exactly what they had: a QueryClient around the page, the toaster,
 * AuthRecovery and the service-worker registration.
 */
describe('AppProviders', () => {
  it('renders the page inside a QueryClient, with the app watchers mounted', () => {
    render(
      <AppProviders>
        <NeedsQueryClient />
      </AppProviders>
    )
    expect(screen.getByText('screen')).toBeInTheDocument()
    expect(screen.getByTestId('auth-recovery')).toBeInTheDocument()
    expect(screen.getByTestId('sw-registration')).toBeInTheDocument()
  })
})
