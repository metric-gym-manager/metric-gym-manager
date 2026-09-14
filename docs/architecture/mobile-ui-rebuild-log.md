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
| **`mobile-ui-rebuild-log.md`** (this file) | Rulings, baselines, execution log, findings, open items, verification debt.            | Living          |
| Tracker artifact (db-backed)               | Status: `phases`, `decisions`, `open`, `risks`, `log`. URL in the plan header.         | Live            |

Branches: one per phase, `claude/mobile-ui-rebuild-p<N>`, cut from `master`;
never commit to `master`.

---

## 1. Rulings taken

Numbered `M<n>` so they cannot be confused with the overhaul's `R<n>` rulings,
which still bind (R6 hands mobile to this effort; R7 governs selection).

| #       | Date       | Ruling                                                                                                                                                                                                                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**  | 2026-09-13 | **The probe's overflow rules are tier-aware.** Phone tier: only a `data-scroll="x"` container may hold or extend past the viewport. Desktop tier (≥ 768): any `overflow-x: auto\|scroll` container is sanctioned. A clip container (`hidden`/`clip`) with wider content is a violation on both tiers.                  | Plan §17 reads "no `main *` beyond the viewport except inside `data-scroll="x"`" with no tier qualifier, but §4 says tablet tables "scroll in their containers" and §5.20 sanctions horizontal scroll for tabular data. Read literally, §17 fails Members (767 px) and the cohort matrix (1,093 px) at 768 and 1024 with no phone involved. §4 is the more specific statement, so it wins. Logged as an EXCEPTION.                                                                                    |
| **M2**  | 2026-09-13 | **Known desktop probe violations are a shrinking allow-list, not a softened rule.** `KNOWN_DESKTOP_VIOLATIONS` in `mobile-probe.spec.ts` names each entry's clearing phase; a violation not on the list fails, and a listed entry that no longer occurs fails too.                                                     | The desktop was expected to probe clean and did not (F1). Phase 0 may not touch product code, and loosening the rule would hide a real defect. The same discipline as `UI1_ALLOW`–`UI5`: an entry that outlives its defect reads as sanctioned, so the ratchet fails on staleness. Exercised live once already — it flagged the cohort entry the moment M1 made it stale.                                                                                                                             |
| **M3**  | 2026-09-13 | **Phone-tier probe results are reported, not asserted, until a route is rebuilt.** `STRICT_PHONE_ROUTES` starts empty; each phase adds the routes it touched and the list never shrinks.                                                                                                                               | The audit measured every phone route failing. A suite that is red everywhere from day one teaches people to ignore red; the value in Phase 0 is the _numbers_ falling route by route, which the report gives and a failure would not.                                                                                                                                                                                                                                                                 |
| **M4**  | 2026-09-13 | **§28 fixture values the product's validation rejects are test-only render constants**, not seeded. `TEST_ONLY_RENDER` carries 12,345,678 / 99,999,999, the 320-char SMS, the 20-char phone and the 128 / 1,024 tab badges; the seed carries the maxima the API accepts (1,000,000; a 160-char message with newlines). | `addMemberSchema` caps `planAmount`/`paymentAmount` at 1,000,000 and `createAnnouncementSchema` caps a message at 160. Seeding past those means bypassing validation — the door the fixtures exist to keep shut. The prompt's "through the app's own APIs" is the binding constraint; §28's numbers are examples of _shape_. Logged as an EXCEPTION.                                                                                                                                                  |
| **M5**  | 2026-09-13 | **768×1024 is emulated as an iPad, not a phone:** `hasTouch: true`, `isMobile: false`, desktop UA, DPR 2. The four phone projects are full phone emulation (`isMobile`, `hasTouch`, iPhone UA, DPR 2–3).                                                                                                               | iPadOS Safari reports a desktop UA and no client hints. The plan's tablet decision (d02) hands 768–1023 the desktop composition, and Phase 2's SSR hint reads `sec-ch-ua-mobile` — a 768 project sending `?1` would exercise the wrong branch and make the tablet tier look like a hydration flip. The emulation must match the device the decision is about.                                                                                                                                         |
| **M6**  | 2026-09-13 | **One sign-in per spec file per project, in the project's own viewport** (`helpers/tier-page.ts`).                                                                                                                                                                                                                     | Seven projects × a sign-in per test is ~110 sign-ins a run, past Supabase's per-IP token limit (`helpers/billing.ts` records two failed attempts at caching sessions). And `browser.newPage()` — the pattern the existing specs use in `beforeAll` — ignores the project's `use` block, so a "phone-390" run would silently measure a 1280×720 desktop. The helper rebuilds the context from `testInfo.project.use`.                                                                                  |
| **M7**  | 2026-09-13 | **Page overflow is measured against the configured device width, not `innerWidth`.**                                                                                                                                                                                                                                   | F5: a mobile browser meeting content wider than the device zooms the layout viewport out, so `scrollWidth === innerWidth` held at 397/397 on the 390 project and the Renewals overflow passed. Comparing to `page.viewportSize().width` reports it as "zoomed out to fit".                                                                                                                                                                                                                            |
| **M8**  | 2026-09-14 | **`compactAxis` is a compact FORMATTER (`1400000 → 1.4M`), not the 56 px axis-width token.** §5.1's `chartAxisWidthCompact` is therefore not added.                                                                                                                                                                    | §5.9 offers both and hands the choice to the Phase 1 visual pass. Rendered both at 390 in the showcase: the 40 px axis shows `0000 / 0000 / 0000 / 0000 / 0` unformatted and `1.6M / 1.2M / 800k / 400k / 0` formatted. Widening to 56 takes 16 px of plot area from a 390 px screen AND still cannot hold `1000000` (7 chars). The formatter fixes it in the space there already is.                                                                                                                 |
| **M9**  | 2026-09-14 | **`ListRow`'s value drops under the primary column by FLEX WRAPPING, not a breakpoint.** The primary column claims `basis-40` (160) and the value `min-w-24` (96); with the 12 px gap they sit side by side only above ~268 px of row content.                                                                         | §9.1 says the value drops "when the row is narrower than 340 px". There is no `phone-sm` token and adding one is a plan amendment. Wrapping reproduces the stated threshold (a row with a leading avatar wraps below ~338 px) and is content-aware in a way a viewport breakpoint is not — a row with a 44 px selection target wraps sooner than one with a 26 px avatar, which is correct in both cases.                                                                                             |
| **M10** | 2026-09-14 | **`AppBar` and `BottomNav` are parked in `UI1_ALLOW` for Phase 1.** Two entries, with Phase 2 named as their deadline.                                                                                                                                                                                                 | The Phase 1 prompt says to mount them in the showcase "so UI1 stays green", but UI1 explicitly does **not** count `src/app/(dev)/design-system/` as an entry point (a showcase imports everything by design). The plan's own sequencing builds the chrome in Phase 1 and wires it in Phase 2, and the Phase 2 prompt's scope item 6 is "remove Drawer, AppBar, BottomNav from any allow-list they were parked in".                                                                                    |
| **M11** | 2026-09-14 | **The More sheet's rows drop the sheet's history entry BEFORE navigating.** A row records its href, calls `history.back()`, and `useHistoryBack`'s close handler performs the navigation.                                                                                                                              | Tapping a link while the entry is live pushes the new route ON TOP of it. The dead entry then shares the previous route's URL, so the first Back looks right and the SECOND does nothing — and another is added every trip through More. Closing first is the only ordering that leaves the stack clean; the alternative (dropping the entry after the push) cannot work, because `history.back()` would undo the navigation.                                                                         |
| **M12** | 2026-09-14 | **Both chromes stay in the DOM at every width, hidden by CSS.** `AppBar`/`BottomNav` carry `tablet:hidden`; `WorkspaceHeader`/`WorkspaceSidebar` carry `tablet:flex`.                                                                                                                                                  | A tier-switched TREE has to agree between the server and the hydrating client, and the tier is a measurement the server cannot take (M5) — the SSR hint is a guess. `display: none` removes the hidden chrome from the accessibility tree, so the only real cost is two `banner` landmarks and two `<nav aria-label="Workspace">` in the markup, one of each live at a time. Tests must name which they mean; the first version of the shell test did not, and silently asserted against the sidebar. |

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

