import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * Reached only from a verification email. Never indexed.
 */
export const metadata: Metadata = {
  title: 'Verify your email',
  robots: { index: false, follow: false },
}

export default function VerifyEmailLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
