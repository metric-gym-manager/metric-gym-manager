# Mobile UI Rebuild — Session Prompts (Phases 0–10)

> One prompt per phase of `mobile-ui-rebuild-plan.md` (v1.5). Each is
> self-contained: paste it into a fresh Claude Code session at the repository
> root. Run the phases in order; a phase starts only after the previous one's
> gate is closed in the tracker and its branch is merged to `master`.
>
> **Branch history (to avoid confusion).** The audit and the plan were written
> on `claude/mobile-ui-rebuild-audit`, merged into `master` at `9420269` and
> the branch deleted (it was never pushed). Implementation uses one branch per
> phase, `claude/mobile-ui-rebuild-p<N>`, cut from `master`. The earlier
> `claude/workspace-ui-overhaul` branch is fully merged and closed; its record
> is `workspace-ui-overhaul-closeout.md`.
>
> **Tracker:** <https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d>
> (database collections `phases`, `decisions`, `open`, `risks`, `log`).

---

## Phase 0 — Test scaffolding

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 0: Test scaffolding

You are executing an approved plan; you do not discover the product design
while coding. Read, in order: `docs/architecture/mobile-ui-rebuild-plan.md`
(v1.5 — the contract; all of it, then keep §0, §4, §15.1, §17, §18–§19, §28,
§30–§31 open), `docs/architecture/mobile-ui-rebuild-audit.md` (the measured
baseline), `docs/architecture/workspace-ui-overhaul-closeout.md` §5 (how
defects got past a green gate here), `src/test-utils/renderScreen.tsx`,
`playwright.config.ts`, `tests/e2e/helpers/billing.ts` (login helper),
`scripts/check-architecture.mjs` (UI1–UI5), and `node_modules/next/dist/docs/`
for the Next 16 `viewport` export and App Router history behaviour.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— `read_db list phases` first; set `phases/p0` to `in_progress`; tick gates
g1–g10 as they pass; add `notes` and a `log/entries` entry (actor
`claude-session`). Writes to existing documents need `if_version` (from
`read_db`) inside a `write_db` `db_op: "batch"` entry. Deviations are logged
as `EXCEPTION:`; plan conflicts follow §31 and are logged as `AMENDMENT:`
before you implement them.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p0`.
Never commit to master. Conventional Commits per step.

Scope (plan §18 row 0 — nothing else):

1. `renderScreen(ui, { viewport: 'phone' | 'desktop' })` — default desktop;
   wraps with a `ViewportTierProvider` override.
2. `src/hooks/useViewportTier.ts` skeleton: provider with `initialTier` and an
   explicit override; hook returns `'phone' | 'desktop'`; no `matchMedia`
   subscription yet (Phase 1 adds it). Mount nothing in `src/app` yet — add
   nothing to any allow-list; a hook is not a component.
3. Playwright projects for 320×568, 360×800, 390×844, 430×932, 768×1024,
   1024×768, 1366×800 (mobile projects with `isMobile`/`hasTouch`).
4. `tests/e2e/helpers/mobile-probe.ts`: page overflow, internal overflow
   outside `data-scroll="x"`, the §15.1 touch rule (≥ 40 all; ≥ 44 without
   `data-dense`; inline-link allow-list), bottom-nav scroll width, fixed/sticky
   inventory, axis tick text, clipped single-line text.
5. `tests/e2e/helpers/stress-fixtures.ts`: the §28 fixtures, seeded through the
   app's own APIs on the E2E Enterprise gym, idempotent by name.
6. `tests/e2e/desktop-regression.spec.ts`: 1366 screenshot baselines for
   Dashboard, Members, Renewals, Revenue, Analytics, Settings/gym and the
   member detail open; commit the baselines.
7. The two VERIFY spikes: (a) a pushed history entry + `popstate` close inside
   the App Router (does it fight Next's own history handling? does back close
   the overlay without navigating?); (b) the Next 16 `viewport` export shape.
   Record findings in the tracker log; if (a) fails, raise an `AMENDMENT:` for
   §5.3/§14 — do not invent a workaround.

Constraints: no source change outside `src/test-utils`, `src/hooks`, `tests/`,
`playwright.config.ts`. No product code. Dev server on a port other than 3000;
log in with `E2E_ENTERPRISE_GYM_EMAIL/PASSWORD` from `.env.local` (46 members
already seeded). `ENABLE_REAL_SMS` must be `false`.

Verify (report results, not commands): `npm run type-check && npm run lint &&
npm run arch:check && npm test` green; the probe runs green on today's desktop
routes at 1366 and _reports_ (does not fail) the known phone failures from the
audit at 390; baselines captured; one new test falsified by mutation (name it).

Finish: tracker updated (status, gates, notes, log), branch pushed, PR opened
against master with: what was built, what was verified and how, spike results,
EXCEPTION/AMENDMENT entries. Stop — do not start Phase 1.
```