| Metric                                         | Phase 0 | Phase 1 | Phase 2 |
| ---------------------------------------------- | ------: | ------: | ------: |
| Jest tests                                     |   1,760 |   1,889 |   1,938 |
| Playwright mobile-rebuild tests (7 projects)   |     124 |     124 |     124 |
| Pre-rebuild Playwright tests (`chromium` only) |      26 |      26 |      26 |
| Desktop baselines (1366, committed)            |       7 |       7 |       7 |
| `STRICT_PHONE_ROUTES`                          |       0 |       0 |       0 |
| `KNOWN_DESKTOP_VIOLATIONS`                     |       3 |       3 |       3 |
| Components mounted for mobile in `src/app`     |       0 |       0 |       3 |
| `UI1_ALLOW` entries                            |      13 |      15 |      12 |
| `UI6_ALLOW` entries                            |       — |       — |       0 |

Phase 1 rebuilds no route, so `STRICT_PHONE_ROUTES` cannot grow yet (M3) and
the 2.1 baseline is unchanged — the primitives are ready; nothing composes
them outside the showcase until Phase 2.

Phase 2 rebuilds the CHROME, not the screens' content, and still cannot run
the suite against the seeded gym (§6.1). `STRICT_PHONE_ROUTES` therefore stays
empty on purpose: adding `/dashboard` would assert a populated screen this
session has never seen. `UI1_ALLOW` falls by three — `Drawer`, `AppBar` and
`BottomNav` are mounted — and gains nothing.

### 2.4 Phase 1 — the design-system showcase, probed and rendered

The 2.1 routes need the seeded gym, which Phase 1's session could not reach
(§6). The showcase does not: it is the one surface where every new primitive
renders, and it is what the phase was verified against.

`/design-system`, `next dev`, scope `body` (the showcase has no `<main>`):

| Width | beyond | overflow | touch    | ticks   | Everything flagged                                                                                  |
| ----- | ------ | -------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| 320   | 4 (24) | 6        | 56 / 210 | 18 /116 | `Table`/`DataTable` **table-mode** demos, `SideNav`, `UserMenu` — all pre-existing showcase content |
| 390   | 2 (6)  | 0        | 46 / 210 | 18 /120 | same, minus the two that fit at 390                                                                 |
| 430   | 0      | 0        | 46 / 210 | 18 /120 | touch only                                                                                          |
| 1366  | 0      | 0        | 0 / 224  | 18 /120 | — (desktop tier: the touch rule does not apply)                                                     |

