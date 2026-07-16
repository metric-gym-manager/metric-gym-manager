# Auto-Versioning System Guide

## Overview

Complete automated versioning system with:
- ✅ **Conventional Commits** format enforcement
- ✅ **Automatic changelog generation** from git commits
- ✅ **Semantic Versioning** (major/minor/patch)
- ✅ **Version Manager GUI** for managing releases
- ✅ **Git hooks** for validation and automation
- ✅ **PWA integration** (auto-regenerates assets on version bump)

---

## Quick Start

### 1. Install Git Hooks (One-Time Setup)

```bash
npm run hooks:install
```

This installs:
- `commit-msg` hook - Validates commit message format
- `post-merge` hook - Auto-generates draft changelog

### 2. Make Commits Using Conventional Format

```bash
# Feature
git commit -m "feat(members): add CSV export functionality"

# Bug fix
git commit -m "fix(payments): resolve rounding error in calculations"

# Breaking change
git commit -m "feat!: redesign authentication API"
```

### 3. Launch Version Manager GUI

```bash
npm run version:gui
```

Opens at: **http://localhost:3001**

### 4. Create Release

In the GUI:
1. Review commits since last version
2. See suggested version bump (auto-calculated)
3. Edit release notes if needed
4. Click "Release New Version"

Done! Version bumped, changelog updated, PWA assets regenerated.

---

## Commit Message Format

### Pattern

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Valid Types

| Type | Description | Version Bump | Example |
|------|-------------|--------------|---------|
| `feat` | New feature | **MINOR** | `feat: add member export` |
| `fix` | Bug fix | **PATCH** | `fix: resolve payment error` |
| `feat!` | Breaking change | **MAJOR** | `feat!: redesign auth API` |
| `fix!` | Breaking fix | **MAJOR** | `fix!: change status enum` |
| `docs` | Documentation | None | `docs: update README` |
| `style` | Formatting | None | `style: format with prettier` |
| `refactor` | Code refactoring | None | `refactor: simplify service` |
| `perf` | Performance | **PATCH** | `perf: optimize queries` |
| `test` | Tests | None | `test: add member tests` |
| `chore` | Maintenance | None | `chore: update dependencies` |
| `ci` | CI/CD | None | `ci: add GitHub Actions` |

### Scopes (Optional but Recommended)

Common scopes for this project:
- `members` - Member management
- `payments` - Payment processing
- `auth` - Authentication/authorization
- `dashboard` - Dashboard/analytics
- `api` - API routes
- `db` - Database/migrations
- `pwa` - PWA functionality

### Examples

**Good:**
```bash
feat(members): add bulk import with CSV validation
fix(payments): correct installment calculation
docs(readme): add deployment instructions
perf(dashboard): lazy load chart components
```

**Bad:**
```bash
❌ update stuff
❌ fix bug
❌ WIP
❌ changes
```

### Pre-Commit Hook Validation

The `commit-msg` hook validates format:

```bash
$ git commit -m "update code"

❌ Commit message does not follow Conventional Commits format

Your commit message:
  update code

Expected format:
  <type>[optional scope]: <description>

Examples:
  feat(members): add CSV export functionality
  fix(payments): resolve rounding error
```

**Bypass (not recommended):**
```bash
git commit --no-verify -m "bypass validation"
```

---

## Version Manager GUI

### Launch

```bash
npm run version:gui
```

Opens at: **http://localhost:3001**

### Features

#### 1. **Current Status**
- Current version
- Last git tag
- Active branch
- Uncommitted files warning
- Commits since last release
- **Suggested version bump** (auto-calculated)

#### 2. **Commits Since Last Release**
Shows all commits grouped by type:
- ⚠️ Breaking changes
- ✨ Features
- 🐛 Fixes
- 📦 Other

#### 3. **Create Release**
- Select version bump (major/minor/patch)
- Preview new version number
- **Auto-generated changelog** (editable!)
- Option to create git tag
- One-click release

#### 4. **Version History**
- All past releases
- Release dates
- Release notes

#### 5. **Changelog Preview**
- View current CHANGELOG.md
- See how it will look after release

### Workflow in GUI

