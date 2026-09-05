# Workspace UI Overhaul — Working Record

> **Why this file exists.** The overhaul spans many sessions. Decisions,
> measured baselines, and mid-execution corrections must not live only in a
> conversation. This is the **living record**: what was decided, what was
> measured, what was done, and what is still open. The plan (`…-overhaul-plan.md`)
> is stable; this file changes every phase.
>
> **Update this file at the end of every phase.** If a fact here contradicts
> the plan or the audit, this file is newer and wins.

## Document set

| Document                                       | Role                                                                                          | Stability         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------- |
| `METRIC_UI_DIRECTIVE.md`                       | **Authoritative mandate** — target state, banned patterns, execution order. Not ours to edit. | Fixed             |
| `workspace-ui-design-analysis.md`              | The as-built audit. Facts about the codebase as of 2026-08-29.                                | Snapshot          |
| `workspace-ui-overhaul-plan.md`                | Execution plan reconciling the two. Dispositions, phases, preconditions.                      | Revised per phase |
| **`workspace-ui-overhaul-log.md`** (this file) | Decisions, baselines, progress, open questions.                                               | Living            |

---

## 1. Decisions taken

| #      | Date       | Decision                                                                                                                                                                                                                                                                                              | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1** | 2026-08-29 | **Delete `layout/Sidebar.tsx`; do NOT add the `/access-control` nav entry.**                                                                                                                                                                                                                          | The file held the only `/access-control` link in the repo, but it was dead — the route was already unreachable. Directive §4.10 forbids changing navigation architecture. The gap pre-dates the overhaul; fixing it inside a visual-correction directive is the scope drift §4 exists to prevent. **Tracked as a separate functional fix — see §4 OPEN-1.**                                                                                                                                                                                                                    |
| **R2** | 2026-08-29 | **Dark only.** Delete the light `--ds-*` block and the `.mws-root` token scope outright.                                                                                                                                                                                                              | The Appendix says light "may remain technically available" but is not the canonical identity. Retaining it doubles Phase 3 verification for a variant that is not the product. There is currently no theme mechanism at all (no toggle, no persistence, no `prefers-color-scheme` handling, exactly one `dark:` utility in the workspace), so nothing is lost. Light can be reintroduced later against a clean dark baseline more cheaply than carried through the overhaul.                                                                                                   |
| **R3** | 2026-08-29 | **Keep the 11-component DECIDE set; do not retheme; re-evaluate after Phase 3.**                                                                                                                                                                                                                      | `CommandPalette`, `Accordion`, `Radio`, `Spinner`, `Popover`, `NotificationMenu`, `DeleteDialog`, `SectionHeader`, `FilterBar`, `Toolbar`, `SearchBar`. They consume tokens so they cost nothing dark. Four are likely consumed by §5.9 compact toolbars and §5.18 section structure. Deleting now risks rebuilding under new names, which §4.4 bans.                                                                                                                                                                                                                          |
| **R6** | 2026-08-30 | **Keep the mobile bottom bar.** Mobile is being rebuilt from scratch in a separate effort.                                                                                                                                                                                                            | Reverted the `Drawer`-based mobile navigation from Phase 3.1. This pass tokenises the existing bars only — hardcoded `#fff` gone, DS `Avatar`/`Button`, `aria-current` added — with no layout or behaviour change. The nine-items-in-a-76px-scroller overflow is a mobile IA problem and is deliberately left for that effort.                                                                                                                                                                                                                                                 |
| **R7** | 2026-08-30 | **Selection has two treatments, split by meaning, not by component.** A _fill_ (`surface-selected`) marks persistent selection state — sidebar, table rows, segmented controls. A _2px ink rule_ marks local position within a page — settings sub-nav, `Tabs`. `surface-selected` stays at **0.30**. | Resolves V4 without moving the token a third time. Two indigo fills stacked on `/settings` (sidebar "Settings" containing sub-nav "Gym Information") read as §5.14's "large colourful pill". The contrast arithmetic wants the token high — at 0.26 the selected state sits 0.0004 above `surface-active` and at 0.24 it inverts, reproducing the pass-1 defect. Separating the two _levels_ of navigation satisfies both constraints. Also demoted the analytics segmented controls off `variant="primary"`, which had made a range filter the brightest element on its page. |
| **R5** | 2026-08-29 | **Scope is every surface except the landing page.** `/contact`, `/join/[token]`, `/demo-sms`, the auth pages and the legal pages are all IN.                                                                                                                                                          | User instruction. My initial lint scoping excluded marketing/auth/legal as "out of scope" — too narrow a reading. Widening surfaced 47 previously-hidden violations: `LegalLayout` (24 hex-in-style), `/contact` (24), `pwa/ServiceWorkerRegistration` (2), `(auth)/register` (2). Only `src/components/landing/**` + `src/app/page.tsx` remain excluded, plus `qr-poster.tsx` (rendered by Satori to a PNG — no browser, no token layer).                                                                                                                                     |
| **R4** | 2026-08-29 | **Type-scale fix moves from Phase 0 to Phase 1.**                                                                                                                                                                                                                                                     | Aliasing `text-sm` 14px→13px changes 244 sites. That is a deliberate _visual_ change, and Phase 0 is defined as non-visual. It is also a token concern, so it belongs in §8.1 ("audit current token values; identify every token contributing to the soft/generic appearance"). Ordering constraint is preserved — Phase 1 still precedes Phase 3 recomposition.                                                                                                                                                                                                               |

---

## 2. Measured baselines

Captured so progress is measurable and regressions are detectable. Re-measure at
the end of each phase.

| Metric                                      |       At audit |                      Now | Target |
| ------------------------------------------- | -------------: | -----------------------: | -----: |
| `eslint` errors                             |             97 |                    **0** |      0 |
| Raw-colour violations (rule is now `error`) |           ~150 |                    **0** |      0 |
| `mws-*` CSS lines / files / occurrences     | 589 / 12 / 168 |            **0 / 0 / 0** |      0 |
| Soft radii outside the dev showcase         |           ~130 |                    **0** |      0 |
| Drop shadows / gradients / blur             |             13 |                    **0** |      0 |
| Nested surfaces inside a `Card`             |              6 |        **1** (justified) |     ≤1 |
| Status-indicator languages                  |              5 |                    **2** |      1 |
| Type utilities on the Metric scale          |             50 |                 **~515** |    all |
| Type utilities off-scale (`text-2xl`+)      |            469 |                    **0** |      0 |
| Ad-hoc hand-copied card divs (files)        |             25 |           **1** (mobile) |      0 |
| Dead / unreachable UI (lines)               |          6,026 |                   ~1,400 |      0 |
| Components allowlisted in UI1 (must shrink) |              — |                       24 |      2 |
| L1 token parity (CSS ↔ JS)                  |       44 vs 34 | **equal, test-enforced** |  equal |
| Tests                                       |          1,347 |                **1,464** |      — |
| Rewritten screens rendered by a test        |        0 of 12 |             **12 of 12** |     12 |

### 2.1 Live adoption after Phase 4

