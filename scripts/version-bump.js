#!/usr/bin/env node

/**
 * Version Bump Script
 *
 * Analyzes git commits since last version tag and determines appropriate
 * version bump based on Conventional Commits format.
 *
 * Usage:
 *   node scripts/version-bump.js [major|minor|patch]
 *   node scripts/version-bump.js auto  (analyzes commits)
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ============================================================================
// Configuration
// ============================================================================

const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json')
const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md')

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

function getCommitsSinceTag(tag) {
  if (!tag) {
    // No tags yet, get all commits
    return execCommand('git log --pretty=format:"%s"')
      .split('\n')
      .filter(Boolean)
  }

  return execCommand(`git log ${tag}..HEAD --pretty=format:"%s"`)
    .split('\n')
    .filter(Boolean)
}

function analyzeCommits(commits) {
  let hasMajor = false
  let hasMinor = false
  let hasPatch = false

  const features = []
  const fixes = []
  const breaking = []
  const others = []

  commits.forEach((commit) => {
    // Check for breaking changes
    if (
      commit.includes('BREAKING CHANGE') ||
      commit.match(/^\w+(\([^)]*\))?!:/)
    ) {
      hasMajor = true
      breaking.push(commit)
    }
    // Check for features
    else if (commit.match(/^feat(\(.+?\))?:/)) {
      hasMinor = true
      features.push(commit)
    }
    // Check for fixes
    else if (commit.match(/^fix(\(.+?\))?:/)) {
      hasPatch = true
      fixes.push(commit)
    }
    // Performance improvements count as patches
    else if (commit.match(/^perf(\(.+?\))?:/)) {
      hasPatch = true
      fixes.push(commit)
    } else {
      others.push(commit)
    }
  })

  // Determine bump type
  let bumpType = 'none'
  if (hasMajor) bumpType = 'major'
  else if (hasMinor) bumpType = 'minor'
  else if (hasPatch) bumpType = 'patch'

  return {
    bumpType,
    features,
    fixes,
    breaking,
    others,
    totalCommits: commits.length,
  }
}

function bumpVersion(currentVersion, bumpType) {
  const [major, minor, patch] = currentVersion.split('.').map(Number)

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid bump type: ${bumpType}`)
  }
}

function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  packageJson.version = newVersion
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n'
  )
}

function createGitTag(version) {
  const tag = `v${version}`
  const date = new Date().toISOString().split('T')[0]

  try {
    execSync(`git tag -a ${tag} -m "Release ${version} (${date})"`)
    return tag
  } catch (error) {
    console.error(`Failed to create git tag: ${error.message}`)
    return null
  }
}

function regeneratePWAAssets() {
  try {
    console.log('\n📦 Regenerating PWA assets...')
    execSync('npm run pwa:generate', { stdio: 'inherit' })
    return true
  } catch (error) {
    console.error(`Failed to regenerate PWA assets: ${error.message}`)
    return false
  }
}

// ============================================================================
// Main Function
// ============================================================================

function main() {
  const args = process.argv.slice(2)
  const bumpArg = args[0] || 'auto'

  console.log('🔍 Analyzing repository...\n')

  // Get current version
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  const currentVersion = packageJson.version
  console.log(`Current version: ${currentVersion}`)

  // Get last tag
  const lastTag = getLastVersionTag()
  console.log(`Last version tag: ${lastTag || 'none'}`)

  // Get commits since last tag
  const commits = getCommitsSinceTag(lastTag)

  if (commits.length === 0) {
    console.log('\n⚠️  No commits since last version.')
    console.log('Make some commits before bumping version.')
    process.exit(0)
  }

  console.log(`Commits since ${lastTag || 'start'}: ${commits.length}\n`)

  // Analyze commits
  const analysis = analyzeCommits(commits)

  console.log('📊 Commit Analysis:')
  console.log(`  Breaking changes: ${analysis.breaking.length}`)
  console.log(`  Features: ${analysis.features.length}`)
  console.log(`  Fixes: ${analysis.fixes.length}`)
  console.log(`  Other: ${analysis.others.length}`)

  // Determine bump type
  let bumpType
  if (bumpArg === 'auto') {
    bumpType = analysis.bumpType
    if (bumpType === 'none') {
      console.log('\n⚠️  No version-bumping commits found (feat/fix/breaking).')
      console.log('Commits analyzed:')
      commits.slice(0, 5).forEach((c) => console.log(`  - ${c}`))
      if (commits.length > 5)
        console.log(`  ... and ${commits.length - 5} more`)
      console.log(
        '\nUse: node scripts/version-bump.js [major|minor|patch] to force a bump'
      )
      process.exit(0)
    }
  } else if (['major', 'minor', 'patch'].includes(bumpArg)) {
    bumpType = bumpArg
    console.log(`\n⚠️  Manual bump type specified: ${bumpType}`)
  } else {
    console.error(`\n❌ Invalid argument: ${bumpArg}`)
    console.error(
      'Usage: node scripts/version-bump.js [auto|major|minor|patch]'
    )
    process.exit(1)
  }

  // Calculate new version
  const newVersion = bumpVersion(currentVersion, bumpType)

  console.log(
    `\n🎯 Version Bump: ${currentVersion} → ${newVersion} (${bumpType})`
  )

  // Confirm
  if (process.env.CI !== 'true' && !process.env.SKIP_CONFIRM) {
    console.log('\n⚠️  This will:')
    console.log(`  1. Update package.json: ${currentVersion} → ${newVersion}`)
    console.log(`  2. Regenerate PWA assets with new version`)
    console.log(`  3. Create git tag: v${newVersion}`)
    console.log('\nRun with SKIP_CONFIRM=true to skip this prompt')
    console.log('Or use the Version Manager GUI for a better experience')
    process.exit(0)
  }

  // Perform version bump
  console.log('\n📝 Updating package.json...')
  updatePackageJson(newVersion)
  console.log(`✅ Updated to ${newVersion}`)

  // Regenerate PWA assets
  const pwaSuccess = regeneratePWAAssets()
  if (!pwaSuccess) {
    console.warn('⚠️  PWA assets regeneration failed (non-fatal)')
  }

  // Create git tag
  console.log('\n🏷️  Creating git tag...')
  const tag = createGitTag(newVersion)
  if (tag) {
    console.log(`✅ Created tag: ${tag}`)
  }

  // Summary
  console.log('\n✨ Version bump complete!\n')
  console.log('Next steps:')
  console.log('  1. Update CHANGELOG.md (or use: npm run changelog:generate)')
  console.log('  2. Commit changes: git add package.json CHANGELOG.md')
  console.log(`  3. Push with tag: git push origin main --tags`)
  console.log('\n💡 Or use the Version Manager GUI to handle all of this!')

  // Output for programmatic use
  if (process.env.OUTPUT_JSON) {
    console.log('\n--- JSON OUTPUT ---')
    console.log(
      JSON.stringify(
        {
          oldVersion: currentVersion,
          newVersion,
          bumpType,
          tag: `v${newVersion}`,
          analysis,
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
    process.exit(1)
  }
}

module.exports = {
  getLastVersionTag,
  getCommitsSinceTag,
  analyzeCommits,
  bumpVersion,
  updatePackageJson,
  createGitTag,
  regeneratePWAAssets,
}
