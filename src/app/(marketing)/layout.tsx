import type { ReactNode } from 'react'
import { MarketingShell } from '@/features/marketing'

/**
 * Public marketing pages: product, features, pricing, company, resources and
 * contact. Every route in this group must be listed in PUBLIC_ROUTES
 * (src/lib/auth-config.ts) and in the page registry — `pages.test.ts` fails if
 * either is missing, because the auth middleware would otherwise answer an
 * anonymous visitor (and Googlebot) with 307 → /login.
 *
 * Nothing here reads a session or tenant data: these pages are static.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>
}
