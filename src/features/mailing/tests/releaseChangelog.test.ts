/**
 * @jest-environment node
 */
import { ChangeCategory } from '../config/AnnouncementConfig'
import { parseChangelog } from '../utils/changelog'

/**
 * The release workflow writes CHANGELOG.md (scripts/release.js, through
 * scripts/generate-changelog.js) and the announcement pipeline reads it
 * (`parseChangelog`). This suite runs the real generator on commits shaped
 * like this repository's and parses what it wrote, so the two sides can never
 * drift apart: a format the parser cannot read would silently send no email.
 */

interface Commit {
  hash: string
  subject: string
  body: string
}
interface Entry {
  hash: string
  hidden?: boolean
  releaseNote?: string | null
}
interface Categories {
  breaking: Entry[]
  features: Entry[]
  fixes: Entry[]
  performance: Entry[]
  chore: Entry[]
  docs: Entry[]
}
interface Generator {
  categorizeCommits(commits: Commit[]): Categories
  generateChangelogSection(
    version: string,
    date: string,
    categories: Categories
  ): string
}
interface Release {
  releaseTypeFor(categories: Categories): 'major' | 'minor' | 'patch' | null
  releaseDate(now: Date): string
}

const generator =
  require('../../../../scripts/generate-changelog.js') as Generator
const release = require('../../../../scripts/release.js') as Release

const NOTE =
  'We’ll now email you a short summary when Metric Gym OS gets new features or fixes.'

const COMMITS: Commit[] = [
  {
    hash: 'aaaaaaa',
    subject: 'feat(mailing): automatic release and policy-change emails',
    body: `- a developer bullet\n\nRelease-Note: ${NOTE}\nCo-Authored-By: Someone <x@y.z>`,
  },
  {
    hash: 'bbbbbbb',
    subject: 'fix(payments): resolve a rounding error',
    body: '',
  },
  {
    hash: 'ccccccc',
    subject: 'fix(cron): billing crons run on GET',
    body: 'Release-Note: none',
  },
  {
    hash: 'ddddddd',
    subject: 'feat(api)!: drop the v1 export endpoint',
    body: 'Release-Note: The old export link stops working; use Export in Settings instead.',
  },
  { hash: 'eeeeeee', subject: 'docs: update the README', body: '' },
]

describe('the changelog the release writes, read by the email', () => {
  const categories = generator.categorizeCommits(COMMITS)
  const section = generator.generateChangelogSection(
    '2.0.0',
    '2026-10-06',
    categories
  )
  const [parsed] = parseChangelog(`# Changelog\n\n${section}`)

  it('is read back as the version it was written for', () => {
    expect(parsed.version).toBe('2.0.0')
    expect(parsed.date).toBe('2026-10-06')
  })

  it('uses a Release-Note line word for word, with no developer scope in front', () => {
    expect(section).toContain(`- ${NOTE} ([aaaaaaa]`)
    expect(parsed.changes[ChangeCategory.New]).toEqual([
      { text: NOTE, details: [] },
    ])
  })

  it('falls back to the commit subject when there is no Release-Note', () => {
    expect(parsed.changes[ChangeCategory.Fixed]).toEqual([
      { text: 'Resolve a rounding error.', details: [] },
    ])
  })

  it('leaves out a commit marked Release-Note: none', () => {
    expect(section).not.toMatch(/billing crons/)
  })

  it('treats a scoped breaking change as breaking, in the words of its note', () => {
    expect(categories.breaking.map((e) => e.hash)).toEqual(['ddddddd'])
    expect(parsed.changes[ChangeCategory.Important]).toEqual([
      {
        text: 'The old export link stops working; use Export in Settings instead.',
        details: [],
      },
    ])
  })

  it('never puts documentation in front of gyms', () => {
    expect(section).not.toMatch(/README/)
  })

  it('writes a plain line, and nothing for the email, when every change is internal', () => {
    const internal = generator.categorizeCommits([COMMITS[2]])
    const quiet = generator.generateChangelogSection(
      '1.0.1',
      '2026-10-06',
      internal
    )
    expect(quiet).toMatch(/behind-the-scenes/i)
    const [read] = parseChangelog(`# Changelog\n\n${quiet}`)
    expect(Object.values(read.changes).flat()).toEqual([])
  })
})

