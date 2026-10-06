/**
 * Announcement configuration — the single owner (R5) of how a release or a
 * legal-page change becomes an email (docs/architecture/marketing-email.md,
 * "Announcements").
 *
 * The emails are designed as Resend templates, outside this repo. This file
 * owns the CONTRACT with them: the alias each is fetched by and every variable
 * the pipeline fills. `scripts/send-announcements.ts` compares it with the
 * published templates, so a variable renamed in the Resend editor is reported
 * instead of mailing gyms an empty field.
 *
 * Client-safe: pure data, no SDK.
 */

/** What an announcement is about. */
export enum AnnouncementKind {
  /** A new version reached production. */
  Release = 'release',
  /** A legal page (privacy, terms, refund policy) changed materially. */
  Policy = 'policy',
}

/** The Resend template each kind is built from, fetched by alias. */
export const ANNOUNCEMENT_TEMPLATE_ALIAS: Record<AnnouncementKind, string> = {
  [AnnouncementKind.Release]: 'release-announcement',
  [AnnouncementKind.Policy]: 'policy-update',
}

/**
 * The variables each template may use, as `{{{NAME}}}`. A template may leave
 * any of them out; one it uses that is NOT listed here has no value, so the
 * render refuses to send (unless the template gives it a fallback).
 *
 * `*_HTML` values are markup built from escaped text; everything else is
 * escaped text. `{{{contact.<key>}}}` placeholders are not ours: they pass
 * through for Resend to fill per recipient.
 */
export const ANNOUNCEMENT_VARIABLES = {
  [AnnouncementKind.Release]: [
    'VERSION',
    'RELEASE_DATE',
    'RELEASE_TYPE',
    'SUMMARY',
    'CHANGES_HTML',
    'IMPORTANT_HTML',
    'IMPORTANT_COUNT',
    'NEW_HTML',
    'NEW_COUNT',
    'IMPROVED_HTML',
    'IMPROVED_COUNT',
    'FIXED_HTML',
    'FIXED_COUNT',
    'SECURITY_HTML',
    'SECURITY_COUNT',
    'APP_URL',
    'UNSUBSCRIBE_URL',
  ],
  [AnnouncementKind.Policy]: [
    'DOCUMENT_NAME',
    'DOCUMENT_URL',
    'UPDATED_DATE',
    'SUMMARY_HTML',
    'SUMMARY_TEXT',
    'PREFERENCES_URL',
  ],
} as const satisfies Record<AnnouncementKind, readonly string[]>

export type ReleaseVariable =
  (typeof ANNOUNCEMENT_VARIABLES)[AnnouncementKind.Release][number]
export type PolicyVariable =
  (typeof ANNOUNCEMENT_VARIABLES)[AnnouncementKind.Policy][number]

/** The groups a release's changes are shown in, in display order. */
export enum ChangeCategory {
  Important = 'important',
  New = 'new',
  Improved = 'improved',
  Fixed = 'fixed',
  Security = 'security',
}

export const CHANGE_CATEGORY_ORDER: readonly ChangeCategory[] = [
  ChangeCategory.Important,
  ChangeCategory.New,
  ChangeCategory.Improved,
  ChangeCategory.Fixed,
  ChangeCategory.Security,
]

/** The heading a group gets inside `CHANGES_HTML`. */
export const CHANGE_CATEGORY_LABELS: Record<ChangeCategory, string> = {
  [ChangeCategory.Important]: 'Important',
  [ChangeCategory.New]: 'New',
  [ChangeCategory.Improved]: 'Improved',
  [ChangeCategory.Fixed]: 'Fixed',
  [ChangeCategory.Security]: 'Security',
}

/**
 * CHANGELOG.md `###` headings, lowercased with emoji and punctuation removed,
 * and the group each feeds. A heading not listed here (Documentation,
 * Refactoring, …) is internal and never reaches an email.
 * `scripts/generate-changelog.js` writes the first four; the rest are the
 * Keep a Changelog headings a person may add by hand.
 */
export const CHANGELOG_HEADING_CATEGORY: Readonly<
  Record<string, ChangeCategory>
> = {
  'breaking changes': ChangeCategory.Important,
  added: ChangeCategory.New,
  fixed: ChangeCategory.Fixed,
  performance: ChangeCategory.Improved,
  changed: ChangeCategory.Improved,
  removed: ChangeCategory.Improved,
  security: ChangeCategory.Security,
}

/**
 * Conventional Commit scopes that describe the codebase, not the product. A
 * changelog line with one of these scopes is left out of the email.
 */
export const INTERNAL_CHANGE_SCOPES: ReadonlySet<string> = new Set([
  'arch',
  'build',
  'ci',
  'deps',
  'dev',
  'docs',
  'e2e',
  'lint',
  'test',
  'tests',
])

/** `RELEASE_TYPE`, from the largest semver part that changed. */
export const RELEASE_TYPE_LABELS = {
  major: 'Major update',
  minor: 'New features',
  patch: 'Fixes and improvements',
} as const

/** The public name each legal page is announced under (`DOCUMENT_NAME`). */
export const LEGAL_DOCUMENT_NAMES: Readonly<Record<string, string>> = {
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
  '/refund-policy': 'Refund & Cancellation Policy',
}

/**
 * How long the real send waits after the preview (owner decision,
 * 2026-10-06): the preview arrives, and cancelling the broadcast in Resend
 * within this window stops it.
 */
export const ANNOUNCEMENT_HOLD_HOURS = 24

/**
 * A claim still `pending` after this long was interrupted (a timeout, a
 * crash). It is reconciled against Resend by broadcast name before anything is
 * retried, so an ambiguous outcome is never sent twice.
 */
export const STALE_CLAIM_MINUTES = 15

/** Dates in emails are written for Sri Lanka, where every gym is. */
export const ANNOUNCEMENT_TIME_ZONE = 'Asia/Colombo'

/** How a group is counted in `SUMMARY`: singular, plural. */
export const CHANGE_CATEGORY_NOUNS: Record<ChangeCategory, [string, string]> = {
  [ChangeCategory.Important]: ['important change', 'important changes'],
  [ChangeCategory.New]: ['new feature', 'new features'],
  [ChangeCategory.Improved]: ['improvement', 'improvements'],
  [ChangeCategory.Fixed]: ['fix', 'fixes'],
  [ChangeCategory.Security]: ['security update', 'security updates'],
}

/** The subject when the template has none of its own. */
export const ANNOUNCEMENT_DEFAULT_SUBJECT: Record<AnnouncementKind, string> = {
  [AnnouncementKind.Release]: 'What’s new in Metric Gym OS {{{VERSION}}}',
  [AnnouncementKind.Policy]: 'We’ve updated our {{{DOCUMENT_NAME}}}',
}

/** Where the email's button takes a gym owner. */
export const ANNOUNCEMENT_APP_PATH = '/dashboard'
