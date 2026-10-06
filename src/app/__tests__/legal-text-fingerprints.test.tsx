import { createHash } from 'node:crypto'
import type { ComponentType } from 'react'
import { render } from '@testing-library/react'
import { MARKETING_PAGES } from '@/features/marketing/config/pages'
import { LEGAL_TEXT_FINGERPRINTS } from '@/features/marketing/config/legalChanges'
import PrivacyPolicyPage from '../privacy/page'
import TermsOfServicePage from '../terms/page'
import RefundPolicyPage from '../refund-policy/page'

/**
 * A change to what a legal page SAYS must be dated and decided.
 *
 * The inverted check of 2026-10-06 added "We may suspend any account at any
 * time without notice." to the Terms with no date change, and all 136 related
 * tests passed: no notice would have gone out and nothing complained. Policy
 * notices hang off `lastModified` (legalChanges.ts), so wording edited without
 * a new date reaches nobody.
 *
 * Each page's document text (its `.legal-sec` sections, not the navigation) is
 * fingerprinted under `path@lastModified`. Changing the text without a new
 * date fails here; so does a new date without a fingerprint.
 */

const PAGES: Record<string, ComponentType> = {
  '/privacy': PrivacyPolicyPage,
  '/terms': TermsOfServicePage,
  '/refund-policy': RefundPolicyPage,
}

function fingerprint(Page: ComponentType): string {
  const { container } = render(<Page />)
  const text = Array.from(container.querySelectorAll('.legal-sec'))
    .map((section) => section.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

const HOW =
  'set its lastModified in features/marketing/config/pages.ts to today, add a ' +
  'LEGAL_CHANGES entry for that date (notify: true with a summary when the ' +
  'change matters to a gym, notify: false when it is wording only), and record ' +
  'the new fingerprint under that date in LEGAL_TEXT_FINGERPRINTS.'

it('fingerprints every legal page, and only those', () => {
  const legal = MARKETING_PAGES.filter((p) => p.kind === 'legal').map(
    (p) => p.path
  )
  expect(Object.keys(PAGES).sort()).toEqual([...legal].sort())
})

describe.each(Object.entries(PAGES))('%s', (path, Page) => {
  const page = MARKETING_PAGES.find((p) => p.path === path)
  const key = `${path}@${page?.lastModified}`

  it('has its text recorded for its current date', () => {
    const actual = fingerprint(Page)
    const recorded = LEGAL_TEXT_FINGERPRINTS[key]
    if (recorded !== actual) {
      throw new Error(
        `The text of ${path} is not the text recorded for ${key} ` +
          `(recorded ${recorded ?? 'nothing'}, now ${actual}). If you changed ` +
          `what it says, ${HOW}`
      )
    }
  })
})