Verified by JSX usage outside tests and the dev showcase. Note the earlier
counts in this file were produced by name-matching and over-reported: `Tooltip`
matched **recharts'** Tooltip inside `Charts.tsx`, and `Spinner` is live only
transitively, through `Button`'s loading state.

**Primitives with no product usage (6 of 32):** `Accordion`, `CommandPalette`,
`Divider`, `Drawer`, `Radio`, `Tooltip`.

**Composites with no product usage (5 of 14):** `Toolbar`, `FilterBar`,
`EmptyStateLayout`, `DeleteDialog`, `NotificationMenu`.

**Newly mounted during Phase 3** (all previously zero-consumer): `SideNav`,
`Breadcrumb`, `UserMenu`, `DropdownMenu`, `Avatar`, `DataTable`, `Pagination`,
`SearchBar`, `SectionHeader`, `SettingsSection`, `LoadingLayout`, `Tabs`.

> `Drawer` returned to unused when **R6** reverted the mobile navigation. It is
> a directive target for §5.20 and stays allowlisted for the separate mobile
> effort.

**Note on the 519 → 412 drop:** not a fix. Phase 0.1's deletions removed 107
type-scale violations along with the dead files that contained them.

---

## 3. Execution log

### Phase 0.1 — Delete dead code · **DONE** 2026-08-29

16 files, 3,820 lines removed. `src/components/dashboard/` and
`src/components/layout/` became empty and were removed entirely.

| Group                                                                                                                                    | Files | Lines |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----: | ----: |
| Payments table suite (`PaymentRemindersTable`, `SMSHistoryModal`, `ReminderStatusTable`, `RegularPaymentTable`, `PaymentCollectedTable`) |     5 | 1,813 |
| `MembersTable`                                                                                                                           |     1 |   673 |
| `PaymentCollectionModal`                                                                                                                 |     1 |   424 |
| `components/dashboard/*` (`MetricCard` + 4 KPI cards)                                                                                    |     5 |   282 |
| `components/layout/*` (`Sidebar`, `Header`, `EmailVerificationBanner`)                                                                   |     3 |   528 |
| `RevenueChart`                                                                                                                           |     1 |   100 |

Also: pruned `MembersTable` + `PaymentCollectionModal` from
`features/members/index.ts`; removed a stray `METRIC_UI_DIRECTIVE.md:Zone.Identifier`
WSL artifact; corrected the `src/components/` folder list in `CLAUDE.md:65` and
`.claude/rules/architecture.md:60`, which both still named the two deleted folders.

**Verification:** `tsc --noEmit` clean · `arch:check` clean · Jest 1,347 passed
/ 114 suites / 0 failures · `eslint` 97 errors, **identical to clean `HEAD`**
(pre-existing, not caused by this work).

### Phase 0.2 — Enforcement ratchets · **DONE** 2026-08-29

Nothing in the repo could detect the drift the audit found. Two mechanisms added,
both **ratchets** carrying a baseline of known exceptions that may only shrink.

**`check-architecture.mjs` — UI1: no component reachable only via a barrel.**
Resolves exported identifiers per module (covering default exports and
`next/dynamic` path references, per C3) and treats a reference from an `index.ts`
or the dev showcase as _not_ usage. This is the check that would have caught all
6,026 dead lines. Baseline allowlist: the 11 R3 components, the 10 directive
targets to be mounted in Phase 2/3, the 2 `DESIGN_SYSTEM.md` §12 staged
components, and `UrgencyBadge` (C6).

**`check-architecture.mjs` — UI2: the `mws-*` layer may not spread.**
12 files may contain `mws-*` today; any new file fails. The rule is
**bidirectional** — a file that _stops_ using `mws-*` must be removed from the
allowlist, so a completed migration cannot silently leave a stale exemption.

**`eslint.config.mjs` — design-token restrictions.** Bans raw Tailwind palette
utilities (string and template-literal `className`s) and hex/`rgba()` literals in
inline `style`. Two tiers, **order-dependent**: a `warn` block for everything in
scope, then an `error` block overriding it for paths already at zero. Flat config
is last-match-wins, so block order is load-bearing — getting it backwards
silently downgrades the error tier. That happened on the first attempt and was
caught only by a throwaway probe file, not by the warning counts.

Error tier today: `features/{payments,access-control,analytics,announcements,revenue}`.
`components/workspace` is deliberately **not** in it — it holds the 5 hex literals
that block the dark flip. It graduates in Phase 1.3.

**Verification:** both tiers confirmed with probe files (error tier errored, warn
tier warned; both removed). `arch:check` clean · `tsc` clean · Jest **1,343
passed / 113 suites** · `eslint` **97 errors** (unchanged baseline) + **157**
token warnings now surfaced.

### Phase 0.1b — Transitive orphan sweep · **DONE** 2026-08-29

Triggered by UI1 firing on its first run (see C6). Deleted `PaymentDetailsModal`
(300), `ProAvatarRing` (50) and `ProAvatarRing.test.tsx`; pruned both barrels;
iterated to a fixed point. `utils/badge-colors.ts` dropped from 7 consumers to 3
— still live, still deferred to Phase 3 per C1.

> **Test flake observed.** One run showed a single failing test that did not
> reproduce across four subsequent runs (exit 0 each time). Not caused by these
> changes. If it resurfaces, capture the suite name — currently unidentified.

### Phase 1.1 — Type scale re-pointed · **DONE** 2026-08-29

The Metric type scale had been **added to** Tailwind's defaults rather than
replacing them, so `text-sm` (14px) and `text-base` (16px) stayed valid and beat
the design tokens 412 to 50. Both are off-scale, and both render _larger_ than
the 13px body the workspace sets — secondary text outweighed primary text.

Fixed in `tailwind.config.ts` by re-pointing the default keys, which corrects
every existing call site without touching a component:

| Utility     | Was   | Now       | Metric size      |
| ----------- | ----- | --------- | ---------------- |
| `text-xs`   | 12/16 | 12/16     | already on-scale |
| `text-sm`   | 14/20 | **13/20** | `body`           |
| `text-base` | 16/24 | **14/20** | `h3` size        |
| `text-lg`   | 18/28 | **16/24** | `h2` size        |
| `text-xl`   | 20/28 | 20/28     | already on-scale |

Size and line-height only — **no weight, no tracking**. This is a size
correction, not a semantic upgrade; anything wanting full heading treatment uses
`text-h1`/`text-h2`/`text-h3`.

`text-2xl` and larger are deliberately **not** re-pointed: those 13 sites carry
both page titles and KPI values, which need the readout decision in Phase 2
(OPEN-4). Collapsing them now would flatten a KPI number to page-title size and
be redone.

**405 call sites** now resolve to Metric sizes; 13 remain off-scale by design.
The DS primitives were unaffected — only `StatCard` (`text-2xl`, deferred) and
`UrgencyBadge` (`text-xs`, unchanged) used the default scale at all.

**Verified in compiled CSS**, not just config: `npx tailwindcss` output confirms
`.text-sm{13px/20px}`, `.text-base{14px/20px}`, `.text-lg{16px/24px}`, with
`.text-body` and `.text-h2` intact and `.text-2xl` still 24px.

**Gate:** `arch:check` clean · `tsc` clean · Jest 1,343 passed · `eslint` 97
errors (unchanged baseline).

