# Version Management & Release Process

## Overview
This project uses **Semantic Versioning** (SemVer) with **Conventional Commits** for automated changelog generation and version bumping.

## Semantic Versioning (SemVer)

Format: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

- **MAJOR** (1.x.x): Breaking changes (incompatible API changes)
- **MINOR** (x.1.x): New features (backward-compatible)
- **PATCH** (x.x.1): Bug fixes (backward-compatible)

Examples:
- `1.0.0 → 1.0.1`: Bug fix (patch)
- `1.0.0 → 1.1.0`: New feature (minor)
- `1.0.0 → 2.0.0`: Breaking change (major)

## Conventional Commits

All commit messages MUST follow this format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Version Bump | Example |
|------|-------------|--------------|---------|
| `feat` | New feature | MINOR | `feat: add member export to CSV` |
| `fix` | Bug fix | PATCH | `fix: resolve payment calculation error` |
| `feat!` | Breaking change | MAJOR | `feat!: redesign authentication API` |
| `fix!` | Breaking fix | MAJOR | `fix!: change subscription status enum` |
| `docs` | Documentation | None | `docs: update API documentation` |
| `style` | Code style (formatting) | None | `style: format with prettier` |
| `refactor` | Code refactoring | None | `refactor: simplify member service` |
| `perf` | Performance improvement | PATCH | `perf: optimize database queries` |
| `test` | Add/update tests | None | `test: add member service tests` |
| `chore` | Maintenance tasks | None | `chore: update dependencies` |
| `ci` | CI/CD changes | None | `ci: add GitHub Actions workflow` |

### Breaking Changes

Indicate breaking changes with `!` after type or `BREAKING CHANGE:` in footer:

```bash
# Method 1: ! suffix
feat!: rename getMember to fetchMember

# Method 2: Footer
feat: update authentication flow

BREAKING CHANGE: Session cookies now require secure flag
```

### Commit Message Examples

**Good:**
```bash
feat(members): add bulk import with CSV validation
fix(payments): correct installment calculation for annual plans
docs(readme): add deployment instructions
refactor(auth): simplify JWT token verification
perf(dashboard): lazy load chart components
test(members): add edge cases for subscription expiry
```

**Bad:**
```bash
❌ update stuff
❌ fix bug
❌ WIP
❌ changes
❌ asdf
```

## Workflow for Developers

### 1. During Development

Make commits using conventional format:

```bash
# Feature commit
git add src/features/export
git commit -m "feat(members): add member export to CSV"

# Bug fix commit
git add src/services/payment.ts
git commit -m "fix(payments): resolve rounding error in installments"

# Multiple commits
git commit -m "feat(dashboard): add revenue chart"
git commit -m "test(dashboard): add revenue chart tests"
git commit -m "docs(dashboard): document chart API"
```

**Pre-commit hook will validate** your commit message format automatically.

### 2. Ready to Release

When you have a batch of commits ready to release:

1. **Push to main:**
   ```bash
   git push origin main
   ```

2. **Open Version Manager GUI:**
   ```bash
   npm run version:gui
   ```

3. **In the GUI:**
   - Review commits since last version
   - See suggested version bump (auto-calculated)
   - Edit/enhance release notes if needed
   - Click "Release" to:
     - Bump version in package.json
     - Update CHANGELOG.md
     - Regenerate PWA assets
     - Create git tag
     - (Optional) Push tag

### 3. Post-Merge

**Post-merge hook automatically:**
- Generates draft release notes from new commits
- Stores them for GUI editing
- Does NOT auto-bump version (manual trigger only)

## Workflow for Claude Code

When the user asks you to commit changes:

### Step 1: Analyze Changes

Determine the commit type based on what changed:
- New functionality → `feat`
- Bug fix → `fix`
- Breaking change → `feat!` or `fix!`
- Documentation → `docs`
- Tests only → `test`
- Refactoring → `refactor`

### Step 2: Write Conventional Commit

Use this format:
```bash
git commit -m "<type>[scope]: <clear description>"
```

**Scope (optional but recommended):**
- `members` - Member management features
- `payments` - Payment processing
- `auth` - Authentication/authorization
- `dashboard` - Dashboard/analytics
- `api` - API routes
- `db` - Database/migrations
- `pwa` - PWA functionality