---

## Phase 1 — Design-system foundations

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 1: Design-system foundations

You are executing an approved plan; you do not discover the product design
while coding. Read, in order: `docs/architecture/mobile-ui-rebuild-plan.md`
(v1.5 — all of it; keep §0, §4, §5, §9.1, §9.3, §15.1, §25.1–§25.3, §30–§31
open), `docs/architecture/mobile-ui-rebuild-audit.md` §G–§H,
`.claude/DESIGN_SYSTEM.md`, `docs/architecture/METRIC_UI_DIRECTIVE.md` §4.4,
§4.5, §5.20, §6, `src/components/ui/tokens.ts`, `src/app/globals.css`,
`tailwind.config.ts`, `src/components/ui/__tests__/token-parity.test.ts`,
`scripts/check-architecture.mjs` (UI1–UI5), `eslint.config.mjs` (token rules),
and the primitives you will touch: `Button`, `Input`, `Select`, `Textarea`,
`Checkbox`, `Radio`, `Switch`, `Tabs`, `Pagination`, `Modal`, `Drawer`,
`Charts`, `DataTable`, `Table` (read-only), plus `src/app/(dev)/design-system/page.tsx`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `phases/p0.status === 'done'`; set `p1` to `in_progress`; gates,
notes, log entry as in the plan. Existing-document writes need `if_version`
inside a `write_db` batch entry. `EXCEPTION:` / `AMENDMENT:` per §30–§31.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p1`.

Scope (plan §18 row 1, in this order):

1. Tokens (§5.1) in all three files + parity test: `touch` 44, `touch-sm` 40,
   `bottomNavHeight` 56, `--ds-safe-*`, `sheetMaxHeight` 90dvh, `input` 16/24,
   Tailwind `screens.phone: { max: '767px' }`, chart compact-axis value. No
   other token. `bodyPhone` is a planned decision — propose it with a rendered
   13 vs 14 px comparison at 390 in the PR; do not apply it.
2. `useViewportTier` (complete: `matchMedia('(max-width: 767px)')` via
   `useSyncExternalStore`, server snapshot = `initialTier`, override prop) and
   `src/hooks/useHistoryBack(open, onClose)` (one implementation).
3. Primitive `phone:` sizing + `data-dense` exactly per §5.2 and §15.1.
4. `Modal placement` (§5.3): `center` default unchanged; `sheet`; `fullscreen`
   with leading Back, body scroller, footer as the sticky action bar with
   `safe-bottom`, `useHistoryBack` on for fullscreen only.
5. `Drawer` (§5.4), `Tabs overflow` (§5.5), `Pagination responsive` (§5.6),
   `Charts compactAxis`/`yTickFormatter` (§5.9 — pick width-token vs compact
   formatter by rendering both at 390 and state which in the PR).
6. `ListRow` (§9.1, §25.1 row spec) and `DataTable mobileRow` (§9.3) with
   `forceLayout`, compact sort `Select`, list-mode skeleton/empty/error.
7. `AppBar` and `BottomNav` composites (§5.11, §25.2, §25.3) — build only;
   mount them in the showcase page so UI1 stays green; they are wired into the
   shell in Phase 2.
8. Showcase sections for every addition; `DESIGN_SYSTEM.md` §4.3/§6/§7 and
   `architecture.md` §2.21 updated in the same commits.
9. `export const viewport` in `src/app/layout.tsx` (§16) and manifest
   `background_color`/`theme_color` via `scripts/generate-pwa-assets.js`
   (colours only; `start_url` unchanged; no `display_override`).

Constraints: every change is `phone:`-scoped or inert without its new prop —
desktop renders pixel-equivalent (prove it with the Phase 0 baselines). No
`Toolbar` or `Table` changes. No feature files touched. No component named
like a DS export. No `window.innerWidth`. No new token without an amendment.

Verify: gate green; parity test green; primitive tests assert phone classes,
`data-dense`, placements, `popstate` close, list mode (visible set, sort,
selection, states); showcase renders at 320/390/430 and 1366 with the probe
green on it; desktop regression suite unchanged; at least one new test
falsified by mutation (name it).

Finish: tracker updated, branch pushed, PR opened. Stop — do not start Phase 2.
```

