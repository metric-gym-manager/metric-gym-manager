#!/usr/bin/env node

/**
 * Changelog Generator
 *
 * Parses git commits since last version tag and generates/updates CHANGELOG.md
 * following Keep a Changelog format.
 *
 * Usage:
 *   node scripts/generate-changelog.js              (generate for current version)
 *   node scripts/generate-changelog.js --unreleased (generate unreleased section)
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ============================================================================
// Configuration
// ============================================================================

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md')
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json')

const CHANGELOG_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`

// ============================================================================
// Helper Functions
// ============================================================================

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim()
  } catch (error) {
    return ''
  }
}

function getLastVersionTag() {
  const tags = execCommand('git tag --sort=-version:refname')
  if (!tags) return null

  const versionTags = tags
    .split('\n')
    .filter((tag) => tag.match(/^v?\d+\.\d+\.\d+$/))
  return versionTags[0] || null
}

/**
 * Commits making up the Unreleased section, or null when that is unknowable.
 *
 * Returns null rather than the entire history when no version tag exists.
 *
 * This repository has zero tags, so the old `if (!tag)` branch returned every
 * commit ever made. The post-merge hook then rewrote Unreleased with hundreds
 * of commits, headlined by a BREAKING CHANGE from 2026-07-07 renaming
 * subscription tiers to names that no longer exist anywhere in the code. A
 * changelog that confidently describes a product that is not shipping is worse
 * than no changelog.
 *
 * Falling back to the last `package.json` version bump was tried and rejected:
 * that commit is 483 commits back, because the project has never cut a release.
 * Without a release there is no "since the last release", and inventing one
 * produces the same wrong answer more slowly. The section stays under human
 * control until the first tag exists, after which this works as intended.
 *
 * Records are NUL-delimited, not newline-delimited: `%b` is the commit BODY and
 * is routinely multi-line, so splitting on newlines turned one commit into many
 * malformed records — 5,332 of them from a 488-commit repository.
 */
function getCommitsSinceTag(tag) {
  if (!tag) return null

  const out = execCommand(
    `git log ${tag}..HEAD --pretty=format:"%H|||%s|||%b%x00"`
  )
  if (!out) return []

  return out
    .split('\0')
    .map((record) => record.trim())
    .filter(Boolean)
    .map(parseCommitLine)
}

function parseCommitLine(line) {
  const [hash, subject, body] = line.split('|||')
  return { hash: hash.substring(0, 7), subject, body: body || '' }
}

function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    features: [],
    fixes: [],
    performance: [],
    docs: [],
    refactor: [],
    tests: [],
    chore: [],
    other: [],
  }

  commits.forEach((commit) => {
    const { subject, body, hash } = commit

    // Skip invalid commits
    if (!subject || typeof subject !== 'string') {
      return
    }

    const fullMessage = `${subject}\n${body}`

    // Extract scope if present: feat(scope): message
    const scopeMatch = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/)
    const type = scopeMatch ? scopeMatch[1] : null
    const scope = scopeMatch ? scopeMatch[2] : null
    const message = scopeMatch ? scopeMatch[3] : subject

    const entry = {
      hash,
      message,
      scope,
      originalSubject: subject,
    }

    // Check for breaking changes
    if (
      fullMessage.includes('BREAKING CHANGE') ||
      subject.match(/^(feat|fix)!/)
    ) {
      // Extract breaking change description
      const breakingMatch = fullMessage.match(/BREAKING CHANGE:\s*(.+)/)
      if (breakingMatch) {
        entry.breakingDescription = breakingMatch[1].trim()
      }
      categories.breaking.push(entry)
      return
    }

    // Categorize by type
    switch (type) {
      case 'feat':
      case 'feature':
        categories.features.push(entry)
        break
      case 'fix':
        categories.fixes.push(entry)
        break
      case 'perf':
        categories.performance.push(entry)
        break
      case 'docs':
        categories.docs.push(entry)
        break
      case 'refactor':
        categories.refactor.push(entry)
        break
      case 'test':
      case 'tests':
        categories.tests.push(entry)
        break
      case 'chore':
      case 'ci':
      case 'build':
        categories.chore.push(entry)
        break
      default:
        categories.other.push(entry)
    }
  })

  return categories
}