1. **Review Status**
   - Check suggested bump type
   - Verify uncommitted files (should be 0)

2. **Review Commits**
   - See what's changed since last version
   - Verify commit message quality

3. **Select Bump Type**
   - Major (breaking changes)
   - Minor (new features)
   - Patch (bug fixes)
   - Preview shows: `1.0.0 → 1.1.0`

4. **Edit Changelog**
   - Auto-generated from commits
   - Add user-facing details
   - Enhance descriptions
   - Add migration notes if needed

5. **Release**
   - Click "Release New Version"
   - System automatically:
     - Updates `package.json`
     - Updates `CHANGELOG.md`
     - Regenerates PWA assets
     - Creates git tag (if checked)

6. **Commit & Push**
   ```bash
   git add package.json CHANGELOG.md public/
   git commit -m "chore: release 1.1.0"
   git push origin main --tags
   ```

---

## Command Line Scripts

### Version Bump (Manual)

```bash
# Analyze commits and suggest bump
npm run version:bump auto

# Force specific bump
npm run version:bump major
npm run version:bump minor
npm run version:bump patch
```

**Example Output:**
```
🔍 Analyzing repository...

Current version: 1.0.0
Last version tag: v1.0.0
Commits since v1.0.0: 15

📊 Commit Analysis:
  Breaking changes: 0
  Features: 3
  Fixes: 5
  Other: 7

🎯 Version Bump: 1.0.0 → 1.1.0 (minor)
```

### Changelog Generation

```bash
# Generate changelog for unreleased commits
npm run changelog:generate --unreleased

# Generate for current version
npm run changelog:generate
```

### Git Hooks

```bash
# Install/reinstall hooks
npm run hooks:install
```

Hooks are also installed automatically on `npm install` via `postinstall` script.

---

## Git Hooks

### commit-msg Hook

**Runs on:** `git commit`

**Purpose:** Validates commit message format

**What it checks:**
- Matches Conventional Commits pattern
- Type is valid (feat/fix/docs/etc.)
- Description is at least 10 characters
- Format: `type(scope): description`

**Example Rejection:**
```bash
$ git commit -m "fix bug"

❌ Commit message does not follow Conventional Commits format
⚠️  Commit description is too short (7 characters)
```

**Example Success:**
```bash
$ git commit -m "fix(payments): resolve rounding error in installment calculations"

✅ Commit message validated
```

### post-merge Hook

**Runs on:** `git merge` or `git pull`

**Purpose:** Auto-generates draft changelog after merging to main

**What it does:**
1. Checks if on `main` or `master` branch
2. Gets commits since last version tag
3. Generates "Unreleased" section in CHANGELOG.md
4. Does NOT auto-bump version (manual trigger only)

**Example Output:**
```bash
$ git pull origin main

📝 Post-merge: Generating draft changelog...

✅ Draft changelog generated in 'Unreleased' section

💡 Next steps:
   1. Review CHANGELOG.md
   2. When ready to release, run: npm run version:gui
```

---

## Workflow Examples

### Daily Development

```bash
# Make changes
vim src/features/members/export.ts

# Commit with conventional format
git commit -m "feat(members): add CSV export with validation"

# Push (hook validates commit message)
git push origin feature/member-export
```

### Weekly Release

```bash
# 1. Merge all feature branches to main
git checkout main
git pull origin main

# 2. Post-merge hook auto-generates draft changelog
# (Check CHANGELOG.md "Unreleased" section)

# 3. Open Version Manager GUI
npm run version:gui

# 4. In GUI:
#    - Review 15 commits since v1.2.0
#    - Suggested bump: minor (new features added)
#    - Edit changelog to add user-facing notes
#    - Click "Release New Version"
#    - Result: v1.2.0 → v1.3.0

# 5. Commit and push
git add package.json CHANGELOG.md public/
git commit -m "chore: release 1.3.0"
git push origin main --tags

# 6. Done! Users will see update banner with new icons
```

### Hotfix Release

```bash
# 1. Fix critical bug
git commit -m "fix(payments): prevent duplicate charges"

# 2. Use GUI for quick patch release
npm run version:gui
# Select: patch bump → 1.3.0 → 1.3.1

# 3. Push immediately
git push origin main --tags
```

