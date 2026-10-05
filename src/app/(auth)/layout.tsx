import type { ReactNode } from 'react'
import { AppProviders } from '@/components/providers/AppProviders'

/**
 * The sign-in pages (/login, /register, /forgot-password, /reset-password,
 * /verify-email) get the app's providers here, as they did from the root
 * layout before SEO-060: AuthRecovery shows the "session expired" toast on
 * /login and repairs stale auth state before a sign-in, and the service
 * worker registers on the §2.15 full-document navigation into the app.
 * Each page keeps its own layout for its metadata.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
