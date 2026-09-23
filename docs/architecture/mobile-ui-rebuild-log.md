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

The phase attributions in that last column are **Phase 0's expectations, left
as recorded**. None held: all three entries now read `clears: 'Phase 10'` —
the two y-tick ones because `compactAxis` is a phone-tier prop and these are
1366 measurements (F31), the x-tick one because its condition does not
reproduce on the rebuilt screen at any width while a sibling case reproduces
at all of them (F37). The file itself carries the reasoning; this table is
kept as the measurement it was.

### 2.3 Suite sizes

| Metric                                         | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
| ---------------------------------------------- | ------: | ------: | ------: | ------: | ------: | ------: |
| Jest tests                                     |   1,760 |   1,889 |   1,938 |   1,968 |   1,982 |   1,996 |
| Playwright mobile-rebuild tests (7 projects)   |     124 |     124 |     124 |     124 |     124 |     124 |
| Pre-rebuild Playwright tests (`chromium` only) |      26 |      26 |      26 |      26 |      26 |      26 |
| Desktop baselines (1366, committed)            |       7 |       7 |       7 |       7 |       7 |       7 |
| `STRICT_PHONE_ROUTES`                          |       0 |       0 |       0 |       0 |       0 |       0 |
| `KNOWN_DESKTOP_VIOLATIONS`                     |       3 |       3 |       3 |       3 |       3 |       3 |
| Components mounted for mobile in `src/app`     |       0 |       0 |       3 |       3 |       3 |       3 |
| `UI1_ALLOW` entries                            |      13 |      15 |      13 |      13 |      13 |      13 |
| `UI6_ALLOW` entries                            |       — |       — |       0 |       0 |       0 |       0 |

Phase 1 rebuilds no route, so `STRICT_PHONE_ROUTES` cannot grow yet (M3) and
the 2.1 baseline is unchanged — the primitives are ready; nothing composes
them outside the showcase until Phase 2.

Phases 3–5 add no Playwright tests: everything they built is pinned by Jest
and measured by an ad-hoc probe run, which is exactly the shape of the debt in
§6.1 — the suite that would pin these numbers needs the seeded gym. The E2E
directory is byte-identical between the Phase 2 head and this one.

**The Phase 2 `UI1_ALLOW` figure was wrong.** It read 12; the list has held 13
entries at every phase head from Phase 2 onward (`AppBar`, `BottomNav` and
`Drawer` left, `Divider` and the R3 set stayed). Corrected above by counting
the set at each commit rather than by re-deriving it from the phase's prose.

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

### 2.6 Phase 3 — the member detail, rendered and probed

Not the seeded gym (§6.1 still stands) but not a stand-in either: a temporary
dev-only route mounted the **real `MemberDetailModal`** with a hard-coded
member, and `next dev` served it to Chromium. The route, the public-route
entry it needed and the probe spec were all removed before the commit. So
this measures the real component tree and the real stylesheet, on data that
did not come from Supabase.

Probed in six states — populated, empty, loading (the skeleton), the Mark
Paid sheet, payment history EXPANDED and SMS history EXPANDED — at all four
phone widths. Violations, after the two fixes F18 and F22:

| State                | 320   | 360   | 390   | 430   |
| -------------------- | ----- | ----- | ----- | ----- |
| populated            | 0     | 0     | 0     | 0     |
| empty                | 0     | 0     | 0     | 0     |
| loading (skeleton)   | 0     | 0     | 0     | 0     |
| Mark Paid sheet      | 0     | 0     | 0     | 0     |
| payment history open | 0     | 0     | 0     | 0     |
| **SMS history open** | **2** | **2** | **2** | **1** |

Sizes, measured on the real component:

| What             | 320        | 390        | 1366   |
| ---------------- | ---------- | ---------- | ------ |
| placement        | fullscreen | fullscreen | center |
| Mark Paid button | —          | 175×44     | 89×32  |
| close control    | 44×44      | 44×44      | 24×24  |

**SMS history is the one state still failing**, its table 384 px wide against
every phone width. Not a regression — the deleted fork had no SMS history at
all — and §12 assigns it "`ListRow` list via tier hook" with Phase 9 owning
SMS and activity lists. Recorded rather than papered over: marking it
`data-scroll="x"` would invent a fourth sanctioned scroller, and §25.1
sanctions exactly two (`Tabs` lists, the bulk-import fallback).

**Section order, measured rather than asserted.** At 390 the column reads
identity → plan → status actions → photo → door access → payment history →
SMS history, with 24 px between every pair. At 1366 it reads photo →
identity → plan → status → access → SMS → payments — the DOM order, every
computed `order` 0. The DOM never changes, so a desktop screen reader walks
exactly what it walked before.

**The footer survives a short screen.** At 390×500 the sticky action bar sits
at 379–500, inside the viewport, with the body scrolling behind it. That is
the `dvh` composition holding up at the height the plan asks about (§11,
risk r07) — it is **not** a keyboard test, which still needs a real device.

**The Mark Paid sheet is flush with the bottom edge**: 844 of 844 at 390,
once the `pal-in` entry animation settles. Measured mid-animation it reads 5
px short, which is the animation's own `translateY` and not a layout defect —
worth recording because the first measurement said `anchoredToBottom: false`
and looked like one.

**Desktop 1366, compared on two freshly built trees.** The detail dialog and
its expanded payment history are **byte-identical** before and after the
branch. The first attempt produced that same answer for the wrong reason:
`next dev` had not recompiled after the checkout, so both captures were of
one build. It was caught by build markers that failed to flip — the close
control's phone class, the column's `phone:flex`, the delete `aria-label` —
and the re-run has all three `false` on the before tree and `true` on the
after. **A byte-identical screenshot pair is worthless without evidence that
the two sides were different builds**, and that evidence is cheap: assert one
DOM fact that differs between them and is invisible at the compared width.

**What this still does not cover:** a member with a photo, a long name, many
payments, or the §28 stress fixtures — the probe fixture carries one payment
and a two-word name (MO-15). The 1366 regression SUITE also did not run
(§6.1); the desktop evidence is the pair above plus the CSS-level proof in
the Phase 3 entry.

### 2.7 Phase 4 — Members and its forms, probed with the §28 fixtures

The first phase to probe a real SCREEN rather than a primitive or an overlay,
and the first to use the §28 stress content: a 29-character name, a 20-char
phone string, a 12,345,678 fee, 300 members. Still a temporary dev route with
an intercepted `/api/members` (the seeded gym is unreachable — §6.1), so the
component tree, the stylesheet and the browser are real and the data is not.

**Eight states × four widths, after the fixes below: 32 of 32 clean.**

| State                      | 320 | 360 | 390 | 430 |
| -------------------------- | --- | --- | --- | --- |
| list, populated            | 0   | 0   | 0   | 0   |
| list, §28 stress fixtures  | 0   | 0   | 0   | 0   |
| list, empty                | 0   | 0   | 0   | 0   |
| overflow menu open         | 0   | 0   | 0   | 0   |
| bulk-import guidance sheet | 0   | 0   | 0   | 0   |
| day pass sheet             | 0   | 0   | 0   | 0   |
| Add member, step 1         | 0   | 0   | 0   | 0   |
| Add member, step 2         | 0   | 0   | 0   | 0   |

**Before the fixes it was not clean, and the first run that said it was, lied.**
The probe page patched `window.fetch` in a `useEffect`; React Query fires the
list request during mount, before any effect runs, so roughly one run in three
the real endpoint answered 401 and the screen rendered its ERROR CARD. A card
has no rows, no links and no meta lines — so the probe reported zero
violations, and the reading "the list is clean at 320 and 390, including under
stress" was measuring nothing at all. Moving the interceptor to module scope
is what made the three real defects visible (F27, F28, F29).

**Where the overflow actually was: 390, and only 390.** At 320 and 360 the
`ListRow` value wraps below the primary column and hands the meta line the
full row width; at 430 there is room for both. 390 is the single width where
the value sits alongside and squeezes the line to 174 px against 199 px of
content. A three-width probe that skipped 360 and 430 would have found it;
one that checked only 320 would not.

**Desktop 1366: byte-identical**, before and after, on two freshly built
trees, with a marker that flips — `Pagination`'s `responsive` readout is
absent on the before tree and present (and `display: none`) on the after.
F23's rule applied from the start this time rather than after a wrong answer.

### 2.8 Phase 5 — Renewals, probed with 100 dues and "299 DAYS AGO"

Eight states × four widths, plus 1366. **33 of 33 clean.** The fixture is
§28's shape applied to this screen: 100 dues (50 expired, 50 within the week),
40 collected, the 29-character name and the 12,345,678 amount on every third
row, and `daysUntilDue` down to −299 so the expired badge reads its widest.
A temporary dev route with a module-scope interceptor — the F26 lesson applied
from the start, and the readiness wait asserts a row rather than "an `li`
exists", because the sidebar contributes hidden ones at phone widths.

| State                     | 320 | 360 | 390 | 430 | 1366 |
| ------------------------- | --- | --- | --- | --- | ---- |
| Expired tab               | 0   | 0   | 0   | 0   | 0    |
| Expires this week         | 0   | 0   | 0   | 0   | —    |
| Collected                 | 0   | 0   | 0   | 0   | —    |
| member detail, opened     | 0   | 0   | 0   | 0   | —    |
| **Confirm Payment sheet** | 0   | 0   | 0   | 0   | —    |
| loading (skeleton rows)   | 0   | 0   | 0   | 0   | —    |
| empty (all three tabs)    | 0   | 0   | 0   | 0   | —    |
| error (all three tabs)    | 0   | 0   | 0   | 0   | —    |

Interactive elements measured: 62 on a dues tab, 37 on Collected, 11 in the
detail overlay, 4 in the Confirm Payment sheet, 10 while loading (chrome only
— the five skeleton rows carry no controls). Bottom nav
`scrollWidth === clientWidth` at every width.

**The Confirm Payment sheet is MO-14's first `sheet` pass.** F18 fixed
`Modal`'s 24 px close control in Phase 3 and could not prove it: `fullscreen`
hides that control, and no phase since had opened a `sheet` under the probe.
Reaching it from this screen — Record payment → fullscreen detail → Mark Paid
— measures it for the first time. Full device width, bottom-anchored, top at
y 329 of 844 at 390; at **320 it rises to y 57**, which is the placement
running out of room rather than a defect, and nothing goes beyond the viewport
there either.

**The probe was falsified before its zeros were believed.** Reverting
`TabsList overflow="scroll"` to the default and re-running at 320 reproduced
the audit's defect exactly: the three labels with their count badges measure
**371 px**, the browser widened the layout viewport to 371 to fit them and
zoomed the page out (F5), and `Collected` sat at x 266.4 with a width of
104.5 — past the 320 px edge, outside any sanctioned scroller. Restored, and
the zeros came back. A probe that has not been shown failing on the defect it
exists to catch is a number, not a measurement.

**Desktop 1366 was NOT byte-identical on the first comparison, and the
difference was real.** 90 pixels on the Expired tab and 101 on Collected, all
on one row, `y = 156`, spanning exactly the width of the active tab — the
2 px underline rendering 1 px thin because `overflow-x-auto` had made the tab
list a scroll container at every width and clipped the pixel that hangs below
the trigger box. Fixed in the primitive (F30); after the fix both states are
byte-identical, with the marker (`[role=tablist]` `data-scroll`, `x` vs
`none`) proving the two sides were different builds.

### 2.9 Phase 6 — Dashboard and Revenue, probed with 99,999,999

Seven states × four phone widths, plus three desktop widths. **32 of 32 clean
on the phone tier**; the desktop tier's only violations are the inherited
six-digit axis clips (F1), which `compactAxis` does NOT remove there (F31).
The fixture is §28's shape applied to these two screens: a 99,999,999 payment
and a 12,345,678 plan amount in every KPI and every list, the 30-character
name `Wickramasinghe Arachchige Dona` as the first row of both lists, 1,024
and 128 as reminder and enrolment counts, and nine recent payments so the
six-row cap is exercised rather than assumed.

