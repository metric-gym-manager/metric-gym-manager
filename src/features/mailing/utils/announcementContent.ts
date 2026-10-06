/**
 * The values an announcement template is filled with.
 *
 * Every text value is HTML-escaped here, braces included, so nothing taken
 * from CHANGELOG.md or a policy summary can become markup or a Resend
 * placeholder. `*_HTML` values are lists built from that escaped text. They
 * carry spacing only, never colour or font: the template decides how they look
 * (wrap `{{{CHANGES_HTML}}}` in a styled cell and it inherits that style).
 */
import { SITE_URL } from '@/features/marketing/config/site'
import type { LegalChange } from '@/features/marketing/config/legalChanges'
import {
  ANNOUNCEMENT_APP_PATH,
  ANNOUNCEMENT_TIME_ZONE,
  CHANGE_CATEGORY_LABELS,
  CHANGE_CATEGORY_NOUNS,
  CHANGE_CATEGORY_ORDER,
  ChangeCategory,
  LEGAL_DOCUMENT_NAMES,
  RELEASE_TYPE_LABELS,
  type PolicyVariable,
  type ReleaseVariable,
} from '../config/AnnouncementConfig'
import {
  MailingTopic,
  preferencesLinkTemplate,
  unsubscribeLinkTemplate,
} from '../config/MailingConfig'
import {
  emptyChanges,
  releaseType,
  type ChangeItem,
  type ReleaseSection,
} from './changelog'

const LIST = 'margin:0 0 16px;padding:0 0 0 20px'
const ITEM = 'margin:0 0 6px'
const SUB_LIST = 'margin:6px 0 0;padding:0 0 0 18px'
const HEADING = 'margin:24px 0 8px;font-size:16px;font-weight:600'

/**
 * Text made safe to place in HTML, and inert to Resend's `{{{…}}}`.
 *
 * @param text - Any text
 * @returns The escaped text
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

/** `2026-10-20` → `20 October 2026`, the calendar day as written. */
function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** Today in Sri Lanka, written the same way. */
function formatToday(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ANNOUNCEMENT_TIME_ZONE,
  }).format(now)
}

function listHtml(items: readonly ChangeItem[]): string {
  if (items.length === 0) return ''
  const rows = items.map((item) => {
    const details = item.details.length
      ? `<ul style="${SUB_LIST}">${item.details
          .map((d) => `<li style="${ITEM}">${escapeHtml(d)}</li>`)
          .join('')}</ul>`
      : ''
    return `<li style="${ITEM}">${escapeHtml(item.text)}${details}</li>`
  })
  return `<ul style="${LIST}">${rows.join('')}</ul>`
}

/** `['a', 'b', 'c']` → `a, b and c`. */
function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export interface ReleaseContentInput {
  /** From `selectReleases`: newest first. One email covers them all. */
  releases: readonly ReleaseSection[]
  /** The last version announced before these, `null` before the first. */
  previousVersion: string | null
  now: Date
}

/**
 * The release template's values.
 *
 * @param input - The versions this email covers
 * @returns A value for every variable in the release contract
 * @throws {Error} When `releases` is empty
 */
export function releaseVariables(
  input: ReleaseContentInput
): Record<ReleaseVariable, string | number> {
  const [newest] = input.releases
  if (!newest) throw new Error('A release email needs at least one version')

  const merged = emptyChanges()
  for (const release of input.releases) {
    for (const category of CHANGE_CATEGORY_ORDER) {
      merged[category].push(...release.changes[category])
    }
  }

  const html = (category: ChangeCategory) => listHtml(merged[category])
  const count = (category: ChangeCategory) => merged[category].length

  const changesHtml = CHANGE_CATEGORY_ORDER.filter((c) => count(c) > 0)
    .map(
      (c) =>
        `<h3 style="${HEADING}">${CHANGE_CATEGORY_LABELS[c]}</h3>${html(c)}`
    )
    .join('')

  const summary = joinWords(
    CHANGE_CATEGORY_ORDER.filter((c) => count(c) > 0).map((c) => {
      const [one, many] = CHANGE_CATEGORY_NOUNS[c]
      return `${count(c)} ${count(c) === 1 ? one : many}`
    })
  )

  return {
    VERSION: escapeHtml(newest.version),
    RELEASE_DATE: newest.date ? formatDay(newest.date) : formatToday(input.now),
    RELEASE_TYPE:
      RELEASE_TYPE_LABELS[releaseType(input.previousVersion, newest.version)],
    SUMMARY: summary,
    CHANGES_HTML: changesHtml,
    IMPORTANT_HTML: html(ChangeCategory.Important),
    IMPORTANT_COUNT: count(ChangeCategory.Important),
    NEW_HTML: html(ChangeCategory.New),
    NEW_COUNT: count(ChangeCategory.New),
    IMPROVED_HTML: html(ChangeCategory.Improved),
    IMPROVED_COUNT: count(ChangeCategory.Improved),
    FIXED_HTML: html(ChangeCategory.Fixed),
    FIXED_COUNT: count(ChangeCategory.Fixed),
    SECURITY_HTML: html(ChangeCategory.Security),
    SECURITY_COUNT: count(ChangeCategory.Security),
    APP_URL: `${SITE_URL}${ANNOUNCEMENT_APP_PATH}`,
    UNSUBSCRIBE_URL: unsubscribeLinkTemplate(MailingTopic.Updates),
  }
}

/**
 * The policy template's values.
 *
 * @param change - The registry entry being announced
 * @returns A value for every variable in the policy contract
 */
export function policyVariables(
  change: LegalChange
): Record<PolicyVariable, string> {
  const summary = change.summary.map(escapeHtml)
  return {
    DOCUMENT_NAME: escapeHtml(LEGAL_DOCUMENT_NAMES[change.path] ?? change.path),
    DOCUMENT_URL: `${SITE_URL}${change.path}`,
    UPDATED_DATE: formatDay(change.date),
    SUMMARY_HTML: summary.length
      ? `<ul style="${LIST}">${summary
          .map((line) => `<li style="${ITEM}">${line}</li>`)
          .join('')}</ul>`
      : '',
    SUMMARY_TEXT: summary.join(' '),
    PREFERENCES_URL: preferencesLinkTemplate(),
  }
}

/** `22 October 2026 at 09:30`, Sri Lanka time. */
function whenIn(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ANNOUNCEMENT_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/**
 * The notice at the top of a preview: when the real send goes, and how to
 * stop it. Centred at email width, above the template's own layout.
 *
 * @param name - The real broadcast's name in Resend
 * @param scheduledAt - When it goes, ISO
 */
export function previewBanner(name: string, scheduledAt: string): string {
  return (
    '<div style="padding:0 16px">' +
    '<div style="max-width:560px;margin:16px auto;box-sizing:border-box;' +
    'border:2px dashed;padding:12px 16px;' +
    'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">' +
    '<strong>Preview.</strong> This email goes to the gyms on ' +
    `<strong>${whenIn(scheduledAt)}</strong> Sri Lanka time. To stop it, ` +
    `cancel the broadcast <strong>${escapeHtml(name)}</strong> at ` +
    '<a href="https://resend.com/broadcasts">resend.com/broadcasts</a> before then.' +
    '</div></div>'
  )
}