**No `ListRow`, `AppBar`, `BottomNav` or `DataTable` list-mode violation at any
width.** The touch counts are dominated by primitives this phase did not
touch (`Alert`'s 18 px dismiss, `Breadcrumb` links, `SideNav` rows, sortable
`<th>` buttons, column resize handles) plus two this phase created knowingly:
the 44×24 `Switch` (F9) and the bare 24 px `Checkbox` in **table** mode, whose
hit area belongs to its caller — in list mode `DataTable` supplies it. The 18
clipped ticks are the deliberately-uncompacted comparison chart (the compact
one beside it is clean) and the pre-existing 1 px x-tick.

**Desktop equivalence, measured:** ten pre-existing showcase sections
(Buttons, Form controls, Data display, Feedback & overlays, Navigation,
DataTable, Charts, and the three Composites sections) screenshotted at 1366
before and after the branch and compared at `maxDiffPixels: 0` — **identical**.
Method: stash the branch, capture with `--update-snapshots`, unstash, compare.
The temporary spec is not committed; re-create it the same way when a later
phase needs the same evidence and the E2E gym is still out of reach.

**Generated CSS read, not assumed:** `text-input`, `min-h-touch`,
`size-touch`, `min-w-touch-sm`, `h-bottom-nav`, `pb-safe-bottom`,
`h-sheet`/`max-h-sheet` and the `@media (max-width: 767px)` block were built
with the Tailwind CLI and inspected. Two things only that could show: the
`text-input` colour collision (F11), and that `theme(spacing.touch)` resolves
inside an arbitrary `grid-cols-[…]` value.

### 2.5 Phase 2 — the rebuilt shell, probed

`next dev`, the phone tier, with the workspace routes temporarily made public
(the seeded gym is still unreachable — §6.1 — so the pages' own queries answer
401 and only the CHROME rendered). Everything below is therefore a
measurement of the shell, which is what this phase built.

| Route           | Width | beyond | overflow | touch | bottom nav    |
| --------------- | ----- | ------ | -------- | ----- | ------------- |
| `/dashboard`    | 320   | 0      | 0        | 0 / 5 | **320 / 320** |
| `/dashboard`    | 390   | 0      | 0        | 0 / 5 | **390 / 390** |
| `/settings/gym` | 320   | 0      | 0        | 0 /11 | **320 / 320** |
| `/settings/gym` | 390   | 0      | 0        | 0 /11 | **390 / 390** |
| More sheet open | 320   | 0      | 0        | 0 / 8 | —             |
| More sheet open | 390   | 0      | 0        | 0 / 8 | —             |

`scrollWidth === clientWidth` on the bar at both widths is §6.2's assertion,
and it is the audit's headline defect closed: the bar it replaces measured
**754 px on a 390 px screen** with five of its nine destinations off-screen
behind a scroll with no affordance.

**Not a like-for-like touch count.** `/settings/gym` was `9 / 18` in the 2.1
baseline and is `0 / 11` here — but seven of those eighteen controls are
data-dependent and did not render without a session. The honest claim is
narrower and still worth having: _every control that rendered met §15.1_, and
the two the baseline names by construction — the 32 px inputs and the 20 px
"‹ Settings" link — are gone, the first by Phase 1's primitive sizing and the
second because the link itself was deleted.

**Back closes the More sheet without navigating**, observed in the real
router: URL unchanged after `page.goBack()`, `[role="dialog"]` count 0. That
is spike (a)'s finding working through `useHistoryBack` for the first time.

**Desktop equivalence, measured again:** `/dashboard` and `/settings/gym`
screenshotted full-page at 1366 before and after the branch and compared at
`maxDiffPixels: 0` — **identical**. The `lg:` → `tablet:` migration, the
`AppBar`/`BottomNav` in the DOM and the shell's new padding change nothing at 1366. **Caveat:** the one expected desktop diff — the Door Access sidebar
entry — does NOT appear in this environment, because it is gated on a
capability the unreachable subscription endpoint would have to supply. So the
comparison proves the rest of the desktop is untouched and says nothing about
that entry; its rendering is covered by the jsdom sidebar test only.

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

### Phase 1 — Design-system foundations · **DONE** 2026-09-14

Branch `claude/mobile-ui-rebuild-phase-1-tccb88` (see the deviation below).
Scope: plan §18 row 1. 33 files: `tokens.ts` + `globals.css` +
`tailwind.config.ts`, `src/hooks/`, twelve primitives, two new composites, the
showcase, `src/app/layout.tsx`, `scripts/generate-pwa-assets.js`, docs.

**Built (plan §18 row 1):**

1. **Tokens (§5.1)** across all three files, with the parity test extended to
   cover them: `touch` 44 / `touch-sm` 40, `bottom-nav` 56, `sheet` 90dvh
   (in `spacing`, so `h-sheet` and `max-h-sheet` come from one entry),
   `--ds-safe-*` + `safe-top/bottom/left/right` spacing, `text-input` 16/24,
   `screens.phone: { max: '767px' }`, `breakpoints.phoneMax`. `bodyPhone` is
   **not** applied — proposed in the PR with a rendered comparison (o09).
   `chartAxisWidthCompact` is not added (M8).
2. **`useViewportTier`** completed: `matchMedia('(max-width: 767px)')` through
   `useSyncExternalStore`, server snapshot = `initialTier`, explicit override
   still winning. **`useHistoryBack(open, onClose, enabled)`** — one
   implementation, built to spike (a)'s four observed behaviours.