### Step 3: Include Context in Commit Body

For complex changes, add a body:
```bash
git commit -m "feat(members): add bulk member import

- Support CSV upload with validation
- Preview import before applying
- Rollback on any errors
- Limit: 1000 members per batch"
```

### Step 4: Never Auto-Bump Version

**CRITICAL:** You (Claude) should NEVER automatically:
- Bump version in package.json
- Update CHANGELOG.md
- Create git tags
- Run version-related scripts

**ONLY the user triggers releases via the GUI.**

### Example: User Asks You to Commit

**User:** "Commit the member export feature"

**Your Actions:**
1. Review what was changed
2. Write appropriate commit message:
   ```bash
   git add src/features/members/export
   git commit -m "feat(members): add CSV export functionality

   - Export active, expired, and cancelled members
   - Filter by subscription status
   - Include payment history option
   - Generate downloadable CSV file"
   ```
3. Tell user: "Committed with message: `feat(members): add CSV export functionality`"
4. **DO NOT** mention versioning or changelog

## Version Bump Logic

The `scripts/version-bump.js` script determines version bumps:

```javascript
// Scan commits since last version tag
const commits = getCommitsSinceLastTag();

// Determine bump type
let bump = 'patch'; // default

commits.forEach(commit => {
  if (commit.includes('BREAKING CHANGE') || commit.match(/^(feat|fix)!/)) {
    bump = 'major'; // Breaking change → major
  } else if (commit.startsWith('feat:') && bump !== 'major') {
    bump = 'minor'; // New feature → minor
  } else if (commit.startsWith('fix:') && bump === 'patch') {
    bump = 'patch'; // Bug fix → patch
  }
});

// Apply bump
1.2.3 + patch  → 1.2.4
1.2.3 + minor  → 1.3.0
1.2.3 + major  → 2.0.0
```

## Changelog Format

Auto-generated changelog follows Keep a Changelog format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Member bulk import with CSV validation
- Export members to CSV

### Fixed
- Payment calculation rounding error
- Timezone handling in check-ins

### Changed
- Updated member list pagination (500 → 1000 per page)

## [1.2.0] - 2024-03-02

### Added
- Revenue dashboard with charts
- SMS reminder scheduling

### Fixed
- Login session timeout issue

## [1.1.0] - 2024-02-28
...
```

## Release Checklist

Before releasing a new version:

- [ ] All commits follow Conventional Commits format
- [ ] Tests passing (`npm test`)
- [ ] Type check passing (`npm run type-check`)
- [ ] Reviewed commits in Version Manager GUI
- [ ] Enhanced release notes with user-facing details
- [ ] Chose appropriate version bump (major/minor/patch)
- [ ] Clicked "Release" in GUI
- [ ] Verified version updated in package.json
- [ ] Verified CHANGELOG.md updated
- [ ] Verified PWA assets regenerated
- [ ] Git tag created
- [ ] (Optional) Pushed tag to remote

## Git Tags

Tags are created automatically on release:

```bash
# Format: v<version>
v1.0.0
v1.1.0
v1.2.0

# View tags
git tag

# View specific version commits
git log v1.1.0..v1.2.0
```

## Integration with PWA

When version is bumped:
1. `scripts/version-bump.js` updates `package.json`
2. `scripts/generate-pwa-assets.js` runs automatically
3. PWA icons get new version query param
4. Service worker cache name updates
5. Users see update banner on next deployment

## Troubleshooting

### Commit Rejected (Pre-commit Hook)

**Error:** "Commit message doesn't follow Conventional Commits format"

**Solution:** Fix your commit message:
```bash
# Bad
git commit -m "added feature"

# Good
git commit -m "feat: add feature description"
```

### Version GUI Won't Start

**Error:** Port 3001 already in use

**Solution:**
```bash
# Find and kill process on port 3001
npx kill-port 3001

# Or specify different port
PORT=3002 npm run version:gui
```

### Changelog Not Generated

**Cause:** No commits since last version tag

**Solution:** Make at least one commit before releasing

### Wrong Version Bump Suggested

**Cause:** Commits may not follow format correctly

**Solution:**
1. Check commits in GUI
2. Manually select correct bump type
3. Fix commit messages for future releases

## References

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
