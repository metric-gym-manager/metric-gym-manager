/**
 * @jest-environment node
 */
import { ChangeCategory } from '../config/AnnouncementConfig'
import {
  compareVersions,
  parseChangelog,
  releaseType,
  selectReleases,
} from '../utils/changelog'

/**
 * Shaped like the real file: Keep a Changelog header, a hand-written
 * Unreleased section, and versioned sections in the two styles that reach it —
 * `scripts/generate-changelog.js` output (scope prefix, commit link) and
 * hand-written prose with wrapped lines and sub-bullets.
 */
const CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- something not released yet ([aaaaaaa](../../commit/aaaaaaa))

## [1.2.0] - 2026-10-20

### ⚠️ BREAKING CHANGES

- **members**: the frozen status is gone; frozen members are now expired ([1111111](../../commit/1111111))

### Added

- **payments**: record a part payment from the member sheet ([2222222](../../commit/2222222))
- **SaaS billing via PayHere** — monthly recurring billing with a
  past-due grace banner:
  - Subscription page under Settings
  - Cancel keeps Pro until \`period end\`
- **ci**: run the e2e suite on every push ([3333333](../../commit/3333333))

### Fixed

- **dashboard**: totals no longer count [cancelled members](https://example.com/x) ([4444444](../../commit/4444444))
- **docs**: fix a typo in the README ([5555555](../../commit/5555555))

### Documentation

- explain the cron schedule ([6666666](../../commit/6666666))

## [1.1.1] - 2026-10-12

<!-- changelog:auto:begin -->

### Performance

- **revenue**: the revenue page loads twice as fast ([7777777](../../commit/7777777))

<!-- changelog:auto:end -->

## [1.1.0] - 2026-10-08

### Fixed

- **test**: stabilise a flaky test ([8888888](../../commit/8888888))
`

describe('parseChangelog', () => {
  const sections = parseChangelog(CHANGELOG)
  const byVersion = (v: string) => {
    const found = sections.find((s) => s.version === v)
    if (!found) throw new Error(`no section ${v}`)
    return found
  }

  it('reads the versioned sections and never Unreleased', () => {
    expect(sections.map((s) => s.version)).toEqual(['1.2.0', '1.1.1', '1.1.0'])
    expect(byVersion('1.2.0').date).toBe('2026-10-20')
  })

  it('maps each heading to its group and drops headings not meant for gyms', () => {
    const changes = byVersion('1.2.0').changes
    expect(changes[ChangeCategory.Important]).toHaveLength(1)
    expect(changes[ChangeCategory.New]).toHaveLength(2)
    expect(changes[ChangeCategory.Fixed]).toHaveLength(1)
    const all = Object.values(changes).flat()
    expect(all.map((c) => c.text).join(' ')).not.toMatch(/cron schedule/)
  })

  it('strips the scope prefix, the commit link and markdown, and finishes the sentence', () => {
    const [partPayment] = byVersion('1.2.0').changes[ChangeCategory.New]
    expect(partPayment).toEqual({
      text: 'Record a part payment from the member sheet.',
      details: [],
    })
    const [totals] = byVersion('1.2.0').changes[ChangeCategory.Fixed]
    expect(totals.text).toBe('Totals no longer count cancelled members.')
  })

  it('drops lines whose scope is about the codebase, not the product', () => {
    const texts = Object.values(byVersion('1.2.0').changes)
      .flat()
      .map((c) => c.text)
    expect(texts.join(' ')).not.toMatch(/e2e suite|typo/)
  })

  it('joins wrapped lines and keeps sub-bullets as details', () => {
    const billing = byVersion('1.2.0').changes[ChangeCategory.New][1]
    expect(billing.text).toBe(
      'SaaS billing via PayHere — monthly recurring billing with a past-due grace banner:'
    )
    expect(billing.details).toEqual([
      'Subscription page under Settings.',
      'Cancel keeps Pro until period end.',
    ])
  })

  it('reads entries between the generator markers', () => {
    expect(byVersion('1.1.1').changes[ChangeCategory.Improved]).toEqual([
      { text: 'The revenue page loads twice as fast.', details: [] },
    ])
  })

  it('leaves a version with only internal changes empty', () => {
    const all = Object.values(byVersion('1.1.0').changes).flat()
    expect(all).toEqual([])
  })

  it('reads nothing from a file with no released versions', () => {
    expect(parseChangelog('# Changelog\n\n## [Unreleased]\n\n- x\n')).toEqual(
      []
    )
  })
})

describe('compareVersions', () => {
  it('orders numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0)
  })
})

describe('releaseType', () => {
  it('names the largest part that changed', () => {
    expect(releaseType('1.2.3', '2.0.0')).toBe('major')
    expect(releaseType('1.2.3', '1.3.0')).toBe('minor')
    expect(releaseType('1.2.3', '1.2.4')).toBe('patch')
  })

  it('calls a first release with nothing before it minor', () => {
    expect(releaseType(null, '1.1.0')).toBe('minor')
  })
})

describe('selectReleases', () => {
  const sections = parseChangelog(CHANGELOG)

  it('takes every version above the last announced, up to the deployed one, newest first', () => {
    const picked = selectReleases(sections, {
      deployed: '1.2.0',
      lastAnnounced: '1.1.0',
    })
    expect(picked.map((s) => s.version)).toEqual(['1.2.0', '1.1.1'])
  })

  it('never takes a version above the deployed one', () => {
    const picked = selectReleases(sections, {
      deployed: '1.1.1',
      lastAnnounced: '1.1.0',
    })
    expect(picked.map((s) => s.version)).toEqual(['1.1.1'])
  })

  it('takes only the deployed version when nothing was ever announced', () => {
    const picked = selectReleases(sections, {
      deployed: '1.2.0',
      lastAnnounced: null,
    })
    expect(picked.map((s) => s.version)).toEqual(['1.2.0'])
  })

  it('takes nothing when the deployed version has no section, even if older ones are unannounced', () => {
    expect(
      selectReleases(sections, { deployed: '1.3.0', lastAnnounced: '1.1.0' })
    ).toEqual([])
  })

  it('takes nothing once the deployed version is announced', () => {
    expect(
      selectReleases(sections, { deployed: '1.2.0', lastAnnounced: '1.2.0' })
    ).toEqual([])
  })
})
