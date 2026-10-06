/**
 * Legal page changes, and whether each is announced to the gyms by email.
 *
 * One entry per change to `/privacy`, `/terms` or `/refund-policy`, dated
 * with the page's `lastModified` in `pages.ts`. `legalChanges.test.ts` fails
 * when a legal page's date moves without an entry, so editing a policy forces
 * the decision: `notify: true` sends a notice (a material change: what we
 * collect, how we use it, what a customer pays or may do); `notify: false`
 * records an editorial one (wording, layout, a fixed link).
 *
 * The notice goes to every gym with a current subscription, whatever its email
 * choices (owner decision, 2026-10-06), through the `policy-update` Resend
 * template — `summary` becomes its `SUMMARY_HTML`. Write it for a gym owner:
 * what changed for THEM, in a few plain sentences. A notice is sent once; when
 * several changes to one page are waiting, only the newest is sent, so its
 * summary must cover them all.
 */

export interface LegalChange {
  /** The page, as registered in `pages.ts`. */
  path: '/privacy' | '/terms' | '/refund-policy'
  /** The page's `lastModified` when this change shipped, `YYYY-MM-DD`. */
  date: string
  /** Email the gyms about it. */
  notify: boolean
  /** What changed, for the notice. Required when `notify` is true. */
  summary: readonly string[]
}

export const LEGAL_CHANGES: readonly LegalChange[] = [
  // Baselines: the pages as they were when announcements began. Nothing to say.
  { path: '/terms', date: '2026-07-01', notify: false, summary: [] },
  { path: '/refund-policy', date: '2026-07-01', notify: false, summary: [] },
  // Email Communications (§5) added. Covered by the 2026-10-06 notice below,
  // the first one there is.
  { path: '/privacy', date: '2026-10-05', notify: false, summary: [] },
  {
    path: '/privacy',
    date: '2026-10-06',
    notify: true,
    summary: [
      'We now send two kinds of optional email: marketing (product news, offers and tips) and product and security updates.',
      'You can stop either kind, or both, from the link at the foot of any of these emails.',
      'When we make a material change to our Terms of Service, Privacy Policy or Refund Policy, we email every gym owner with a current subscription, whatever email choices you have made.',
      'If you change your account’s email address, your email choices move with it.',
    ],
  },
]

/**
 * The text each legal page had on its `lastModified` date: the first 16 hex
 * characters of the SHA-256 of its document sections, whitespace collapsed
 * (src/app/__tests__/legal-text-fingerprints.test.tsx). Keyed `path@date`, so
 * wording changed without a new date fails that test instead of reaching
 * nobody. Add a key when a page gets a new date; never rewrite an old one.
 */
export const LEGAL_TEXT_FINGERPRINTS: Readonly<Record<string, string>> = {
  '/privacy@2026-10-06': '069cf6a03fc2c8f5',
  '/terms@2026-07-01': '993ff18b7d6bcd36',
  '/refund-policy@2026-07-01': '5e0575584e294b19',
}