---

## Phase 2 — Shell & navigation

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 2: Shell & navigation

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0, §3.1, §4, §6, §25.2–§25.3, §26, §30–§31 open),
`docs/architecture/mobile-ui-rebuild-audit.md` §D "Navigation",
`docs/architecture/METRIC_UI_DIRECTIVE.md` §5.14, §5.20,
`docs/architecture/workspace-ui-overhaul-log.md` rulings R6 and R7,
`docs/architecture/frontend-patterns.md` §2.15 (sign-out is a full-document
navigation), `src/components/workspace/{WorkspaceShell,WorkspaceSidebar,WorkspaceHeader,nav}.ts(x)`,
`src/app/(dashboard)/layout.tsx`, `src/components/common/composites/{AppBar,BottomNav,SideNav,UserMenu}.tsx`,
`src/components/ui/primitives/{Drawer,Toast}.tsx`, `scripts/check-architecture.mjs`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p1` done; read `open/o02`, `open/o03`, `open/o12` answers (defaults:
tablet collapsed; four-item bar; Door Access in the desktop sidebar = yes);
set `p2` in_progress; gates/notes/log; `if_version` on existing docs.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p2`.

Scope (plan §18 row 2; §6 is the specification):

1. `nav.ts`: `mobile: { placement: 'bar' | 'more'; order }`, optional
   `capability`, the `/access-control` entry (More; desktop sidebar per o12),
   `mobileNav()` selector. `WORKSPACE_NAV` remains the only list.
2. `WorkspaceShell`: mount `AppBar` (identity/Back + title from
   `crumbForPath`; no action slot) and `BottomNav` (Dashboard · Members ·
   Renewals · More); More = `Drawer size="auto"` per §6.2 with the sign-out
   handler **moved** from `MobileTopBar` unchanged; delete `MobileTopBar` and
   `MobileBottomNav`; `data-tier` on the root; `<main>` `phone:px-4 phone:pt-3`
   - bottom padding `h-bottom-nav` + safe; `lg:` → `tablet:`; tablet-collapsed
     default (localStorage choice still wins).
3. `(dashboard)/layout.tsx`: `ViewportTierProvider` with `initialTier` from
   `sec-ch-ua-mobile`/UA.
4. `Toaster` top-center offset on phones.
5. UI6 ratchet in `check-architecture.mjs` (no `sm:|md:|lg:|max-tablet:` in
   workspace/primitives/composites; allow-list seeded with current offenders).
6. Remove `Drawer`, `AppBar`, `BottomNav` from any allow-list they were parked in.
7. In-flow `PageHeader` title hidden on phones (its `actions` render as the
   first content row); the Settings layout's in-flow "‹ Settings" link hidden
   on phones (AppBar Back navigates to `/settings`).

Constraints: no screen composition changes beyond the shell; desktop sidebar
and header unchanged except the Door Access entry (only if o12 = yes) and the
768–1023 collapsed default; no routing changes; sign-out stays a
full-document navigation.

Verify: shell test (phone tier) asserts three bar items + More and that every
remaining `WORKSPACE_NAV` item appears in More; Playwright at 320/360/390:
`BottomNav.scrollWidth === clientWidth`, every destination reachable in ≤ 2
taps, Back from `/settings/gym`, from a fullscreen overlay (use the showcase)
and from More; Door Access visible only for the Enterprise gym (log in as the
Lite gym for the negative case); zero console errors; 1366 regression suite
unchanged apart from the approved sidebar entry; 768 shows the collapsed
default; probe green on the shell at four widths; one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 3 — Member detail parity

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 3: Member detail parity

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0 C1/C3/C4/C14, §3.2, §10, §11, §25.4 "Member detail", §26, §30–§31 open),
`docs/architecture/mobile-ui-rebuild-audit.md` §I row 1,
`src/features/members/components/{MemberDetailModal,MemberDetailModalMobile,MemberDetailModalResponsive}.tsx`,
`src/contexts/member-modal.context.tsx`, `src/features/members/index.ts`,
`src/features/payments/components/{MarkPaidDialog,ReactivationDialog}.tsx`,
`src/features/sms/components/MemberSmsHistory.tsx`,
`src/features/access-control/components/MemberAccessPanel.tsx`,
`.claude/rules/architecture.md` §2.7 (the SMS barrel is server-tainted —
deep-import `MemberSmsHistory`), `scripts/check-architecture.mjs`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p2` done; set `p3` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p3`.