/**
 * Inverted check, 2026-10-06. This repo's GitHub squash merge writes every
 * inner commit's message into the squashed commit's body
 * (`squash_merge_commit_message: COMMIT_MESSAGES`), so one commit can carry
 * several notes — including inner `Release-Note: none` lines that were only
 * about a tidy-up commit. And editors wrap long lines at 72 columns.
 */
describe('Release-Note lines in squashed and wrapped commit messages', () => {
  const lines = (commit: Commit) => {
    const section = generator.generateChangelogSection(
      '1.2.0',
      '2026-10-06',
      generator.categorizeCommits([commit])
    )
    const [read] = parseChangelog(`# Changelog\n\n${section}`)
    return Object.values(read.changes)
      .flat()
      .map((c) => c.text)
  }

  it('uses every real note in a squash, whatever order the inner commits came in', () => {
    expect(
      lines({
        hash: 'a1a1a1a',
        subject: 'feat(members): part payments (#95)',
        body:
          '* fix(members): tidy the sheet\n\nRelease-Note: none\n\n' +
          '* feat(members): part payments\n\nRelease-Note: Members can pay part of a fee.\n\n' +
          '* feat(members): receipts\n\nRelease-Note: Part payments get their own receipt.',
      })
    ).toEqual([
      'Members can pay part of a fee.',
      'Part payments get their own receipt.',
    ])
  })

  it('never lets an inner commit\'s "none" hide the squashed feature', () => {
    expect(
      lines({
        hash: 'a2a2a2a',
        subject: 'feat(members): part payments (#96)',
        body: '* feat(members): part payments\n\n* fix(members): tidy\n\nRelease-Note: none',
      })
    ).toEqual(['Part payments.'])
  })

  it('still hides a commit of its own marked none', () => {
    expect(
      lines({
        hash: 'a3a3a3a',
        subject: 'fix(cron): retry',
        body: 'Release-Note: none',
      })
    ).toEqual([])
  })

  it('keeps a note wrapped onto the next lines whole', () => {
    expect(
      lines({
        hash: 'a4a4a4a',
        subject: 'feat(members): part payments',
        body: 'Release-Note: Members can now pay part of a fee\n  and settle the rest\n  later.\n\nCo-Authored-By: X <x@y.z>',
      })
    ).toEqual(['Members can now pay part of a fee and settle the rest later.'])
  })
})

describe('releaseTypeFor — the version bump from the kinds of change', () => {
  const type = (commits: Commit[]) =>
    release.releaseTypeFor(generator.categorizeCommits(commits))

  it('makes a breaking change a major release', () => {
    expect(type(COMMITS)).toBe('major')
  })

  it('makes a new feature a minor release', () => {
    expect(type([COMMITS[0], COMMITS[1]])).toBe('minor')
  })

  it('makes a fix a patch release, even one kept out of the email', () => {
    expect(type([COMMITS[1]])).toBe('patch')
    expect(type([COMMITS[2]])).toBe('patch')
  })

  it('makes a speed-up a patch release', () => {
    expect(
      type([{ hash: 'f', subject: 'perf(revenue): load faster', body: '' }])
    ).toBe('patch')
  })

  it('releases nothing for documentation, tests or chores alone', () => {
    expect(
      type([
        COMMITS[4],
        { hash: 'g', subject: 'test(members): cover the sheet', body: '' },
        { hash: 'h', subject: 'chore(release): v1.0.1', body: '' },
      ])
    ).toBeNull()
  })
})

describe('releaseDate', () => {
  it('dates a release by the calendar in Sri Lanka', () => {
    expect(release.releaseDate(new Date('2026-10-06T20:00:00Z'))).toBe(
      '2026-10-07'
    )
  })
})
