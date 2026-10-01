# Close-Out — Mobile UI Rebuild

> Written 2026-10-01 at the end of Phase 10. Companion to
> `mobile-ui-rebuild-plan.md` (v1.5), `mobile-ui-rebuild-audit.md` (the
> before-values) and `mobile-ui-rebuild-log.md` (every measurement and all 46
> findings). Modelled on `workspace-ui-overhaul-closeout.md`.
>
> Read §1 before merging. Everything else can be read in any order.

---

## 1. Read this first — two desktop screenshot baselines are stale

`compactAxis` now ships on **both** tiers for `/dashboard` and `/revenue`
(Phase 10). The tick text is what it changes, so:

| Baseline                           | Holds                    | Should hold                 |
| ---------------------------------- | ------------------------ | --------------------------- |
| `dashboard-desktop-1366-linux.png` | `0000 / 5000 / 0000 / 0` | `250k / 500k / 750k / 1.0M` |
| `revenue-desktop-1366-linux.png`   | `0000 / 5000 / 0000 / 0` | `250k / 500k / 750k / 1.0M` |

**Re-take them with `npx playwright test tests/e2e/desktop-regression.spec.ts
--update-snapshots` on a machine with `E2E_ACCESS_CONTROL=1` and the seeded
Enterprise gym.** No session in this rebuild had Supabase credentials, so the
suite skipped in all eleven phases and a baseline taken here would be a picture
of intercepted fixtures rather than of the product. Absorbing the diff silently
is what MO-4 forbids; naming it is the alternative.

Until that run happens, `desktop-regression.spec.ts` is expected to fail on
exactly those two screens, with a diff confined to the y-axis labels. Any other
difference in that run is a real regression.

---

## 2. State

**Eleven phases, Phase 0 through Phase 10, all merged to `master` except this
one.** The audit's three headline charges are answered:

| Audit finding (before)                                                   | Now                                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Bottom bar scrolls sideways at 390 (754 px in 390)                       | `scrollWidth === clientWidth` at 320 and 390                                                                   |
| Members / Renewals / Revenue / cohort / dashboard tables overflow at 390 | Every list renders `ListRow`s below `tablet`; zero beyond-viewport violations on fifteen routes at four widths |
| Interactive controls below 40 px on phone routes                         | Zero, on every probed route at every phone width                                                               |

**The measurement behind that table:** fifteen `(dashboard)` routes probed at
320 / 360 / 390 / 430 populated (60 states) and at 320 / 390 empty (30 states)
— **zero violations, zero console errors, no dev error overlay on any of them**
— plus 45 desktop-tier states at 768 / 1024 / 1366, whose only violations were
the two axis entries now fixed. The sixteenth route, `/settings`, renders
`null` by design and is measured through the shell.

`STRICT_PHONE_ROUTES` now holds all sixteen routes. It was empty through
Phases 1–9 for a stated reason, and §5 explains why promoting it now is
defensible and what its first run against the seeded gym will actually test.

---

## 3. Definition of Done (§24), walked