Scope (plan §10 — "Required" and "Presentation on phone" only), in this order:

1. Record request-body fixtures for the six mutations in `MemberDetailModal`
   (suspend, activate, cancel, markRegularPaid, reactivate, delete) as tests
   BEFORE changing anything.
2. `MemberDetailModal` reads `useViewportTier()` and passes
   `placement={tier === 'phone' ? 'fullscreen' : 'center'}` to its two Modals;
   sub-dialogs get `sheet`/`center`. 1366 pixel diff must be unchanged.
3. `MemberModalProvider` renders `MemberDetailModal` for both tiers; delete
   `MemberDetailModalMobile.tsx` and `MemberDetailModalResponsive.tsx`; update
   the barrel, tests and any allow-list.
4. Phone section order via `phone:order-*` on the existing wrappers (§10 step
   5); disclosure toggles keep their current behaviour, collapsed by default.
5. `aria-label` on the icon-only Edit/Delete buttons.

Do NOT: extract mutations into hooks; rename the component; add `?member=`
URL state or an `intent` option; change any request, dialog, toast or
invalidation; add or remove a step from any action. The only intended mobile
behaviour change is that Mark Paid now opens `MarkPaidDialog` (parity).

Verify: fixture tests green before and after; phone-tier test asserts the
"View SMS History" toggle exists and that Mark Paid opens `MarkPaidDialog`
(mutate the source to skip the dialog — the test must fail); 1366 regression
unchanged; Playwright at 390: open a member from Members, Renewals and the
Dashboard; back closes it and the list keeps its page/scroll; Mark Paid via
the date sheet records a payment on the E2E gym; suspend/activate/cancel/
delete each once; Escape closes; footer visible at height 500; probe green.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 4 — Members + member forms

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 4: Members list and member forms

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0, §8.2, §8.4–§8.8, §9, §11, §14, §15.1, §25.4 "Members"/"Add member", §26
MEMBERS and ADD MEMBER blueprints, §27, §28, §30–§31 open),
`docs/architecture/mobile-ui-rebuild-audit.md` §C Members/Add/Edit/Day pass/
Bulk import rows, `src/app/(dashboard)/members/MembersPageClient.tsx` and its
test, `src/features/members/components/{AddMemberModal,EditMemberModal,DayPassModal,BulkAddMemberModal}.tsx`,
`src/components/ui/primitives/{DataTable,ListRow,Pagination,DropdownMenu,Modal}.tsx`,
`src/components/common/composites/SearchBar.tsx`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p3` done; read `open/o05` (bulk import: guidance sheet + labelled
fallback); set `p4` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p4`.

Scope:

1. Members (§8.2, blueprint): first content row `SearchBar` (flex-1) + `Add
member` + "⋯" `DropdownMenu` (Day pass, Bulk import); second row status
   `Select` + record count; `DataTable mobileRow` per §9.4 (visible: name,
   status+due, plan, fee; disclosed: phone as `tel:`); `Pagination responsive`.
   Queries, params, server pagination, `openMember` unchanged.
2. Add member / Edit member: `placement="fullscreen"`, one step per screen,
   footer buttons per blueprint; forms, schemas, queries unchanged.
3. Day pass: `placement="sheet"`; results as `ListRow`s if the current list is
   hand-rolled markup (VERIFY; otherwise leave it).
4. Bulk import (§14): on phone the menu item opens the `Drawer` guidance sheet
   with the exact copy in §14, Copy link, and "Open the desktop grid here"
   which opens the existing modal fullscreen with a persistent `Alert` and
   `data-scroll="x"` on the grid. No other change to bulk import.

Do NOT: add "Register another"; change any request; add confirmations; touch
desktop compositions (the desktop table, toolbar and modals stay as they are).

