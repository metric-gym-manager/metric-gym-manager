import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from '@/components/ui'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'
// Deep import: the @/features/auth barrel is server-only (rule 2.15).
import { AuthRecovery } from '@/features/auth/components/AuthRecovery'

/**
 * The signed-in app's machinery: react-query around the page, the toaster,
 * the service-worker registration (rule 2.19) and AuthRecovery, the client
 * half of the auth handshake (rule 2.15), which brings the Supabase browser
 * client with it.
 *
 * Mounted by the layouts of every surface where a session exists or is being
 * established — the workspace, the SaaS admin, the sign-in pages, the demo SMS
 * tool and the dev showcase — and never by the root layout. In the root
 * layout it reached every public page, which used none of it: 87 KB of gzipped
 * JavaScript on the homepage, the guides, the legal pages and /join (SEO-060,
 * measured 2026-10-04). Order and nesting are exactly the root layout's were.
 * `providers-placement.test.ts` pins where it is mounted.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QueryProvider>
        {children}
        <Toaster />
      </QueryProvider>
      <ServiceWorkerRegistration />
      <AuthRecovery />
    </>
  )
}
