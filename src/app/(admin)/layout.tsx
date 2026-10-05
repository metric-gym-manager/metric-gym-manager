import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin'
import { AppProviders } from '@/components/providers/AppProviders'

interface AdminLayoutProps {
  children: ReactNode
}

/** SaaS-operator surface: never indexable, whatever serves it. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Admin Layout — real authorization gate for SaaS-operator routes.
 *
 * Access requires a Supabase session (enforced by middleware) AND membership in
 * the `saas_admins` allow-list. A signed-in non-admin is bounced to their
 * dashboard; an unauthenticated visitor is already redirected to /login by
 * middleware before reaching here.
 *
 * This replaces the previous NEXT_PUBLIC_ADMIN_API_SECRET existence check, which
 * only verified the secret was configured (not that the *viewer* was authorized)
 * and shipped that secret to every browser via the client bundle.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const admin = await getSaasAdmin()

  if (!admin) {
    redirect('/dashboard')
  }

  // The same dark operational ground as the workspace. Deliberately no
  // navigation: adding one would be a navigation-architecture change, which the
  // UI directive (§4.10) puts out of scope for a visual correction.
  return (
    <AppProviders>
      <div
        data-theme="dark"
        className="min-h-screen bg-surface-base p-6 font-geist text-body text-ink antialiased"
      >
        {children}
      </div>
    </AppProviders>
  )
}
