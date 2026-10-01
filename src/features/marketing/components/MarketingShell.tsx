import type { ReactNode } from 'react'
import { MarketingHeader } from './MarketingHeader'
import { MarketingFooter } from './MarketingFooter'

/**
 * Chrome for every public page except the homepage (which keeps its own
 * bespoke hero) and the legal documents (LegalLayout). Dark, like the rest of
 * Metric — the tokens on `:root` are the dark palette.
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base font-geist text-ink antialiased">
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  )
}
