# Version Management & Release Process

Semantic Versioning, bumped from Conventional Commits. The `commit-msg` hook rejects non-conforming messages; the bump logic lives in `scripts/version-bump.js`.

## Committing

- Format: `<type>[scope]: <description>` — types `feat`, `fix`, `feat!`/`fix!` (breaking, or a `BREAKING CHANGE:` footer), `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
- Scopes (optional, recommended): `members`, `payments`, `auth`, `dashboard`, `api`, `db`, `pwa` — or the feature folder name.
- Complex changes get a body of `-` bullets saying what changed and why.
- After committing, report the commit message. **Do not** mention versioning or the changelog.

## Releases — user only

**CRITICAL:** Claude NEVER, unprompted or as part of another task:

- bumps the version in `package.json`
- updates `CHANGELOG.md`
- creates git tags
- runs version-related scripts (`version:gui`, `version:bump`, `changelog:generate`)

Releases are triggered ONLY by the user through the Version Manager GUI (`npm run version:gui`), which bumps the version, writes the changelog, regenerates PWA assets and tags the release. The `post-merge` hook drafts release notes but never bumps.