Verify: phone-tier screen test asserts the §9.4 visible and disclosed sets
and that joined/member-number are absent from the row; desktop test
unchanged; Playwright at 320/390/430 with the §28 fixtures (29-char name,
12,345,678 fee, 300 members): probe green, Add member reachable without
scrolling, rows ≥ 44 px, pagination targets ≥ 40, Add member creates a member
on the E2E gym with the footer visible at height 500, Edit round-trips, Day
pass issues, bulk-import sheet copy present and the fallback opens and closes
cleanly; 1366 regression unchanged; visual review against the blueprint
recorded (§29); one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 5 — Renewals + payment dialogs

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 5: Renewals and payment dialogs

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0 C2/C4, §8.6–§8.7, §8.10, §9.4, §12, §15.1, §25.4 "Renewals", §26 RENEWALS
blueprint, §27, §30–§31 open), `docs/architecture/mobile-ui-rebuild-audit.md`
§C Renewals row and §D "Tables",
`src/app/(dashboard)/payment-collection/PaymentCollectionPageClient.tsx` and
its test, `src/features/payments/components/{MarkPaidDialog,ReactivationDialog}.tsx`,
`src/components/ui/primitives/{Tabs,DataTable,ListRow,Pagination}.tsx`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p4` done; set `p5` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p5`.

Scope (§8.10): `TabsList overflow="scroll"` with the count badges;
`DataTable mobileRow` for the three tabs (visible: name, days-overdue badge or
due date, amount, both existing actions at dense size, Record payment first);
compact sort from the existing `sortValue`s; phone-only `pageSize={25}` with
`Pagination responsive` (desktop stays unpaginated); `MarkPaidDialog` and
`ReactivationDialog` get `placement="sheet"`.

Do NOT change behaviour: Remind sends on tap exactly as today (no confirm);
Record payment opens member detail exactly as today (no `intent`); Receipt
opens member detail; button variants keep their meaning. Desktop table,
tabs and actions unchanged.

Verify: phone-tier test asserts both actions render per row and the visible
set; Playwright at 320/390/430 with 100 dues and "299 DAYS AGO": both actions
visible without sideways scrolling, tab list scrolls and each tab is
reachable, Record payment opens the fullscreen detail with Mark Paid in its
footer, Remind writes one mocked `sms_logs` row on tap (ENABLE_REAL_SMS must
be false), pagination works; probe green; 1366 regression unchanged; visual
review recorded; one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 6 — Dashboard + Revenue

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 6: Dashboard and Revenue

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§8.1, §8.11, §9.2, §9.4, §12, §25.4 "Dashboard"/"Revenue", §26 DASHBOARD and
REVENUE blueprints, §27, §30–§31 open), `docs/architecture/mobile-ui-rebuild-audit.md`
§C Dashboard/Revenue rows and §D "Dashboards", `.claude/rules/architecture.md`
§2.22 (revenue is billed, not run-rate — touch no arithmetic),
`src/app/(dashboard)/dashboard/DashboardClient.tsx`,
`src/app/(dashboard)/revenue/RevenuePageClient.tsx` and their tests,
`src/components/ui/primitives/{Charts,ListRow,Progress}.tsx`,
`src/components/common/composites/{StatCard,ChartCard,SectionHeader}.tsx`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p5` done; set `p6` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p6`.

Scope:

- Dashboard (§8.1): `PageHeader` title hidden on phone (timestamp as a mono
  caption under the band); KPI band unchanged; chart `compactAxis` on phone;
  reminder queue rows as `ListRow`s; recent payments keep the `Table` on
  desktop and render `ListRow`s on phone via the tier hook (rows open member).
- Revenue (§8.11): month/year selects in a two-column row on phone; KPI band
  unchanged; chart `compactAxis`; breakdown keeps the `Table` on desktop and
  renders `ListRow`s with a share bar (`Progress`) on phone.

Do NOT change any query, computation, formatter or tile href. No new
component. Desktop compositions unchanged.

Verify: phone-tier tests assert the §9.4 visible/disclosed sets for the
queue, payments and breakdown; Playwright at 320/390/430: axis tick text is
complete (no leading-digit loss), tiles ≥ 44 px and navigate, rows open
member detail, probe green with the 99,999,999 fixture; 1366 regression
unchanged; visual review recorded; one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 7 — Analytics

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 7: Member Analytics

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0 C9, §8.12, §12, §13, §25.4 "Analytics", §26 ANALYTICS blueprint, §27,
§30–§31 open), `docs/architecture/mobile-ui-rebuild-audit.md` §C Analytics
row, `src/features/analytics/components/{MemberAnalyticsClient,RangeSelector}.tsx`
and tests, `src/components/ui/primitives/{DataTable,ListRow,Select,Charts}.tsx`
(`DataTable.renderExpanded` already exists — use it).

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p6` done; set `p7` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p7`.