### Breaking Change Release

```bash
# 1. Make breaking change
git commit -m "feat!: redesign authentication flow

BREAKING CHANGE: Session cookies now require secure flag.
Update your authentication middleware to use secure cookies."

# 2. Use GUI
npm run version:gui
# Suggested bump: major (breaking change detected)
# Version: 1.3.1 → 2.0.0

# 3. Add migration guide to changelog
# (Edit in GUI textarea)

# 4. Release and notify users
git push origin main --tags
```

---

## Integration with PWA

### Automatic PWA Asset Regeneration

When you bump the version:
1. `package.json` version updates
2. `npm run pwa:generate` runs automatically
3. PWA icons get new version query params:
   - `/icon-192.png?v=1.1.0`
   - `/icon-512.png?v=1.1.0`
4. Service worker cache name updates:
   - `saas-app-v1.1.0`
5. Users see update banner on next visit

### User Experience

```
Developer releases v1.1.0
    ↓
Deployment to production
    ↓
User visits app
    ↓
Service worker detects new version
    ↓
[Banner] "New version available! [Refresh Now] [Later]"
    ↓
User clicks "Later"
    ↓
Continues working (no interruption)
    ↓
Next visit: Silent auto-reload to v1.1.0
```

No reinstall required! See `docs/pwa-update-workflow.md` for details.

---

## Changelog Format

