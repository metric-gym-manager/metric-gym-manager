import Link from 'next/link'
import { MarketingSection } from './MarketingSection'

export interface RelatedPage {
  href: string
  title: string
  summary: string
}

/** "Keep reading" links between related pages, each with a one-line why. */
export function RelatedPages({
  title = 'Related',
  items,
}: {
  title?: string
  items: readonly RelatedPage[]
}) {
  return (
    <MarketingSection title={title} width="wide">
      <ul className="grid grid-cols-1 gap-x-10 gap-y-6 tablet:grid-cols-2">
        {items.map((item) => (
          <li key={item.href} className="flex flex-col gap-1">
            <Link
              href={item.href}
              className="text-lg font-semibold text-ink underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-sm text-ink-secondary">{item.summary}</p>
          </li>
        ))}
      </ul>
    </MarketingSection>
  )
}