Scope (§13): range selector as a dense snap-scrolling row on phone (same
buttons, same state); series control rendered as a native `Select` on phone
(same state variable); charts `compactAxis`; cohort matrix keeps the `Table`
on desktop and on phone becomes condensed `ListRow`s (primary cohort month,
value size, meta "M1 · M3 · M6" with "—" for missing) that expand to the full
M0–M12 series. VERIFY first that the cohort data exposes per-cohort arrays; if
not, raise an `AMENDMENT:` rather than reshaping data in the component.

Do NOT change any analytics computation, estimation or query; do not add a
"Jump to" menu; do not remove any value.

Verify: phone-tier test asserts every cohort's 13 values are present after
expansion and that the condensed row shows M1/M3/M6; Playwright at
320/390/430 with 24 cohorts: no horizontal overflow, controls ≥ 40 px,
expansion works by tap; 1366 regression unchanged; visual review recorded;
one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 8 — Membership Setup, Settings, Support, Subscription, Announcements

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 8: Setup, Settings, Support, Subscription, Announcements

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0 C2/C5/C13, §3.2, §8.13–§8.14, §8.16–§8.18, §9.4, §11, §25.4, §26
ANNOUNCEMENTS / MEMBERSHIP SETUP / SETTINGS blueprints, §27, §30–§31 open),
`docs/architecture/mobile-ui-rebuild-audit.md` §C rows for these screens and
§I row 4, `src/app/(dashboard)/billing-setup/{BillingSetupPageClient,PlanTypesTab,DiscountsTab,AdmissionFeeTab}.tsx`,
`src/app/(dashboard)/settings/layout.tsx`, `settings/security/page.tsx`,
`settings/policies/page.tsx`, `src/app/(dashboard)/support/page.tsx`,
`src/app/(dashboard)/settings/billing/BillingPageClient.tsx`,
`src/features/subscriptions/components/BillingHistoryTable.tsx`,
`src/app/(dashboard)/make-announcement/page.tsx`, `src/hooks/useHistoryBack.ts`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p7` done; set `p8` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p8`.

Scope:

1. Membership Setup (§8.13): keep the `mobileSection` state; render ONE tree
   by tier (no hidden desktop `Tabs` on phones); entering a section on phone
   calls `useHistoryBack` so back returns to the menu; AppBar shows Back +
   section label. Plan-type inline edit → `sheet` on phone with the same
   inputs and `updateMutation`; discounts table → `mobileRow`; add/edit
   discount → `sheet`. No routes, no new pages.
2. Settings (§8.14): Security's four modals → `sheet`; Policies textareas at
   the phone input size; touch sizing otherwise from primitives. Print unchanged.
3. Support (§8.16): nothing beyond primitive sizing — verify only.
4. Subscription (§8.17): billing history → `ListRow`s on phone (desktop
   `Table` unchanged); dialogs unchanged.
5. Announcements (§8.18): delivery log → `ListRow`s on phone (VERIFY whether
   the log is capped; if uncapped, phone `pageSize` 25); compose card and
   **Send behaviour unchanged** — no confirmation.

Do NOT add routes, confirmations, Share, or any new action; desktop tabs,
URLs and forms unchanged.

Verify: phone-tier tests for the five screens in both tiers; Playwright at
320/390/430: back from a Setup section returns to the menu, one request per
section endpoint on phones (network probe), every settings modal usable with
the footer visible at height 500, delivery log rows show the §9.4 set with the
320-char fixture; probe green; 1366 regression unchanged (desktop Setup tabs
and URLs identical); visual review recorded; one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 9 — Door Access + SMS / activity lists

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 9: Door Access, SMS history and activity lists

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5; keep
§0 C15, §8.15, §9.2, §9.4, §12, §25.4 "Door Access", §26 DOOR ACCESS
blueprint, §27, §30–§31 open), `docs/architecture/access-control-master.md`
(read before touching anything in the feature — rule 2.20: all writes go
through the admin client; you change no write path),
`src/features/access-control/components/{AccessControlDashboard,AccessActivityLog,DeviceStatusCard,MemberAccessPanel}.tsx`,
`src/features/sms/components/MemberSmsHistory.tsx` (deep-import only; the
`@/features/sms` barrel is server-tainted), `tests/e2e/helpers/access-control.ts`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p8` done; set `p9` in_progress; gates/notes/log; `if_version`.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p9`.

