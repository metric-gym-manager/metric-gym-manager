/**
 * CHANGELOG.md → the changes a release email lists.
 *
 * Pure: no file or network access. The cron route reads the file and passes
 * the text in. The file is written during the owner's release
 * (`npm run version:gui` → `scripts/generate-changelog.js`), whose lines read
 * `- **scope**: message ([hash](../../commit/hash))`; hand-written sections
 * may also wrap lines and nest sub-bullets. Both shapes are parsed.
 */
import {
  CHANGE_CATEGORY_ORDER,
  CHANGELOG_HEADING_CATEGORY,
  ChangeCategory,
  INTERNAL_CHANGE_SCOPES,
} from '../config/AnnouncementConfig'

/** One line of a release email, with any sub-points under it. */
export interface ChangeItem {
  text: string
  details: string[]
}

/** One released version of CHANGELOG.md, grouped for the email. */
export interface ReleaseSection {
  version: string
  /** The `YYYY-MM-DD` after the version heading, or `null` when absent. */
  date: string | null
  changes: Record<ChangeCategory, ChangeItem[]>
}

const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/
const COMMIT_LINK = /\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)/g
const PR_REFERENCE = /\s*\(#\d+\)/g
const SCOPE_PREFIX = /^\*\*([a-z][a-z0-9-]*)\*\*:\s*/

export function emptyChanges(): Record<ChangeCategory, ChangeItem[]> {
  return Object.fromEntries(
    CHANGE_CATEGORY_ORDER.map((category) => [category, []])
  ) as unknown as Record<ChangeCategory, ChangeItem[]>
}

/** `### ⚠️ BREAKING CHANGES` → `breaking changes`. */
function headingKey(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Markdown out, sentence finished: what a gym owner reads. */
function cleanText(raw: string): string {
  let text = raw
    .replace(COMMIT_LINK, '')
    .replace(PR_REFERENCE, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  text = text.charAt(0).toUpperCase() + text.slice(1)
  return /[.!?:]$/.test(text) ? text : `${text}.`
}

interface DraftItem {
  lines: string[]
  details: string[][]
}

/** A finished draft, or `null` when its scope is internal. */
function finishItem(draft: DraftItem): ChangeItem | null {
  const joined = draft.lines.join(' ').trim()
  const scope = SCOPE_PREFIX.exec(joined)
  if (scope && INTERNAL_CHANGE_SCOPES.has(scope[1])) return null
  const text = cleanText(scope ? joined.slice(scope[0].length) : joined)
  if (!text) return null
  return {
    text,
    details: draft.details
      .map((lines) => cleanText(lines.join(' ')))
      .filter(Boolean),
  }
}

/**
 * Every released version in the file, in file order (newest first).
 * `[Unreleased]` is never read: it has not shipped.
 *
 * @param markdown - The text of CHANGELOG.md
 * @returns One section per `## [x.y.z]` heading
 */
export function parseChangelog(markdown: string): ReleaseSection[] {
  const sections: ReleaseSection[] = []
  let section: ReleaseSection | null = null
  let category: ChangeCategory | null = null
  let draft: DraftItem | null = null
  let inUnreleased = false

  const flush = () => {
    if (section && category && draft) {
      const item = finishItem(draft)
      if (item) section.changes[category].push(item)
    }
    draft = null
  }

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      flush()
      const match = VERSION_HEADING.exec(line)
      inUnreleased = !match
      category = null
      section = match
        ? { version: match[1], date: match[2] ?? null, changes: emptyChanges() }
        : null
      if (section) sections.push(section)
      continue
    }
    if (inUnreleased || !section) continue

    if (line.startsWith('### ')) {
      flush()
      category = CHANGELOG_HEADING_CATEGORY[headingKey(line.slice(4))] ?? null
      continue
    }
    if (!category || line.trim().startsWith('<!--')) continue

    const bullet = /^- (.*)$/.exec(line)
    if (bullet) {
      flush()
      draft = { lines: [bullet[1]], details: [] }
      continue
    }
    const current: DraftItem | null = draft
    if (!current) continue
    const sub = /^\s+[-*] (.*)$/.exec(line)
    if (sub) {
      current.details.push([sub[1]])
    } else if (line.trim()) {
      const lastDetail = current.details[current.details.length - 1]
      if (lastDetail) lastDetail.push(line.trim())
      else current.lines.push(line.trim())
    }
  }
  flush()
  return sections
}

/** Numeric `x.y.z` order: positive when `a` is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * The largest semver part that changed between two versions.
 *
 * @param previous - The version before, or `null` for a first release
 * @param next - The version being announced
 */
export function releaseType(
  previous: string | null,
  next: string
): 'major' | 'minor' | 'patch' {
  if (!previous) return 'minor'
  const [pMajor, pMinor] = previous.split('.').map(Number)
  const [nMajor, nMinor] = next.split('.').map(Number)
  if (nMajor !== pMajor) return 'major'
  if (nMinor !== pMinor) return 'minor'
  return 'patch'
}

/**
 * The sections one release email covers: every version above the last one
 * announced, up to and including the deployed one, newest first. Two releases
 * deployed before the job runs therefore become one email.
 *
 * Nothing at all when the DEPLOYED version has no section: the changelog was
 * not written for this release, and announcing only older versions would
 * describe a product that is no longer the one running.
 *
 * @param sections - From {@link parseChangelog}
 * @param versions - What is deployed, and the newest version ever announced
 *   (`null` before the first: then only the deployed version is taken, never
 *   the whole history)
 */
export function selectReleases(
  sections: ReleaseSection[],
  versions: { deployed: string; lastAnnounced: string | null }
): ReleaseSection[] {
  const { deployed, lastAnnounced } = versions
  if (!sections.some((s) => s.version === deployed)) return []
  if (lastAnnounced === null) {
    return sections.filter((s) => s.version === deployed)
  }
  return sections
    .filter(
      (s) =>
        compareVersions(s.version, lastAnnounced) > 0 &&
        compareVersions(s.version, deployed) <= 0
    )
    .sort((a, b) => compareVersions(b.version, a.version))
}