| State                | 320 | 360 | 390 | 430 | 768 | 1024 | 1366 |
| -------------------- | --- | --- | --- | --- | --- | ---- | ---- |
| Dashboard populated  | 0   | 0   | 0   | 0   | 4\* | 4\*  | 4\*  |
| Dashboard §28 stress | 0   | 0   | 0   | 0   | 4\* | 4\*  | 4\*  |
| Dashboard empty      | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| Dashboard error      | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| Revenue populated    | 0   | 0   | 0   | 0   | 4\* | 4\*  | 4\*  |
| Revenue §28 stress   | 0   | 0   | 0   | 0   | 4\* | 4\*  | 4\*  |
| Revenue empty        | 0   | 0   | 0   | 0   | 0   | 0    | 0    |

\* The four clipped y-axis ticks of F1, matching the `KNOWN_DESKTOP_VIOLATIONS`
pattern. Every other rule is clean at every desktop width. The empty and error
states render no chart, which is why they show 0.

Axis text, read from the DOM rather than from a screenshot: at 390 the ticks
are `0 · 200k · 400k · 600k · 800k`; at 1366 the same data gives
`0 · 200000 · 400000 · 600000 · 800000`, each clipped by 12 px. With the
stress fixture the phone reads `0 · 25M · 50M · 75M · 100M` and the desktop
`100000000` clipped by 30 px.

Interactive elements measured: 15 on the dashboard (four KPI tiles, six
payment rows, the AppBar avatar, four bottom-nav items), 7 on Revenue (two
selects plus the chrome — the breakdown rows are deliberately not interactive,
§9.4 lists no detail for them), 9 on the empty dashboard, 5 on the error
state. Bottom nav `scrollWidth === clientWidth` at every width.

**The probe was falsified before its zeros were believed.** `compactAxis`
forced to `false` and re-run at 390 reproduces the audit's defect exactly:
`axis tick "200000" clipped by -12px` on both screens, four ticks each.
Restored, and the zeros came back.

**Desktop 1366 byte-identical**, both screens, across two freshly built trees
with `.next` cleared on each side, with three build markers that flip:
`StatCard`'s `break-words` (absent → present), the dashboard's phone `ListRow`
count (0 → 8) and Revenue's phone share bars (0 → 4). The FIRST comparison
said the dashboard differed and that answer was wrong — see F34.

### 2.10 Phase 7 — Analytics, probed with 24 cohorts

Five states × four phone widths, plus three desktop widths. **24 of 24 clean
on the phone tier**, the fifth state being the 24-cohort list with **every row
expanded** — a probe only sees what something opened (§6.3), and a collapsed
disclosure renders nothing (F22).

| State                       | 320 | 360 | 390 | 430 | 768 | 1024 | 1366 |
| --------------------------- | --- | --- | --- | --- | --- | ---- | ---- |
| Analytics populated         | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| Analytics §28 stress (24)   | 0   | 0   | 0   | 0   | 2\* | 2\*  | 2\*  |
| Analytics empty             | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| Analytics error             | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| **All 24 cohorts expanded** | 0   | 0   | 0   | 0   | —   | —    | —    |

\* Two five-character y-axis ticks (`10500`, `14000`) clipped by 6 px — F1's
condition, inherited and not this phase's (see F35). Interactive elements
measured: 17 populated, 35 with 24 cohorts, 11 empty or in error. Bottom nav
`scrollWidth === clientWidth` at every width.