Scope: `AccessActivityLog` keeps its `Table` on desktop and renders `ListRow`s
on phone via the tier hook (visible: who, badge, when; disclosed: reader);
filter chips at the dense touch size; `DeviceStatusCard`s already stack —
verify only; `MemberSmsHistory` renders `ListRow`s on phone (visible: type,
status, sent at; disclosed: message clamped to two lines, tap to expand);
its pagination uses `Pagination responsive`.

Do NOT change any access-control service, route, outbox or write path; no
change to `MemberAccessPanel` behaviour; desktop tables unchanged.

Verify: phone-tier tests for both lists (visible/disclosed sets, long-message
fixture); Playwright as the Enterprise gym at 320/390/430 (the mock provider
answers, per the E2E helper notes): activity list rows and chips ≥ 40 px,
pagination works, probe green; SMS history inside member detail expands a
320-char message; Lite gym still sees no Door Access entry; 1366 regression
unchanged; visual review recorded; one test falsified by mutation.

Finish: tracker updated, branch pushed, PR opened. Stop.
```

---

## Phase 10 — Cleanup, sweep, sign-off

```markdown
# Metric Gym OS — Mobile UI Rebuild — Phase 10: Cleanup, sweep and sign-off

You are executing an approved plan; you do not discover the product design
while coding. Read: `docs/architecture/mobile-ui-rebuild-plan.md` (v1.5 — all
of it; keep §17, §19, §24, §27–§29, §30–§31 open),
`docs/architecture/mobile-ui-rebuild-audit.md` (every number there is a
before-value to compare against), `docs/architecture/workspace-ui-overhaul-closeout.md`
(the shape a closeout takes here), `.claude/rules/architecture.md` §2.21,
`.claude/DESIGN_SYSTEM.md`, `scripts/check-architecture.mjs`.

Tracker: https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d
— confirm `p0`–`p9` done; read every `EXCEPTION:`/`AMENDMENT:` log entry and
every `open` document; set `p10` in_progress; `if_version` on existing docs.

Branch: `git checkout master && git pull && git checkout -b claude/mobile-ui-rebuild-p10`.

Scope (plan §18 row 10):

1. Allow-lists: `UI1_ALLOW` loses every entry now consumed (`Drawer`, and any
   Phase 1 parking); UI6 allow-list to zero (migrate the remaining
   `sm:|md:|lg:|max-tablet:` composition switches in shell/DS layers — nothing
   in feature files unless it is a composition switch).
2. Delete dead code the rebuild orphaned (verify with UI1, never retheme).
3. Full run: probe + §28 stress fixtures on every `(dashboard)` route at all
   seven viewports; desktop regression suite; both-tier screen tests;
   `type-check`, `lint`, `arch:check`, `test`, token parity.
4. Visual review (§29) of every screen at 320/390/430 against its §26
   blueprint, recorded in the tracker log with screenshot names; correct
   deviations in this branch.
5. Definition of Done (§24) walked item by item with evidence for each; the
   physical-device safe-area check is requested from the project owner and
   recorded when done.
6. Docs: `architecture.md` §2.21 gains the mobile invariants as standing
   rules (breakpoint, tier hook, touch rule, no forks, one member detail);
   `DESIGN_SYSTEM.md` reflects every addition; write
   `docs/architecture/mobile-ui-rebuild-closeout.md` in the style of the
   workspace closeout (state, what merging does not finish, deferred §23-B
   items, how the work was checked); update `mobile-ui-rebuild-plan.md`'s
   version header.
7. Resolve or hand off every §23-A open decision in the tracker with an answer.

Do NOT widen scope into §23-B; do not "fix" anything that is not a deviation
from the plan or a DoD item — log it as a follow-up in the closeout instead.

Verify: every gate criterion for every phase re-checked and ticked in the
tracker; DoD evidence table in the PR; zero console errors on every route;
the audit's headline numbers now read: bar `scrollWidth === clientWidth`,
Members/Renewals/Revenue/cohort/dashboard tables no longer overflow at 390,
no interactive control < 40 px on any phone route.

Finish: tracker `p10` done with the closeout link in notes; PR opened;
request the human §29 sign-off. Stop.
```