Generated changelog follows [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [Unreleased]

### Added
- **members**: CSV export with validation
- **dashboard**: Revenue chart with filters

### Fixed
- **payments**: Rounding error in installments
- **auth**: Session timeout issue

## [1.1.0] - 2024-03-02

### Added
- **members**: Bulk import functionality
- **sms**: Reminder scheduling

### Fixed
- **dashboard**: Chart loading performance

## [1.0.0] - 2024-02-28

Initial release
```

### Sections

- **⚠️ BREAKING CHANGES** - API/behavior changes requiring user action
- **Added** - New features
- **Fixed** - Bug fixes
- **Performance** - Performance improvements
- **Changed** - Modifications to existing features (optional)
- **Removed** - Removed features (optional)

---

## Troubleshooting

### Commit Rejected by Hook

**Problem:**
```
❌ Commit message does not follow Conventional Commits format
```

**Solution:**
Use correct format:
```bash
git commit -m "feat: add feature description"
```

Not:
```bash
git commit -m "added feature"
```

### Version GUI Won't Start

**Problem:**
```
Error: Port 3001 already in use
```

**Solution:**
```bash
# Kill process on port 3001
npx kill-port 3001

# Or use different port
PORT=3002 npm run version:gui
```

### Changelog Not Generated

**Problem:**
Post-merge hook doesn't generate changelog

**Solution:**
1. Check if on `main`/`master` branch
2. Verify commits exist since last tag
3. Manually run:
   ```bash
   npm run changelog:generate --unreleased
   ```

### Wrong Version Bump Suggested

**Problem:**
GUI suggests patch but you added features

**Solution:**
- Check commit messages follow Conventional Commits
- `feat:` commits → minor bump
- `fix:` commits → patch bump
- `feat!` or `BREAKING CHANGE:` → major bump
- Manually select correct bump type in GUI

### Git Hooks Not Working

**Problem:**
Commits succeed with invalid messages

**Solution:**
```bash
# Reinstall hooks
npm run hooks:install

# Verify hooks installed
ls -la .git/hooks/

# Should see:
# commit-msg
# post-merge
```

### PWA Assets Not Regenerated

**Problem:**
Version bumped but icons unchanged

**Solution:**
```bash
# Manually regenerate
npm run pwa:generate

# Check generated files
cat public/manifest.json | grep "v="
# Should show: "v=1.1.0"
```

---

## File Reference

### Created/Modified Files

**Scripts:**
- `scripts/version-bump.js` - Version bumping logic
- `scripts/generate-changelog.js` - Changelog generator
- `scripts/install-git-hooks.js` - Git hooks installer
- `scripts/versioning-gui/server.js` - GUI backend
- `scripts/versioning-gui/public/index.html` - GUI frontend
- `scripts/versioning-gui/public/style.css` - GUI styling
- `scripts/versioning-gui/public/app.js` - GUI JavaScript
- `scripts/hooks/commit-msg` - Commit message validator
- `scripts/hooks/post-merge` - Changelog auto-generator

**Documentation:**
- `.claude/rules/versioning.md` - Rules for Claude Code
- `docs/versioning-system-guide.md` - This file
- `CHANGELOG.md` - Auto-generated changelog

**Modified:**
- `package.json` - Added versioning scripts

### package.json Scripts

```json
{
  "scripts": {
    "version:gui": "node scripts/versioning-gui/server.js",
    "version:bump": "node scripts/version-bump.js",
    "changelog:generate": "node scripts/generate-changelog.js",
    "hooks:install": "node scripts/install-git-hooks.js",
    "postinstall": "npm run hooks:install"
  }
}
```

---

## Best Practices

### ✅ DO

- **Use meaningful commit messages**
  ```bash
  feat(members): add CSV export with column selection and validation
  ```

- **Break down large changes into multiple commits**
  ```bash
  feat(export): add CSV formatting logic
  feat(export): add column selection UI
  test(export): add CSV export tests
  docs(export): document CSV export API
  ```

- **Include scope for better changelog organization**
  ```bash
  fix(payments): resolve rounding error
  # Better than: fix: resolve error
  ```

- **Review generated changelog before releasing**
  - Add user-facing details
  - Include migration notes for breaking changes
  - Fix any unclear descriptions

- **Test releases on staging before production**

### ❌ DON'T

- **Don't use vague commit messages**
  ```bash
  ❌ fix bug
  ❌ update code
  ❌ WIP
  ❌ changes
  ```

- **Don't bypass commit hooks without good reason**
  ```bash
  git commit --no-verify  # Avoid this!
  ```

- **Don't manually edit package.json version**
  - Use GUI or `npm run version:bump`

- **Don't forget to push tags**
  ```bash
  # Wrong (tags not pushed):
  git push origin main

  # Right:
  git push origin main --tags
  ```

- **Don't create releases with uncommitted files**
  - GUI warns if files uncommitted
  - Commit all changes first

---

## FAQ

**Q: Do I need to bump version for every commit?**
A: No! Make multiple commits, then bump version when ready to release.

**Q: Can I edit the auto-generated changelog?**
A: Yes! Edit in GUI textarea before clicking "Release".

**Q: What if I forget to use Conventional Commits?**
A: Pre-commit hook rejects invalid commits. Fix message and retry.

**Q: Can I skip minor commits in changelog?**
A: Yes, but they're included by default. Types like `chore`, `style`, `refactor` are excluded.

**Q: How do I rollback a version bump?**
A:
```bash
git reset --hard HEAD~1  # Undo commit
git tag -d v1.1.0        # Delete tag
```

**Q: Can multiple people release simultaneously?**
A: No, coordinate releases. Last push wins, but may cause conflicts.

**Q: Does this work with GitHub/GitLab?**
A: Yes! Tags appear as releases. You can enhance with:
- GitHub: `gh release create v1.1.0 --notes-file CHANGELOG.md`
- GitLab: CI/CD pipeline triggers on tag push

---

## Summary

### What You Get

✅ **Enforced commit standards** via git hooks
✅ **Auto-generated changelogs** from commits
✅ **Simple version bumping** via GUI
✅ **Semantic Versioning** automatically calculated
✅ **PWA integration** (auto-regenerates assets)
✅ **Professional release notes** editable in GUI
✅ **Git tags** for version tracking
✅ **Zero manual version editing**

### Workflow Summary

```
Make commits → Push to main → Open GUI → Review → Release → Done!
     ↓              ↓            ↓         ↓        ↓        ↓
  (validated)  (changelog)  (analyze)  (edit)  (1-click)  (push)
```

### Next Steps

1. **Install hooks:** `npm run hooks:install`
2. **Start committing:** Use Conventional Commits format
3. **When ready to release:** `npm run version:gui`
4. **Click release:** System handles everything
5. **Push:** `git push origin main --tags`

That's it! 🎉

---

**Created:** 2024-03-02
**Version:** 1.0
**Status:** Production Ready ✅
