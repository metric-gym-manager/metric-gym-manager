# Release and policy emails: inverted check

A falsifying check of the whole announcement system (2026-10-06, after release 1.1.0 shipped and the Actions secrets were set). The aim was to prove each part broken, not to confirm it works:

- the cron and its pipeline;
- the email designs;
- the release workflow and its scripts;
- the git hooks;
- the policy registry;
- the docs.

Every finding was reproduced or probed before it was fixed. Every fix was written test first, then mutated back to the defect to show the test catches it. The design is in `marketing-email.md`, "Announcements".

## The secrets

Both were verified **from GitHub Actions itself**, on a throwaway branch with a one-off workflow (run 37466773953, branch deleted afterwards):

- **`RESEND_API_KEY`:** `publish-email-templates.ts --check` read both published designs and reported "up to date".
- **`CRON_SECRET`:** production answered **200**, while a wrong bearer got **401**. The answer named release `1.1.0` and the privacy notice as already announced, which matches the scheduled state.

## Findings

| #   | Verdict    | Finding                                                                                                                                                                                                                                                         | Evidence                                                                                                                                                                               | Fix                                                                                                                                                                                                                          |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | HOLE       | A GitHub squash merge **silently dropped the squashed feature** whenever an inner commit said `Release-Note: none`. Only the first note in a body was read, so a squash with several notes kept one, and an inner `none` placed first hid a real note after it. | The repo's `squash_merge_commit_message` is `COMMIT_MESSAGES`. Reproduced with the real generator: a `feat … (#96)` whose only note was an inner fix's `none` came out `hidden: true`. | Every real note becomes a line. `none` hides a commit only when it is that commit's own word, never in a squash (`(#N)` subject). Pinned in `releaseChangelog.test.ts`.                                                      |
| A2  | HOLE       | A `Release-Note:` wrapped onto the next line was **cut mid-sentence**.                                                                                                                                                                                          | Reproduced: "…pay part of a fee / and settle the rest later." came out as "…pay part of a fee".                                                                                        | Indented continuation lines, as git trailers continue, are joined.                                                                                                                                                           |
| A3  | HOLE       | **Night-time sends.** The real send was the trigger time plus 24 hours, so a release merged at 23:30 Sri Lanka time reached every gym owner at 23:30 the next night.                                                                                            | By construction: the workflow triggers minutes after a deploy.                                                                                                                         | `nextSendTime`: at least 24 hours, and within 09:00–19:00 Sri Lanka time, otherwise 09:30 the next morning. The preview banner states the moved time.                                                                        |
| A4  | HOLE       | **The veto could vanish silently.** Every preview is a broadcast carrying Gmail's one-click unsubscribe. One tap sets Resend's account-wide flag on the only Test-segment contact, and from then on previews reach nobody while real sends continue.            | The Test segment holds one contact. The header and the flag's effect were measured on 2026-10-06 (`marketing-email.md`).                                                               | Before a preview, the Test segment must have at least one contact that has not unsubscribed. Otherwise the run sends nothing to the gyms and reports `preview_failed`. Live read: 1 reachable.                               |
| A5  | HOLE       | **A policy page's wording could change with no notice and no failing test.**                                                                                                                                                                                    | Probe: "We may suspend any account at any time without notice." was added to the Terms with no date change, and all 136 related tests passed.                                          | Each legal page's document text is fingerprinted under `path@lastModified` (`LEGAL_TEXT_FINGERPRINTS`). Changed wording fails `legal-text-fingerprints.test.tsx` with instructions. The same probe now fails.                |
| A6  | HOLE       | **The trigger trusted a bare HTTP 200.** The cron answers 200 even when an email failed to render, preview or send, so the run went green. Just after a deploy, the previous deployment could answer instead, announcing nothing, also green.                   | The route returns 200 with `*_failed` outcomes (its own test). Vercel posts the deployment's success at the end of the build.                                                          | `scripts/trigger-announcements.js` reads the answer. An answer from an older version (the release entry names the version that ran) or a 5xx is asked again every 20 s, for up to 3 minutes; any failed email fails the run. |
| A7  | HOLE (low) | **A push landing while a release was being cut turned the run red** (non-fast-forward).                                                                                                                                                                         | By construction.                                                                                                                                                                       | The run checks out the newest master, so pushes queued behind it are released together. If master still moves, the run warns, steps aside, and the queued run releases everything.                                           |

## Checked, and holding

- **Vercel promoting builds out of order.** The merge commit's build finished after the release commit's, and production kept 1.1.0: the live service worker reads `saas-app-v1.1.0`.
- **The workflow triggering itself.** The release commit pushed with `GITHUB_TOKEN` started 0 runs.
- **Bot protection.** GitHub's runners reached production unchallenged (the 200 and 401 above).
- **Release commits deploy.** Authored as the owner; Vercel deployed `39657a1`.
- **Script injection.** The workflow interpolates only commit SHAs and versions into shell; commit messages appear only in an `if:` expression.
- **Unfinished template edits are never sent.** `templates.get` returns the published version while an edit is unsaved (measured).
- **A cancel is recorded.** A cancelled broadcast reads back as `draft` and is logged `canceled` (measured).
- **Email assets and links.** The logo returns 200 `image/png`, `/privacy` returns 200, and `/dashboard` sends a logged-out reader to the login page.
- **Resend limits.** 10 requests a second. Broadcasts are uncapped and do not count against the 100-a-day email limit: the counter read 0 after today's previews were delivered. Contacts are 9 of 1,000.

## Known and accepted

- **Every release moves the PWA version,** so installed apps show "Refresh now" after each release, including internal-only patches.
- **A breaking marker (`!`) makes a major release.** That changes `APP_MAJOR_VERSION`, which namespaces client storage, and sends a "Major update" email. Use it only for a real break.
- **With merge commits instead of squash,** each branch commit is its own line. A feature and its follow-up fix both appear unless the fix says `Release-Note: none`.
- **A cancelled announcement's changes never roll into the next digest.** That is deliberate; use `send-announcements.ts --apply --force <kind> <ref>` to send it again.
- **Segments are at the plan's cap (3 of 3).** A new audience needs an old one retired or a plan upgrade.
- **`.claude/rules/versioning.md` still describes manual releases.** It is the owner's file, so it is left untouched.
