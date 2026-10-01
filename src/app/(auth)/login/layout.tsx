import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * Metadata for /login (the page itself is a client component, so it cannot
 * export metadata). Indexable — people search for "Metric Gym OS login" — but
 * canonicalised to the bare path so `?redirect=…` variants from the auth
 * middleware fold into one URL. Not in the sitemap: a sign-in form is a
 * destination, not content.
 */
export const metadata: Metadata = {
  title: 'Log in',
  description:
    'Log in to Metric Gym OS to manage your gym’s members, renewals, payments and SMS reminders.',
  alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