**The probe was falsified against the defect the phase exists to remove.**
Reverting the cohort section to render its matrix on the phone reproduces the
audit's finding almost exactly: the table measures **1,100 px inside a 358 px
container, 15 columns with 4 fully visible** (the audit recorded 1,093 px and
"3½ of 15"; the 7 px is this fixture's wider four-digit size column). Restored,
and the same state probes `beyond 0 · overflow 0 · touch 0/35`.

**Desktop 1366 byte-identical** on both states, across two freshly built trees
with `.next` cleared on each side, with three markers that flip: the range
group's `data-scroll` (absent → present), the phone cohort `ListRow` count
(0 → 6) and the phone metric control's tag (`none` → `SELECT`).

**Second pass — the labels the product actually emits.** The fixture above
labels the trend series `"Jan"…"Dec"`. `bucketLabel` emits `"Jan 26"` at month
granularity and `"01 Sep"` at day granularity; three characters is a format
this app never produces, and it is the format the outstanding ratchet entry
for this route is written against (F37). Re-probed at all seven widths with
labels generated by `bucketLabel` itself:

| Trend x labels    | 320 | 360 | 390 | 430 | 768 | 1024 | 1366 |
| ----------------- | --- | --- | --- | --- | --- | ---- | ---- |
| `Jan 26 … Dec 26` | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| 24-cohort stress  | 0   | 0   | 0   | 0   | 0   | 0    | 0    |
| `01 Sep … 30 Sep` | 1   | 1   | 1   | 1   | 1   | 1    | 1    |

The trailing `"Dec 26"` is rendered whole at every width — recharts thins the
strip to six ticks on a phone and prints all twelve at 1366, and the last one
is inside its surface in both cases. The day-granularity trailing tick
`"30 Sep"` overhangs its surface by **0.6 px, identically at every width**,
which makes it chart geometry rather than anything layout does. Neither is the
entry's condition (`"Mon YY"` clipped by 1 px), and neither is reachable by
the probe suite, which visits each route at its default range — YTD, months.

Rendered and looked at, not only measured: at 390 the axis reads
`Jan 26 · Mar 26 · May 26 · Jul 26 · Sep 26 · Dec 26` with nothing cut, above
a full-width series `Select` and cohort rows reading
`Jan 2025 · M1 93.7% · M3 81.1% · M6 — · 1,024 ›`.

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
8. **Added after the phase was first recorded as done.** Item 5's own §2.21
   entry was written with unescaped pipes inside a table cell and deleted two
   rules from the rendered rulebook (F17). Repaired, and the class of defect
   made a gate failure: **UI7** in `arch:check` — every body row in a markdown
   table under `.claude/**` or `docs/architecture/**` carries exactly as many
   cells as its header. 41 files, 171 tables. The stale `UI1–UI2` range in the
   script's section header was corrected to `UI1–UI7` in the same commit.

**Verification:**

- `type-check` clean · `lint` 0 errors (the same 11 pre-existing warnings) ·
  `arch:check` green · Jest **1,938 passed**, 7 skipped (49 new).
- Rendered at 320 and 390 and looked at; probe numbers and the desktop
  pixel comparison in §2.5.
- The repaired §2.21 row **rendered through a GFM renderer**, before and
  after — three cells, rule intact end to end. The source check and the
  render disagreed, which is the whole of F17.
- **Mutation-falsified** (five, each restored): moving Renewals off the bar
  fails 3 of 52; removing the capability filter fails 3 of 52; pointing the
  AppBar's Back at `router.back()` fails 1 of 20; restoring the unescaped
  pipe fails UI7; splitting on every pipe rather than unescaped ones makes
  UI7 report 10 correctly-escaped rows across four rulebooks.

**Known and deliberate:** the phone `AppBar` titles a settings section from
`SETTINGS_SECTIONS`, and any _other_ nested route falls back to its parent's
crumb. Only `/settings` has children today; a future nested route gets a true
but coarse title until it is named.

### Phase 3 — Member detail parity · **DONE** 2026-09-14

Branch `claude/mobile-ui-rebuild-p3`, cut from the Phase 2 head. **Deviation,
same one as Phase 2:** the prompt says to branch from `master`, which would
lose Phase 1's `Modal placement` and `useViewportTier` and Phase 2's shell —
everything this phase builds on. The stack is p0 → phase-1 → p2 → p3.

Scope: plan §10 "Required" and "Presentation on phone".

**Decisions the phase was asked to take:** none were open. §10 specifies the
placements, the order and the two accessibility fixes outright. Two judgment
calls arose inside that scope and are recorded below.

**Built (plan §10, in the migration order §10 gives):**

1. **Request fixtures first.** The six mutations — suspend, activate, cancel,
   markRegularPaid, reactivate, delete — pinned by method, URL, headers and
   parsed body, before the component was touched. The risk in merging two code
   paths is not a screen that fails to mount; it is a request that quietly
   changes shape. Deliberately literal: recomputing the expected amount with
   the same helper the component uses would agree with the component however
   wrong both were.
2. `MemberDetailModal` reads the tier: `fullscreen` on a phone, `center`
   otherwise, on both the skeleton and the detail. Sub-dialogs stay dialogs —
   delete `center` (explicit, though also the default), activate-with-date
   `sheet`, `MarkPaidDialog` and `ReactivationDialog` `sheet` set inside each
   component, since after this phase `MemberDetailModal` is the only caller of
   both.
3. **`MemberDetailModalMobile` (716 lines) and `MemberDetailModalResponsive`
   (61) deleted.** The wrapper switched on `window.innerWidth`, which §2.21
   bans, and it chose between implementations that had drifted: the fork had
   no `MarkPaidDialog` (it recorded a payment with no date choice), no SMS
   history, and no Radix dialog semantics, so Escape and hardware Back did
   nothing. Three missing features, not three styling differences.
4. Phone section order through `phone:order-*`, with the column becoming a
   flex column and `space-y-6` neutralised on phones only.
5. `aria-label` on the icon-only Delete and Edit.
6. **Out of the phase's stated scope:** the `Modal` close control, 24 × 24 on
   every `center` and `sheet` dialog on a phone. See F18.
7. **Payment history is a `ListRow` list on a phone** — a regression this
   phase introduced and then fixed. The deleted fork rendered payments as
   cards; the desktop component renders a four-column `Table`, and serving
   both tiers from it put 405 px on a 320 px screen. Found only by probing
   the EXPANDED disclosure. See F22.

**Decisions taken inside the scope:**

| Question                                                     | Answer                                                                   | Why                                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| How does `accessSlot` get an order when it has no element?   | It does not — the four blocks above it go **negative** and it stays at 0 | A wrapper would be a permanent empty child, and `MemberAccessPanel` renders null for every gym without the hardware: a 24 px gap from nothing. |
| How do `MemberPhotoSection` / `MemberSmsHistory` get theirs? | An optional `className`                                                  | Same reason. Each has exactly one production call site.                                                                                        |
| Fix the 24 px close control here, or leave it to Phase 8?    | **Fix it**                                                               | §15.1 is a standing invariant, the fix is desktop-inert, and the phase's own verification criterion is "probe green" (F18).                    |

**Verification:**

- `type-check` clean · `lint` 0 errors (the same pre-existing warnings) ·
  `arch:check` green · Jest **1,968 passed**, 7 skipped (**30 new**: 11
  request fixtures, 17 tier tests, 2 on the `Modal` close control).
- **Rendered in Chromium and looked at**, at 390×844, 390×500 and 1366×900 —
  numbers in §2.6, and the screens match the §26 blueprint.
- **Probe run over six states at four widths** — populated, empty, loading,
  the Mark Paid sheet, payment history open, SMS history open, at 320 / 360 /
  390 / 430. Five states clean after F18 and F22; **SMS history still fails**
  at every width and belongs to Phase 9 (MO-17). Numbers in §2.6.
- Escape closes the sheet and leaves the detail; Escape again closes the
  detail; hardware Back closes the detail with the URL unchanged. At 1366 Back
  does **not** close it — it leaves the page, which is `useHistoryBack`
  correctly declining to claim Back for a centred dialog.
- **Desktop equivalence, two ways.** At the CSS level the built stylesheet is
  byte-identical before and after the placement change (59,289 both), and all
  57 `.phone\:` selectors sit inside the single `@media (max-width: 767px)`
  block — 0 outside. At 1366 the detail dialog and its expanded payment
  history are byte-identical screenshots across two freshly built trees, with
  build markers proving the trees differed (F23). The regression SUITE still
  did not run (§6.1).
- **Mutation-falsified** (**fourteen**, each restored). Requests: dropping
  `deductOverduePeriod` fails 1; the inline unrounded arithmetic fails 1;
  `planType` on a renewal fails 1; deleting without the confirm fails 2.
  Tiers: Mark Paid skipping its dialog fails 1; a centred phone placement
  fails 2; removing the photo order fails 1; dropping the `aria-label` fails
  1; dropping `phone:space-y-0` fails 4. Layout, in the browser: dropping
  `phone:flex` reverts the order and zeroes the gaps; dropping
  `phone:space-y-0` gives 48/48/24/48/48/48. Primitive: removing the close
  sizing fails 2. Payment history: forcing the table back on a phone fails 2;
  dropping the discount from the meta line fails 1.

**Gate (§19): 8 of 10, and the two failures are deliberate.**

| Gate                   | Result | Why                                                                                                                                                                                                                                                                              |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| g1 composition         | pass   | Matches §26 at 320 and 390 by eye; probe-clean at all four widths.                                                                                                                                                                                                               |
| **g2 function intact** | **no** | The six request fixtures are green and four of them mutation-falsified — but §19 also requires the interaction checks to run **on the seeded E2E gym**. No credentials, so no mutation ever reached a real server. The wire format is proven; that the server accepts it is not. |
| g3 desktop             | pass   | 1366 byte-identical, both states, across two builds proven different (F23).                                                                                                                                                                                                      |
| **g4 phone verified**  | **no** | Five of six states clean at 320/360/390/430; **SMS history fails at every width** (MO-17). The §28 stress fixtures need the seeded gym regardless.                                                                                                                               |
| g5 automated           | pass   | type-check, lint, arch:check, test all green; both tiers exercised; 14 mutations falsified.                                                                                                                                                                                      |
| g6 rules               | pass   | No allow-list grew; token parity green; no composition breakpoint. This phase **removed the product's last `window.innerWidth`**.                                                                                                                                                |
| g7 no duplication      | pass   | One member detail component — the phase's entire purpose.                                                                                                                                                                                                                        |
| g8 scope               | pass   | Two changes beyond §10's remit (F18, F22), both logged here and in the PR rather than absorbed silently.                                                                                                                                                                         |
| g9 states              | pass   | Loading, empty, populated and both disclosures each rendered and probed.                                                                                                                                                                                                         |
| g10 docs               | pass   | `DESIGN_SYSTEM.md` and `architecture.md` §2.21 updated.                                                                                                                                                                                                                          |

A green gate was available by marking the SMS table `data-scroll="x"`. It was
not taken: see below.

**Known and deliberate:** two things ship imperfect and recorded rather than
quietly fixed.

- The `Modal` `description` ("View and manage member information") renders
  above the ordered column on a phone, because it is a sibling of that column
  inside the scroller, not a child of it. Desktop behaviour unchanged, outside
  the §10 CSS-only remit, and the §26 blueprint does not draw it (MO-16).
- **SMS history overflows every phone width.** §12 assigns it to a `ListRow`
  list and Phase 9 owns it; it is not a regression, because the fork had no
  SMS history at all. The alternative on offer was a `data-scroll="x"` marker,
  which would have made the probe green by inventing a sanctioned scroller the
  plan does not sanction — a worse outcome than a recorded defect (MO-17).

### Phase 4 — Members and member forms · **DONE** 2026-09-15

Branch `claude/mobile-ui-rebuild-p4`, cut from the Phase 3 head — the same
deviation as Phases 2 and 3, for the same reason. Stack: p0 → phase-1 → p2 →
p3 → p4. Scope: plan §8.2, §8.4–§8.8, §9.4, §14, §25.4.

**Decisions the phase was asked to take:** none open. `o05` (bulk import:
guidance sheet + labelled fallback) was already resolved and is implemented
as written.

**Built:**

1. **Members list.** Two toolbars, one per tier — a switched TREE, because
   they are not the same controls rearranged: the phone folds Day pass and
   Bulk import into a "⋯" menu and moves the record count beside the status
   filter, while the desktop keeps three buttons and the count in
   `PageHeader`. Row = `DataTable mobileRow` per §9.4. `Pagination
responsive`. Queries, params, server pagination and `openMember`
   untouched; the desktop suite's assertions were not edited.
2. **Add / Edit member** `fullscreen`; **Day pass** `sheet`, and its results
   are now `ListRow`s — §8.8's VERIFY resolved, the markup **was** hand-rolled
   (its own `<ul>`, its own `<button>`, its own two-line stack).
3. **Bulk import (§14).** The phone menu item opens a guidance sheet with the
   plan's copy verbatim, Copy link, and "Open the desktop grid here"; that
   opens the real grid `fullscreen` with a persistent phone-only `Alert` and
   `data-scroll="x"` on the table — one of exactly two places §25.1 sanctions
   that marker. Desktop opens the grid directly, unchanged.

**Beyond §10-style scope, each logged (g8):**

| Change                                        | Why it could not wait                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DataTableMobileRow.status` takes an array    | §9.3 wrote one column id; §8.2 needs badge + due from two the desktop must keep separately sortable (F25) |
| `DropdownMenu` items touch-height             | §8.2 asks for "touch items"; Phase 1 never sized this primitive (F18's blind spot again)                  |
| `ListRow` meta wraps when it holds an element | The probe cannot permit an ellipsis on a line containing a link (F27)                                     |
| Five checkboxes wrapped by their labels       | §15.1 puts the 44 px on the label, which needs it to WRAP the input (F28)                                 |

**Verification:**

- `type-check` clean · `lint` 0 errors · `arch:check` green · Jest **1,982
  passed**, 7 skipped (**14 new**, all phone-tier).
- **Probe: 32 of 32 clean**, eight states × four widths, with the §28
  fixtures. Numbers and the "before" in §2.7.
- **Rendered and looked at** at 320 (stress), 390 and 1366, plus the bulk
  guidance sheet — matches the §26 MEMBERS blueprint.
- **Desktop 1366 byte-identical**, marker-verified (§2.7).
- **Mutation-falsified** (five, each restored): the joined date creeping back
  into the row fails 1; dropping `due` off the status line fails 2; losing
  the `tel:` link's `data-inline-link` fails 1; the phone keeping the
  desktop's three buttons fails 3; the avatar rendering twice fails 1.

**Known and deliberate:** the Add-member consent labels contain links, so
tapping "privacy policy" both navigates and toggles the checkbox. That is
pre-existing — the label was already associated by `htmlFor` — and wrapping
did not change it. Recorded as MO-22 rather than fixed, because the fix is a
product decision about where consent links belong, not a layout one.

### Phase 5 — Renewals and payment dialogs · **DONE** 2026-09-15 · PR #76

Branch `claude/mobile-ui-rebuild-p5`, cut from the Phase 4 head. Stack: p0 →
phase-1 → p2 → p3 → p4 → p5. Scope: plan §8.10, §9.4, §25.4.

**Decisions the phase was asked to take:** none open. `o14` (no `intent: 'pay'`
option on `openMember`) was already resolved against; Record payment opens the
detail and nothing else.

**Pre-satisfied by earlier phases, verified rather than built:**
`MarkPaidDialog` and `ReactivationDialog` already carry `placement="sheet"`
from Phase 3; `DataTable` already passes `responsive={layout === 'list'}` to
its internal `Pagination`, so a page size is the whole of the compact control;
`Button size="xs"` already carries `phone:min-h-touch-sm` and `data-dense`.
Three of the phase's scope items needed a check, not a change.

**Built:**

1. **All three tables take a `mobileRow`**, so the phone renders `ListRow`s:
   name, the days-overdue badge (or the due DATE on the expires-this-week tab,
   from the same column id), the amount, both actions, avatar in the row's
   `leading` slot. The member cell drops its own avatar on that tier or it
   renders twice.
2. **Record payment first on a phone, and no wrapper** — `ListRow` lays its
   actions out as a wrapping flex row with §25.4's gap already, so a nested
   `inline-flex` only fights it. The desktop keeps Remind first and keeps its
   wrapper. This is the one deliberate ordering difference between the tiers:
   collecting money is the primary action on the screen whose job is
   collecting money (§8.10).
3. **`TabsList overflow="scroll"`** — `data-scroll="x"`, snap points, trailing
   fade. Three labels carrying count badges are 371 px and do not fit 320.
4. **`pageSize` 25 on the phone only.** The desktop stays unpaginated, which
   is today's behaviour there.

**Beyond scope, logged (g8):**

| Change                              | Why it could not wait                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `TabsList` scroller `phone:`-scoped | Renewals is the first product screen to use the variant, and it moved the desktop by a pixel (F30) |

**Verification:**

- `type-check` clean · `lint` 0 errors (11 warnings, all pre-existing) ·
  `arch:check` green · Jest **1,996 passed**, 7 skipped (**14 new**, all
  phone-tier; the desktop suite's 10 were not edited).
- **Probe: 33 of 33 clean**, eight states × four widths plus 1366, with the
  fixture in §2.8 — and the probe itself falsified first. The eighth state is
  the **Confirm Payment sheet**, reached from this screen, which is the first
  time any phase has measured a `sheet` with the probe (MO-14).
- **Behaviour asserted in the browser, not only in jsdom**: both actions start
  and end inside the viewport at every width; all three tabs reachable and
  `aria-selected` after a tap; Remind issues exactly ONE request and opens no
  dialog; Record payment opens a dialog measuring the full device width with
  **Mark Paid** in its footer; pagination shows exactly 25 rows per page and
  the first row changes on Next.
- **Rendered and looked at** at 320 and 390 across all three tabs, the empty
  state, the opened detail and the Confirm Payment sheet — matching the §26
  RENEWALS blueprint (tab strip with a scroll cue, sort control, avatar · name
  · amount, `● 299 DAYS AGO`, both actions, pagination, bottom nav). The one
  cosmetic difference is the sort control's label, `Sort: default` against the
  blueprint's `Sort [ Expired ▾ ]`; that string belongs to `DataTable` and
  Phase 4 shipped Members with it, so changing it here would fork a shared
  control for one screen.
- **Desktop 1366 byte-identical** after F30, marker-verified; the desktop test
  also pins the table, the Remind-first order and the absence of pagination.
- **Mutation-falsified** (six, each restored): the phone keeping the desktop
  action order fails 1; `overflow="fit"` tabs fails 1; no phone `pageSize`
  fails 2; the status column dropped from the row fails 2; the avatar rendered
  twice fails 1; the `TabsList` scroller made unconditional again fails 1.

**Measured, not assumed:** at 768 and 1024 the Renewals tab strip is 664 and
736 px inside its container with `overflow: visible`, so `phone:`-scoping the
scroller costs the tablet band nothing.

**Not verified, and saying so:** the AppBar title and the selected BottomNav
item were probed on a stand-in route (`/payments-probe`), which has no
`WORKSPACE_NAV` entry — so the AppBar rendered titleless there. `Renewals` is
a `bar` item in `nav.ts` and Phase 2 pinned that chrome, but this phase did
not see the real route's header. It needs the seeded gym, like the rest of
§6.1.

**CI — green, after a red check that was never this PR's and then stopped
appearing.** `Vercel – gym-management-saas` — the one project in
`team_Fl7rQYbRLMhzxU8bhXeMOE94`, and so the real deployment — has been green
on every head this branch has had. A second check, `Vercel –
gym-management-saas-ihsw`, was red on `f0333b4`, and was not this PR's:

- it was **red on the base branch too** (`claude/mobile-ui-rebuild-p4` at
  `91ea6aa`, a tree carrying none of this phase's commits);
- it **did not exist before #75** — PRs #71 and #74 have exactly one Vercel
  check and it passes. It first appeared at 2026-09-15 08:12, on #75 and
  #76, always `"Deployment failed."` with **no `target_url`**, so there was
  no build log to read;
- the project is **not in this repo's Vercel team**, so it could not be
  inspected or re-run from here.

Stood down with one comment on each PR naming the check and that evidence,
because no fix existed to port: nothing in this repository addresses a Vercel
project connection outside the team's configuration.

**Then the next push settled it, and settled it against what had just been
written here.** `0705ffb` — the commit carrying the paragraph above — took
**one** status, green, and the PR went to `mergeable_state: clean`. The
`-ihsw` check did not attach to that commit at all, and had not a minute or
five minutes later. #75 still shows it red only because its head has not
moved since 08:12; those statuses are pinned to `91ea6aa` and are not
re-evaluated.

The correction is the point. The first version of this paragraph, and MO-26
with it, said the check would read red on _every_ phase PR from #75 on until
someone with Vercel access cleared it — a claim about an external system's
future behaviour, drawn from two samples an hour apart, disproved by the
third sample within the hour. Two observations of a flaky integration
support "it happened twice", not "it will keep happening". Recorded as
MO-26, now describing what was observed rather than what it would do next.

Two check-ins since (09:16 and 10:16 UTC) found **no change** on either PR:
same statuses on the same head commits, no review threads, `mergeable_state`
`unstable` from CI rather than a conflict. Per the drive-to-green rules that
is a re-arm, not a second comment. Also established while checking: the repo
has **no `.claude/skills/` directory**, so there is no `steward` or `babysit`
guidance to defer to, and it does **not** run the `Claude Approvals` check —
the only check run on either PR is `Vercel Preview Comments`.

### Phase 6 — Dashboard and Revenue · **DONE** 2026-09-15

Branch `claude/mobile-ui-rebuild-p6`, cut from `master` at `b62e85b` — the
first phase whose base is `master` rather than the previous phase's head,
because Phases 0–5 are all merged. Scope: plan §8.1, §8.11, §9.2, §9.4, §12,
§25.4, §26.

**Pre-satisfied by earlier phases, verified rather than built:** `PageHeader`
already carries `phone:sr-only` on its `<h1>` from Phase 2, so "title hidden,
timestamp as the first content row" needed a check, not a change; `ListRow`
already joins a plain-text meta line to one text node (F10) and wraps one
holding an element (F27); `Charts` already carries `compactAxis` from Phase 1.

**Built:**

1. **`compactAxis` on the phone tier**, on both `BarChart`s. At 390 the ticks
   read `200k … 800k` instead of losing their leading digits to a 40 px axis.
2. **Recent payments render `ListRow`s on the phone**, `Table` on the desktop
   (§12 category A): name and the NEW badge on the primary line, amount
   trailing, "plan · date" disclosed, and the row opens the member detail —
   which is §9.4's listed home for everything else. `memberId` was already in
   the endpoint's payload; the screen's local interface had simply never
   named it.
3. **The reminder queue renders `ListRow`s on the phone**: name and amount
   visible, "reminder type · when" disclosed.
4. **Revenue's month/year selects** are `PageHeader` actions on the desktop
   and a `grid-cols-2` first content row on the phone (§25.4). Never both:
   `PageHeader`'s `<h1>` is `sr-only` at that tier, so passing them twice
   renders two month selects — the trap Phase 4 recorded on the Members
   record count.
5. **The breakdown renders `ListRow`s on the phone** with "N members ·
   N payments" disclosed and a 2 px `Progress` share bar on the row's last
   line.

**THREE SCOPE EXCEPTIONS AND ONE CORRECTION, all logged (g8):**

| Change                                          | Why                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Reminder queue converted on the phone tier ONLY | §8.1 says "reminder queue as `ListRow`s" without naming a tier; converting the desktop moves its baseline |
| The share bar rides `ListRow`'s `actions` slot  | §25.4 asks for a bottom `Progress`; §9.1's anatomy has no other slot below the meta line                  |
| `StatCard` value gains `break-words`            | §27 "Large money", and the §28 fixture overflowed the page without it (F33)                               |
| `capitalise` uppercases after a hyphen          | The desktop cell's CSS `capitalize` prints `6-Months`; `charAt(0)` alone printed `6-months`               |

**GATE — 8 of 10, and the two failures are the same two Phases 4 and 5
recorded, for the same reason:**

**g2 FALSE** — §19 wants the phase's interaction checks run on the seeded E2E
gym. No Supabase credentials. This phase writes nothing, so there is no
mutation to verify; what is unverified is that the four endpoints shape their
responses the way the fixtures assume, and that `openMember` reaches a real
member. Both were driven against an interceptor.

**g4 FALSE** — the probe is 32/32 clean on the phone tier at 320/360/390/430
across seven states, and the §28 content was REPRODUCED on an interceptor
rather than seeded through the app's APIs (MO-23, now three phases deep).

**g1 TRUE** — matches the §26 DASHBOARD and REVENUE blueprints at 320 and 390
by eye: timestamp as a mono caption under the app bar, 2×2 KPI band, compact
chart, two-line queue rows with a trailing amount, avatar · name · NEW ·
amount payment rows, the two-column select row, and breakdown rows with their
share bar. §26's above-the-fold rule holds at 390 — the band, the chart and
the first two queue rows are all above 730 px. Two caveats, both recorded
below: the AppBar rendered titleless on the probe route (MO-25, same as Phase
5), and the browser had no Geist until this phase wired the bundled files in
(F32).

**g3 TRUE** — 1366 byte-identical on both screens across two freshly built
trees, markers flipping. `break-words` is therefore genuinely inert at the
desktop tier, measured rather than asserted (MO-24).

**g9 TRUE** — populated, §28-stress, empty and error all rendered and probed;
loading was rendered but not probed as a separate row, because these two
screens have no skeleton list of their own (the chart is a `Skeleton` and the
KPI values are "—").

**g6 TRUE** — no allow-list grew; token parity green; no `sm:`/`md:`/`lg:`
composition switch; no `window.innerWidth`.

**Verified:** type-check clean; lint 0 errors (11 pre-existing warnings);
arch:check green; Jest **2,026 passed** / 7 skipped (**29 new** — 15 dashboard
phone, 12 revenue phone, 2 `StatCard`; the two desktop suites' 34 assertions
were not edited); **eleven mutations falsified** — `compactAxis` off on each
screen, the queue's meta line split into elements, the payments row made
inert, either list left as a `Table` on the phone, the NEW badge moved to the
status slot, the share bar dropped, the selects passed on both tiers, the
`break-words` class removed, and `charAt(0)` restored.

**Not verified, and saying so:** the AppBar title and the selected BottomNav
item on the real routes. The probe route has no `WORKSPACE_NAV` entry, so its
AppBar rendered titleless — the same gap as MO-25. `appBarTitle('/dashboard')`
returning `Overview` is pinned by Phase 2's `nav.test.ts`; the rendered
pairing is not.

#### After the PR — six days open, and what the wait cost

PR #77 opened 2026-09-15 18:07 UTC and sat unreviewed until 2026-09-22.
Eleven check-ins across that window found no change: no reviews, no review
comments, no push, `updated_at` frozen. The record is kept because the wait
produced two things worth having.

**`Vercel – gym-management-saas-ihsw` was red on the first head, and this
phase finally got its error string.** Phase 5 could only establish what it was
NOT (red on a tree carrying none of its commits, on a project outside the
team, no `target_url`, no build log). Here the `vercel[bot]` comment arrived
seconds behind the status and named the cause: `The provided GitHub repository
can't be found.` So it is a Vercel project whose GitHub link is broken, not a
build of this code — which explains both the missing log and the real
project's success on the same commit. Confirmed from the account rather than
inferred: one team, one project in it (`gym-management-saas`), and
`get_project` for `gym-management-saas-ihsw` under that team answers **404**.
Two comments on the PR, and MO-26 rewritten from "no build log to read" to the
cause.

**The base moved under a green head.** By 2026-09-22 `master` had advanced to
`e9d9656` — Google Analytics tags in `src/app/layout.tsx` and the matching
privacy-policy text. No overlap with this branch's nine files, and GitHub
reported `mergeable: true` throughout, so nothing looked wrong. But the PR's
green head had only ever been built against `b62e85b`: **no CI anywhere had
run the merged tree.** `master` was merged in as `da85405` and the whole gate
re-run on the result — type-check clean, lint 0 errors, `arch:check` green,
Jest 2,026 passed / 7 skipped, Vercel green on the new head, `mergeable_state`
clean. It passed; the point is that until it ran, nobody knew.

Phase 6 was then closed by merging #77 to `master` on the user's instruction.

### Phase 7 — Analytics · **DONE** 2026-09-23

Branch `claude/mobile-ui-rebuild-p7`, cut from `master` at `52ea895`. **The
first phase in the rebuild that neither stacks nor deviates**: Phases 0–6 are
all merged, so the plan's own precondition ("a phase starts only after the
previous one's branch is merged to `master`") is satisfied for the first time
since Phase 0. Scope: plan §13, §12 (C-alt), §8.12, §25.4, §26.

**The prompt's VERIFY, answered three ways before any code was written:**

1. **Passes.** `CohortRetentionRow` already exposes `retention: (number |
null)[]` per cohort, 13 entries (`COHORT_RETENTION_MAX_MONTHS` = 12, k =
   0…4). No data reshaping in the component.
2. **Fails, and not the way the prompt expected.** The cohort grid is a plain
   hand-built `Table` with a dynamic M0…M12 column count. It is not a
   `DataTable` at all.
3. **Fails harder.** `DataTable`'s list path does not implement
   `renderExpanded` — `renderList()` references it zero times. Expansion exists
   only on the TABLE path, which is the desktop, which keeps its table and
   does not need it.

AMENDMENT raised (F36) and the alternative §27 already names — local state —
used instead.

**Built:**

1. **Cohort matrix → condensed `ListRow`s on the phone** (§12 C-alt): cohort
   month, size, and the M1/M3/M6 milestones with "—" for a month the cohort
   has not reached. Tapping a row reveals the full M0–M12 series as a wrapping
   mono list in the row's last line — the `actions` slot, the same one Phase 6
   gave the revenue share bar. Desktop keeps its matrix.
2. **Series control → native `Select` on the phone**, segmented group above
   `tablet`. One `metric` state variable; a switched tree, not a restyled
   control.
3. **Range strip snap-scrolls on the phone** instead of wrapping, so it stays
   put rather than pushing the KPI band down the screen. `phone:`-scoped, with
   `data-scroll="x"` — a scroller §13 and §25.4 both ask for explicitly, unlike
   the one Phase 3 refused to invent for SMS history.
4. **All three charts take `compactAxis` on the phone tier**, at §26's heights
   (trend 180, YoY and at-risk 160). Desktop keeps 240/200/180.

**THREE FINDINGS, two of them about my own fixture (g8):**

| Finding | What                                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| F35     | A money fixture fed to a count chart manufactures a defect the product cannot reach                                         |
| F36     | §13 names an API that exists on the wrong path of the wrong component                                                       |
| F37     | The fixture's x-axis labels were not a format this app emits, so a ratchet entry assigned to this phase was never exercised |

**The one ratchet entry this phase owned is re-pointed, on a measurement.**
`KNOWN_DESKTOP_VIOLATIONS` carried `/member-analytics`, "the trailing x-axis
label overshoots the chart by a pixel", `clears: 'Phase 7'` — written by Phase
0 against the real route. The first probe pass could not have exercised it:
its labels were bare `"Jan"`, and the entry's pattern needs `"Mon YY"`. A
second pass, with labels generated by the product's own `bucketLabel`, was run
across all seven widths — see §2.10. It is re-pointed to Phase 10 with that
measurement written into the file, beside the two y-tick entries Phase 6 sent
there for the same reason: every fix moves a baseline this environment cannot
re-take.

**GATE — 8 of 10, the two failures the same two Phases 4–6 recorded:**

**g2 FALSE** — §19 wants the interaction checks on the seeded E2E gym. No
Supabase credentials. This screen writes nothing, so there is no mutation to
verify; what is unverified is that `/api/analytics/members` shapes its response
the way the fixture assumes.

**g4 FALSE** — the probe is 24/24 clean on the phone tier across five states,
and the content was REPRODUCED on an interceptor rather than seeded (MO-23,
now four phases deep). The 24-cohort fixture also exceeds what the service can
return: `COHORT_RETENTION_MAX_COHORTS` is **12**. The prompt asked for 24, the
layout survives 24, and no real gym will see more than 12.

**g1 TRUE** — matches the §26 ANALYTICS blueprint at 320 and 390 by eye: the
range row, the 2×2 KPI band, a full-width series `Select`, the three charts,
and cohort rows reading `Apr 2026 · M1 93.7% · M3 81.1% · M6 — · 1,024 ›` that
expand to the full wrapping series.

**g3 TRUE** — 1366 byte-identical on both states, three markers flipping.

**g9 TRUE** — populated, §28-stress, empty, error AND the expanded disclosure
all rendered and probed.

**g6 TRUE** — no allow-list grew; token parity green; no `sm:`/`md:`/`lg:`
composition switch; no `window.innerWidth`.

**Verified:** type-check clean; lint 0 errors (11 pre-existing warnings);
`arch:check` green; Jest **2,143 passed** / 7 skipped (**12 new**, all
phone-tier; the desktop suite's 12 assertions were not edited); **eight
mutations falsified** — the expanded series truncated, the milestones moved off
M1/M3/M6, a missing month rendered `0%` instead of a dash, either control left
in its desktop form, `compactAxis` off, the range scroller left unscoped, and
its `data-scroll` marker dropped.

**Not verified, and saying so:** the same three as Phase 6 — the AppBar title
on the real route (MO-25), the fixtures seeded rather than intercepted
(MO-23), and whether a real gym's analytics ever reaches the widths measured
here.

**PR [#78](https://github.com/metric-gym-manager/metric-gym-manager/pull/78)
opened against `master`** at head `02a3ae7`, base `52ea895` — which is still
`master`'s tip, so unlike Phase 6 there is no un-gated merged tree here yet
(§6.3). Two checks attach and one is red:

| Check                               | Result on `02a3ae7`                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| `Vercel – gym-management-saas`      | success — `Deployment has completed`                       |
| `Vercel – gym-management-saas-ihsw` | failure — `The provided GitHub repository can't be found.` |

The red one is MO-26, on its fourth PR. Stood down rather than fixed, with
the check re-run against the account on THIS head rather than recycled from
Phase 6's note: `get_project` for `gym-management-saas-ihsw` under
`team_Fl7rQYbRLMhzxU8bhXeMOE94` still answers **404**, so the project cannot
be inspected or re-run from here, and the real project deployed the same
commit. One comment posted on the PR saying exactly that. **No forecast
attached** — §6.3's standing item is that two observations of a flaky external
support "it happened twice", not "it will keep happening", and Phase 6 learned
that by predicting and being disproved within the hour.

Nothing else was open at the close: no merge conflict (`mergeable_state:
unstable` is that one red check), no review threads, and this repository runs
no Claude Approvals check.

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
not, so that one token became four phantom columns.

The source damage is visible: Prettier re-padded the row around those
boundaries and closed up the spacing between the inline code spans on either
side, leaving a band of whitespace with a fragment at each end.

```
`sm: | md:            | lg: | max-tablet:`are banned in`components/workspace`
```

The **rendered** damage is worse, and is the reason this is a finding rather
than a typo. A GFM renderer discards cells past the header's column count, so
on the page the row is still three cells — and they are:

| cell        | content                                                               |
| ----------- | --------------------------------------------------------------------- |
| `#`         | `2.21`                                                                |
| `Rule`      | …the rule, cut off mid-sentence at `` `sm: `` on an unclosed backtick |
| `Reference` | `md:`                                                                 |

Everything after that was **deleted from the document**: the `lg:`/
`max-tablet:` ban, the `arch:check` UI6 note and its empty allow-list, the
whole `/terms`, `/privacy`, `/refund-policy`, `/contact` `PUBLIC_ROUTES`
sentence, and the Reference column's two links. Two rules gone, not one
sentence mangled — and a reader has no signal that anything is missing,
because the row still looks like a row.

The same edit escaped `` `center`\|`sheet`\|`fullscreen` `` correctly three
sentences earlier, so knowing the rule was not enough — the pipes have to be
escaped **every** time, and the Pattern Index is a 22-row table where every
rule is one wide cell.

Nothing could catch it: `arch:check`, ESLint, `tsc`, Prettier and all 1,938
tests were green with two rules deleted, because the file is prose to all of
them. Prettier in particular _caused_ the source mangling and then reported
the result as correctly formatted.

Two checks do work, and neither is reading the diff:

1. Split each row on unescaped pipes and count — every body row carries as
   many cells as its header. This is now **`arch:check` UI7**, over
   `.claude/**` and `docs/architecture/**`: 41 files, 171 tables. It is
   arithmetic, so it costs nothing and cannot drift.
2. **Render it.** The source check finds the split; only the renderer shows
   what a reader actually loses, and here the two gave different answers —
   the source looked mangled, the render was missing two rules. The
   Verification Directives say to render a UI change before claiming it
   works; a rulebook is no different.

Fixed by escaping (`` `sm:`\|`md:`\|`lg:`\|`max-tablet:` ``); the row now
renders as three cells with the rule intact end to end, confirmed through a
GFM renderer against both the broken and the fixed file.

**UI7, falsified.** Restoring the unescaped pipe fails it (`row has 6 cells
but the header has 3`) and the fix clears it. Its escape-awareness is
load-bearing, not decoration: splitting on _every_ pipe instead of unescaped
ones reports 10 correctly-escaped rows across four rulebooks as ragged. Its
fenced-block skip is defensive only — nothing in the scanned set puts a table
inside a fence today (verified: zero fenced lines start with a pipe), and the
comment in the script says so rather than implying it was proven.

**What UI7 does not do:** it counts cells. A rule can still be wrong, stale,
or contradict another rule, and no gate in this repo can tell. It closes
exactly one hole — text silently vanishing from a file every session loads.

### F18 — Two of three close controls were sized, and the third hid the miss

Phase 1 gave the fullscreen `Modal`'s Back control a 44 px box and the
`Drawer`'s close a 44 px box, and each has a test saying so. The `Modal`'s own
trailing × was left at **24 × 24** — a 16 px glyph in 4 px of padding — which
is under even the probe's 40 px floor.

That is every `center` and every `sheet` dialog in the product: every
confirmation, every form dialog, a close button a thumb cannot reliably hit.

It survived three phases for a precise reason: `fullscreen` **hides** this
control, and `fullscreen` was the only placement any phase had probed **with a
dialog open**. A closed dialog renders nothing to measure, and the design-
system showcase's modals are closed. Phase 3 opened a sheet — and the probe
named it on the first run, at both 320 and 390.

Fixed at 44 rather than 40: it stands in for the Back control at the other
placement and should match it, and a close button is not a dense control. Six
`phone:`-scoped classes, all six compiling inside the single phone media
query; measured at 44 × 44 at 390 and still 24 × 24 at 1366.

**The lesson is about the probe, not the pixel.** An overlay contributes
nothing to a probe run unless something opens it first. Every later phase that
introduces a sheet or a dialog needs a probe pass with it OPEN, or the rule is
being checked against an empty region.

### F19 — `space-y` and `order` disagree about which siblings are adjacent

`space-y-6` compiles to `> :not([hidden]) ~ :not([hidden]) { margin-top }` —
a **DOM**-order rule. `order` changes the **visual** order and nothing else.
Put together they do not compose: the margin lands above whichever block is
DOM-second, which after reordering is not the block that is visually second.

Measured in Chromium on the real column: 48 / 48 / 24 / 48 / 48 / 48 px
instead of six 24s — a doubled gap above five boundaries and a single one in
the middle, from a class that looks entirely innocent in the diff. jsdom
computes no geometry, so no unit test in this repo could have seen it.

The fix is `phone:gap-6` with `phone:space-y-0`, which measures between what
the reader actually sees. Any later phase that adds `order` to a `space-y`
column inherits this exactly.

### F20 — A new section with no order class lands in the middle, not at the end

The corollary of the negative-order scheme in §10 step 5, and the reason the
scheme is commented where it is used. Because `accessSlot` sits at the default
`order: 0` with four blocks pulled negative above it, a section added later
with **no** order class also sits at 0 — and lands beside the door-access
slot, fifth or sixth, not last.

Measured, not predicted: an appended block with no class rendered between
access and payments.

The alternative was a wrapper around `accessSlot`, which is worse: it renders
a permanent empty child for every gym whose `MemberAccessPanel` returns null,
and an empty child in a gapped column is a 24 px hole from nothing.

### F21 — An entry animation makes a layout measurement lie

The Mark Paid sheet measured `bottom: 837` against an 844 px viewport — 7 px
short of the bottom edge it is anchored to — and the first reading of that was
"the sheet is not flush". It was: `animate-pal-in` was still running and its
`translateY` had 5 px left to go. Settled, it is 844 of 844.

Recorded because the false reading is indistinguishable from a real
positioning defect, and because the repair is one line: wait for the animation
before measuring, not for the selector.

### F22 — "Minimal parity change" assumed a superset, and one block was not

§10's premise is that `MemberDetailModal` does everything
`MemberDetailModalMobile` did and more, so deleting the fork can only add.
For payment history that was false. The fork rendered payments as **cards**;
the desktop component renders a four-column `<Table>`. Serving both tiers
from the desktop component put a 405 px table on a 320 px screen and pushed
the overlay's own scroller to 438 px — a regression, introduced by the phase
whose stated purpose was parity.

It hid twice over. The disclosure is collapsed by default, so the earlier
probe runs and every screenshot measured a region that rendered **nothing**;
and the phase's scope language ("CSS / props only") invited reading the block
as untouched when in fact it had been swapped wholesale.

Fixed with `ListRow` on the phone tier — §12's category-A treatment, which
every comparable table in the plan gets — table on desktop, chosen by the
tier hook the component already reads. No cell is dropped.

**The check that would have caught it earlier is a list, not a rule:** before
declaring a screen probed, enumerate its disclosures, its empty state, its
loading state and its sub-dialogs, and probe each. Four of those five states
were clean; the fifth was the defect.

### F23 — A byte-identical screenshot pair can mean nothing at all

The 1366 before/after comparison returned "byte-identical" on its first run
and was wrong: `next dev` had not recompiled after the tree was switched, so
both captures were of the same build. The answer a correct run gives and the
answer a broken run gives are the same string.

Caught by build markers — three DOM facts that differ between the two trees
and are invisible at 1366 (the close control's phone class, the detail
column's `phone:flex`, the delete `aria-label`). On the first run they were
`true` on both sides, which is impossible for a genuine comparison. On the
re-run, with the server restarted and `.next` cleared on each side, they read
`false` then `true` and the identical pixels mean what they claim.

Two mistakes fed it: `git stash` does not revert **committed** work, and the
phase's source changes were four commits old by then — the tree never
changed on the first attempt. `git checkout <base> -- <files>` is the
operation that was wanted.

Every later phase makes this comparison. Assert a marker, or do not claim the
result.

### F24 — A checking script reported a catastrophe, and the script was wrong

Verifying that the placement change could not move the desktop, a hand-written
scan of the built stylesheet reported **56 of 57 `.phone\:` selectors sitting
outside any media query** — which, if true, would mean every phone rule in the
product applies at every width and three phases of "desktop pixel-equivalent"
were false.

It was the script. Its brace accounting popped the media-query stack on each
rule's closing `}` instead of the block's, so every selector after the first
rule read as top-level. The correct answer is **0 outside**: all 57 sit inside
the single `@media (max-width: 767px)` block, which a byte-range scan of the
block confirms.

Two things worth keeping from it.

**The prior should have been the script.** A result implying that a core
invariant had been broken for three phases, in a codebase whose gate is green
and whose desktop was screenshot-compared twice, is far more likely to be a
bug in the five-minute script than a bug in the product. The reflex to check
the instrument first is the whole of it.

**A measurement tool needs falsifying like a test does.** F23 is the same
mistake in the other direction — there a broken tool said "identical" and the
right answer was also "identical", so nothing looked wrong. Here a broken tool
said "catastrophe" and the right answer was "fine". Both were caught only by
asking what the tool would report if it were broken:

- A comparison tool: assert a marker that MUST differ between the two sides.
- A scanning tool: check its count against a second method that shares no
  code with the first.

Neither check costs more than a minute, and between them they are the
difference between a measurement and a number.

### F25 — The plan's own two sections disagreed about one API

§9.3 specifies `mobileRow.status` as a single column id. §8.2 specifies the
Members status line as "status badge + due" — two columns, which the desktop
table must keep as two separately sortable ones. Both are the approved plan.

Widened `status` to `string | string[]`, matching `meta`, which had the shape
already. The alternative was a combined column the desktop would have to
hide, and `DataTable` has no hiding mechanism — adding one to satisfy a
mapping would have been the larger change.

Second instance of the same class as MO-18 (§12's table inventory missing the
member-detail payment history). **An approved plan is not internally
consistent merely because it was approved**, and the phase that first
implements a cross-section requirement is where the disagreement surfaces.

### F26 — A probe that measures an error card reports zero violations

The Phase 4 probe page patched `window.fetch` inside a `useEffect`. React
Query fires its request during mount, before any effect runs, so about one
run in three the real endpoint answered 401 and the screen rendered its error
state. An error card has no rows, no links and no meta lines — nothing the
touch and overflow rules apply to — so the probe reported **clean**, and that
reading was written down and reported as a result.

It was wrong. Moving the interceptor to module scope turned the same eight
states from "clean" into three real defects (F27, F28 and the `tel:` line
box), every one of which had been present the whole time.

This is F23 arriving from the other direction. There a broken comparison said
"identical" and the truth was also identical, so nothing looked wrong. Here a
broken fixture said "clean" and the truth was three defects. The shared
lesson is narrow and worth stating plainly: **a green probe is only evidence
if you know what it measured.** Assert the subject exists — row count, a
known name, the absence of the error state — before believing a zero.

### F27 — `truncate` and an inline element cannot coexist under the probe

`ListRow`'s meta line truncates with an ellipsis, which probe rule 9 permits
**only** for an element holding nothing but text. §9.4 asks Members to put
the phone number there as a `tel:` link. So the line that §9.4 specifies can
never satisfy rule 9, and any overflow on it is rule 3 — a silent clip.

F10 recorded the same collision in Phase 1 at the level of a separator span.
The general form is now in the primitive: **a meta line of plain text
truncates; a meta line holding an element wraps.** A caller who chooses a
richer line gets a second line rather than a cut.

Found at **390 and nowhere else** — at 320 and 360 the value wraps below the
primary column and the line gets the full row; at 430 both fit. A phase that
probed one phone width would have called this clean.

### F28 — `htmlFor` is not a hit area

Five checkboxes across Add and Edit member sat as siblings of their labels,
associated by `htmlFor`. Clicking the label toggles the box, so the behaviour
was right and the geometry was not: the probe measures a control's
`closest('label')`, and with no wrapping label it measured a bare 24 × 24
checkbox against §15.1's 40 px floor.

The rule as written — "a checkbox or radio is 24 px inside a 44 px label" —
already said this. What it did not say is that the label has to **contain**
the input for the 24 px to be inside anything. Fixed at the pattern level
across both forms rather than on the single checkbox the probe reached first,
because the other four were one step of a wizard away from the same report.

### F29 — `leading-6` does not resize an inline element

Three inline links failed §15.1's 24 px line-box minimum (WCAG 2.5.8): the
members row's `tel:` link at 13 px, and Add member's two consent links at 15.
The obvious fix — `leading-6` — changed nothing, twice, and the probe
returned the identical measurement.

`line-height` sizes the line box of the **containing block**;
`getBoundingClientRect` on an **inline** element returns a box derived from
the font metrics, which line-height does not enter. `inline-block` is what
makes the element own its height. Both halves are needed, and the class list
now says so at each of the three sites, because the next person will reach
for `leading-6` alone as well.

### F30 — A scroll container clips the underline it was given to hold

`TabsList overflow="scroll"` (built in Phase 1, first used on a product screen
in Phase 5) applied `overflow-x-auto` at every width. On a phone that is the
point. On a desktop, where the strip fits and nothing scrolls, it looked
inert — and was not.

`overflow` other than `visible` establishes a scroll container, and a scroll
container clips whatever sits outside its padding box. The active trigger's
underline is `after:-bottom-px h-0.5`: a 2 px rule positioned 1 px BELOW the
trigger, so it covers the list's own bottom border rather than sitting on top
of it. That 1 px is outside the list's padding box. The desktop underline
rendered 1 px thin.

Ninety pixels on one row of one screenshot. Nothing else in the gate could see
it: `tsc`, ESLint, `arch:check`, Prettier and 1,995 passing tests were all
green, the render test asserted `data-scroll="x"` and the class was present,
and at 390 the fix and the defect look the same because the strip scrolls
either way. Only the 1366 comparison, with a marker proving the two sides were
different builds (F23), could produce the number.

Two things worth keeping.

**"Inert on the desktop" is a claim about computed style, not about intent.**
`overflow-x-auto` on a row that does not overflow changes no layout, paints no
scrollbar and moves nothing — and still changed what the box clips. The plan's
rule is "`phone:`-scoped OR inert", and the cheap way to satisfy it is to
scope, because deciding a property is inert requires knowing every side effect
it has.

**A variant built in one phase and first used three phases later has never
been measured.** The showcase exercised `overflow="scroll"` from Phase 1, but
the showcase is a dev route nobody compares at 1366. The defect shipped the
moment a product screen used it, which is also the moment it was caught —
so the rule is that the FIRST product use of an existing variant gets the
same before/after comparison a new component would.

The test now asserts the scoped class and the ABSENCE of the bare one; the
bare string put back fails it.

### F31 — `compactAxis` on the phone does not clear the desktop's ratchet entries

`KNOWN_DESKTOP_VIOLATIONS` carried two entries for the six-digit axis clip
with `clears: 'Phase 6'` and a note saying the phase that applies `compactAxis`
"deletes these two entries in the same commit". Phase 6 applied it, and the
entries still match: at 1366 both charts still render `200000 … 800000`, each
clipped by 12 px, and with the §28 fixture `100000000` clipped by 30.

The note assumed the fix was tier-neutral. It is not: `compactAxis` changes
the tick **text**, so switching it on at the desktop tier changes what
`dashboard-desktop-1366.png` and `revenue-desktop-1366.png` contain. That is
the same MO-4 objection which stopped Phase 1 making it the default, and it is
a re-baseline, not a screen rebuild. Both the plan (§5.9, "screens pass it
under the phone tier") and §8.1/§8.11 scope it to the phone, so following the
plan and clearing the entries were never the same action.

Entries re-pointed at the sweep phase, which owns the baselines, with the
reasoning written into the file so the next reader does not re-derive it.

_Lesson:_ a ratchet entry's `clears:` field is a **prediction**, and the phase
it names is the first one able to test it. Phase 0 could not know that the fix
would be tier-scoped, because §5.9 offered two implementations — widen the
axis, or shorten the label — and only one of them is invisible at 1366.

### F32 — The browser pass ran in the wrong typeface until the bundled fonts were wired in

`fonts.googleapis.com` is denied by this environment's network policy: the
proxy answers `403` to `CONNECT`, `next/font/google` logs "Failed to download
Inter from Google Fonts. Using a fallback font instead", and the page renders
in a system face. Every width the probe measures is then the wrong font's —
and the rules that depend on it are rules 2, 3, 8 and 9 plus §15.1's inline
line box, which is most of the probe.

Fixed for the run by pointing `next/font/local` at the Geist `.woff` files the
repo already bundles for the QR poster (`src/features/registration/assets/
fonts/`): 400, 600, 700 and Mono 400/500 are all there; only Geist 500 is
absent and falls back to 400, which is what CSS font-matching would do anyway.
Reverted with the rest of the probe scaffolding.

Two things follow. **The numbers in this section were measured in Geist**;
without the swap they would have been measured in whatever DejaVu the image
ships. And it is an open question whether the earlier phases' browser numbers
were — nothing in their records says either way, and this session cannot
determine what network policy those sessions ran under. Recorded as MO-27
rather than asserted in either direction.

### F33 — "KPI band unchanged" and the §28 fixture cannot both hold

Both §8.1 and §8.11 say the KPI band is unchanged, and §28's
`payment 99,999,999` fixture says it validates "value column width; **KPI
wrap**; breakdown". At 320 the figure renders 144 px in a 111 px tile, the
page overflowed by one pixel, and mobile Chromium answered by widening the
layout viewport to 321 and zooming the whole page out (F5). Both bands failed,
on both screens, and nothing else in the run did.

§27's "Large money" row already names the fix — "KPI `text-readout` may wrap
to two lines inside the tile (`break-words`)" — so the plan contains both the
defect's cause and its cure and only the prompt says "unchanged". Taken as an
instruction about composition (no tile added, removed or re-ordered) rather
than about a robustness class, and the one class was added to `StatCard`,
where §27's rule belongs. Nothing else §25.4 lists for that band — `min-h-touch`
on the tile, `line-clamp-2` on the sub — was touched: neither is needed for the
probe, both would change the desktop, and they are left to the sweep (MO-28).

_Lesson:_ the stress fixtures are not a formality appended to a phase; §28
names, for each fixture, the thing it is expected to break. Reading that column
before the run tells you which "unchanged" claims the run is about to test.

### F34 — Two ways the probe harness lied before the product could

Both were caught, and both are the F26 family: an instrument that reports
something other than what it claims to measure.

**A `?screen=` branch read during render.** The throwaway probe page picked its
component from `typeof window !== 'undefined' && location.search`, so the
server rendered Dashboard and the client rendered Revenue, and React threw the
tree away with a hydration error. The page still _looked_ right after the
client re-render, and the probe still reported zeros — of a tree that had been
regenerated rather than hydrated. Split into one route per screen; the console
is silent and the measurement is of the tree the server sent. A harness whose
own rendering is unsound cannot certify a screen's rendering.

**A live clock in the compared region.** The first 1366 before/after pair said
the dashboard **differed**. It did: by the header timestamp, which ticks every
minute and had crossed one between the two captures. `desktop-regression.spec.ts`
already masks `/ IST$/` for exactly this reason — the mask existed and the
ad-hoc comparison did not use it. Re-captured with the repo's own mask list,
and both screens are byte-identical.

That is F23's mirror image and worth stating beside it: F23 is a comparison
that says "identical" when it compared nothing, and this is one that says
"differs" for a reason that is not the change. Neither is answered by looking
harder at the number. Both are answered by asking what the tool would report
if it were broken — a marker for the first, the repo's existing mask list for
the second.

### F35 — A money fixture fed to a count chart manufactures a defect

The Phase 7 stress fixture borrowed §28's headline figures — `12,345,678` and
`99,999,999` — and fed them to the analytics series. The desktop probe then
reported eight clipped y-axis ticks at 1366: `24000000` cut by 24 px,
`6000000` by 18.

Every digit of that is arithmetically true and none of it is reachable. These
charts plot **member counts** — the chart's own `scale` prop says `members` —
and `activeMembers` is a `.filter(…).length`. An eight-digit member count is
not a state the product has. §28's `12,345,678` is a **plan amount** and
`99,999,999` a **payment**; they belong to the money screens Phase 6 stressed,
and §28's figures for counts are the tab-badge row, `128 / 1,024`.

Re-stressed with counts, the same probe reports two clipped ticks rather than
eight, and those two are the inherited F1 condition (below).

_Lesson:_ a stress fixture is not "the biggest number in §28". §28 names, per
fixture, **what it validates** — "value column width; KPI wrap; breakdown" is
a money column, not an axis of member counts. Picking a figure whose magnitude
the screen cannot produce does not harden the screen; it invents a failure and
spends a cycle proving it is not real. Check what the number MEANS on the
screen under test before deciding it is large.

**And the two that remained refine F1.** F1 concluded that "a six-digit label
does not fit a 40 px axis at _any_ width". It is worse than that: `10500` and
`14000` — **five** characters — are clipped by 6 px, against the dashboard's
six-character `200000` clipped by 12. The axis holds about four and a half
characters, not five. Not fixed here, for F31's reason: `compactAxis` is
phone-only and turning it on at the desktop tier moves committed baselines.
Not added to `KNOWN_DESKTOP_VIOLATIONS` either — real analytics counts are two
or three digits, so an entry for the real route would read stale and fail the
ratchet on its next run. Recorded here instead.

### F36 — §13 names an API that exists, on the wrong path of the wrong component

§13: "expanding the row (`DataTable renderExpanded`, which already exists)
shows the full M0–M12 series". The Phase 7 prompt repeats it: "`DataTable.renderExpanded`
already exists — use it." Both are true about `DataTable` and neither is usable
here.

Two independent reasons, each sufficient:

1. **The cohort grid is not a `DataTable`.** It is a hand-built `Table` with a
   column count derived from the data (`M0…M{max}`), which is why it was built
   that way — `DataTable` takes a static `columns` array.
2. **`DataTable`'s list path does not implement `renderExpanded`.**
   `renderList()` references it zero times. Expansion is a table-path feature:
   a chevron column, an extra `<tr>`. So even after converting the grid, the
   prop would work on the **desktop**, which keeps its matrix and has no use
   for it, and do nothing on the **phone**, which is the tier §13 is about.

Implemented with local state, which §27 already names as the alternative
("tap expands the row (`renderExpanded` / local state)"), and which needs no
change to a primitive four other lists depend on. Converting the grid to a
`DataTable` would also have restructured the desktop table this phase is
required to leave byte-identical.

_Lesson:_ this is the third of its family — MO-18, F25, now this. **An approved
plan's cross-references are claims about the code, and they age.** §13 was
written when `DataTable`'s list mode was a design sketch; `renderExpanded`
shipped on the table path and nobody revisited the sentence. The phase that
first tries to use a named API is where that gets found, so read the named API
before budgeting the work, not after.

### F37 — A fixture label format the app never emits leaves a ratchet entry untested

Phase 0 measured the real `/member-analytics` at 1366 and recorded a
`KNOWN_DESKTOP_VIOLATIONS` entry: the trailing x-axis label overshoots the
chart by a pixel, pattern `axis tick "[A-Z][a-z]{2} \d{2}" clipped by -?1px`,
`clears: 'Phase 7'`. This phase probed the rebuilt screen in five states at
seven widths and reported the axis clean — and that result could not have
cleared the entry, because the fixture labelled its trend series `"Jan"`,
`"Feb"`, `"Mar"`. The pattern needs `"Jan 26"`. The condition was never on the
screen to find.

`bucketLabel` is nine lines and returns `"Jan 26"` for a month bucket and
`"01 Sep"` for a day bucket. Neither is three characters. The fixture was
written from what a month "is" rather than from what the function returns.

Re-probed with the labels generated by `bucketLabel` itself (§2.10, second
pass): the trailing `"Dec 26"` is whole at 320, 360, 390, 430, 768, 1024 and
1366; the day-granularity `"30 Sep"` overhangs by 0.6 px at every one of them.
So the entry's own condition does not reproduce anywhere on the rebuilt
screen, a sibling condition reproduces everywhere, and neither is reachable
by the probe suite, which visits each route at its default range (YTD, months)
and never selects 1M.

Re-pointed to Phase 10 rather than deleted. A deletion claims the defect is
gone, and what this phase can say is narrower: it does not occur on this
fixture. A sub-pixel overhang that shows at one chart width and not another is
precisely what a fixture cannot settle — only the seeded gym can — and every
fix for it (a wider right margin, a `textAnchor` on the end tick) moves the
plot area or the label, so it belongs with the two y-tick entries in the phase
that owns the baselines. The reasoning is written into
`tests/e2e/mobile-probe.spec.ts` beside the entry, not only here.

_Lesson:_ **a fixture's field is only as good as the function that produces
it.** F35 was the same mistake in the value dimension — a money figure fed to
a count axis. This is the format dimension, and it is worse, because a wrong
magnitude manufactures a failure you can see and argue with, while a wrong
format manufactures a PASS. Where a field has a producer in the codebase,
import the producer. Where it does not, read it off the real response before
writing the literal.

_And:_ an inherited ratchet entry that names your phase is a task, not
scenery. Nothing in the prompt mentioned it; `grep` for the route in
`tests/e2e/` did.

---

## 5. Open items

| Id    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Owner       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| MO-1  | ~~Two axis entries clear in Phase 1~~ → ~~**Phase 6**~~ → **Phase 10**. Phase 1 built `compactAxis` but §5.9 has the _screens_ pass it, and a default change would move the plot area of every 1366 chart against Phase 1's pixel-equivalence constraint. Phase 6 applied it on the phone tier, which does not clear entries measured at 1366 (F31). Phase 7 then re-pointed the third entry, the 1 px x-tick, for the same reason (F37): its condition does not reproduce on the rebuilt screen at any width, the sibling day-granularity case reproduces at all of them, and every fix moves a baseline. All three axis entries now sit with the phase that owns the baselines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Phase 6 / 7 |
| MO-2  | `STRICT_PHONE_ROUTES` is empty. Each phase adds the routes it rebuilt (M3); Phase 10 expects all 16. Phases 1 and 2 add none — Phase 1 rebuilt no route, and Phase 2 rebuilt the CHROME, so adding `/dashboard` would assert a populated screen no session here has seen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | every phase |
| MO-3  | ~~`metadata.other['theme-color']` must go when `viewport.themeColor` arrives~~ — **done in Phase 1**; the spike now asserts `PLANNED_VIEWPORT_META` and the single theme-color.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | closed      |
| MO-4  | Desktop baselines picture live E2E data. Any seeding or payment on the Enterprise gym shifts them; re-baseline with `--update-snapshots` and say so in the PR — never to absorb a phase's own diff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | every phase |
| MO-5  | The NEW-badge fixture ages out weekly and is re-registered by the seed; the recent-payments list on the dashboard baseline reorders when that happens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | note        |
| MO-6  | `TEST_ONLY_RENDER` lives under `tests/e2e/helpers`; jsdom tests that need it import it from there or re-export via `src/test-utils`. Phase 1 did not need it — the §28 shapes it carries (a 320-char SMS, 3-digit tab badges) belong to the screens, not the primitives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Phase 4+    |
| MO-7  | **Phase 1's E2E suites were not run**, and **Phase 2's were not either** — same session, same missing Supabase credentials. Itemised in §6.1; `viewport-export` is still the one to run first. Phase 2 adds `app-router-history` to the list for a second reason: `useHistoryBack` now has two consumers with opposite ordering needs (F16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Phase 3     |
| MO-8  | ~~`UI1_ALLOW` gained `AppBar` and `BottomNav`~~ — **closed in Phase 2**: all three (`Drawer` too) are mounted in `WorkspaceShell` and their entries are deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | closed      |
| MO-9  | o09 `bodyPhone` (14/20) is **proposed, not applied** — see the decisions table in the Phase 1 entry above. **Recommendation: adopt.** At 13/20 the primary row text sits 1 px above the caption (12) and 2 px above the mono meta (11), so a member's name and its own status line read as one weight; at 14/20 they separate, and that is the most-scanned relationship in every phone list. The line-height stays 20, so no row grows and no §26 blueprint height changes. Against it: 13 is the workspace's body size everywhere else, and raising it on phones means the two tiers no longer share one body token. Rendered comparison in the showcase's "Phase 1 decisions" section, confirmed at `13px/20px` vs `14px/20px`; **caveat — fallback fonts** (§6.2). Applying it is one token across the three files plus one class at the shell root.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | product     |
| MO-10 | F9: the 44×24 `Switch` cannot meet the probe's 40 px minimum. Decide at Phase 8 (padded wrapper, or a §5.2 amendment) before Settings joins `STRICT_PHONE_ROUTES`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Phase 8     |
| MO-11 | **o12 was applied from its default, not approved.** The Door Access entry in the DESKTOP sidebar is the rebuild's one intended desktop navigation change (§0.2). It is one line in `nav.ts` to remove if the answer is no, and the tracker entry is still `open`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | product     |
| MO-12 | The tablet-collapsed default (o02) corrects on the client's first commit: the server cannot measure a width and an iPad shares the desktop UA (M5). Visible only at 768–1023, on a first visit with no stored choice. If it ever needs to be flicker-free, the mechanism is `Accept-CH: Sec-CH-Viewport-Width`, which is Chromium-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | note        |
| MO-13 | The phone `AppBar` names a settings section from `SETTINGS_SECTIONS`; any other nested route falls back to its parent's crumb. Only `/settings` has children today. A new nested route wants either an entry in that list or a generalisation of `appBarTitle`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Phase 8     |
| MO-14 | **The probe never sees a closed overlay (F18).** A dialog contributes nothing to a probe run unless something opens it first, which is how a 24 px close control survived three phases. Every phase that adds a sheet or a dialog needs a probe pass with it OPEN; Phase 10's sweep needs a list of overlays, not only of routes. **Part-paid in Phase 5**: the Confirm Payment sheet is the first `sheet` measured, so the F18 fix is now proven for that placement as well as `center`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | every phase |
| MO-15 | **Member detail was rendered on a hard-coded fixture, not on real data.** Short name, no photo, no discount, one payment, collapsed histories. A long name, a photo, a discount row and an expanded payment table are all unmeasured at 320. Worth a pass once the seeded gym is reachable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Phase 4     |
| MO-16 | The member-detail `Modal` `description` renders above the ordered column on a phone — it is a sibling of that column, not a child, so `order` cannot move it. Desktop behaviour unchanged and outside §10's CSS-only remit, but the §26 blueprint does not draw it. Decide at Phase 8 whether a fullscreen placement should suppress its description.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Phase 8     |
| MO-17 | **The SMS history table overflows every phone width** (384 px), inside the member detail Phase 3 made reachable on a phone. §12 assigns it "`ListRow` list via tier hook"; Phase 9 owns SMS and activity lists. Not a regression (the deleted fork had no SMS history) and deliberately not papered over with a `data-scroll="x"` the plan does not sanction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Phase 9     |
| MO-18 | **§12 does not list the member-detail payment-history table.** Phase 3 converted it (F22) because the phase introduced the regression, but the omission means the plan's table inventory is not complete — worth a sweep at Phase 10 for other tables no phase owns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Phase 10    |
| MO-19 | **Probe every state, not every route.** A screen is probed when its disclosures, empty state, loading state and sub-dialogs have each been measured. Four of member detail's five states were clean and the fifth was the defect (F22). Phase 10's DoD needs this as a checklist, not a sentence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | every phase |
| MO-20 | **`STRICT_PHONE_ROUTES` can finally take an entry.** Phase 4 rebuilt `/members`, the first real ROUTE in the rebuild, and probed it clean at four widths in eight states. Adding it needs the seeded gym (the probe ran on an intercepted endpoint), so it is still unpaid. Phase 5 adds `/payment-collection` to the same queue for the same reason — two routes now probed clean against an interceptor and neither pinned. Phase 6 adds `/dashboard` and `/revenue` to the same queue, and Phase 7 `/member-analytics`, so the list is **five** routes long and `STRICT_PHONE_ROUTES` is still `[]`. → **Phase 8**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase 6     |
| MO-21 | **Every phone width matters, and 390 is not the worst case.** F27 failed at 390 alone — 320 and 360 wrap the value and hand the meta line the full row; 430 fits both. A phase that probes one or two widths is sampling, not checking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | every phase |
| MO-22 | Add member's consent labels wrap links, so tapping "privacy policy" both navigates and toggles the checkbox. Pre-existing (the label was already associated by `htmlFor`) and untouched by the wrapping fix. The remedy is a product decision about where consent links belong.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | product     |
| MO-23 | **The §28 stress fixtures still have not run against the seeded gym.** Phase 4 reproduced their CONTENT (29-char name, 20-char phone, 12,345,678 fee, 300 members) on an intercepted endpoint, which exercises the layout but not the seeding, the real API's shaping, or the fixtures' own idempotence. Phase 5 did the same with 100 dues and −299 days, Phase 6 with the 99,999,999 payment and the 30-character name, and Phase 7 with 24 cohorts, so the debt is now **four** phases deep. Phase 7 also shows what an interceptor costs beyond seeding: its first fixture emitted an x-label format the app never produces, and no gate could tell (F37).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Phase 6     |
| MO-24 | **The first product use of an EXISTING variant needs the same 1366 comparison a new component gets.** `TabsList overflow="scroll"` shipped in Phase 1, sat in the dev showcase for three phases, and moved the desktop by a pixel the moment a product screen used it (F30). Phases 6–10 each reach for primitives built earlier; the comparison is not optional because the component is not new.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | every phase |
| MO-25 | **Renewals' AppBar title and selected BottomNav item are unverified on the real route.** Phase 5 probed `/payments-probe`, a stand-in with no `WORKSPACE_NAV` entry, so its AppBar rendered titleless. `Renewals` is a `bar` item in `nav.ts` and Phase 2 pinned the chrome, but the pairing was not seen. Phase 6 hit the same wall on `/p6-probe/*`: `appBarTitle('/dashboard')` returns `Overview` in `nav.test.ts`, and no phase has yet SEEN it above the screen. Phase 7 makes three: `/p7-probe` has no `WORKSPACE_NAV` entry either, so `/member-analytics`'s `crumb: 'Analytics'` — the only nav entry in the rebuild whose crumb differs from its name — is still unseen above a screen. Clears with the seeded gym (§6.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Phase 8     |
| MO-26 | **`Vercel – gym-management-saas-ihsw` failed on #75 and on #76's first head, then stopped attaching.** A second Vercel project, outside `team_Fl7rQYbRLMhzxU8bhXeMOE94`, appearing 2026-09-15 08:12 on both PRs; always `"Deployment failed."` with no `target_url`, red on the base branch too, while the real project deployed the same commits successfully. It attached to no commit after `f0333b4`: `0705ffb` took one status, green, and #76 went `mergeable_state: clean`. **#75 still reads red because its head has not moved** — those statuses are pinned to `91ea6aa` and are not re-evaluated; the next real push to that branch should clear it, and an empty commit to find out is banned. **Phase 6 got the error string, which no earlier phase had.** It reappeared on #77's head, and the `vercel[bot]` comment beside it reads: `Deployment failed for project gym-management-saas-ihsw with the following error: The provided GitHub repository can't be found.` So the cause is a Vercel project whose GitHub repository link is broken — not a build of this code, which is why it fails with no build log and why the real project deploys the same commit. Independently confirmed from the Vercel account: `list_teams` returns one team, `list_projects` for it returns only `gym-management-saas`, and `get_project` for `gym-management-saas-ihsw` in that team answers **404** — the project is unreachable, so it cannot be inspected or re-run from here. Nothing in this repository caused it or can fix it; clearing it is an account-level Vercel setting. **Phase 7 makes four PRs (#75, #76, #77, #78)**: same error string on #78's head, the real project green on the same commit, and the 404 re-verified against the account on that head rather than carried over. Recorded with no prediction about later pushes, per §6.3. | product     |
| MO-27 | **It is not known which typeface Phases 1–5 measured in.** `fonts.googleapis.com` is denied by this environment's network policy, so `next/font/google` silently falls back to a system face and every probe width is the wrong font's (F32). Phase 6 wired `next/font/local` at the Geist `.woff` files the repo already bundles, for the run only. Nothing in the earlier records says whether they hit the same denial. Re-running an earlier phase's probe is cheap once a route is reachable; re-deriving its numbers from prose is not.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Phase 10    |
| MO-28 | **Two §25.4 KPI-band deltas are still unapplied.** `min-h-touch` on the tile and `line-clamp-2` on the `sub` line. Phase 6 added only `break-words`, which the probe forced (F33); the other two are invisible to every probe rule (the tiles already measure over 44 px, and a wrapping sub line breaks nothing) and both would move the 1366 baseline. They belong with the axis re-baseline (F31) rather than in a screen phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Phase 10    |
| MO-29 | **The plan stresses this screen past what the service can return.** §28 and the Phase 7 prompt both ask for 24 cohorts; `COHORT_RETENTION_MAX_COHORTS` is **12**, enforced by a `.slice()` in `aggregate.ts`. The layout survives 24 and the extra twelve cost nothing to probe, but a stress figure the product cannot produce is the same class of error as F35's money-in-a-count-chart: it proves a state no user reaches. Reconcile the plan's figure with the constant, in whichever direction is intended — if 24 is wanted, the cap is the change, not the fixture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | plan        |
| MO-30 | **The trailing day-granularity x tick overhangs its chart by 0.6 px at every width** (F37), on both tiers, and no run of the probe suite can see it: the suite visits each route at its default range, which for this screen is YTD. It needs the 1M or 3M range selected — a probe that drives a control before measuring, which no phase has needed yet. Fold into the Phase 10 axis work, which already owns the other three entries (MO-1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Phase 10    |

---

## 6. Verification debt

Every phase ends with something it could not check. Recorded here rather than
inside a phase's log entry, because the point is that the NEXT session pays it
off, and a reader looking for "what is not yet known to work" should not have
to reconstruct it from prose.

Rule for this section: an item leaves it only when the check has actually been
run and its result recorded — never because time passed, and never because the
code "obviously" works.

### 6.1 Phases 1–6 — four suites that still have not run

No session had **Supabase credentials**, so the seeded E2E Enterprise gym was
unreachable and every spec gated on `E2E_ACCESS_CONTROL_ENABLED` skipped.
Nothing was worked around; the gap is the gap. Phase 6 makes it six phases
deep, and adds a second environment gap beside it: `fonts.googleapis.com` is
denied by the network policy, so a browser pass renders in a substitute face
unless the bundled Geist files are wired in by hand (F32, MO-27).

Each phase got closer to a real rendering without closing it. Phase 2 put a
browser on the real shell by making four workspace routes temporarily public,
which renders the chrome and answers 401 underneath (§2.5). Phase 3 went
further — a temporary dev route mounted the **real component** on a hard-coded
member, so the tree, the stylesheet and the browser were all real and only the
data was not (§2.6). What is missing is still **real data**, not "a browser":
a long name, a photo, a discount, an expanded payment table (MO-15).

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

### 6.2 Phases 1–6 — what the browser pass could not see

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
- **A member detail with real content (Phase 3).** The fixture is short and
  well-formed: no photo, a two-word name, no discount row, one payment, both
  histories collapsed. Every one of those is a thing that could overflow at
  320 and none of them was measured (MO-15).
- **The 1366 comparison was not repeated for Phase 3.** Desktop equivalence
  rests on a CSS-level proof — a byte-identical stylesheet and every
  `.phone\:` rule inside the phone media query — plus a 1366 rendering that
  was looked at. That is strong for "no rule changed" and silent about
  anything a screenshot diff would have caught.
- **The on-screen keyboard, again.** 390×500 shows the fullscreen footer
  holding its place at a reduced height, which is the closest available proxy
  and is not the same thing: a keyboard also changes `dvh` and moves focus.
  Risk r07 stays open.
- **Nothing has been WRITTEN in a browser yet (Phase 4).** Add member was
  probed on both steps and never submitted; Edit never round-tripped; Day pass
  never issued; the bulk grid never imported. Every mutation on this screen is
  covered by a mocked-`fetch` unit test and by nothing else, which is
  precisely the gap Verification Directive 2 names.
- **The §28 fixtures were reproduced, not seeded (Phase 4).** The content was
  right — 29-char name, 20-char phone, 12,345,678 fee, 300 members — but it
  came from an interceptor, so the seeding helper, the real API's response
  shaping and the fixtures' idempotence are all still unexercised (MO-23).
- **No SMS has actually been sent (Phase 5).** "Remind" was tapped in a
  browser and the probe counted exactly one `/api/sms/send` per tap — against
  an interceptor. Nothing reached the route, the provider, or `sms_logs`, so
  rule 2.7's one-writer contract and the delivery-status columns are as
  unexercised by this phase as they were before it. Verification Directive 2,
  again: a mocked mutation and a refused one look identical.
- **"Mark Paid" was reached, not pressed (Phase 5).** The fullscreen footer's
  button was measured visible and inside the viewport; the payment it records
  was not made, so the dialog it opens (`MarkPaidDialog`, `placement="sheet"`)
  has been probed from Phase 3's fixtures and never from this screen's entry
  point with a real overdue member.
- **Renewals' own chrome (Phase 5).** The probe route has no `WORKSPACE_NAV`
  entry, so the AppBar rendered without a title and no BottomNav item showed
  as selected. Both are Phase 2's work and pinned by its tests; the pairing
  with THIS screen was not seen in a browser (MO-25).

### 6.3 Standing — what no automated gate in this repo can see

Carried forward each phase so it is never mistaken for something a green run
covers:

- jsdom computes no geometry. A screen test proves a screen **mounts**, never
  that it **looks right** (`CLAUDE.md`, Verification Directives 1).
- Unit tests mock Supabase, so a missing column and an RLS-refused write are
  both indistinguishable from success (directive 2).
- A test is decorative until the defect it names has been made to break it
  (directive 3) — see F13, which is that rule catching a test from this phase.
- **Nothing reads the prose.** `arch:check`, ESLint, `tsc`, Prettier and the
  whole Jest suite were green while two rules sat deleted from the rendered
  §2.21 (F17). UI7 now counts table cells, which closes exactly one hole:
  text vanishing from a file every session loads. It cannot tell whether a
  rule is **wrong**, stale, or contradicted by another rule — and no gate
  here can. A rulebook edit still has to be re-read after it is committed.
- **A probe only sees what is open.** An overlay contributes nothing to a
  probe run unless something opens it first, so "probe green" on a route says
  nothing about the dialogs that route can open. This is how a 24 px close
  control lived through three phases (F18) — and it applies to every sheet,
  dialog and drawer added from here on. The same is true one level down: a
  COLLAPSED disclosure renders nothing, which is how a 405 px table sat
  inside a "clean" screen (F22). Probe the states, not the route. Phase 5 paid
  the first instalment: the Confirm Payment sheet, opened from Renewals, is
  the first `sheet` any phase has measured, and `Modal`'s close control is
  now proven at 40+ px with the control actually on screen rather than
  hidden by `fullscreen`.
- **A green probe is evidence only if you know what it measured.** A screen
  showing its error state has no rows, no links and no meta lines, so every
  touch and overflow rule passes vacuously (F26). Assert the subject exists —
  a row count, a known name, the absence of the error card — before believing
  a zero.
- **A before/after screenshot pair proves nothing without a build marker.**
  The correct answer and the answer from a comparison that never switched
  trees are the same string (F23). Assert one DOM fact that differs between
  the two sides and is invisible at the compared width, or do not claim the
  result.
- **"Inert on the desktop" is a claim about computed style, not intent.** A
  class that changes no layout, paints no scrollbar and moves nothing can
  still change what a box clips — `overflow-x-auto` on a row that does not
  overflow cost the desktop a pixel of tab underline (F30). The plan's rule
  is "`phone:`-scoped OR inert"; scoping is cheap and deciding something is
  inert requires knowing every side effect it has.
- **Two observations of a flaky external system support "it happened twice",
  not "it will keep happening".** A failing Vercel check was correctly
  established as not any phase's — red on the base branch, absent from the
  earlier PRs, on a project outside the team — and then written up with a
  prediction attached: that it would read red on every phase PR until someone
  cleared it. The next push disproved that within the hour. The evidence
  ruling a failure out is not evidence about what it does next; record what
  was observed and stop there.
- **The measuring tool is usually the broken thing, not the codebase.** A
  throwaway script written to verify an invariant is younger, less exercised
  and less reviewed than the code it is checking, so a result implying a
  long-standing catastrophe should be aimed at the script first (F24).
  Falsify a measurement tool the way a test is falsified: a comparison needs
  a marker that MUST differ; a count needs a second method sharing no code
  with the first.
- **A green probe is only evidence if the page it measured was the page the
  server sent.** A probe harness that picks its component from
  `location.search` during render makes the server and the client render
  different trees; React discards the server's and regenerates, the screen
  ends up looking right, and the probe reports zeros for a tree that was
  never hydrated (F34). A silent console is part of the measurement, not a
  nicety.
- **A before/after pair can differ for a reason that is not the change.** The
  dashboard header carries a live clock, and a minute boundary between two
  captures is enough to make the comparison say "differs" (F34). The repo's
  own `desktop-regression.spec.ts` already masks `/ IST$/`; an ad-hoc
  comparison that does not reuse that list is measuring something else. This
  is F23's mirror: a marker catches a comparison that compared nothing, a
  mask catches one that compared too much.
- **The rendering environment can substitute the typeface without failing.**
  `next/font/google` logs a warning and carries on when the font host is
  unreachable, and most of the probe's rules — overflow, clipping, axis
  ticks, the inline line box — are font-metric rules (F32). Check which faces
  actually loaded before recording a width.
- **A PR's green head is evidence about the head, not about the merge.** A
  long-open PR's base moves under it; GitHub's `mergeable: clean` answers
  "will it apply", not "does the result build", and no CI anywhere runs the
  merged tree until someone makes it. Phase 6 sat six days while `master`
  gained two commits, and the combined tree had never been gated when the PR
  still read green. Merge the base in and re-run the gate before treating a
  stale PR as ready — this project merges ten phase PRs, so the case recurs.
- **A fixture is a claim about the product, and nothing checks it.** Every
  probe result is conditional on the fixture being a shape the app can
  produce. Phase 7 fed a count axis money figures and manufactured eight
  desktop violations that no gym can reach (F35), then labelled a month
  bucket `"Jan"` where the product emits `"Jan 26"` and reported a ratchet
  entry's condition absent when it had never been rendered (F37). Neither is
  visible to `tsc` — both fixtures type-check, because `label` is a `string`
  and `value` a `number`. Where a field has a producer in the codebase,
  import the producer; where it does not, read the real response. A wrong
  magnitude manufactures a failure you can argue with; a wrong format
  manufactures a pass.
- **An inherited ratchet entry naming your phase is a task.** The prompts
  carry the plan's scope, not the repo's outstanding items, so an entry in
  `KNOWN_DESKTOP_VIOLATIONS` (or any list keyed by phase) reaches the phase
  that owns it only if someone greps for it. Two phases running have found
  one this way, and both times the entry could not be cleared as written
  (F31, F37) — which is itself the argument for looking early rather than at
  the end.
- **UI7's fenced-block skip has never fired.** Nothing in `.claude/**` or
  `docs/architecture/**` puts a table inside a code fence today (verified:
  zero fenced lines start with a pipe), so that branch is defensive and
  unexercised. Its escape-awareness _is_ exercised — remove it and 10
  correctly-escaped rows across four rulebooks report as ragged.
