import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ARTICLE_PAGES,
  CallToAction,
  HUB_PATH,
  MarketingHero,
  MarketingSection,
  RESOURCES_PATH,
  StructuredData,
  buildPageMetadata,
  formatDisplayDate,
} from '@/features/marketing'

const PATH = RESOURCES_PATH

export const metadata: Metadata = buildPageMetadata(PATH)

export default function ResourcesPage() {
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Resources"
        title="Resources for gym owners"
        lead={
          <p>
            Practical notes from building Metric for Sri Lankan gyms. Each one
            explains the reasoning behind a decision — when to remind members,
            how to measure revenue — so it is useful whichever system you run.
          </p>
        }
      />

      <MarketingSection title="Guides" width="wide">
        <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
          {ARTICLE_PAGES.map((article) => (
            <li
              key={article.path}
              className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-surface-panel p-6"
            >
              <p className="font-mono text-metadata uppercase text-ink-muted">
                <time dateTime={article.published}>
                  {article.published && formatDisplayDate(article.published)}
                </time>
              </p>
              <h3 className="text-h1 text-ink">
                <Link
                  href={article.path}
                  className="underline-offset-4 hover:underline"
                >
                  {article.title.replace(' | Metric Gym OS', '')}
                </Link>
              </h3>
              <p className="text-sm text-ink-secondary">
                {article.description}
              </p>
            </li>
          ))}
        </ul>
        <p className="pt-6 text-sm text-ink-muted">
          Looking for the product itself? See{' '}
          <Link
            href={HUB_PATH}
            className="text-brand-link underline underline-offset-4 hover:text-brand-link-hover"
          >
            gym management software for Sri Lanka
          </Link>
          .
        </p>
      </MarketingSection>

      <CallToAction />
    </>
  )
}
