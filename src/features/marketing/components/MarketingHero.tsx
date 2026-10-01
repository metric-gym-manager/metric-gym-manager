import type { ReactNode } from 'react'
import { MarketingBreadcrumbs } from './MarketingBreadcrumbs'

/**
 * Opening block of a public subpage: breadcrumbs, a mono eyebrow, the page's
 * single <h1> and a lead paragraph that answers "what is this page about?" in
 * plain words before anything else — the part a search result or an AI
 * summary is most likely to quote.
 */
export function MarketingHero({
  path,
  eyebrow,
  title,
  lead,
  children,
}: {
  path: string
  eyebrow: string
  title: ReactNode
  lead: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="border-b border-line-subtle">
      <div className="mx-auto flex max-w-marketing flex-col gap-6 px-6 pb-16 pt-10 phone:px-4 phone:pb-12 phone:pt-6">
        <MarketingBreadcrumbs path={path} />
        <div className="flex max-w-3xl flex-col gap-5 pt-6 phone:pt-2">
          <p className="font-mono text-metadata uppercase text-ink-muted">
            {eyebrow}
          </p>
          <h1 className="text-pretty text-display text-ink">{title}</h1>
          <div className="max-w-2xl text-pretty text-xl text-ink-secondary phone:text-lg">
            {lead}
          </div>
          {children}
        </div>
      </div>
    </section>
  )
}