> **Not yet visually reviewed.** This is a deliberate, wide visual change —
> every screen gets slightly denser. Constraint D requires inspecting rendered
> composition; that happens at the Phase 1 exit gate alongside the dark flip.

### Phase 1.2 + 1.3 — Dark-first tokens and the shell · **DONE** 2026-08-29

**Retuned, not inverted** (§5.1). The old dark block was a _marketing_ dark
theme; an operational surface needs different relationships:

- **Three-step surface ladder** — base `#08080a` → panel `#0d0d10` → card
  `#131317`. Shallow, because cards are exceptional objects (§5.4).
- **Borders carry all structure**, since shadows are banned (§5.12), so
  `border-1` went `0.07` → `0.10` alpha and `border-strong` `0.30` → `0.38`.
- **Accent restrained** — `#1b17ff` → `#4a47d1`. Full chroma glows on near-black;
  §6 bans glow and §9.3 flags excessive blue. Brand hue preserved.
- **Selection is a system state** — `surface-selected` is now accent-tinted
  `rgba(74,71,209,0.18)` rather than a neutral wash (§5.7: BLUE = selected).
- **`text-muted` lifted** `#64646d` → `#7d7d88` to hold WCAG AA (~4.9:1) on the
  canvas; the old value measured ~4.3:1.
- **`shadow-overlay` is now a hairline ring** `0 0 0 1px rgba(255,255,255,0.14)`,
  not a drop shadow — elevation via a 1px boundary (§5.12).
- **Focus ring 3px → 2px** for density (§5.9).

**Light deleted (R2).** `globals.css` no longer declares a light `--ds-*` block.
`[data-theme='light']` is deliberately _mapped_ to the dark values rather than
left dangling, so a stale stamp inherits the real palette instead of resolving
to nothing. `lightColors` in `tokens.ts` is now an alias of `darkColors`.

**The exit gate — 15 CSS hardcodes tokenized.** Every `rgba(0,0,0,α)` in the
`mws-*` layer was a _darken-the-surface_ state that would have gone invisible.
Fixed, notably: sidebar active item and settings sub-nav active → `surface-selected`;
toggle track → `surface-active`; overlay → `surface-overlay`; both modal/drawer
drop shadows → the hairline ring. `.mws-btn-primary:hover` was `background:#000`,
which would have rendered the primary button _black on black_.

**Shell tokenized (1.3).** All 6 hardcoded values replaced; `WorkspaceShell` now
stamps `data-theme="dark"`. `grep` for `#fff`/`rgba(0,0,0` in
`src/components/workspace/` returns nothing.

**One token added**, via the §4.5 path (add → sync all three L1 files → consume):
`--ds-primary-hover`, required because §5.19's action hierarchy had no primary
hover value.

**Verified in the production bundle, not just the config.** `next build` succeeds
on every route; `.next/static/chunks/*.css` contains exactly one
`--ds-surface-base:#08080a`, `--ds-accent:#4a47d1`,
`--ds-surface-selected:#4a47d12e`, and zero `#f4f4f5`.

**Gate:** `arch:check` clean · `tsc` clean · `next build` clean · Jest **1,348
passed / 113 suites** · `eslint` 97 errors (unchanged baseline).

> **Still unreviewed visually.** Constraint D is not satisfied by a green gate.
> The workspace is now dark in code and in the compiled CSS; whether it _reads_
> as an operational control system is a Phase 4 judgement, and Phase 2/3 have not
> yet touched composition.

### Phase 2 — Primitives and composites · **DONE** 2026-08-29

**L1 parity closed and now enforced (C8).** The gap was smaller than feared —
only `accentBg` and `accentBorder` were genuinely unmirrored; `border1/2/3`
false-flagged because my extraction regex excluded digits. Added a
`token-parity.test.ts` that reads `globals.css` and compares it to the JS mirror
in both directions. The lesson of C8 was that nothing checked this; now
something does.

**Radius reduced (§5.13).** 20 files retuned; `rounded-md|lg|xl` → `rounded-sm`
across every primitive and composite. Soft radii in the DS: **35 → 1** (the
`Switch` track, which is a pill by nature). Genuine circles preserved — avatar,
status dot, switch knob, unread dot. `Progress` moved from `rounded-full` to
`rounded-xs`: a progress meter is an instrument readout, not a pill.

**Badge rewritten as a signal (§5.7).** Now `● ACTIVE` — a status dot plus an
uppercase mono label, **no fill and no border**. The dot appears automatically
for coloured variants, so status is never conveyed by colour alone, and it is
`aria-hidden` so the label carries the meaning. A `chip` variant restores the
bordered container for the exceptional case (§10 — a variant, not a second
component). Six contract tests added.

**`badge-colors.ts` deleted — C1 closed, ahead of schedule.** With Badge
borderless, the pastel `className` overrides had nowhere sensible to sit. Plan
type is _metadata, not status_, so the three live call sites now render
`<Badge variant="neutral">`. The module and its test are gone.

**StatCard de-contained (§5.5, §8.4).** Borderless and unfilled by default; the
four-floating-tile row is the first pattern §9.3 names in its smell test. The
three KPI grids became **information bands** — `divide-x divide-line-1
border-y` — so alignment and hairlines separate the figures instead of four
boxes. A `boxed` prop covers the §5.4 exception.

**ChartCard is now a section, not a card (§5.16).** Label row, hairline, chart.
This also removes a real §5.3 violation: the old `Card` wrapper made every chart
on a carded page a second nested boundary.

**OPEN-4 resolved** — added a `readout` type token (24px/28px, mono tabular at
the call site) via the §4.5 path, synced to both L1 files. That was the last
off-scale size in the DS; `text-2xl` no longer appears in any primitive or
composite.

**Audited, deliberately unchanged:** `Table` already meets §5.6 — `px-4 py-2`
rows, 13px body, uppercase metadata headers, right-aligned mono tabular
numerics. `Card`, `Button` and `Input` needed only the radius change; their
variant matrices already satisfy §5.19. `SideNav` and `DataTable` are mounted in
Phase 3, so auditing their _composition_ is premature.

**Gate:** `arch:check` · `tsc` · `eslint` **0 errors** · Jest **1,347 passed** ·
`next build` — all clean.

### Phase 3.1 — The shell · **DONE** 2026-08-30

The shell is now composition and data only; all three files consume DS
composites, and none contains a `mws-*` class.

**Two primitives had to be extended first (§7 — extend, never fork):**

- `SideNav` rendered a plain `<a href>`. Mounting the shell on it as-is would
  have turned every navigation into a full document reload — a §4.10 functional
  regression. Added `linkComponent`, so the app supplies `next/link`.
- `Breadcrumb` had only `BreadcrumbLink` (an `<a>`) and `BreadcrumbPage`. The
  workspace trail needs a _non-interactive_ leading segment (the gym name is
  context, not a destination), so `BreadcrumbItem` was added rather than making
  the gym name a link — which would have been a navigation change §4.10 forbids.

**Sidebar** → `SideNav`. This alone closes four accessibility gaps the
hand-written rail had: no `aria-current="page"`, an unlabelled `<nav>`, a
collapse button with no accessible name when collapsed, and an active state of
`rgba(0,0,0,0.09)` that was invisible on the dark ground.

