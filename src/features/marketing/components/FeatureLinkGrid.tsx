import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui'

export interface FeatureLink {
  href: string
  title: string
  summary: string
  /** Shown as a small mono tag, e.g. the tier a capability needs. */
  tag?: string
}

/**
 * Cards that each link to a deeper page. Each card's link text is the page's
 * own name, so anchors stay descriptive without repeating one phrase.
 */
export function FeatureLinkGrid({
  items,
  headingLevel = 'h3',
}: {
  items: readonly FeatureLink[]
  headingLevel?: 'h2' | 'h3'
}) {
  const Heading = headingLevel
  return (
    <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
      {items.map((item) => (
        <li key={item.href} className="flex">
          <Card className="relative flex w-full flex-col gap-3 rounded-lg bg-surface-panel p-6 transition-colors duration-normal focus-within:border-focusring hover:border-line-hover">
            <div className="flex items-start justify-between gap-3">
              <Heading className="text-h2 text-ink">
                <Link
                  href={item.href}
                  className="after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {item.title}
                </Link>
              </Heading>
              {item.tag && (
                <span className="shrink-0 rounded-sm border border-line-2 px-1.5 font-mono text-mono-sm uppercase text-ink-muted">
                  {item.tag}
                </span>
              )}
            </div>
            <p className="flex-1 text-sm text-ink-secondary">{item.summary}</p>
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1.5 text-sm text-brand-link"
            >
              Learn more <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Card>
        </li>
      ))}
    </ul>
  )
}
