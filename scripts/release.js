#!/usr/bin/env node

/**
 * Release — cut a version from the commits since the last version tag.
 *
 * Run by .github/workflows/release.yml on every push to master; nobody runs
 * it by hand. The kind of change decides the release, from the Conventional
 * Commit types the commit-msg hook already enforces:
 *
 *   breaking (`feat!:`, `fix(api)!:`, `BREAKING CHANGE:`)  → major
 *   feat                                                  → minor
 *   fix, perf                                             → patch
 *   anything else (docs, test, chore, ci, refactor, …)    → no release
 *
 * A release bumps package.json, writes the version's CHANGELOG.md section
 * (scripts/generate-changelog.js, which uses each commit's `Release-Note:`
 * line when it has one), regenerates the PWA version files, commits
 * `chore(release): vX.Y.Z` and tags `vX.Y.Z`. The workflow pushes both;
 * once Vercel has deployed the commit, the announcement cron turns the new
 * section into the release email.
 *
 * Without any version tag it releases nothing: "since the last release" has
 * no answer, and the whole history is not a release note.
 *
 * Usage:
 *   node scripts/release.js            cut the release (commit + tag, no push)
 *   node scripts/release.js --dry-run  print what it would release
 *
 * Writes `released`, `version` and `sha` to $GITHUB_OUTPUT when set.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const changelog = require('./generate-changelog')
const versionBump = require('./version-bump')

const ROOT = path.join(__dirname, '..')
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md')

/** The files a release changes, and commits. */
const RELEASE_FILES = [
  'package.json',
  'CHANGELOG.md',
  'public/manifest.json',
  'public/service-worker.js',
  'src/lib/pwa-version.ts',
]

/**
 * The release a set of changes makes.
 *
 * @param {{ breaking: unknown[], features: unknown[], fixes: unknown[], performance: unknown[] }} categories
 *   From `categorizeCommits`
 * @returns {'major' | 'minor' | 'patch' | null} `null` when nothing releasable changed
 */
function releaseTypeFor(categories) {
  if (categories.breaking.length > 0) return 'major'
  if (categories.features.length > 0) return 'minor'
  if (categories.fixes.length > 0 || categories.performance.length > 0) {
    return 'patch'
  }
  return null
}

/**
 * The release's date, `YYYY-MM-DD`, on the calendar in Sri Lanka, where every
 * gym reading the email is.
 *
 * @param {Date} now
 * @returns {string}
 */
function releaseDate(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function run(command) {
  return execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const lastTag = changelog.getLastVersionTag()
  if (!lastTag) {
    console.log(
      'No version tag yet, so there is no release boundary. Nothing released.'
    )
    output('released', 'false')
    return
  }

  const commits = (changelog.getCommitsSinceTag(lastTag) || []).filter(
    (commit) => !/^chore\(release\)/.test(commit.subject)
  )
  const categories = changelog.categorizeCommits(commits)
  const type = releaseTypeFor(categories)
  if (!type) {
    console.log(
      `${commits.length} commit(s) since ${lastTag}, none a feature, fix or ` +
        'breaking change. Nothing released.'
    )
    output('released', 'false')
    return
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
  )
  const version = versionBump.bumpVersion(pkg.version, type)
  const tag = `v${version}`
  if (run(`git tag --list ${tag}`)) {
    throw new Error(`${tag} already exists; refusing to release it twice`)
  }

  const section = changelog.generateChangelogSection(
    version,
    releaseDate(new Date()),
    categories
  )
  console.log(
    `${type} release: ${pkg.version} → ${version} (${commits.length} commits since ${lastTag})\n`
  )
  console.log(section)

  if (dryRun) {
    output('released', 'false')
    return
  }

  versionBump.updatePackageJson(version)
  fs.writeFileSync(
    CHANGELOG_PATH,
    changelog.insertIntoChangelog(changelog.readExistingChangelog(), section)
  )
  execSync('node scripts/generate-pwa-assets.js', {
    cwd: ROOT,
    stdio: 'inherit',
  })

  run(`git add ${RELEASE_FILES.join(' ')}`)
  run(
    `git commit -m "chore(release): ${tag}" -m "Cut automatically from the commits since ${lastTag}."`
  )
  run(`git tag -a ${tag} -m "Release ${version}"`)

  output('released', 'true')
  output('version', version)
  output('sha', run('git rev-parse HEAD'))
  console.log(`\nCommitted and tagged ${tag}.`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Release failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = { releaseTypeFor, releaseDate }