**Header** → `Breadcrumb` + `Badge` + `UserMenu`. The trail was previously two
spans and a `/` literal, carrying no breadcrumb semantics. **The workspace now
has an account menu** — `UserMenu` was built for exactly this and had never been
mounted (finding F11); the old header offered a non-interactive avatar beside a
bare logout icon.

**Mobile navigation** → a `Drawer` containing the same `SideNav`. The bottom bar
laid nine destinations out at a 76px minimum — roughly 684px inside a ~390px
viewport — so **more than half the navigation was off-screen behind a horizontal
scroll with no affordance**. Reusing `SideNav` means mobile and desktop are one
navigation rather than two that can drift (§5.20: "Desktop Metric and mobile
Metric must feel like the same operating system").

> This changes the mobile navigation _mechanism_ (persistent bar → drawer), not
> the navigation architecture: same routes, same groups, same hierarchy, and
> §5.20 explicitly sanctions drawers. Flagged rather than buried, because §4.10
> is strict and this is the closest call taken so far.

**Also removed:** the `.mws-main` offset (a CSS rule driven by a `--mws-sb-w`
custom property set from JS — now a conditional Tailwind class) and the
`.mws-nav-item*` rules. 27 lines of CSS deleted; the `mws-*` block is down from
589 to 562 lines and the UI2 allowlist from 12 files to 9.

**One token exposed:** `h-bar` (52px), mirroring the `layout.breadcrumbHeight` /
`workspaceSelectorHeight` tokens that existed in `tokens.ts` but were consumable
from nothing.

**Gate:** `arch:check` · `tsc` · `eslint` 0 errors · Jest 1,347 · `next build` —
all clean.

### Phase 3.2 — Dashboard, revenue, analytics · **DONE** 2026-08-30

De-contained per §4.3 ("the default is no container"). The reminder queue,
recent payments, revenue breakdown and cohort retention were each wrapped in a
`Card` for no structural reason; they are now `<section>` + a labelled hairline.
The one `Card` left on the dashboard is the error state, which _is_ a discrete
object (§5.4).

**Section headers consolidated.** `SectionHeader` (previously zero consumers)
gained a `metadata` variant — the 11px uppercase tracked label the directive
uses for operational regions (§5.8) — and a `divider`. `ChartCard` now composes
it, so there is one section-header implementation instead of ChartCard's inline
copy plus an unused composite.

### Phase 3.3 — Members onto DataTable · **DONE** 2026-08-30

The primary screen, rebuilt from a hand-written `mws-table`. Retires
`mws-table`, `mws-btn`, `mws-input`, `mws-select`, `Panel` and `StatusBadge`
from this page, and mounts `DataTable`, `SearchBar` and `Pagination` — all three
previously unused.

**Search and pagination stay server-side.** `DataTable`'s `searchable` and
`pageSize` are **client-only**: they would have filtered and paginated just the
20 rows already fetched, silently breaking both. `SearchBar` (which supplies the
debounce the page used to hand-roll) and the `Pagination` primitive are composed
around the table instead. Worth knowing before the renewals migration — the
"full-featured" table does not do server-side data.

**Status display consolidated.** Added
`features/members/utils/memberStatusIndicator.ts` — one map from status to
`{ variant, label }`, replacing four: `getStatusVariant` duplicated
byte-for-byte across the two detail modals, a colour-only `getStatusDotClass`,
and a `memberBadge` that alone knew about "expires soon". Six tests, including
one for a real behaviour change: unknown statuses previously defaulted to
success, i.e. **a member in an unrecognised state was reported as healthy**. It
now falls back to neutral.

### C11 — `DataTable` had the same accessibility defect as the table it replaces

Migrating to the primitive did **not** fix finding F8. `TableRow`'s `clickable`
prop added `cursor-pointer` and nothing else — no `tabIndex`, no key handler —
so `DataTable`'s `onRowClick` was mouse-only exactly like the hand-written
`<tr onClick>` it replaced. Opening a member is the primary action of the
primary screen, and it would have stayed keyboard-inaccessible while _looking_
like it had been fixed by adopting the design system.

Fixed in `TableRow` (so every consumer benefits, not just members): a tab stop,
Enter/Space activation, a visible focus state, and event-target checks so
keystrokes aimed at a control inside the row are left alone. Four regression
tests.

_Lesson:_ "migrated onto the design system" is not evidence of correctness. The
primitive can carry the same defect — and adopting it then launders the defect
as a fix.

### Phase 3.4–3.7 — Renewals, settings, support · **DONE** 2026-08-30

**Renewals → `Tabs` + `DataTable`.** The tab bar was three plain `<button>`s, so
it had none of the roving focus, arrow-key navigation or `aria-selected` wiring
Radix Tabs provides. Unlike members, all three data sets are fetched whole and
filtered client-side, so `DataTable`'s own sorting applies directly.

**Settings, policies, support → sections.** `SettingsSection` was itself a
bordered card, which made every settings page an instance of the
`Page → SettingsCard → SettingsRow` composition §5.3 names as banned. It is now
a labelled section over hairline-separated rows (§5.18), composing
`SectionHeader` like everything else, with a `boxed` escape.

**The settings master/detail was five bespoke CSS classes full of `!important`**
(`mws-settings-shell`, `-nav-root`, `-nav-sub`, `-content-root`, `-content-sub`).
Same behaviour, expressed in layout classes; the rules are gone.

**`workspace/primitives.tsx` deleted** — its `Panel`, `PanelHead`, `StatusBadge`,
`formatLKR` and `initials` all had DS equivalents once their consumers migrated.

### Phase 3.8 — The legacy design system is retired · **DONE** 2026-08-30

**562 lines deleted from `globals.css`** — the entire `.mws-*` layer: its own
button, badge, table, input, panel, tab, sub-nav, toggle, modal and drawer
implementations. `globals.css` is 1,220 → 606 lines. No source file references
an `mws-*` class; the only survivors are historical comments explaining what was
replaced.

**The UI2 allowlist is empty**, and the rule now fails on _any_ new `mws-*`.
Twelve files at the start of Phase 0, zero now. It shrank on schedule at every
step — and caught four migrations that would otherwise have left stale
exemptions behind.

One deliberate behaviour change: the sidebar-collapse localStorage key was
renamed `mws-sidebar-collapsed` → `metric:sidebar-collapsed`. A sidebar
collapsed before the rename reopens expanded once. Preference reset, not data
loss.

**The workspace now runs on one design system.**

**Gate:** `arch:check` · `tsc` · `eslint` **0 errors** · Jest **1,357 passed** ·
`next build` — all clean.

### Phase 3.9 — Admin surface and the last raw colour · **DONE** 2026-08-30

**Admin grounded.** `(admin)` rendered `<div className="admin-layout">` — an
inert class with no CSS — so it had no surface of its own and mixed DS colour
tokens with `container mx-auto` and `text-3xl`. It now sits on the same dark
ground with the same page grammar (`PageHeader`, `max-w-app`, sections).
Deliberately **no navigation added**: that would be a §4.10 change, and the two
admin routes are reached directly.

**Raw colour eliminated: 150 → 0.** `LegalLayout` was the interesting one — it
hardcoded the _pre-retune_ dark hexes (`#0a0a0b`, `#ededf0`, `#9b9ba4`), so the
legal pages would have rendered the old palette, silently out of sync with
everything else after Phase 1.

**The design-token lint rule is now `error` everywhere in scope**, with no
per-directory tiers left to graduate. Verified with a probe file.

### Phase 4 — Verification audits · **DONE** 2026-08-30

**§9.2 immediately earned its keep.** The composition audit found **94 soft
radii, 9 drop shadows and a gradient still in feature and page code** — Phase 2
had retuned the primitives, and I had taken that for the system. This is exactly
the failure §9.2 names: _"changing a shared primitive does not automatically fix
composition."_ All squared to the low end and stripped.

**§5.3 nesting.** Six candidates found, five real (the sixth was `Card.tsx`
itself, which _defines_ the class string). Fixed: a table's own border inside a
card, a conditional form drawn as a box rather than a divided section, a QR
wrapper adding a border around something that already carries its own ground,
counter tiles filled inside a card, an error block filled inside a card. The one
kept is the raw cron output `<pre>` — vendor error text is a genuinely
independent data surface, which §5.3 permits explicitly.

**§9.3 smell test.** Findings and fixes:

| Smell                                   | State                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four identical KPI cards across the top | Gone — borderless readouts in a divided band                                                                                                            |
| Every section in a rounded rectangle    | 17 `Card` files remain, all reviewed; the rest are sections                                                                                             |
| Icon + heading + description repeated   | `SectionHeader` has no icon slot — 0 by construction                                                                                                    |
| Excessive badges                        | `Badge` is a borderless dot + label; `chip` used 0 times                                                                                                |
| Excessive blue accent                   | Accent restrained to `#4a47d1`; raw palette 0                                                                                                           |
| Gradients / glow / glass                | 0 — **the `backdrop-blur` on Modal, Drawer and CommandPalette was removed**; §5.12 and §6 both ban blur, and it was the last glass effect in the system |
| Accent bar / rail                       | 0 — removed from `system-health`, `TrialBanner` and `PastDueBanner`                                                                                     |

> **A correction on myself.** While de-nesting `AnnouncementProgress` I replaced
> a filled error block with a `border-l-2` accent rail — reintroducing the exact
> pattern I had just deleted from `system-health` for being a §9.3 smell. Caught
> on the next grep and replaced with a hairline row. Recorded because it is the
> drift §4.8 predicts: the banned grammar creeps back in as a local judgement
> that looks reasonable in isolation.

**Gate:** `arch:check` · `tsc` · `eslint` **0 errors, 0 token warnings** ·
Jest **1,357 passed** · `next build` — all clean.

---

### Phase 5 — Visual sign-off, screen tests, structural tail · **DONE** 2026-08-30

Ran the visual pass **first** this time, which is what pass 4 concluded should
happen. Seven screens at 1440×900, zero console errors, and the operational
grammar holds: the members toolbar is one row, "1 record" is singular, the KPI
band reads as a band.

**One measurement my eye got wrong, corrected by the DOM.** I recorded that the
empty table on `/payment-collection` sat in a bordered box while the populated
one on `/members` did not. Computed styles say both wrappers are
`rounded-sm border border-line-1 bg-surface-card`, identical, radius 4px. There
was no defect. Logged because the instrument lesson runs the other way here too:
the screenshot suggested a difference that did not exist, and only reading the
computed style settled it.

**V4 — resolved by ruling.** The settings sub-nav no longer fills its current
item. Fill is now reserved for _persistent selection state_ (sidebar, table
rows); _local position within a page_ is marked with the 2px ink rule `Tabs`
already uses. `surface-selected` is **unchanged at 0.30**, so the interaction
ladder measured in pass 1 (hover 0.00808 < active 0.01169 < selected 0.01472)
is untouched and its guarding test still passes. The arithmetic wanted the token
high; §5.14 wanted the fill quiet; separating the two _levels_ of navigation
satisfies both without moving the token a third time. Guarded by
`SettingsLayout.test.tsx`.

**New finding — the segmented controls were a third selection language.**
`/member-analytics` marked its selected range and metric segments with
`Button variant="primary"` — `rgb(242,242,245)` solid, the near-white this app
reserves for one call to action per screen. `YTD` and `Sign-ups` were therefore
the brightest elements on the page, above the KPI values they qualify (§5.11
"strong contrast only for levels 1–2"; §5.19 "not every action is prominent").
Moved to `surface-selected`, the app's existing selection fill. Verified in the
render: the KPI row is now the brightest thing on the screen.

**New defect — "Revenue · Trailing 1 months".** Same class as the "1 records"
count pass 4 found, on a new gym's dashboard. Fixed and pinned. A sweep for the
sibling pattern across `src/` found the other user-facing counters already
handle it (`whenLabel` special-cases 0 and 1); the remaining unpluralised
strings are logs, or aria-labels on `UrgencyBadge`, which is allowlisted dead
code.

**V5 — NOT REPRODUCIBLE; it is a `next dev` artifact, not a defect.**
Pass 4 recorded a hydration mismatch on `/login`
(`style={{paddingRight:52}}` vs `padding-right:"52px"`). Four instruments say
otherwise:

1. `/login`, `/register`, `/verify-email` and `/` produce **zero** console
   errors, warnings or page errors — cold browser context and after a reload.
2. The SSR stream for `/login` emits `style="padding-right:52px"`, which is
   exactly what React computes on the client. There is nothing to mismatch.
3. The error **is** reproducible on demand, but only by forcing a recompile:
   warm load of `/settings/security` → 0 errors; `touch` the page file, reload
   → 1 hydration error. `next dev` streamed HTML from the pre-recompile module
   graph and hydrated it against the new client bundle.
4. **A production build serves 12 workspace routes with zero hydration errors
   and zero console errors.**

So the finding is closed as a dev-server artifact. Recorded in full because the
next session would otherwise re-hunt it, and because "I could not reproduce it"
is a weaker claim than the four probes above.

**Structural tail (§9.2).**

- Off-scale type utilities **14 → 0**. (The log said 16; the real count was 14 —
  another approximate headline number.) OPEN-4 unblocked this: `2xl`+ were
  deliberately left un-repointed pending the readout decision, and `readout`
  now exists. Values and counts → `text-readout`; document headings →
  `text-display-sm` / `text-h1`. `JoinForm`'s three sites went onto
  `display-sm`/`display`, sizes chosen to preserve its consumer tone —
  OPEN-3 defers _tone_, but off-scale Tailwind defaults are a token-compliance
  question and §4.5 does not defer.
- Ad-hoc card divs **17 files → 1**. `Card`'s root is byte-for-byte what they
  hand-copied (`rounded-sm border border-line-1 bg-surface-card`), so the swap
  is visually neutral and removes a second implementation of the primitive
  (§2.17). Verified by re-rendering `/settings/security` and `/billing-setup`.
- One §5.3 depth-two violation removed: `MemberDetailModal` wrapped its payment
  table in a bordered surface _inside the modal_ — `Modal → Card → Table`, the
  banned shape. `Table` draws its own header rule and row boundaries, so the
  wrapper added a boundary and nothing else. The QR poster frame inside the
  per-gym card on `/qr-codes` was the same thing; it kept its padding (the code
  needs a quiet zone) and lost its border.
- `MemberDetailModalMobile`'s payment tiles are the one remaining hand-copy.
  **Deliberately left**: R6 records that mobile is being rebuilt separately, and
  recomposing a mobile list here would collide with that effort.

**§5.18 settings composition — closed after the first pass left it open.**
`/settings/security` rendered as four stacked cards while `/settings/gym`, one
click away in the same menu, used `SettingsSection`. The first sweep deduped
the _implementation_ (hand-copied divs → the `Card` primitive) and recorded the
_composition_ as still open; it is now one labelled section over four
hairline-separated rows, each the same shape — identity, current value, action.
The conversion also exposed a duplicated heading (page-level `h2` "Account
security" directly above a section header reading ACCOUNT SECURITY), removed
per §9.3. Guarded by a test that asserts the rendered surface rather than the
imports, since the defect was compositional: a page can import the right
primitive and still stack four bordered boxes.

**B1 closed — the highest-value item in the whole check.** See below.

### B1 — screen tests · **CLOSED** 2026-08-30

The inverted check's standing conclusion was that the highest-value remaining
work was not more visual change but tests that render what was rewritten.
**Zero of the twelve rewritten screens were rendered by any test; all twelve now
are.** 1,357 → 1,457 tests, 100 added across 12 files, plus one harness at
`src/test-utils/renderScreen.tsx` (a `QueryClientProvider` wrapper, a
URL-routing `fetch` mock that **throws** on an unmatched request, and the
`ResponseBuilder` envelope helper).

| Screen                         | Tests | Notable pin                                       |
| ------------------------------ | ----: | ------------------------------------------------- |
| `MembersPageClient`            |     8 | singular "1 record"; **no column sort** (A2)      |
| `PaymentCollectionPageClient`  |    10 | all four SMS-type boundaries; tab partition       |
| `DashboardClient`              |    14 | "Trailing 1 month"; `whenLabel` 0/1/n             |
| `MemberAnalyticsClient`        |    12 | metric→series lookup; segmented-control fill      |
| `RevenuePageClient`            |     7 | no divide-by-zero; plan union                     |
| `QrCodesDashboardClient`       |    10 | rotation is confirmed before it fires             |
| `WorkspaceSidebar`             |     7 | exactly one `aria-current`; named collapse toggle |
| `SettingsLayout`               |     7 | **V4: rule, not fill**                            |
| `GymInformationPage`           |     6 | logout precedes register-new-gym                  |
| `WorkspaceHeader`              |     6 | **logout re-entrancy (A1-1)**                     |
| `SupportPage`                  |     5 | draft survives a failed send                      |
| `SystemHealthPage` + cron grid |     6 | raw vendor error reaches the operator (§2.9)      |

**Every assertion that guards a known defect was falsified before being
trusted** — the source was mutated to reintroduce the defect and the test had to
fail. Nine mutations, and the discipline earned its keep three times:

1. **A test that passed for the wrong reason.** The logout re-entrancy test
   clicked "Sign out" three times and asserted one POST. It passed _with the
   `useRef` guard deleted_ — because the Radix menu closes on select, so clicks
   two and three landed on a detached node. Rewritten to hold the request open
   and reopen the menu, which is the only path a user can actually re-enter.
   It now fails correctly (expected 1, received 2).
2. **A mutation that was a no-op.** Restoring `variant="primary"` on the
   segmented control did not fail the test — `twMerge` strips the losing
   background, so the render was unchanged. The real revert (variant _and_
   className) fails it.
3. **Two of my own tests were vacuous** until a stub was fixed: an incomplete
   `@/features/members` mock made `DashboardClient` throw, and the empty-queue
   assertion passed against a screen that had rendered nothing at all.

**What this layer cannot see, stated so nobody over-reads a green run:** jsdom
computes no geometry. The three-row members toolbar — the defect that motivated
the visual pass — is invisible here and always will be. Layout needs a browser.

## 4. Corrections discovered during execution

Recorded because each one falsified something the plan or the audit asserted.
Future phases should assume more of these exist and verify before acting.

### C1 — `utils/badge-colors.ts` is NOT dead _(caught before deletion)_

Scheduled for Phase 0.1 deletion on the strength of its dead consumers. It has
**four live consumers**: `DayPassModal`, `PaymentDetailsModal`,
`MemberDetailModal`, `MemberDetailModalMobile`. Deleting it would have broken
all four. **Moved to Phase 3**, after those call sites migrate to the
consolidated status indicator. Its test
(`src/utils/__tests__/badge-colors.test.ts`) goes with it.

_Lesson:_ a module is not dead because its most visible consumers are. Verify
every importer immediately before deleting, not from an earlier survey.

### C2 — The verification gate is already red

`npm run lint` fails on clean `master` with **97 errors** — 88
`@typescript-eslint/no-explicit-any`, 9 `react-hooks/set-state-in-effect`.
Confirmed identical before and after Phase 0.1. Directive §8.9 requires `lint`
green and `architecture.md` §2.2 mandates zero `any`, so **the overhaul cannot
satisfy its own definition of done until these clear**. See OPEN-2.

### C3 — Orphan surveys over-report through dynamic imports and barrels

The audit's first orphan sweep flagged `MemberDetailModalResponsive`,
`EditMemberModal` and `MemberAccessPanel` as unreferenced. All three are live —
loaded via `next/dynamic` inside `src/contexts/member-modal.context.tsx`.
Barrel re-exports hide consumers the same way.

_Lesson:_ reachability must account for `dynamic(() => import(...))` and barrel
indirection. A plain identifier grep is not sufficient evidence to delete.

### C4 — The audit's type-scale figure included files since deleted

519 was measured pre-deletion. The live figure is **412**. Baselines in §2 are
now the reference, not the audit's numbers.

### C5 — The directive's §1 diagnosis is partly off-target

Detailed in the plan §4. Summary: nesting is narrow (6 files, not systemic);
drop shadows are 3 sites, not pervasive — the DS explicitly avoids them. The
real containment problem is the inverse: **25 files hand-copy `Card`'s class
string** rather than importing it. Retuning the `Card` primitive will not touch
one of them.

### C10 — The UI2 ratchet counted prose as usage

`arch:check` flagged `WorkspaceSidebar` and `app/layout.tsx` as still using
`mws-*` when their only match was a doc comment _describing_ the retired layer.
The rule now strips comments before testing, in both directions.

The bidirectional half earned its keep immediately: it caught `WorkspaceHeader`
sitting in the allowlist after its migration, which is exactly the stale
exemption that would otherwise accumulate and hide finished work.

### C8 — The three L1 token files were never actually in sync

§7 requires `tokens.ts` + `globals.css` + `tailwind.config.ts` to move together.
They did not. `globals.css` declares **44** `--ds-*` variables; `tokens.ts`
mirrored **34**. `surfacePanel` and `surfaceSelected` — both long-declared in CSS
and both load-bearing for the new palette — had no JS mirror at all, which is why
the rewritten token test failed on `surfaceSelected` being `undefined`.

Fixed for the surface group; **the remaining ~8-key gap is unaudited** and should
be closed in Phase 2 when the primitives are reviewed.

_Lesson:_ "synced across three files" was documentation, not a verified property.
Nothing checks it. A parity test between the CSS block and the JS mirror would.

### C9 — A token test pinned the state the directive exists to change

`tokens.test.ts` asserted `accentDefault === '#1b17ff'` and
`lightColors.surfaceBase === '#f4f4f5'`. Both are exactly what the directive
replaces, so the suite failed the moment the retune landed.

Rewritten to assert the **new** contract with _stronger_ invariants rather than
being relaxed to pass — including a guard that every interaction-state token
matches `rgba(255,255,255,…)`, i.e. lightens rather than darkens. That encodes
the Phase 1 exit gate as a permanent regression test, so the silent-affordance-loss
failure can never return unnoticed.

_Distinction worth keeping:_ updating a test because the specification changed is
correct; loosening a test because the code changed is not. This was the first.

### C6 — Dead code is transitive, and the audit only measured one level

The UI1 ratchet immediately caught two orphans the manual audit missed:
`PaymentDetailsModal` (300 lines) and `ProAvatarRing` (50). Both were reachable
**only** from files Phase 0.1 deleted — `PaymentDetailsModal` ← `MembersTable`,
`ProAvatarRing` ← `layout/Header`. Deleting them then orphaned `UrgencyBadge` in
turn.

_Lesson:_ orphan removal is a **fixed-point computation**, not a single pass.
Re-run `arch:check` after every deletion until it comes back clean. A one-level
grep will always under-report.

Result: 2 more files + 1 test deleted; `UrgencyBadge` allowlisted rather than
deleted, because it holds the best a11y pattern in the product (`role="status"` +
a full `aria-label`) and is the reference for the Phase 3 consolidated status
indicator (plan §5).

### C7 — `/contact` is a light page inside a dark marketing system

Directive §1 frames the discontinuity as "workspace is light; marketing/auth/legal
are dark." That is _almost_ right. Verified state of every non-workspace route:

| Group                   | Routes                                                                | Raw palette |
| ----------------------- | --------------------------------------------------------------------- | ----------: |
| Already dark, compliant | 5 auth pages, `privacy`, `terms`, `refund-policy`, root layout        |           0 |
| **Light outliers**      | `contact` (32), `demo-sms` (37), `join/[token]` + `JoinForm` (5 + 33) |         107 |
| Excluded                | landing                                                               |           — |

So `/contact` is a **public marketing page rendering white while every other
marketing and legal page is dark** — the §1 brand discontinuity, on a page the
directive never named. Brought into scope by R5.

---

## 4a. Inverted check — three passes

`docs/architecture/workspace-ui-inverted-check.md`. **Twenty-two findings**,
seventeen of them defects this overhaul introduced or left standing.

- **Pass 1 — implementation.** Misleading sort on a server-paginated table; a
  token lint rule blind to arbitrary values (so "raw colour → 0" was false); an
  **inverted interaction-state ladder**; sub-AA placeholder contrast; a device
  serial silently uppercased.
- **Pass 2 — capability & enforcement.** Desktop logout lost its re-entrancy
  guard; UI1 could only see the head of a dead chain (rewritten as real
  reachability — and the rewrite was wrong twice before it was right); an
  overdue member rendered **green "Active"**; `Toaster` bypassed the design
  system entirely; `DESIGN_SYSTEM.md` still asserted the workspace was light.
- **Pass 3 — premises.** **The `<body>` element was white for eleven phases** —
  never on the token system; every shell simply painted over it. And I had
  **never once loaded the application**, citing `next build` as evidence
  throughout.

**Two open items are not mine to fix and matter to the product:**
`/contact`, `/terms`, `/privacy` and `/refund-policy` are behind authentication
(pass 3, P3), and the SMS-history endpoint is live with no UI (pass 2, G1).

- **Pass 4 — visual QA.** Playwright against the running app, eight screens
  captured and inspected. The operational grammar holds. Three defects no check
  in this repo could see: the members toolbar rendering on three rows, a string
  `empty` on `DataTable` rendering worse than omitting the prop, and "1 records".
  One open judgement call for the §9.1 sign-off: two stacked indigo selected
  fills on `/settings`, a consequence of raising `surface-selected` to fix the
  ladder.

**The standing conclusion:** the structure holds; the _evidence_ attached to it
was repeatedly weaker than claimed. Six measurement errors occurred while
producing this work, and two foundational beliefs — "tokens are dark, therefore
the app is dark" and "it compiles, therefore it runs" — went unchecked for the
entire project.

---

## 5. Open questions

### OPEN-1 — `/access-control` has no navigation entry _(functional, deferred by R1)_

The route exists, is Enterprise-gated, and is reachable only by typing its URL
or via Settings → Access Control. The only sidebar link lived in a dead file,
now deleted. **Not fixed under this directive** (§4.10 forbids navigation
changes). Needs a separate, non-visual change: add `/access-control` to
`WORKSPACE_NAV` in `src/components/workspace/nav.ts`.

### OPEN-2 — ~~97 pre-existing lint errors block §8.9~~ **RESOLVED 2026-08-29 — fixed.**

> **The framing was wrong, and I stated it wrongly.** I described this as "88
> `any` removals — a typing project with its own risk profile" without breaking
> down the file distribution. **92 of the 97 errors were in `my-video/`**, an
> untracked, standalone nested Remotion project with its own `package.json`,
> `node_modules` and `eslint.config.mjs`. The root config should never have been
> linting it. The application itself had **5** errors, and **zero**
> `no-explicit-any` — `architecture.md` §2.2 was being honoured all along.

Fixed as: `my-video/**` added to the root ESLint ignores, plus the 5 real
`react-hooks/set-state-in-effect` violations repaired — **not suppressed**. Each
became React's documented "adjust state during render" pattern (a previous-value
compare that runs before paint), which is also a small behavioural improvement:
a reopened `DeleteDialog`/`DayPassModal` no longer paints one frame of the
previous entry, and `DataTable` never paints an out-of-range page.

| File                    | Was                                     | Now keyed on          |
| ----------------------- | --------------------------------------- | --------------------- |
| `login/page.tsx`        | banner from `searchParams` in an effect | query string          |
| `DeleteDialog.tsx`      | reset confirm word on open              | `open`                |
| `DataTable.tsx`         | reset to page 1                         | `query` + `pageSize`  |
| `DayPassModal.tsx` (×2) | reset on close; prefill fee             | `open`; member + plan |

The fee prefill kept its `!amount` guard so typed input is never overwritten, and
is keyed on the plan too because that query resolves asynchronously — a member
can be selected before it arrives.

**Gate is now fully green for the first time:** `arch:check` · `tsc` ·
`eslint` **0 errors** · Jest 1,348 · `next build`. §8.9 is satisfiable.

### OPEN-3 — ~~Is the public registration flow in scope?~~ **RESOLVED by R5 — yes.**

> Scope is settled. What remains is a _treatment_ question for Phase 3, below.

`features/registration/components/JoinForm.tsx` is the heaviest single
concentration of banned grammar in the repo — 33 raw-palette utilities, 24
default-type utilities, `rounded-xl`, `bg-blue-600`, `shadow-sm`. By the user's
scope definition ("everything except the landing page") it is in scope.

But it is **customer-facing, not operator-facing**: a prospective member
registering on a phone, not a manager operating the business. The directive's
target state ("dark operational control system", "THIS IS THE SOFTWARE THAT RUNS
THE BUSINESS") is an argument about the _operator's_ tool. Applying it to a
consumer sign-up form may be actively wrong.

**Remaining question (Phase 3, not blocking):** does a consumer sign-up form
adopt the full operational grammar, or does it stay legible-and-friendly on a
phone while still using only tokens? Token compliance is required either way by
§4.5; the open part is density and tone. Decide when Phase 3 reaches it.

### OPEN-4 — KPI readout type size

`text-2xl` (24px) currently carries both page titles and KPI values, and 24px is
not on the DS scale. §5.5 wants a readout band where "numbers carry authority",
and §5.11 wants hierarchy from precision rather than oversized type. Deferred to
**Phase 2**, where `StatCard` is retuned — a `readout` semantic token may need
adding (§4.5 permits this; §7 requires syncing all three L1 files).

---

### OPEN-5 — ~~Legal and contact pages are behind authentication~~ **RESOLVED 2026-08-31**

`PUBLIC_ROUTES` in `src/lib/auth-config.ts` contains `/`, `/login`, `/register`
and the auth callbacks. It does **not** contain `/terms`, `/privacy`,
`/refund-policy` or `/contact`, so all four `307 → /login?redirect=…` for a
logged-out visitor.

Terms of service, privacy policy and refund policy are the documents payment
providers and app stores generally require at **public** URLs, and the privacy
policy is where `ACCESS_EVENT_RETENTION_DAYS` is published (rule 2.21). A
prospective customer cannot read any of them, and neither can a compliance
reviewer.

Pre-existing and entirely outside a visual-correction directive, so it was
raised rather than fixed, then ruled on and fixed separately.

**Resolution.** All four added to `PUBLIC_ROUTES` as **exact** matches — a
`/terms/` prefix would make every future nested route public by accident.

The safety question was asked first, because a public route that reads
per-request state is how multi-tenant isolation leaks: all four pages are
statically prerendered and contain no Supabase client, no session read, no
`cookies()`/`headers()` call and no `fetch`, and the `@/components/legal`
components they use are equally inert.

Verified against the running app signed out: the four serve 200, and sixteen
protected routes — including `/terms/internal`, `/privacy/admin` and
`/contact/leads` — still redirect to `/login`. Tests name each document rather
than looping over `PUBLIC_ROUTES`, so they state what must stay reachable
instead of asserting a list matches itself, and were falsified by reverting the
four entries.

Incidental check while there: the privacy policy's "door access records …
deleted automatically 12 months after they occur" agrees with
`ACCESS_EVENT_RETENTION_DAYS = 365` (rule 2.21 requires the two to move
together). The figure is now actually reachable by the data subjects it is
written for.

### OPEN-6 — SMS history: a live endpoint with no UI _(product gap)_

`GET /api/members/[id]/sms-history` and `sms-history.service.ts` are live and
have **no consumer**. `SMSHistoryModal` was the only caller and was reachable
solely from the already-dead `PaymentRemindersTable`, so the capability was lost
_before_ this overhaul — Phase 0.1 deleted the vestige, not the feature.

A gym therefore cannot see a member's SMS history anywhere in the product, while
the endpoint, the service and the Text.lk delivery-status webhook that feeds it
all still run and still cost money. The endpoint also has no test.

Either build the UI or retire the endpoint and its service; leaving it is the
worst of the three. **Not a UI-directive problem — needs a product call.**

### OPEN-7 — `/revenue` can read "Fully collected" over a zero _(pre-existing, cosmetic-but-misleading)_

Observed in the Phase 5 visual pass on a new gym: `COLLECTED · AUG` shows `0`
with "0% of billed", while `PROJECTED · AUG` shows `5,000` with **"Fully
collected"** in green beside it. The label is driven by
`currentMonth.hasOverduePayments`, which is false when nobody is _past due_ —
true here, since the member's due date is in the future. The two tiles
contradict each other at a glance, and the green reads as an all-clear on a
month where nothing has been collected.

Predates the overhaul (identical in `b5ab06a~1`), so it was not changed under a
visual directive. The fix is a wording/derivation decision — "Fully collected"
should probably require `collectedRevenue >= projectedRevenue`, not merely the
absence of overdue payments.

## 6. Revised phase status

| Phase   | Scope                                                                 | Status              |
| ------- | --------------------------------------------------------------------- | ------------------- |
| **0.1** | Delete dead code                                                      | **DONE** 2026-08-29 |
| **0.2** | Enforcement tooling (lint + `arch:check` ratchets)                    | **DONE** 2026-08-29 |
| **1.1** | Type-scale alias _(moved from 0.2 per R4)_                            | **DONE** 2026-08-29 |
| **1.2** | Dark-first token retune; delete light block + `.mws-root` scope (R2)  | **DONE** 2026-08-29 |
| **1.3** | Replace the hardcoded shell values; flip `data-theme` to dark         | **DONE** 2026-08-29 |
| **2**   | Primitive + composite audit; de-containment; radius; `Badge` per §5.7 | **DONE** 2026-08-29 |
| **3**   | Screen recomposition; retire `mws-*`; delete `badge-colors` (C1)      | **DONE** 2026-08-30 |
| **4**   | Gate + §9.1 / §9.2 / §9.3 audits; four-pass inverted check            | **DONE** 2026-08-30 |
| **5**   | Visual sign-off, screen tests (B1), structural tail                   | **DONE** 2026-08-30 |

> This table read "Not started" for phases 0.2–4 until 2026-08-30, long after
> they shipped. A status table nobody updates is worse than no table: it is the
> same failure mode as a green gate that proves nothing — an artifact that
> describes intent rather than the product.

**Remaining, and none of it closes without a decision that is not mine:**

1. **§9.1 human sign-off.** "Has the perceived product category moved" is not a
   question a screenshot answers. Everything mechanical around it is done.
2. Two product issues still raised rather than fixed — OPEN-6 (SMS history: a
   live endpoint and service with no UI consumer and no test) and OPEN-7
   (`/revenue` reading "Fully collected" in green over a zero). OPEN-5 was
   ruled on and fixed.
3. `MemberDetailModalMobile`'s payment tiles — the last hand-copied card
   (R6: mobile is a separate effort).

**Phase 1 exit gate (non-negotiable, from plan §2):** the canvas, sidebar and
header render dark AND every interaction state is still visible. The legacy
layer expresses every hover/active/selected state as `rgba(0,0,0,α)` — "darken
the surface" — which becomes invisible on a near-black ground. The sidebar
active item, settings sub-nav active, tab active and table row hover all fail
**silently and simultaneously**. Do not leave Phase 1 while any `rgba(0,0,0,α)`
state survives.
