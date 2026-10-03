import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * A one-step utility flow with nothing to rank for: kept out of the index so
 * it never competes with real pages for the brand name.
 */
export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
