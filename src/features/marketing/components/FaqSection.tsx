import type { ReactNode } from 'react'
import { MarketingSection } from './MarketingSection'

export interface FaqItem {
  question: string
  answer: ReactNode
}

/**
 * Questions answered in full, always visible.
 *
 * Deliberately not an accordion: a collapsed Radix panel is not in the DOM, so
 * its answer would be missing from the HTML a crawler reads. And deliberately
 * no FAQPage markup — Google only shows FAQ rich results for authoritative
 * government and health sites (SEO-031); the visible answers do the work.
 */
export function FaqSection({
  title = 'Questions gym owners ask',
  items,
}: {
  title?: string
  items: readonly FaqItem[]
}) {
  return (
    <MarketingSection id="faq" eyebrow="FAQ" title={title}>
      {/* Not a <dl>: a <dt> may not contain a heading, and each question is
          an <h3> so the page outline lists them. */}
      <div className="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
        {items.map((item) => (
          <div key={item.question} className="flex flex-col gap-2 py-6">
            <h3 className="text-h2 text-ink">{item.question}</h3>
            <div className="flex flex-col gap-3 text-body-lg text-ink-secondary [&_a]:text-brand-link [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-brand-link-hover">
              {item.answer}
            </div>
          </div>
        ))}
      </div>
    </MarketingSection>
  )
}