| Item                      | Evidence                                                                                                                                                                                                                                                                                                                                  | Status                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Functional parity         | No service, route, schema or request body changed in any phase. The six member mutations' bodies are pinned by fixture tests; Mark Paid uses the desktop date dialog on both tiers.                                                                                                                                                       | Met, except the E2E half                 |
| Presentation parity       | 1366 before/after run every phase: byte-identical on 23 screen-captures, geometry-identical on 2 (F41's animated chrome), and one intended diff — Phase 9's `Pagination`, 0.90% of the frame, confined to the pager row.                                                                                                                  | Met, with §1's two baselines outstanding |
| Mobile quality            | §26 blueprints matched at 320/390/430; no page or unintended internal overflow; the only sideways scrollers are `Tabs` lists and the bulk-import fallback, both `data-scroll="x"`; every `WORKSPACE_NAV` destination ≤ 2 taps; the bar never scrolls.                                                                                     | Met                                      |
| Touch (§15.1)             | Probe green on every phone route at four widths. MO-10 settled at Phase 9 (the switch label is 88×44) and the probe's own predicate corrected at Phase 10 to match §15.1's Checkbox/Radio/**Switch** row.                                                                                                                                 | Met                                      |
| State completeness        | Loading, empty and populated rendered and probed for all fifteen routes; error states covered by the per-screen jsdom suites.                                                                                                                                                                                                             | Met                                      |
| Stress resilience (§28)   | §28 content at magnitudes each field's own producer can emit (F35): a 26-char name, `1,000,000` plan and payment amounts, a 320-char SMS, 26 announcements, 12 cohorts, a 58-char device name. No clipping or collapsed rows.                                                                                                             | Met                                      |
| Information access (§9.4) | Visible and disclosed sets asserted by a phone-tier test for every list; every cohort's full M0–M12 series reachable by tap.                                                                                                                                                                                                              | Met                                      |
| One member detail         | `MemberDetailModalMobile` and its `window.innerWidth` wrapper are deleted; both tiers use `MemberDetailModal` with `MarkPaidDialog` and SMS history.                                                                                                                                                                                      | Met                                      |
| Design-system integrity   | `type-check` clean, `lint` 0 errors (11 pre-existing warnings), `arch:check` green, **2,184 tests passing / 7 skipped**, token parity 18/18. UI2/UI3/UI4/UI6 allow-lists empty; UI1b added and empty; `Drawer` out of `UI1_ALLOW`. No `window.innerWidth`, and no off-boundary breakpoint composition switch in shell or DS layers (UI6). | Met                                      |
| Controlled deviations     | Every exception and amendment is in the tracker's activity log and in §3 of the rebuild log. None silent.                                                                                                                                                                                                                                 | Met                                      |
| Safe area                 | `viewport-fit=cover` ships, `--ds-safe-*` declared and consumed, probe measures the fixed chrome at every width. **No physical device has opened this app in standalone mode.**                                                                                                                                                           | **Outstanding** (o06)                    |
| Human sign-off (§29)      | Requested in the Phase 10 PR.                                                                                                                                                                                                                                                                                                             | **Outstanding**                          |

---

## 4. Outstanding — what merging does not finish

**Blocking nothing, owed by someone:**

1. **The two desktop baselines** (§1). One command, needs the seeded gym.
2. **The physical-device safe-area check** (o06). The probe can prove the
   tokens are wired and can never prove they are respected on a notched
   device: Chromium's emulated viewport reports zero insets.
3. **§29 human visual sign-off.** The workspace overhaul's equivalent passed
   2026-09-09; this one is requested in the Phase 10 PR.

**Two decisions handed off rather than resolved:**

4. **o09 — `bodyPhone` 13 vs 14 px.** Phase 1's recommendation stands: adopt
   14/20. Not applied here on purpose — it is one token across three files plus
   one class, and it moves the text metrics of every phone screen, which would
   invalidate all 105 probe states this phase recorded. Whoever adopts it owes
   a re-probe, not a re-read.
5. **o12 — the Door Access entry in the DESKTOP sidebar.** Shipped from its
   default at Phase 2 and never explicitly approved; it is the rebuild's one
   intended desktop navigation change and one line in `nav.ts` to decline. The
   mobile entry is required regardless (§6.2) and is not this decision.

**Carried as follow-ups, each with its measurement:**

6. **MO-30** — a 0.6 px trailing-tick overhang at DAY granularity on
   `/member-analytics`, width-independent and therefore chart geometry. Needs a
   probe that drives the range control before measuring; no run of the suite
   selects that range today.
7. **MO-33** — one latent instance of F42: `PricingTable` is
   `grid gap-4 md:grid-cols-3`, the exposed shape (a grid whose only column
   templates are breakpoint-prefixed). `/subscription` probes clean, so it is
   latent, not broken. The sweep for it is a grep for a `grid` class with no
   unprefixed `grid-cols-*`, then a measurement before adding one.
8. **MO-35** — `/settings/access-control` was never in any phase's scope. Two
   defects measured there while settling MO-10: "Connect a reader" sits flush
   against the card border, eating all 12 px of its right padding at 320 and
   390; and the reader-name input clips its own value (scrollWidth 450 in a
   306 px box), which is native `<input>` behaviour and needs a judgement about
   probe rule 3 rather than a class.
9. **MO-37** — the Door Access activity log formats timestamps with raw
   `toLocaleString()` (`9/24/2026, 8:41:00 AM`) on **both** tiers, where the
   rest of the product uses `formatDate` / `formatDateShort`. Pre-existing on
   the desktop table; the phone row mirrors it deliberately rather than
   introducing a second format. Fixing it changes the desktop too.
10. **MO-39 — two of these follow-ups understated their own scope**, found by a
    post-merge audit and corrected in §5 of the log. **MO-33 is four instances,
    not one**: `PricingTable` plus `AccessReadersCard` (twice) and
    `AccessAccountCard`, the last three on `/settings/access-control`, the one
    screen no phase owned. **MO-37 is three screens in two wrong formats, not
    one**: the Door Access log's `toLocaleString()`, plus raw ISO dates in
    `PaymentCollectionPageClient` (`nextDueDate`, `paymentDate`) and
    `DashboardClient` (`paymentDate`). Neither is a measured defect — both
    screens probe clean — and both were logged from a browser pass, which sees
    the screens a phase owned. An entry naming a code pattern should be opened
    with the sweep that proves its extent; both sweeps are one `grep` and are
    quoted in the log entries.
11. **UI1_ALLOW's thirteen entries.** All pre-date the rebuild, which orphaned
    none of them (measured: 14 entries at the base commit, 13 now, the one
    difference `Drawer`). Deleting them is a design-system cleanup. Four have
    positive evidence of redundancy — Phase 4 built its phone toolbar from
    `DropdownMenu` rather than `Toolbar` or `FilterBar`, and Phases 7 and 9
    disclosed rows with local state rather than `Accordion`.
12. **MO-23 / MO-31** — **nothing in this rebuild was written through a
    browser.** No member registered, no payment recorded, no broadcast sent, no
    door opened, no fingerprint enrolled. Every fixture in every phase was
    intercepted, because no session had Supabase credentials. The jsdom suites
    pin the request bodies; the E2E suites that would exercise them have never
    run.

---

## 5. How the work was checked, and what that is worth

**The probe is the instrument, and it was falsified in every phase.** Before
believing a phase's zeros, the phone branch it added was reverted and the probe
re-run: Phase 8 reproduced a 617 px delivery-log table in a 356 px container,
Phase 9 a 543 px activity table in 286 px and a 771 px SMS table in 254 px.
A probe that has not been shown failing on the defect it exists to catch is a
number, not a measurement.

**Nine of the 46 findings are about the harness lying before the product
could.** That is the single largest category, and it is the reason this
closeout quotes measurements rather than adjectives:

- **F26** — a probe that measures an error card reports zero violations.
- **F35 / F37 / F38** — a fixture with the wrong magnitude manufactures a
  failure you can argue with; the wrong format manufactures a PASS; the wrong
  shape makes the probe measure Next's dev error overlay and report its
  "Reload" and "Back" buttons as undersized controls on a screen that never
  rendered.
- **F23 / F34 / F41** — a comparison needs a marker that MUST differ or it
  cannot tell "identical" from "never switched trees"; it needs a mask for what
  legitimately varies; and a full-page shot of a screen inside animated chrome
  measures the chrome.
- **F46** — a falsification run must not write where the passing run's
  evidence lives.
- **Phase 10 added two more.** A hand-written stub crashed eleven of fifteen
  routes until every payload was transcribed from the screen's own jsdom suite
  — the unit tests are the producers, and the two that have an exported
  response type now carry it so `tsc` refuses a wrong shape. And a stub that
  answers **instantly** manufactured a hydration mismatch on
  `/settings/security` that no user can reach: `page.route` fulfilled
  `/api/auth/profile` before React finished hydrating, so the client's first
  render had data the server's did not. A 150 ms delay — what any real network
  imposes — removes it.

**`STRICT_PHONE_ROUTES` holding all sixteen is a promotion, not a proof.**
Every number in this rebuild was taken against intercepted endpoints on
throwaway `/pN-probe/*` routes, and that list's own suite runs against the
seeded gym. The promotion is defensible on coverage — 90 phone-tier states with
full §28 content and zero violations — and its first run against real data is
the real test of the line. If that run fails, the fix is the screen or the
fixture. Never a deletion from the list.

**What no gate in this repo can see** is recorded as §6.3 of
`mobile-ui-rebuild-log.md` and carried forward unchanged: jsdom computes no
geometry; a green gate is evidence, not proof; "verify only" names a claim, not
a method; an inherited ratchet entry naming your phase is a task, not scenery.

---

## 6. Reviewing this

The diff is small; the log is not. For a reviewer with an hour:

1. **§1 of this file**, then the two commits of Phase 10.
2. **§2.12 and §3's Phase 9 and 10 entries** in `mobile-ui-rebuild-log.md` —
   the baselines and what each phase actually changed.
3. **`.claude/rules/architecture.md` §2.21** — the standing invariants, which
   is what survives this rebuild into every later change.
4. **`tests/e2e/mobile-probe.spec.ts`** — `KNOWN_DESKTOP_VIOLATIONS` is empty
   and `STRICT_PHONE_ROUTES` is full. Those two lines are the ratchet's state.

For a reviewer with ten minutes: §1, §3's table, and §4.