function formatChangelogEntry(entry) {
  const scope = entry.scope ? `**${entry.scope}**: ` : ''
  return `- ${scope}${entry.message} ([${entry.hash}](../../commit/${entry.hash}))`
}

function generateChangelogSection(version, date, categories) {
  const lines = []

  // Version header
  if (version === 'Unreleased') {
    lines.push(`## [Unreleased]\n`)
  } else {
    lines.push(`## [${version}] - ${date}\n`)
  }

  // Breaking changes (most important)
  if (categories.breaking.length > 0) {
    lines.push(`### ⚠️ BREAKING CHANGES\n`)
    categories.breaking.forEach((entry) => {
      if (entry.breakingDescription) {
        lines.push(
          `- ${entry.breakingDescription} ([${entry.hash}](../../commit/${entry.hash}))`
        )
      } else {
        lines.push(formatChangelogEntry(entry))
      }
    })
    lines.push('')
  }

  // Features
  if (categories.features.length > 0) {
    lines.push(`### Added\n`)
    categories.features.forEach((entry) => {
      lines.push(formatChangelogEntry(entry))
    })
    lines.push('')
  }

  // Fixes
  if (categories.fixes.length > 0) {
    lines.push(`### Fixed\n`)
    categories.fixes.forEach((entry) => {
      lines.push(formatChangelogEntry(entry))
    })
    lines.push('')
  }

  // Performance
  if (categories.performance.length > 0) {
    lines.push(`### Performance\n`)
    categories.performance.forEach((entry) => {
      lines.push(formatChangelogEntry(entry))
    })
    lines.push('')
  }

  // Refactoring (optional - can be noisy)
  // if (categories.refactor.length > 0) {
  //   lines.push(`### Changed\n`);
  //   categories.refactor.forEach(entry => {
  //     lines.push(formatChangelogEntry(entry));
  //   });
  //   lines.push('');
  // }

  return lines.join('\n')
}

function readExistingChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return CHANGELOG_HEADER
  }
  return fs.readFileSync(CHANGELOG_PATH, 'utf8')
}

function insertIntoChangelog(existingContent, newSection) {
  // Find where to insert (after header, before first ## version)
  const lines = existingContent.split('\n')
  const insertIndex = lines.findIndex(
    (line, i) =>
      i > 0 && line.startsWith('## [') && !line.includes('Unreleased')
  )

  if (insertIndex === -1) {
    // No existing versions, append at end
    return existingContent + '\n' + newSection
  }

  // Insert before first version
  lines.splice(insertIndex, 0, newSection)
  return lines.join('\n')
}

const AUTO_BEGIN = '<!-- changelog:auto:begin -->'
const AUTO_END = '<!-- changelog:auto:end -->'

/**
 * Update the generated part of Unreleased WITHOUT destroying anything a human
 * wrote there.
 *
 * The previous implementation replaced the whole section, so every post-merge
 * run silently deleted hand-written release notes — on one observed run, 16
 * lines of carefully worded prose about the SaaS billing work, swapped for
 * auto-generated bullets. The workflow in .claude/rules/versioning.md
 * explicitly asks humans to "enhance release notes with user-facing details",
 * which the tool then threw away.
 *
 * Generated content now lives between markers and only that span is rewritten.
 * Prose outside the markers — above or below — survives untouched. When the
 * markers are absent the block is APPENDED to the section rather than replacing
 * it, so adopting this on an existing changelog costs nothing.
 */
