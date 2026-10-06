# Version Management & Release Process

Semantic Versioning, bumped from Conventional Commits. The `commit-msg` hook rejects non-conforming messages. **Releases are automatic:** `.github/workflows/release.yml` cuts one on every push to master.

## Committing

- Format: `<type>[scope]: <description>` — types `feat`, `fix`, `feat!`/`fix!` (breaking, or a `BREAKING CHANGE:` footer), `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
- Scopes (optional, recommended): `members`, `payments`, `auth`, `dashboard`, `api`, `db`, `pwa` — or the feature folder name.
- Complex changes get a body of `-` bullets saying what changed and why.
- **Every `feat`, `fix` and `perf` commit carries a `Release-Note:` line.** The text is what gym owners read in the release email, word for word: one plain sentence about what changed for them, no jargon (`Release-Note: Members can now pay part of a fee and settle the rest later.`). Write `Release-Note: none` for a change gyms will not notice. With no line, the commit subject is shown instead, which reads as developer jargon. The `commit-msg` hook suggests a note but never blocks.
- Use `!` / `BREAKING CHANGE:` only for a real break: it makes a major release, which resets client storage (`APP_MAJOR_VERSION`) and emails a "Major update".
- After committing, report the commit message. **Do not** mention versioning or the changelog.

## Releases — automatic

On every push to master the Release workflow does all of this:

1. It reads the commit types since the last tag: breaking → major, `feat` → minor, `fix`/`perf` → patch, anything else → no release.
2. It bumps `package.json`, writes the CHANGELOG.md section from the Release-Note lines, regenerates the PWA version, commits `chore(release): vX.Y.Z` and tags it.
3. It waits for production, then triggers the release email: a preview to the owner at once, and the gyms 24 hours later, within 09:00–19:00 Sri Lanka time.

Design: `docs/architecture/marketing-email.md`, "Announcements".

**CRITICAL:** Claude NEVER, unless the user explicitly asks:

- bumps the version in `package.json`
- edits `CHANGELOG.md` release sections
- creates or moves git tags
- runs the version scripts (`version:gui`, `version:bump`, `changelog:generate`, `scripts/release.js`)

The workflow owns all of these. The Version Manager GUI (`npm run version:gui`) remains for the user's own deliberate manual release; the workflow then finds nothing new since that tag. The old `post-merge` changelog hook is retired.
