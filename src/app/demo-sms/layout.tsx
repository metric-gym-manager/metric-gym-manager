import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AppProviders } from '@/components/providers/AppProviders'
import { getCurrentGymProfile } from '@/lib/middleware/auth'

/**
 * Demo SMS Layout
 *
 * Restricts the /demo-sms page to the single designated demo account.
 * Authorization is entirely server-side: the signed-in gym owner's email must
 * match DEMO_TOOLS_ALLOWED_EMAIL (a server-only env var).
 *
 * Middleware already redirects unauthenticated visitors to /login before they
 * reach this layout; here we additionally send any non-demo account back to
 * their own dashboard, so the page never renders for them. The
 * /api/demo/send-sms endpoint enforces the same check independently
 * (defense in depth) — this layout just hides the UI.
 */
export default async function DemoSmsLayout({
  children,
}: {
  children: ReactNode
}) {
  const allowedEmail = process.env.DEMO_TOOLS_ALLOWED_EMAIL

  let gymProfile
  try {
    gymProfile = await getCurrentGymProfile()
  } catch {
    redirect('/login')
  }

  // Fail closed: if the demo email is not configured, or the signed-in account
  // is not the demo account, deny access.
  if (!allowedEmail || gymProfile.email !== allowedEmail) {
    redirect('/dashboard')
  }

  return <AppProviders>{children}</AppProviders>
}
