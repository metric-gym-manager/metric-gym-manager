# Mobile UI Rebuild — Working Record

> **Why this file exists.** The rebuild spans eleven phases and as many
> sessions. Rulings, measured baselines, findings that falsified something the
> plan or the audit asserted, and the reasons behind each deviation must not
> live only in a conversation or in a PR thread. This is the **living
> record**. The plan (`mobile-ui-rebuild-plan.md`, v1.5) is the contract and
> is stable; the audit is a snapshot; this file changes every phase.
>
> **What lives where.** Execution _status_ — phase state, gate ticks, decision
> approvals, open-decision answers, risk states, the activity log — lives in
> the tracker's database and is the authority for "where are we". This file
> is the git-tracked narrative: _why_ things were decided, what was measured,
> and what a later phase must not forget. Where the two disagree, the tracker
> is newer for status and this file is newer for reasoning.
>
> **Update this file at the end of every phase**, in the same PR as the phase.

## Document set

| Document                                   | Role                                                                                   | Stability       |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | --------------- |
| `mobile-ui-rebuild-audit.md`               | The measured phone baseline as of 2026-09-13 (390 px, E2E Enterprise gym, 46 members). | Snapshot        |
| `mobile-ui-rebuild-plan.md`                | **The contract** (v1.5). Scope, blueprints, gates, amendment protocol.                 | Amended per §31 |
| `mobile-ui-rebuild-prompts.md`             | The per-phase session prompts.                                                         | Fixed           |
| **`mobile-ui-rebuild-log.md`** (this file) | Rulings, baselines, execution log, findings, open items.                               | Living          |
| Tracker artifact (db-backed)               | Status: `phases`, `decisions`, `open`, `risks`, `log`. URL in the plan header.         | Live            |

Branches: one per phase, `claude/mobile-ui-rebuild-p<N>`, cut from `master`;
never commit to `master`.

---

## 1. Rulings taken

Numbered `M<n>` so they cannot be confused with the overhaul's `R<n>` rulings,
which still bind (R6 hands mobile to this effort; R7 governs selection).

| #      | Date       | Ruling                                                                                                                                                                                                                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1** | 2026-09-13 | **The probe's overflow rules are tier-aware.** Phone tier: only a `data-scroll="x"` container may hold or extend past the viewport. Desktop tier (≥ 768): any `overflow-x: auto\|scroll` container is sanctioned. A clip container (`hidden`/`clip`) with wider content is a violation on both tiers.                  | Plan §17 reads "no `main *` beyond the viewport except inside `data-scroll="x"`" with no tier qualifier, but §4 says tablet tables "scroll in their containers" and §5.20 sanctions horizontal scroll for tabular data. Read literally, §17 fails Members (767 px) and the cohort matrix (1,093 px) at 768 and 1024 with no phone involved. §4 is the more specific statement, so it wins. Logged as an EXCEPTION.   |
| **M2** | 2026-09-13 | **Known desktop probe violations are a shrinking allow-list, not a softened rule.** `KNOWN_DESKTOP_VIOLATIONS` in `mobile-probe.spec.ts` names each entry's clearing phase; a violation not on the list fails, and a listed entry that no longer occurs fails too.                                                     | The desktop was expected to probe clean and did not (F1). Phase 0 may not touch product code, and loosening the rule would hide a real defect. The same discipline as `UI1_ALLOW`–`UI5`: an entry that outlives its defect reads as sanctioned, so the ratchet fails on staleness. Exercised live once already — it flagged the cohort entry the moment M1 made it stale.                                            |
| **M3** | 2026-09-13 | **Phone-tier probe results are reported, not asserted, until a route is rebuilt.** `STRICT_PHONE_ROUTES` starts empty; each phase adds the routes it touched and the list never shrinks.                                                                                                                               | The audit measured every phone route failing. A suite that is red everywhere from day one teaches people to ignore red; the value in Phase 0 is the _numbers_ falling route by route, which the report gives and a failure would not.                                                                                                                                                                                |
| **M4** | 2026-09-13 | **§28 fixture values the product's validation rejects are test-only render constants**, not seeded. `TEST_ONLY_RENDER` carries 12,345,678 / 99,999,999, the 320-char SMS, the 20-char phone and the 128 / 1,024 tab badges; the seed carries the maxima the API accepts (1,000,000; a 160-char message with newlines). | `addMemberSchema` caps `planAmount`/`paymentAmount` at 1,000,000 and `createAnnouncementSchema` caps a message at 160. Seeding past those means bypassing validation — the door the fixtures exist to keep shut. The prompt's "through the app's own APIs" is the binding constraint; §28's numbers are examples of _shape_. Logged as an EXCEPTION.                                                                 |
| **M5** | 2026-09-13 | **768×1024 is emulated as an iPad, not a phone:** `hasTouch: true`, `isMobile: false`, desktop UA, DPR 2. The four phone projects are full phone emulation (`isMobile`, `hasTouch`, iPhone UA, DPR 2–3).                                                                                                               | iPadOS Safari reports a desktop UA and no client hints. The plan's tablet decision (d02) hands 768–1023 the desktop composition, and Phase 2's SSR hint reads `sec-ch-ua-mobile` — a 768 project sending `?1` would exercise the wrong branch and make the tablet tier look like a hydration flip. The emulation must match the device the decision is about.                                                        |
| **M6** | 2026-09-13 | **One sign-in per spec file per project, in the project's own viewport** (`helpers/tier-page.ts`).                                                                                                                                                                                                                     | Seven projects × a sign-in per test is ~110 sign-ins a run, past Supabase's per-IP token limit (`helpers/billing.ts` records two failed attempts at caching sessions). And `browser.newPage()` — the pattern the existing specs use in `beforeAll` — ignores the project's `use` block, so a "phone-390" run would silently measure a 1280×720 desktop. The helper rebuilds the context from `testInfo.project.use`. |
| **M7** | 2026-09-13 | **Page overflow is measured against the configured device width, not `innerWidth`.**                                                                                                                                                                                                                                   | F5: a mobile browser meeting content wider than the device zooms the layout viewport out, so `scrollWidth === innerWidth` held at 397/397 on the 390 project and the Renewals overflow passed. Comparing to `page.viewportSize().width` reports it as "zoomed out to fit".                                                                                                                                           |