3. **Primitive `phone:` sizing + `data-dense`** (§5.2, §15.1) on Button,
   Input, Select, Textarea, Checkbox, Radio, Switch, TabsTrigger, Pagination.
4. **`Modal placement`** `center` (unchanged) · `sheet` · `fullscreen`, with
   the leading Back control rendered beside the × and one hidden per width, and
   the history entry armed only for `fullscreen` on a phone.
5. **`Drawer`** on `phone:` + `size: 'auto' | 'full'`; **`Tabs overflow`**;
   **`Pagination responsive`**; **`Charts compactAxis`/`yTickFormatter`**.
6. **`ListRow`** (L2) and **`DataTable mobileRow`** + `forceLayout`, compact
   sort `Select`, list-mode skeleton/empty/error.
7. **`AppBar`** and **`BottomNav`** (L3) — built, shown in the showcase,
   wired into the shell in Phase 2 (M10).
8. Showcase sections for every addition; `DESIGN_SYSTEM.md` §4.3/§4.4/§6/§7 +
   new §10.1, and `architecture.md` §2.21.
9. `export const viewport` (§16) with `viewport-fit=cover`, replacing
   `metadata.other['theme-color']` (MO-3 closed); manifest
   `background_color`/`theme_color` → `#08080a` via the generator.

**Decisions the phase was asked to take, and what decided them:**

| Question                                                         | Answer                                                            | What decided it                                                                                                                                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §5.9 — widen the axis to 56, or compact the tick text?           | **Compact formatter.** `chartAxisWidthCompact` is not added (M8). | Rendered both at 390: `0000 / 0000 / 0000 / 0000 / 0` against `1.6M / 1.2M / 800k / 400k / 0`. 56 px costs 16 px of plot on a 390 px screen and still cannot hold `1000000`.          |
| §9.1 — how does the value "drop under the primary below 340 px"? | **Flex wrapping**, not a breakpoint (M9).                         | There is no `phone-sm` token and adding one is an amendment. `basis-40` + `min-w-24` + the 12 px gap reproduces the stated threshold and is content-aware, which a breakpoint is not. |
| o09 — is phone body text 13/20 or 14/20?                         | **Proposed 14/20, NOT applied** (MO-9), as the scope requires.    | Rendered side by side and confirmed at `13px/20px` vs `14px/20px`. The reasoning and the caveat are in MO-9.                                                                          |
| Where do `AppBar`/`BottomNav` live until the shell exists?       | **`UI1_ALLOW`, with Phase 2 named as the deadline** (M10).        | UI1 does not treat the dev showcase as an entry point, and Phase 2's scope item 6 removes them.                                                                                       |

**Defects found — none of which the gate could see.** Three were introduced by
this phase's own work and fixed inside it; the fourth is a plan conflict left
for Phase 8.

| #   | Defect                                                                                    | Found by                                          | Outcome                                        |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| F11 | `text-input` merged with a colour of the same name and repainted every phone text control | Building the Tailwind CSS and reading it          | Fixed; a parity test now forbids the collision |
| F10 | One element inside `ListRow`'s truncating meta line made every list row a probe violation | Running the probe over the showcase in a browser  | Fixed; `overflow 2` → `overflow 0`             |
| F13 | The §9.4 test passed under the mutation it existed to catch                               | Mutating the source, per Verification Directive 3 | Test rewritten, then it fails                  |
| F9  | A 24 px `Switch` cannot meet the probe's own 40 px minimum                                | The showcase probe at 390                         | Left as §5.2 specifies; MO-10 decides it       |

F11 and F13 are the two worth carrying forward: both sat behind a **green**
gate — 1,889 passing tests, `tsc`, ESLint and `arch:check` all clean — while
the defect was there.

**Verification (what was checked, and the result):**

- `type-check` clean · `lint` 0 errors (the same 11 pre-existing warnings, in
  files this branch never touched) · `arch:check` green · Jest **1,889
  passed**, 7 skipped (129 new).
- **Rendered at 320 / 390 / 430 / 1366** in `next dev` and looked at, not
  inferred. The `ListRow` value sits beside the primary column at 390 and
  drops under it at 320 (M9); `BottomNav` holds four labelled slots at 320
  without truncation, which is the evidence for decision C8; the `AppBar`
  centres its title against the screen; list mode renders search, sort,
  selection, compact pagination and all three states.
- **Desktop equivalence measured, not argued:** ten pre-existing showcase
  sections (Buttons, Form controls, Data display, Feedback & overlays,
  Navigation, DataTable, Charts, three Composites) screenshot at 1366 before
  and after the branch and compared with `maxDiffPixels: 0` — **identical**.
- **Probe on the showcase**: 430 and 1366 clean; 390 and 320 report only
  pre-existing showcase content (the `Table`/`DataTable` table-mode demos,
  `SideNav`/`UserMenu`) — **no `ListRow`, `AppBar`, `BottomNav` or list-mode
  violation at any width**.
- **Mutation-falsified** (four, each restored): dropping `aria-labelledby`
  from `ListRow`'s target fails 6 of 13; making `useHistoryBack` never drop
  its entry fails 1 of 6; feeding every column into the list row's meta fails
  the §9.4 test; removing `data-dense` from `TabsTrigger` fails 1 of 24.
