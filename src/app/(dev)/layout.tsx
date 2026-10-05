import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppProviders } from '@/components/providers/AppProviders'

/** Development-only showcase routes: never indexable. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