---

## 2. Measured baselines

Captured so progress is measurable. Re-measure at the end of each phase; the
probe's attached JSON is the source (`npx playwright test mobile-probe
--project=phone-390`).

### 2.1 Phone probe at 390×844, E2E Enterprise gym **with the §28 fixtures** (351 members)

Columns: `beyond` = outermost elements past the viewport (descendants in
brackets); `overflow` = containers scrolling/clipping without `data-scroll="x"`;
`touch` = §15.1 violations / interactive elements; `ticks` = clipped / total.
Bottom nav is 754/390 on every route (the nine-item scroller, audit §D).

| Route                      | Page                 | beyond  | overflow | touch     | ticks  | Largest single defect                                             |
| -------------------------- | -------------------- | ------- | -------- | --------- | ------ | ----------------------------------------------------------------- |
| `/dashboard`               | 390                  | 1 (17)  | 1        | 1 / 14    | 4 / 7  | recent-payments table 442 px; y-ticks "400000…1600000" clipped    |
| `/members`                 | 390                  | 1 (168) | 1        | 11 / 40   | —      | members table 767 px; 32 px inputs, buttons, pagination           |
| `/payment-collection`      | **397 (zoomed out)** | 2 (936) | 1        | 239 / 249 | —      | tab strip 397 px with 3-digit counts; table 674 px; 26 px actions |
| `/revenue`                 | 390                  | 1 (47)  | 1        | 3 / 12    | 4 / 7  | breakdown table 577 px; y-ticks clipped; 32 px selects            |
| `/member-analytics`        | 390                  | 1 (393) | 1        | 11 / 20   | 1 / 27 | cohort table 1,093 px; 26 px segmented controls                   |
| `/make-announcement`       | 390                  | 1 (13)  | 1        | 3 / 13    | —      | delivery-log table 347 px; 32 px select + Send                    |
| `/billing-setup`           | 390                  | 0       | 0        | 1 / 13    | —      | 32 px log-out button only                                         |
| `/settings`                | 390                  | 0       | 0        | 1 / 16    | —      | 32 px log-out button only                                         |
| `/settings/gym`            | 390                  | 0       | 0        | 9 / 18    | —      | 32 px inputs; 20 px "‹ Settings" link; 26 px "Register new gym"   |
| `/settings/registration`   | 390                  | 0       | 0        | 5 / 14    | —      | 30 px Copy / Download / Print                                     |
| `/settings/policies`       | 390                  | 0       | 0        | 5 / 16    | —      | 16 px "Reset to default" ×2                                       |
| `/settings/security`       | 390                  | 0       | 0        | 6 / 15    | —      | 26 px Update / Change ×4                                          |
| `/settings/access-control` | 390                  | 0       | 0        | 9 / 18    | —      | 32 px inputs and buttons                                          |
| `/settings/billing`        | 390                  | 0       | 0        | 7 / 16    | —      | 32 px plan buttons; 30 px Print                                   |
| `/support`                 | 390                  | 0       | 0        | 7 / 17    | —      | 16 px phone links; 32 px form controls                            |
| `/access-control`          | 390                  | 0       | 0        | 7 / 16    | —      | 30 px filter chips; 32 px "Go to settings"                        |

Every number agrees with the audit's appendix where the two overlap (Members
767 px, Renewals 674 px, cohort 1,093 px, bottom bar 754 px, 26–36 px
targets). The Renewals touch count rose from 36 to 239 because the fixtures
added 100 overdue rows with two 26 px buttons each — the fixture doing its job.

### 2.2 Desktop-tier probe (asserted)

| Width | Routes clean | Pinned entries (`KNOWN_DESKTOP_VIOLATIONS`)                                                                                                                |
| ----- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1366  | 16 / 16      | `/dashboard`, `/revenue`: y-axis ticks ≥ 5 digits clipped (clears **Phase 1**, §5.9); `/member-analytics`: x-axis end label 1 px over (clears **Phase 7**) |
| 1024  | 16 / 16      | same                                                                                                                                                       |
| 768   | 16 / 16      | same                                                                                                                                                       |

### 2.3 Suite sizes

| Metric                                         | Phase 0 |
| ---------------------------------------------- | ------: |
| Jest tests                                     |   1,760 |
| Playwright mobile-rebuild tests (7 projects)   |     124 |
| Pre-rebuild Playwright tests (`chromium` only) |      26 |
| Desktop baselines (1366, committed)            |       7 |
| `STRICT_PHONE_ROUTES`                          |       0 |
| `KNOWN_DESKTOP_VIOLATIONS`                     |       3 |
| Components mounted for mobile in `src/app`     |       0 |

---

## 3. Execution log

### Phase 0 — Test scaffolding · **DONE** 2026-09-13 · PR #71

Branch `claude/mobile-ui-rebuild-p0`, four commits, no product code. Files
touched: `src/hooks/`, `src/test-utils/`, `tests/e2e/`, `playwright.config.ts`,
this file.

**Built (plan §18 row 0):**

1. `renderScreen(ui, { viewport: 'phone' | 'desktop' })` — default desktop;
   wraps a `ViewportTierProvider` override outside any extra wrapper so a
   screen test's own providers still see the tier.
2. `src/hooks/useViewportTier.tsx` — provider with `initialTier` and an
   explicit `tier` override; hook returns the tier; **no `matchMedia`**
   (Phase 1); **mounted nowhere** (Phase 2); no allow-list touched — a hook
   is not a component, and UI1 walks `src/components` and
   `features/*/components` only. `.tsx`, not the plan's `.ts`, because it
   holds the provider's JSX.
3. Seven Playwright projects (M5). `mobile-*.spec.ts` runs across the matrix;
   `desktop-regression.spec.ts` on 1366 only; `spikes/` on 390 only; the 26
   pre-rebuild tests stay on `chromium` (verified: access-control dashboard
   5/5 after the config change).
4. `tests/e2e/helpers/mobile-probe.ts` — nine rules, one report; the spec
   `mobile-probe.spec.ts` runs it over 16 routes (M1–M3, M7).
5. `tests/e2e/helpers/stress-fixtures.ts` — §28 seeded through the app's own
   routes, idempotent by name (M4). First run 19.6 s; second run skipped all
   eight in 4.5 s. The NEW-badge member is re-registered when older than the
   7-day `isNewMember` window, since that fixture cannot be permanent.
6. `tests/e2e/desktop-regression.spec.ts` — full-page 1366 baselines for
   Dashboard, Members, Renewals, Revenue, Analytics, Settings/gym and the
   member detail open (the desktop `MemberDetailModal` on the long-name
   fixture). Server clock and Next's dev badge masked; 2 % pixel tolerance
   for date drift; re-baseline protocol in the spec header.
7. Both VERIFY spikes kept as specs (`tests/e2e/spikes/`), so they keep
   guarding what they found.

**Verification (what was checked, and the result):**

- `type-check` clean · `lint` 0 errors (11 warnings, all pre-existing, in
  files this branch never touched) · `arch:check` green · Jest 1,760 passed.
- Mutation-falsified: `src/hooks/__tests__/useViewportTier.test.tsx`. Making
  the hook ignore `tier` fails 4 of 7; dropping `tier={viewport}` from
  `renderScreen` fails 2 of 7. Source restored, 7/7.
- Playwright: 124/124 across all seven projects in one run (4.6 min).
- Baselines opened and inspected before commit; a second run passes 7/7.
- Fixtures **queried in the database**, not trusted from 200s: 351 members on
  the Enterprise gym with the trigger-maintained `member_count` agreeing;
  300 bulk, exactly 100 overdue; the overdue member at 299 days; next due
  2027-02-16; plan and payment 1,000,000; the 40-char discount linked; the
  announcement with newlines to 351 recipients; Lite gym untouched; dev log
  shows the Mock SMS provider only.

**Spike (a) — history entry + `popstate` in the App Router: PASS.** No
amendment to §5.3/§14. Observed on `phone-390`: `history.pushState(state, '')`
with no URL is adopted by Next (it copies `__NA` and its tree onto the state)
without dispatching a navigation; hardware back fires `popstate` on the same
URL with no navigation and no reload (an in-page marker survives); a second
back is the ordinary client-side navigation to `/dashboard`; `history.back()`
from the overlay's own Close behaves identically; zero console errors. For
Phase 1's `useHistoryBack`: push **without** a URL (a same-URL push is
adopted but dispatches a same-URL restore), and treat a `popstate` that
re-enters the dead entry via _forward_ as a no-op while closed.

**Spike (b) — Next 16 `viewport` export: shape confirmed.** `Viewport` carries
`viewportFit: 'auto' | 'cover' | 'contain'`; `lib/metadata/metadata.js`
renders the layout fields into one meta in the fixed order `width, height,
initial-scale, minimum-scale, maximum-scale, user-scalable, viewport-fit,
interactive-widget`, and `themeColor` as its own tag; static object form,
server components only, exclusive with `generateViewport`. See F2 for the
trap.

---

## 4. Findings

Recorded because each one falsified something the plan, the audit or the
prompt asserted, or was invisible to every existing gate.

### F1 — The desktop chart axis is clipped too, not only the phone's

The audit recorded clipped y-axis labels at 390 px. At **1366** the dashboard
and revenue charts render `0000 / 5000 / 0000 / 5000 / 0` for the ticks
`35000 … 140000`; with the 1,000,000 fixture payment they are seven digits
and clipped by 18 px. Cause is the plan's own diagnosis (`YAxis width={40}`
with `margin.left: -8`, §5.9): a six-digit label does not fit a 40 px axis at
_any_ width. Rendered and confirmed from a screenshot before it was believed.
Pinned by M2; Phase 1's `compactAxis` / `yTickFormatter` must delete the two
`/dashboard` and `/revenue` entries in the same commit.

_Lesson:_ the prompt's "the probe runs green on today's desktop routes" was an
assumption, and the desktop screenshot suite that the overhaul signed off on
did not include a chart with six-digit values.

### F2 — `viewport.themeColor` would ship a second `theme-color` tag

`src/app/layout.tsx` already emits `<meta name="theme-color" content="#000000">`
through `metadata.other['theme-color']` — the pre-`viewport`-API way. Adding
`export const viewport = { themeColor: '#08080a', … }` per §16 without removing
that entry ships **two** tags with different values. `tests/e2e/spikes/
viewport-export.spec.ts` pins "exactly one `theme-color`" and today's default
viewport meta (`width=device-width, initial-scale=1`, no `viewport-fit`), so
Phase 1 fails the spec if it forgets, and again if it forgets to update the
expected meta.

### F3 — §17's overflow rule contradicts §4 at tablet widths

See M1. At 768 the Members table (767 px) is wider than its 718 px container
and at 1024 wider than its 734 px one; the cohort matrix (1,093 px) overflows
at both. §4 says tablet tables scroll in their containers; §17's literal rule
says any element beyond the viewport outside `data-scroll="x"` fails. The
plan has two rules for one situation. M1 resolves it toward §4 and §5.20 for
the desktop tier; the phone-tier rule is untouched.

### F4 — Two §28 fixture values cannot pass the product's own validation

See M4. `addMemberSchema` caps `planAmount`/`paymentAmount` at 1,000,000;
`createAnnouncementSchema` caps a message at 160 characters. Also: the
"29-char" name `Wickramasinghe Arachchige Dona` is 30 characters (14 + 1 + 10

- 1 + 4); used verbatim.

### F5 — A mobile browser hides page overflow by zooming out

With the fixtures, Renewals' tab strip reads `Expired 115 · Expires this week
39 · Collected 125`; its intrinsic width is 397 px, and mobile Chromium
widened the layout viewport to 397×860 to fit it — exactly what Safari does
on a phone. `documentElement.scrollWidth` then equals `innerWidth` (397/397)
and the plan's "`scrollWidth === innerWidth`" rule **passes** on an
overflowing page. Fixed by M7. This is also the §28 "tab badge counts →
`TabsList` overflow" fixture firing on real data, a year early: the plan's
`TabsList overflow="scroll"` (§5.5) is what clears it in Phase 1/5.

### F6 — `browser.newPage()` does not inherit the project's viewport

The existing specs open shared pages with `browser.newPage()` in `beforeAll`.
Under a viewport project that page is a 1280×720 desktop regardless — a
phone-390 run measuring a desktop would have looked perfectly green. M6's
helper exists because of this; any future spec that shares a page across
tests must use it.

### F7 — Probe false positives that were fixed before they could mislead

Recorded so nobody re-adds the rule that produced them: (1) `sr-only`
captions (`caption.sr-only` on every `DataTable`) are 1×1 clipped boxes by
design and read as "clipped text" until visually-hidden elements were
excluded; (2) the desktop sidebar shares the `Workspace` landmark with the
bottom bar, so "bottom nav 239/239" appeared at 1366 until the rule selected
the _fixed_ nav; (3) Radix's `tablist` is focusable and read as a 37 px
"interactive element" until focus-group containers were excluded — their
triggers are the targets.

### F8 — The tracker's `if_version` is stored as a data field

The Artifact tool's batch schema has no `if_version` slot, so the plan's
instruction ("entries include `if_version`") can only be met by putting it
inside `data`. The tracker accepts the write and the field persists on the
document. Harmless, but a session reading a document back will see it; do not
mistake it for the document's `version`.

---

## 5. Open items

| Id   | Item                                                                                                                                                                                                | Owner       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| MO-1 | `KNOWN_DESKTOP_VIOLATIONS`: two axis entries clear in Phase 1 (§5.9), the 1 px x-tick in Phase 7. Delete the line with the fix or the spec fails on staleness (M2).                                 | Phase 1 / 7 |
| MO-2 | `STRICT_PHONE_ROUTES` is empty. Each phase adds the routes it rebuilt (M3); Phase 10 expects all 16.                                                                                                | every phase |
| MO-3 | `metadata.other['theme-color']` must go when `viewport.themeColor` arrives (F2), and the spike's expected viewport meta flips to `PLANNED_VIEWPORT_META`.                                           | Phase 1     |
| MO-4 | Desktop baselines picture live E2E data. Any seeding or payment on the Enterprise gym shifts them; re-baseline with `--update-snapshots` and say so in the PR — never to absorb a phase's own diff. | every phase |
| MO-5 | The NEW-badge fixture ages out weekly and is re-registered by the seed; the recent-payments list on the dashboard baseline reorders when that happens.                                              | note        |
| MO-6 | `TEST_ONLY_RENDER` lives under `tests/e2e/helpers`; jsdom tests that need it (Phase 1 `ListRow`, `Tabs`) import it from there or re-export via `src/test-utils`.                                    | Phase 1     |