- **Tailwind output read, not assumed**: the generated CSS was built and
  inspected for `text-input`, `min-h-touch`, `size-touch`, `h-bottom-nav`,
  `pb-safe-bottom`, `max-h-sheet` and the `phone:` media query.

**Not verified, and why.** The seeded E2E gym is unreachable from this session
(no Supabase credentials), so four suites did not run and the browser pass had
two blind spots. **Itemised in §6** — what each check would have caught, what
that leaves unknown, and which to run first.

**Deviation from the prompt's branch instruction.** The plan says one branch
per phase cut from `master`. This session's branch,
`claude/mobile-ui-rebuild-phase-1-tccb88`, was cut from the **Phase 0 head**
because PR #71 is still open: `master` does not yet carry `renderScreen({
viewport })`, the probe, the fixtures or the spikes, all of which Phase 1
builds on. Merge #71 first; this branch then merges cleanly on top.

### Phase 2 — Shell & navigation · **DONE** 2026-09-14

Branch `claude/mobile-ui-rebuild-p2`, cut from the Phase 1 head (PR #71 and
#72 are both still open — see the Phase 1 entry's deviation note; the stack is
p0 → phase-1 → p2). Scope: plan §18 row 2.

**Decisions the phase was asked to take:**

| Question                                            | Answer                                                                      | Source                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| o02 — tablet treatment (768–1023)                   | Desktop composition, **sidebar collapsed by default**; a stored choice wins | Tracker default, applied. The band gets the PHONE chrome today, so this defines a tier (C20). |
| o03 — four bar items or five                        | **Four** (Dashboard · Members · Renewals · More)                            | Tracker default, applied; decision C8.                                                        |
| o12 — Door Access in the desktop sidebar            | **Yes**, capability-gated                                                   | Tracker default, applied — **not an explicit approval**. It is the one expected desktop diff. |
| How does the More sheet's history entry stay clean? | Rows drop it before navigating (M11)                                        | Reasoned from spike (a) and verified in the browser.                                          |

**Built (plan §18 row 2):**

1. `nav.ts`: `mobile: { placement, order }`, `capability`, `mobileNav()`, and
   the `/access-control` entry — **OPEN-1 closed**. `WORKSPACE_NAV` is still
   the only list; the sheet's groups ARE the sidebar's groups.
   `SETTINGS_SECTIONS` moved here too, because the AppBar now needs a section
   name and a second copy in the shell is the same fork one level down.
2. `WorkspaceShell` rebuilt: `AppBar` + `BottomNav` + the More `Drawer`,
   `data-tier` on the root, `<main>` `phone:px-4 phone:pt-3` and a bottom
   padding derived from `bottom-nav` + `--ds-safe-bottom`, `lg:` → `tablet:`,
   the tablet-collapsed default. `MobileTopBar` and `MobileBottomNav` deleted;
   the sign-out handler moved into the More sheet with its re-entrancy guard
   and its full-document navigation intact (§2.15).
3. `(dashboard)/layout.tsx` reads `sec-ch-ua-mobile` / UA through the new pure
   `tierFromHeaders` and supplies `ViewportTierProvider initialTier`.
4. `Toaster` top-centre on a phone, offset by `h-bar` + safe-top. Sonner's own
   `mobileOffset` stops at 600 px and ours is 768, so the offset is passed
   both ways.
5. **UI6** in `arch:check`: no `sm:|md:|lg:|max-tablet:` in
   `components/workspace`, `ui/primitives`, `common/composites`. Allow-list
   **empty** — the shell's `lg:` classes became `tablet:` in the same commit.
6. `Drawer`, `AppBar`, `BottomNav` removed from `UI1_ALLOW` (MO-8 closed).
7. `PageHeader`'s `<h1>` is `phone:sr-only` and the settings rail's is too;
   the in-flow "‹ Settings" link is **deleted** — the AppBar's 44 px Back
   replaces a 20 px text link inside the scrolling content.

**Verification:**

- `type-check` clean · `lint` 0 errors (the same 11 pre-existing warnings) ·
  `arch:check` green · Jest **1,938 passed**, 7 skipped (49 new).
- Rendered at 320 and 390 and looked at; probe numbers and the desktop
  pixel comparison in §2.5.
- **Mutation-falsified** (three, each restored): moving Renewals off the bar
  fails 3 of 52; removing the capability filter fails 3 of 52; pointing the
  AppBar's Back at `router.back()` fails 1 of 20.

**Known and deliberate:** the phone `AppBar` titles a settings section from
`SETTINGS_SECTIONS`, and any _other_ nested route falls back to its parent's
crumb. Only `/settings` has children today; a future nested route gets a true
but coarse title until it is named.

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

### F9 — A 24 px `Switch` cannot satisfy the probe's own touch rule

§5.2 specifies `Switch phone:h-6 phone:w-11` — a 44×24 track — and it is
implemented verbatim. §15.1's row for Checkbox/Radio/Switch reads "control
24 px; 44 px label hit area (label wraps the control)", but **a `Switch` has
no wrapping label**: in `SettingsRow` the label sits beside it, so the track
_is_ the target, and the probe measures it at 44×24 against a 40 px minimum.

Not resolved here, deliberately: the plan answers the question (§30 — "when a
question is answered by this plan, follow the plan"), and the alternative is a
DOM restructure (an inner span for the track) that would change the desktop
markup for a phone problem. It surfaces at Phase 8, where Settings is rebuilt
and the switch rows become `STRICT_PHONE_ROUTES`. The options then are a
padded wrapper that is the target, or an amendment to §5.2.

### F10 — One element inside a truncating line turns an ellipsis into a defect

`ListRow`'s meta line is `truncate` — `overflow: hidden` plus
`text-overflow: ellipsis`, exactly what §25.1 asks for. The probe has two
rules for a container narrower than its content: **rule 3** forbids clipping,
and **rule 9** permits it when the element holds nothing but text and
truncates with an ellipsis. `hasOnlyText` requires _every_ child node to be a
text node.

The first implementation separated the segments with
`<span aria-hidden> · </span>`, which put an element in the line and moved it
from rule 9 to rule 3 — a violation on every list row in the product. Removing
the span was **not** enough: React separates adjacent text children with
`<!-- -->` comment nodes, which are not text nodes either. The fix is to join
plain segments into a single string. The probe reported `overflow 2` before
and `overflow 0` after.

Found by running the probe over the showcase in a browser. 1,889 green jsdom
tests could not see it: jsdom renders no comment separators and computes no
widths.

### F11 — A type token and a colour token sharing a name merge into one rule

Tailwind's `fontSize` and `textColor` plugins both emit `.text-<key>`. The
legacy shadcn palette carried `input: 'hsl(var(--input))'`, so adding
`fontSize.input` for §5.1's 16 px control text produced a single rule:

```css
.text-input {
  font-size: 16px;
  line-height: 24px;
  color: hsl(var(--input));
}
```

`--input` is `214.3 31.8% 91.4%` — a near-white left over from the light
theme. Every phone text control would have been repainted as a side effect of
its font size, with no error anywhere. Nothing in `src/` referenced
`bg-input`/`border-input`/`text-input`, so the dead colour binding was removed
rather than the plan's token renamed. Found by **building the CSS and reading
it**; pinned by a parity test that fails if any key appears in both groups.

### F12 — `useHistoryBack` and React StrictMode

StrictMode runs a mount effect twice in development (effect → cleanup →
effect, synchronously). A cleanup that drops the pushed entry immediately
therefore pops an entry the re-armed effect has just re-pushed, and the
overlay closes itself — in dev only, which is where it would be found last.
The drop is deferred by one tick so the re-arm can cancel it, and it is
guarded by "is our entry still the current one", which also makes it correct
when the close _navigated_ (a More-sheet row) — there a blind `history.back()`
would undo the navigation.

### F13 — A §9.4 test passed under the mutation it existed to catch

`DataTable`'s list mode must not render a column the `mobileRow` mapping does
not name — §9.4's "accessible, not simultaneously visible", and the one rule
that keeps a phone row from quietly growing back into a table. The test was:

```ts
expect(screen.queryByText('2024-02-11')).not.toBeInTheDocument()
```

Mutating `DataTable` to feed **every** column into the row's meta line left it
**green**. The meta segments are joined into one string (F10), so the
exact-text query matched nothing — and "matched nothing" is what the assertion
wanted. The row carried the column it was guarding against, and the test
reported success.

Rewritten to assert on each row's text, and on the column's header as well as
its value; it then fails under the same mutation. This is the third rule in
`CLAUDE.md`'s Verification Directives landing on a test written the same day:
a green assertion is not evidence until the defect it names has been made to
break it.

_Lesson for later phases:_ `queryByText(...).not.toBeInTheDocument()` is the
weakest assertion in the suite — it passes when the text is absent, when it is
present but split across nodes, and when the component failed to render at
all. Prefer `expect(element).not.toHaveTextContent(...)` on a node the test
has already proved exists.

### F14 — A rule written loosely reported five primitives that broke none

UI6's first pattern was `/\b(?:sm|md|lg|max-tablet):/`, which is what "no
`lg:` here" looks like written down. It flagged `Button`, `Input`, `Modal`,
`Select` and `Spinner` — none of which uses a breakpoint. All five declare
cva variants: `size: { sm: 'h-7.5 …', md: …, lg: … }`. An object KEY and a
Tailwind VARIANT are both `word` + `:`.

The pattern now requires what a variant actually looks like — preceded by a
quote or whitespace, followed immediately by a utility, a negative or an
arbitrary value — and the rule strips comments first, so `StatCard`'s doc
comment showing a consumer `lg:grid-cols-4` is documenting page code rather
than switching a composition here.

_Lesson:_ a new `arch:check` rule is code, and its first run is its first
test. Five false positives would have been five allow-list entries, and an
allow-list entry that never had a defect behind it is a permanent hole.

### F15 — Two chromes, one document: the landmark a test grabs by accident

Both navigations are `<nav aria-label="Workspace">` and both are `fixed` —
the sidebar `fixed inset-y-0`, the bottom bar `fixed inset-x-0 bottom-0`. The
shell test's first helper picked "the fixed one", got the SIDEBAR, and
thirteen assertions failed in ways that read like a broken bottom bar. The
same shape exists for `banner`: `WorkspaceHeader` and `AppBar` are both
`<header>`.

In a browser this is harmless — `display: none` leaves exactly one of each in
the accessibility tree — and it is the price of M12's CSS switch. In jsdom,
which applies no CSS, a test that does not say which one it means is asserting
against whichever comes first.

### F16 — The More sheet's history entry survives the navigation it triggers

`useHistoryBack` drops the entry it pushed when the overlay closes, guarded by
"is our entry still the current one" (F12) — which is exactly right for a
close that navigated, and exactly wrong for the More sheet, whose ONLY purpose
is to navigate. Tapping a link pushes the new route on top of the live entry;
the guard then correctly refuses to go back, and the dead entry stays.

The symptom is subtle enough to survive review: the first Back from the new
route lands on the dead entry, whose URL is the PREVIOUS route, so Next
navigates there and everything looks right. The second Back lands on that
route's own entry — same URL — and appears to do nothing. One swallowed press
per trip through More, accumulating.

Fixed by ordering rather than by a new mechanism (M11): a row records its
href and calls `history.back()`; the hook's close handler runs the navigation
after the entry is gone. Verified in the browser — URL unchanged, sheet
closed, and the stack left with nothing extra on it.

### F17 — An unescaped pipe deletes a rule from `architecture.md`

Phase 2's §2.21 edit wrote the UI6 rule as `` `sm:|md:|lg:|max-tablet:` `` —
inside a **table cell**. GFM splits a row on every unescaped `|`, code span or
not, so that one token became four phantom columns. Prettier then re-padded
the row around those boundaries and closed up the spacing between the inline
code spans on either side, leaving:

```
`sm: | md:            | lg: | max-tablet:`are banned in`components/workspace`
```

Which is not a rule; it is a column of whitespace with a fragment on each side.
The same edit escaped `` `center`\|`sheet`\|`fullscreen` `` correctly three
sentences earlier, so knowing the rule was not enough — the pipes have to be
escaped **every** time, and the Pattern Index is a 22-row table where every
rule is one wide cell.

Nothing could catch it: `arch:check`, ESLint, `tsc`, Prettier and all 1,938
tests were green with the sentence destroyed, because the file is prose to all
of them. Prettier in particular _caused_ the mangling and then reported the
result as correctly formatted. It was found by re-reading the committed file.

The check that does work is mechanical and takes a second — split the row on
unescaped pipes and count: a Pattern Index row has exactly three cells. Fixed
by escaping (`` `sm:`\|`md:`\|`lg:`\|`max-tablet:` ``); the row now splits
three ways and Prettier leaves it alone.

---

## 5. Open items

| Id    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Owner       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| MO-1  | ~~Two axis entries clear in Phase 1~~ → **Phase 6**. Phase 1 built `compactAxis` but §5.9 has the _screens_ pass it, and a default change would move the plot area of every 1366 chart against Phase 1's pixel-equivalence constraint. The 1 px x-tick stays Phase 7.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Phase 6 / 7 |
| MO-2  | `STRICT_PHONE_ROUTES` is empty. Each phase adds the routes it rebuilt (M3); Phase 10 expects all 16. Phases 1 and 2 add none — Phase 1 rebuilt no route, and Phase 2 rebuilt the CHROME, so adding `/dashboard` would assert a populated screen no session here has seen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | every phase |
| MO-3  | ~~`metadata.other['theme-color']` must go when `viewport.themeColor` arrives~~ — **done in Phase 1**; the spike now asserts `PLANNED_VIEWPORT_META` and the single theme-color.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | closed      |
| MO-4  | Desktop baselines picture live E2E data. Any seeding or payment on the Enterprise gym shifts them; re-baseline with `--update-snapshots` and say so in the PR — never to absorb a phase's own diff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | every phase |
| MO-5  | The NEW-badge fixture ages out weekly and is re-registered by the seed; the recent-payments list on the dashboard baseline reorders when that happens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | note        |
| MO-6  | `TEST_ONLY_RENDER` lives under `tests/e2e/helpers`; jsdom tests that need it import it from there or re-export via `src/test-utils`. Phase 1 did not need it — the §28 shapes it carries (a 320-char SMS, 3-digit tab badges) belong to the screens, not the primitives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Phase 4+    |
| MO-7  | **Phase 1's E2E suites were not run**, and **Phase 2's were not either** — same session, same missing Supabase credentials. Itemised in §6.1; `viewport-export` is still the one to run first. Phase 2 adds `app-router-history` to the list for a second reason: `useHistoryBack` now has two consumers with opposite ordering needs (F16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Phase 3     |
| MO-8  | ~~`UI1_ALLOW` gained `AppBar` and `BottomNav`~~ — **closed in Phase 2**: all three (`Drawer` too) are mounted in `WorkspaceShell` and their entries are deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | closed      |
| MO-9  | o09 `bodyPhone` (14/20) is **proposed, not applied** — see the decisions table in the Phase 1 entry above. **Recommendation: adopt.** At 13/20 the primary row text sits 1 px above the caption (12) and 2 px above the mono meta (11), so a member's name and its own status line read as one weight; at 14/20 they separate, and that is the most-scanned relationship in every phone list. The line-height stays 20, so no row grows and no §26 blueprint height changes. Against it: 13 is the workspace's body size everywhere else, and raising it on phones means the two tiers no longer share one body token. Rendered comparison in the showcase's "Phase 1 decisions" section, confirmed at `13px/20px` vs `14px/20px`; **caveat — fallback fonts** (§6.2). Applying it is one token across the three files plus one class at the shell root. | product     |
| MO-10 | F9: the 44×24 `Switch` cannot meet the probe's 40 px minimum. Decide at Phase 8 (padded wrapper, or a §5.2 amendment) before Settings joins `STRICT_PHONE_ROUTES`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Phase 8     |
| MO-11 | **o12 was applied from its default, not approved.** The Door Access entry in the DESKTOP sidebar is the rebuild's one intended desktop navigation change (§0.2). It is one line in `nav.ts` to remove if the answer is no, and the tracker entry is still `open`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | product     |
| MO-12 | The tablet-collapsed default (o02) corrects on the client's first commit: the server cannot measure a width and an iPad shares the desktop UA (M5). Visible only at 768–1023, on a first visit with no stored choice. If it ever needs to be flicker-free, the mechanism is `Accept-CH: Sec-CH-Viewport-Width`, which is Chromium-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | note        |
| MO-13 | The phone `AppBar` names a settings section from `SETTINGS_SECTIONS`; any other nested route falls back to its parent's crumb. Only `/settings` has children today. A new nested route wants either an entry in that list or a generalisation of `appBarTitle`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Phase 8     |

---

## 6. Verification debt

Every phase ends with something it could not check. Recorded here rather than
inside a phase's log entry, because the point is that the NEXT session pays it
off, and a reader looking for "what is not yet known to work" should not have
to reconstruct it from prose.

Rule for this section: an item leaves it only when the check has actually been
run and its result recorded — never because time passed, and never because the
code "obviously" works.

### 6.1 Phases 1 and 2 — four suites that still have not run

Neither session had **Supabase credentials**, so the seeded E2E Enterprise gym
was unreachable and every spec gated on `E2E_ACCESS_CONTROL_ENABLED` skipped.
Nothing was worked around; the gap is the gap. Phase 2 did get a browser onto
the real shell — by making four workspace routes temporarily public, which
renders the chrome and answers 401 for every query underneath (§2.5) — so what
is missing is specifically **populated screens**, not "a browser".

| Suite                                   | What it would have checked                                                                                          | What that leaves unknown                                                                                                                                                      | Owner   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `mobile-probe.spec.ts` (16 routes × 7)  | That the 2.1 phone numbers and the 2.2 desktop baseline still hold after the primitive changes                      | Whether a `phone:` class on a shared primitive shifted a real route. The showcase (2.4) covers the primitives; it does not cover a screen composing them.                     | Phase 2 |
| `desktop-regression.spec.ts` (1366, ×7) | That the seven committed baselines still match                                                                      | The 2.4 comparison is the same evidence against a different page. It is strong for the primitives and silent about the screens.                                               | Phase 2 |
| `spikes/viewport-export.spec.ts`        | That the document ships exactly `width=device-width, initial-scale=1, viewport-fit=cover` and **one** `theme-color` | **The highest-value one.** Phase 1 both changed the layout AND flipped this spec's expectation, so the assertion and the code it guards were written together and never met.  | Phase 3 |
| `spikes/app-router-history.spec.ts`     | That Next still adopts a no-URL `pushState` without navigating                                                      | `useHistoryBack` now has TWO consumers with opposite ordering needs (F16), and the spike has not re-run since either existed. Phase 2 verified the More sheet's Back by hand. | Phase 3 |

**If `viewport-export` fails at the start of Phase 2**, the likely causes in
order: the `metadata.other['theme-color']` entry came back; `viewportFit` was
dropped; or Next's meta ordering changed and `PLANNED_VIEWPORT_META` needs
re-recording (the spike's header documents the renderer's fixed order).

### 6.2 Phases 1 and 2 — what the browser pass could not see

- **Fonts.** Geist could not be fetched offline, so every screenshot used the
  fallback family. Glyph widths differ from production, which matters for two
  of this phase's decisions: the `ListRow` wrap threshold (M9) and the o09
  13-vs-14 comparison (MO-9). Both were also checked numerically —
  `getComputedStyle` for the type sizes, the flex arithmetic for the wrap —
  so the conclusions do not rest on the pixels alone, but a device check at
  §29 sign-off should confirm them.
- **A real device.** `env(safe-area-inset-*)` is 0 in headless Chromium at
  every viewport, so `pt-safe-top` / `pb-safe-bottom` are proven to _resolve_
  and never proven to _inset_. §16's CSS-override probe
  (`--ds-safe-bottom: 34px`) and the one physical-device check at sign-off are
  still outstanding.
- **The on-screen keyboard.** §5.3's fullscreen footer is `dvh`-based and
  outside the body scroller; risk r07 (iOS keyboard hides the action bar) is
  untested until a reduced-height run and a manual iPhone check.
- **A populated screen (Phase 2).** Every workspace route rendered its chrome
  and an error card. So the shell is measured and the screens are not: whether
  a real Members table still overflows at 390 under the new `<main>` padding
  is a Phase 4 question, and the probe's phone numbers in §2.1 have not been
  re-measured since Phase 0.
- **The Door Access sidebar entry (Phase 2).** Capability-gated, and the
  subscription endpoint answers 401 here, so the entry never rendered in a
  browser. The jsdom sidebar test covers both branches; the 1366 comparison
  covers everything except it.

### 6.3 Standing — what no automated gate in this repo can see

Carried forward each phase so it is never mistaken for something a green run
covers:

- jsdom computes no geometry. A screen test proves a screen **mounts**, never
  that it **looks right** (`CLAUDE.md`, Verification Directives 1).
- Unit tests mock Supabase, so a missing column and an RLS-refused write are
  both indistinguishable from success (directive 2).
- A test is decorative until the defect it names has been made to break it
  (directive 3) — see F13, which is that rule catching a test from this phase.