function replaceUnreleasedSection(existingContent, newSection) {
  const body = newSection.replace(/^## \[Unreleased\]\n*/, '').trimEnd()
  const block = `${AUTO_BEGIN}\n\n${body}\n\n${AUTO_END}`

  const begin = existingContent.indexOf(AUTO_BEGIN)
  const finish = existingContent.indexOf(AUTO_END)

  if (begin !== -1 && finish !== -1 && finish > begin) {
    return (
      existingContent.slice(0, begin) +
      block +
      existingContent.slice(finish + AUTO_END.length)
    )
  }

  const lines = existingContent.split('\n')
  const unreleasedIndex = lines.findIndex((line) =>
    line.includes('## [Unreleased]')
  )

  if (unreleasedIndex === -1) {
    // No Unreleased section at all: create one above the first released
    // version, or at the end when there are no releases yet.
    const firstRelease = lines.findIndex(
      (line, i) =>
        i > 0 && line.startsWith('## [') && !line.includes('Unreleased')
    )
    const section = `## [Unreleased]\n\n${block}\n`
    if (firstRelease === -1) return `${existingContent.trimEnd()}\n\n${section}`
    lines.splice(firstRelease, 0, section)
    return lines.join('\n')
  }

  // Append to the end of the existing Unreleased section, keeping its prose.
  const nextSection = lines.findIndex(
    (line, i) => i > unreleasedIndex && line.startsWith('## [')
  )
  const insertAt = nextSection === -1 ? lines.length : nextSection
  lines.splice(insertAt, 0, block, '')
  return lines.join('\n')
}

// ============================================================================
// Main Function
// ============================================================================

function main() {
  const args = process.argv.slice(2)
  const isUnreleased = args.includes('--unreleased')

  console.log('📝 Generating changelog...\n')

  // Get current version
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  const currentVersion = packageJson.version

  // Get last tag
  const lastTag = getLastVersionTag()
  console.log(`Last version tag: ${lastTag || 'none'}`)

  // Get commits since last tag
  const commits = getCommitsSinceTag(lastTag)

  if (commits === null) {
    console.log(
      '⚠️  No version tag found, so there is no release boundary and no way to\n' +
        '   know which commits are unreleased. Leaving CHANGELOG.md untouched.\n' +
        '   Cut a release (npm run version:gui) and this will work from then on.'
    )
    process.exit(0)
  }

  if (commits.length === 0) {
    console.log(
      '⚠️  No commits since last version. Nothing to add to changelog.'
    )
    process.exit(0)
  }

  console.log(`Commits to process: ${commits.length}\n`)

  // Categorize commits
  const categories = categorizeCommits(commits)

  console.log('📊 Commit Categories:')
  console.log(`  Breaking: ${categories.breaking.length}`)
  console.log(`  Features: ${categories.features.length}`)
  console.log(`  Fixes: ${categories.fixes.length}`)
  console.log(`  Performance: ${categories.performance.length}`)
  console.log(
    `  Other: ${categories.other.length + categories.docs.length + categories.refactor.length + categories.tests.length + categories.chore.length}`
  )

  // Generate changelog section
  const date = new Date().toISOString().split('T')[0]
  const version = isUnreleased ? 'Unreleased' : currentVersion
  const changelogSection = generateChangelogSection(version, date, categories)

  // Read existing changelog
  const existingChangelog = readExistingChangelog()

  // Insert or replace section
  let newChangelog
  if (isUnreleased) {
    newChangelog = replaceUnreleasedSection(existingChangelog, changelogSection)
  } else {
    newChangelog = insertIntoChangelog(existingChangelog, changelogSection)
  }

  // Write changelog
  fs.writeFileSync(CHANGELOG_PATH, newChangelog)

  console.log(`\n✅ Changelog updated: ${CHANGELOG_PATH}`)
  console.log(`   Section: ${version}`)

  if (isUnreleased) {
    console.log('\n💡 When ready to release, run: npm run version:gui')
  } else {
    console.log('\n💡 Next: Commit the changelog and push to main')
  }

  // Output for programmatic use
  if (process.env.OUTPUT_JSON) {
    console.log('\n--- JSON OUTPUT ---')
    console.log(
      JSON.stringify(
        {
          version,
          date,
          categories: {
            breaking: categories.breaking.length,
            features: categories.features.length,
            fixes: categories.fixes.length,
            performance: categories.performance.length,
          },
          totalCommits: commits.length,
        },
        null,
        2
      )
    )
  }
}

// ============================================================================
// Run
// ============================================================================

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

module.exports = {
  getLastVersionTag,
  getCommitsSinceTag,
  replaceUnreleasedSection,
  categorizeCommits,
  generateChangelogSection,
  readExistingChangelog,
  insertIntoChangelog,
}
