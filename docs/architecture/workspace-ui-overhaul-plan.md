# Workspace UI Overhaul — Execution Plan

> **Precedence.** `METRIC_UI_DIRECTIVE.md` is authoritative on **what the UI must
> become**. This document is the execution plan that reconciles it with
> `workspace-ui-design-analysis.md` (the as-built audit). Where this plan and the
> directive appear to disagree, the directive wins and this plan is wrong —
> except where the plan documents a _factual precondition_ the directive assumes
> and the audit disproves. Those are marked **PRECONDITION** and are the reason
> this document exists.
>
> **Scope added by the user:** the directive is a visual correction; the audit
> found 6,026 lines of dead or unwired UI. The overhaul must fix those too. §3
> below is that addition, and it is folded into the execution order in §6.

---

## 1. The short version

The directive is executable and its design direction needs no revision. Three
things block it from running as written:

1. **Three of its named targets are not mounted.** §8.3 says to audit
   `SideNav`, `DataTable`, `StatCard`, `ChartCard`; §5.14 says to retheme "the
   existing SideNav." `SideNav` has **zero consumers** — the live sidebar is
   hand-written `mws-*` markup. `DataTable` has **zero consumers** — all 20
   tables are hand-rolled. Rethemeing either changes nothing on screen, and
   Constraint D ("inspect rendered composition") cannot verify a component that
   never renders.

2. **The dark flip is blocked by hardcoded light values.** §8.2 + the Appendix
   require the workspace to become dark-first. Retuning `--ds-*` will not darken
   the shell, because the shell does not consume tokens (§2 below).

3. **There are two design systems, and only one responds to the tokens.** §7
   forbids creating another design system. One already exists — the `mws-*`
   layer, ~590 lines of `globals.css` plus `workspace/primitives.tsx`. Every
   visual decision in this overhaul would otherwise have to be made twice, and
   the second copy would be made in a system whose interaction states are
   hardcoded for a light background.

None of this changes the target state. It changes the order: a consolidation
pass has to run **before** §8.1, because §8 assumes a single live coherent
system to audit and that precondition is currently false.

---

## 2. PRECONDITION — why retuning tokens will not darken the workspace

This is the highest-priority finding in this document. §8 steps 1–2 are the
first work item in the directive, and on the current tree they will produce a
near-black canvas with a **white sidebar, white mobile bars, and invisible
navigation states**.

### 2.1 The theme scope is pinned to light

`src/app/globals.css:87–89` declares the light token block as:

```css
:root,
[data-theme='light'],
.mws-root {
  /* light --ds-* values */
}
```

`WorkspaceShell.tsx:65` renders `<div data-theme="light" className="mws-root">`.
So the workspace element is stamped light **twice** — once by attribute, once by
class. The Appendix requires `data-theme="dark"`. Flipping the attribute alone
leaves `.mws-root` on the same element still matching the light block at equal
specificity (both `(0,1,0)`); dark wins only because its block appears later in
source order. That is a source-order coincidence, not a design. `.mws-root` must
come out of the light selector group.

### 2.2 The shell does not consume tokens

Six hardcoded values in three files, none of which respond to a token change:

| File                   | Line | Value                          | Renders as                              |
| ---------------------- | ---: | ------------------------------ | --------------------------------------- |
| `WorkspaceSidebar.tsx` |   52 | `background: '#ffffff'`        | White sidebar on black canvas           |
| `WorkspaceShell.tsx`   |  128 | `background: '#fff'`           | White mobile top bar                    |
| `WorkspaceShell.tsx`   |  185 | `background: '#fff'`           | White mobile bottom nav                 |
| `WorkspaceShell.tsx`   |  142 | `color: '#fff'`                | Avatar initials                         |
| `WorkspaceHeader.tsx`  |  102 | `color: '#fff'`                | Avatar initials                         |
| `WorkspaceSidebar.tsx` |  132 | `background: rgba(0,0,0,0.09)` | Active nav item — **invisible on dark** |

### 2.3 The legacy layer's entire state vocabulary is a light-theme assumption

Every interaction state in the `mws-*` CSS is expressed as _darken the surface_:

| `globals.css` line | Value                         | What it styles                        |
| -----------------: | ----------------------------- | ------------------------------------- |
|                784 | `rgba(0,0,0,0.09)`            | Sidebar active item                   |
|                831 | `rgba(0,0,0,0.09)`            | Settings sub-nav active               |
|                884 | `rgba(0,0,0,0.09)`            | Toggle track                          |
|                438 | `rgba(0,0,0,0.12)`            | Scrollbar thumb                       |
|          544 / 842 | `rgba(0,0,0,0.05)`            | Table header + settings row hairlines |
|    583 / 600 / 605 | `rgba(0,0,0,0.16–0.28)`       | Button hover/active borders           |
|                910 | `rgba(0,0,0,0.45)`            | Overlay backdrop                      |
|          923 / 938 | `0 16px 48px rgba(0,0,0,0.5)` | Modal + drawer **drop shadows**       |

On a near-black surface, "darken by 9%" is invisible. **The active-state
affordance for the sidebar, the settings sub-nav, the tab bar and table row
hover all disappear simultaneously.** These are the primary navigation
affordances of the product.

The two `box-shadow` entries are separately banned outright by §5.12 and §6.

### 2.4 Consequence for sequencing

The `mws-*` layer cannot be retuned for dark — it would have to be rewritten,
and §7 forbids maintaining a second design system to rewrite. It must be
**retired**, not rethemed. That work is a precondition of §8.2, not a follow-on
from it.

---

## 3. Dead and unwired code — disposition

6,026 lines across 37 files. The audit's inventory is in
`workspace-ui-design-analysis.md` §8. Every file resolves to one of three
dispositions, each traced to a directive clause.

### 3.1 WIRE — unused, but they are what the directive asks for

These are unused _because_ the shell and list screens were never migrated onto
them. They are the targets of §5.6, §5.14, §5.18, §5.20 and §8.3. Deleting them
would mean rebuilding them under new names, which §4.4 bans.

| Component                               |         Lines | Directive clause that requires it                                 |
| --------------------------------------- | ------------: | ----------------------------------------------------------------- |
| `DataTable`                             |           647 | §5.6 tables first-class; §8.3, §8.6                               |
| `SideNav`                               |           132 | §5.14 retheme the sidebar as system navigation                    |
| `Drawer`                                |            76 | §5.20 "use drawers/sheets where appropriate"                      |
| `Breadcrumb`                            |            70 | §5.11 page identity; replaces the hand-built crumb                |
| `UserMenu` (+ `DropdownMenu`, `Avatar`) | 96 + 133 + 71 | §5.14 shell completeness; the shell currently has no account menu |
| `SettingsSection`                       |            77 | §5.18 sections and dividers, not nested cards                     |
| `StateLayouts`                          |           112 | §5.17 compact operational empty/low-data states                   |
| `Divider`                               |            57 | §5.2, §5.12, §5.18 — structure via hairlines                      |
| `Pagination`                            |             — | §5.6; replaces three hand-rolled Previous/Next pairs              |

**These do not get deleted. They get mounted.** Wiring them is not scope creep
under §4.10 — the directive names them.

### 3.2 DELETE — superseded, or carrying the banned grammar

No behaviour change: by definition nothing renders these, so Constraint B is
satisfied trivially.

| Component(s)                                                                                                                             |  Files |     Lines | Why                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -----: | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments table suite — `PaymentRemindersTable`, `SMSHistoryModal`, `ReminderStatusTable`, `RegularPaymentTable`, `PaymentCollectedTable` |      5 |     1,813 | Orphaned when `/payment-collection` was rebuilt in `mws-*`. Superseded by the §8.6 `DataTable` rebuild                                                                                            |
| `MembersTable`                                                                                                                           |      1 |       673 | Second implementation of the members list. Superseded by the §8.6 rebuild                                                                                                                         |
| `PaymentCollectionModal`                                                                                                                 |      1 |       424 | Barrel-only, no consumer                                                                                                                                                                          |
| `components/dashboard/*` — `MetricCard` + 4 KPI cards                                                                                    |      5 |       282 | `MetricCard` here is a **second implementation** of the `StatCard`/`MetricCard` composite — exactly the fork §4.4 and §7 ban. The four KPI cards are the floating-stat-card pattern §5.5 replaces |
| `layout/Sidebar`, `layout/Header`, `layout/EmailVerificationBanner`                                                                      |      3 |       528 | Superseded shell. **See §7 ruling R1 before deleting `Sidebar.tsx`**                                                                                                                              |
| `RevenueChart`                                                                                                                           |      1 |       100 | Raw recharts re-draw with `bg-white`, `text-green-600`, `shadow-lg`. Banned by §5.12, §5.16, §6                                                                                                   |
| **Total**                                                                                                                                | **16** | **3,820** |                                                                                                                                                                                                   |

> **Correction (verified at execution).** `utils/badge-colors.ts` was originally
> scheduled here and is **not dead** — it has four _live_ consumers
> (`DayPassModal`, `PaymentDetailsModal`, `MemberDetailModal`,
> `MemberDetailModalMobile`) alongside the five dead ones. It is banned grammar
> under §5.7 and §4.5 and still gets deleted, but in **Phase 3**, after those
> four call sites are migrated to the consolidated status indicator (§5). Its
> test (`src/utils/__tests__/badge-colors.test.ts`) goes with it.

**Excluded from deletion** — `RevenueMetricCard` (60) and `pwa/InstallButton`
(97) are documented in `DESIGN_SYSTEM.md` §12 as intentionally staged. Leave
them.

### 3.3 DECIDE — genuinely unused, no directive claim

Not required by the directive, not obviously superseded. Default: **keep, do not
retheme** — they cost nothing dark because they consume tokens, and rethemeing
unmounted components burns effort Constraint D cannot verify.

`CommandPalette` (151) · `Accordion` (72) · `Radio` (50) · `Spinner` (60) ·
`Popover` (40) · `NotificationMenu` (70) · `DeleteDialog` (108) ·
`SectionHeader` (38) · `FilterBar` (38) · `Toolbar` (37) · `SearchBar` (71)

`SectionHeader`, `FilterBar`, `Toolbar` and `SearchBar` are likely to become
useful during §8.5–§8.7 (section headers and compact toolbars are explicitly
called for by §5.18 and §5.9). Re-evaluate them at the end of Phase 3 rather
than now.

### 3.4 The pattern worth naming

Every rebuild in this codebase has been **additive**: the new implementation
ships, the old one stays in the tree, and the barrel keeps exporting it so no
tooling flags it. This overhaul will produce another 6,000 dead lines unless
Phase 0 adds the check that detects them (§6, Phase 0.3).

---

## 4. Corrections to §1's diagnosis

§1 of the directive describes the current state. The audit agrees with most of
it, and disagrees on two points in ways that redirect effort. Recorded so the
work goes where the problem actually is — the target state in §2/§3 is
unaffected.

| §1 claim                                                           | Audit finding                                                                                                                                                                                                                                                                                  | Effect on the work                                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Nested-container grammar… `card-within-card`, `tile-within-card`" | Real but **narrow: 6 files** contain a bordered/background surface inside a `Card` — `RegistrationQRCard`, `AnnouncementProgress`, `BillingHistoryTable`, `MemberAnalyticsClient`, `AccessReadersCard`, `CronStatusGrid`                                                                       | §5.3 is a 6-site fix, not a systemic one                                                                                                                            |
| "Decorative containment… cards as the default wrapper"             | **Confirmed, and worse than stated.** The most common container is not `Card` — it is an _ad-hoc copy_ of `Card`'s class string: **25 files** hand-write `rounded-lg border border-line-1 bg-surface-card` with drifting padding (`p-3`/`p-4`/`p-6`/`p-8`) and radius (`rounded-md`/`lg`/`xl`) | This, not nesting, is the real §4.3 / §5.3 target. Changing the `Card` primitive **will not touch any of these 25 sites** — the §9.2 warning applies literally here |
| "Drop shadows"                                                     | **Not pervasive in the DS half.** `Card` documents "elevation via hairline + surface, never drop shadow"; shadow tokens are `focus` / `overlay` only. Real drop shadows are 2 in the `mws-*` modal/drawer + 1 in dead `RevenueChart`                                                           | Shadow removal is a 3-site fix, mostly resolved by retiring `mws-*`                                                                                                 |
| "Large radius"                                                     | Confirmed and quantified: `rounded-md`, `rounded-lg`, `rounded-xl` and `rounded-full` all applied to the same conceptual surfaces                                                                                                                                                              | §5.13 applies as written                                                                                                                                            |
| "Floating stat cards… four isolated rounded cards"                 | Confirmed: 3 sites — `DashboardClient`, `RevenuePageClient`, `MemberAnalyticsClient`                                                                                                                                                                                                           | §5.5 is a 3-site fix                                                                                                                                                |
| "Soft… oversized badges, decorative pills"                         | Confirmed, and there are **five** competing status languages, two using raw pastel palettes and `rounded-full` pills                                                                                                                                                                           | §5.7 is larger than it looks — see §5 below                                                                                                                         |

### 4.1 Two findings the directive does not cover

Both are token violations under §4.5 and therefore in scope, but neither is
named in the directive.

**Typography — 519 vs 50.** The DS type scale was _added to_ Tailwind's defaults
rather than replacing them, so `text-xs`/`sm`/`base`/`lg` remain valid and are
used **519 times** against **50** uses of the DS scale. `text-sm` is 14px and
`text-base` is 16px; neither is a Metric size, and both are larger than the 13px
body the workspace sets. §5.8 ("Geist / Geist Mono as an information hierarchy",
"derive hierarchy from precision… not oversized type") cannot hold while the
dominant type utilities render off-scale and oversized. §4.5 forbids hardcoded
typography, which is what these 519 utilities are.

**Colour — 119 raw-palette utilities.** `bg-gray-200`, `text-blue-600`,
`bg-orange-100`, `text-white` and similar, outside the token system entirely.
Concentrated in `JoinForm` (33), `(dashboard)/loading.tsx` (10), `TrialBanner`
(6), `PastDueBanner` (4), `MemberLimitBar` (4). Direct §4.5 violations, and each
one renders wrong on dark.

---

## 5. Status treatment — the largest single recomposition

§5.7 asks for `● ACTIVE` (dot + label) instead of pill badges. The audit found
the same concept rendered **five** ways, so this is not a badge restyle — it is
a consolidation.

| #   | Mechanism                                                                   | Current form                                           | Disposition                                                                                                                              |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DS `<Badge variant>`                                                        | 4px radius, mono 11px, tint bg + border                | **Keep as the base.** Retune per §5.7 toward dot + label; drop the tint background so colour is signal, not fill                         |
| 2   | `workspace/primitives.tsx` `StatusBadge` → `.mws-badge`                     | Parallel implementation                                | Delete with the `mws-*` retirement                                                                                                       |
| 3   | `.mws-badge-ok` raw class in `WorkspaceHeader`                              | Third copy                                             | Delete with the shell rebuild                                                                                                            |
| 4   | `getPlanBadgeColor()` → `<Badge className="bg-orange-100 text-orange-800">` | Pastel pill **overriding the variant via `className`** | Delete `utils/badge-colors.ts`. Plan type is not a status — render it as plain mono text, not colour                                     |
| 5   | `UrgencyBadge`                                                              | `rounded-full` pastel pill                             | Re-express as dot + label. **Preserve its `role="status"` and `aria-label`** — it is the most accessible status indicator in the product |

Underneath these, the member-status→variant map is duplicated byte-for-byte in
`MemberDetailModal.tsx:369` and `MemberDetailModalMobile.tsx:309`, and
`MembersTable` maps the same four statuses a third way (`getStatusDotClass`, a
bare colour dot with no label — status by colour alone). Four statuses, four
mappings, no shared source.

**Resolution:** one `memberStatusIndicator(status)` helper in the members
feature returning `{ tone, label }`, consumed everywhere. This is not a new
abstraction under §4.4 — it is a data map, not a visual primitive, and it
removes three implementations rather than adding a fourth.

---

## 6. Merged execution order

§8 of the directive assumes one live, coherent, token-consuming system to audit.
That precondition is false today. **Phase 0 establishes it; §8.1–§8.10 then run
in their stated order**, satisfying §4.9.

Phases 1–3 each end at a verifiable visual state, so Constraint D can run
against real rendered output rather than component source.

### Phase 0 — Establish the precondition _(no intended visual change)_

> **0.1 status: DONE (2026-08-29).** 16 files / 3,820 lines removed;
> `src/components/dashboard/` and `src/components/layout/` are now empty and
> gone entirely. `features/members/index.ts` pruned. Gate after deletion:
> `tsc --noEmit` clean · `arch:check` clean · Jest **1,347 passed, 114 suites**
> · `eslint` unchanged from baseline (see 0.3).

- **0.1 Delete** the 17 files / 3,894 lines in §3.2. Prune the matching barrel
  exports in `features/members/index.ts`. Per **R1**, `layout/Sidebar.tsx` goes
  with the rest and the `/access-control` nav entry is _not_ added.
- **0.2 Fix the type scale.** Remove or alias Tailwind's default `text-*` sizes
  onto DS tokens so the 519 existing utilities resolve to Metric sizes.
  _Highest-leverage single change in the plan_ — it converts the largest
  category of drift into compliance without touching a component, and it must
  land before any recomposition or 14px/16px text gets baked into new screens.
- **0.3 Add the enforcement that is currently absent.** `arch:check` covers only
  the structural rules R1/R4/R10/R11; ESLint restricts only dissolved-layer
  imports. Nothing detects raw colour, off-scale type, `mws-*` usage, or an
  unreferenced component. Add: lint rules for raw palette utilities and `#fff`
  literals; an `arch:check` rule failing on zero-importer components under
  `src/components`; a rule banning new `mws-*` outside `globals.css`. Without
  this the overhaul produces the next 6,000 dead lines (§3.4).

> **PRECONDITION — the gate is already red.** `npm run lint` fails on clean
> `master` with **97 errors**: 88 `@typescript-eslint/no-explicit-any` and 9
> `react-hooks/set-state-in-effect`. Verified identical before and after Phase
> 0.1, so the overhaul did not cause them — but directive §8.9 requires `lint`
> green and `architecture.md` §2.2 mandates "zero use of `any`". The overhaul
> cannot satisfy its own definition of done until these clear. They are neither
> visual nor in the directive's scope, so they need a ruling: fix inside Phase
> 0, or an explicit carve-out from §8.9.

- **0.4 Documentation drift.** `CLAUDE.md` and `.claude/rules/architecture.md`
  both list `layout` and `dashboard` among the `src/components/` folders. Neither
  folder exists after 0.1. Update both to match.

### Phase 1 — Dark-first tokens _(directive §8.1, §8.2, Appendix)_

- Audit and retune the `--ds-*` semantic set for dark-first, designed — not
  inverted (§5.1). Sync `tokens.ts` + `globals.css` + `tailwind.config.ts`.
- **Per R2 (dark only):** delete the light `--ds-*` block and the `.mws-root`
  token scope outright, rather than un-grouping the selector at
  `globals.css:87–89`. Dark becomes the only token set.
- Flip `WorkspaceShell` to `data-theme="dark"`.
- Replace the six hardcoded shell values in §2.2 with tokens.
- **Verification gate:** the canvas, sidebar and header are dark and every
  navigation state is still visible. Do not proceed while any `rgba(0,0,0,α)`
  state remains.

### Phase 2 — Primitives and composites _(§8.3, §8.4)_

- Audit `Card`, `StatCard`/`MetricCard`, `ChartCard`, `Badge`, `Button`,
  `SideNav`, `Table`, `DataTable` — noting that four of these are unmounted, so
  the audit is "fit for the target grammar," not "what does it look like now."
- Retune `Badge` per §5.7 (dot + label, no tint fill).
- Reduce radius to `none`/`xs`/`sm` (§5.13); remove the 2 `mws-*` drop shadows.
- De-contain the composites (§8.4): `ChartCard` loses its heavy card treatment
  per §5.16; `StatCard` is retuned to support the §5.5 readout band rather than
  a floating tile.

### Phase 3 — Screen-by-screen recomposition _(§8.5, §8.6, §8.7, §8.8)_

**One pass per screen.** Each screen is simultaneously (a) moved off `mws-*`
onto DS primitives and (b) recomposed into the operational grammar. Doing these
as two passes would compose every screen twice, the first time against a palette
that is about to change.

| Order | Screen                                                        | Work                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Shell**                                                     | Rebuild `WorkspaceSidebar` on `SideNav` (§5.14), `WorkspaceHeader` on `Breadcrumb` + `UserMenu`, mobile nav on `Drawer` (§5.20). Replace inline dimensions with the `layout` tokens that already hold the same values. Delete `workspace/primitives.tsx` |
| 2     | **Dashboard** (§8.5)                                          | Operational cockpit per §5.16. Replace the four floating `StatCard`s with the §5.5 readout band                                                                                                                                                          |
| 3     | **Members** (§8.6)                                            | Rebuild `MembersPageClient` on `DataTable`. Net deletion — it currently hand-rolls search, filter, pagination and empty states that `DataTable` provides                                                                                                 |
| 4     | **Renewals** (§8.6)                                           | Same, for `PaymentCollectionPageClient`. Retires the last `mws-table`                                                                                                                                                                                    |
| 5     | **Revenue · Analytics**                                       | §5.5 readout band; §5.16 integrated charts                                                                                                                                                                                                               |
| 6     | **Settings** (§8.7)                                           | Sections and dividers on `SettingsSection` (§5.18); retire the `mws-subnav` pills                                                                                                                                                                        |
| 7     | **Announcements · Billing · Support · Access Control** (§8.8) | Consistency pass; replace the 25 ad-hoc card divs (§4.1)                                                                                                                                                                                                 |
| 8     | **Admin**                                                     | `(admin)` currently has no shell at all and mixes DS colour tokens with `text-3xl` and `container mx-auto`. Smallest surface, lowest urgency, but the last place a third dialect survives                                                                |

- **Ends with:** deleting `globals.css` lines 392–980 (the `mws-*` layer) and
  rewriting `(dashboard)/loading.tsx`, which currently renders a generic table
  skeleton in `bg-gray-200` that matches no actual page (§5.17).

### Phase 4 — Verification _(§8.9, §8.10, §9)_

- `npm run type-check && npm run arch:check && npm run lint && npm test`
- §9.2 repository-wide composition audit. **Note the directive's own warning
  applies literally here:** changing `Card` does not fix the 25 hand-copied card
  divs. Audit rendered composition, not primitive source.
- §9.3 adversarial AI-dashboard smell test, run last.

---

## 7. Rulings — decided 2026-08-29

| #      | Decision                                                                                                                                                      | Effect                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **R1** | **Delete the dead file; do not add the nav entry.** The `/access-control` discoverability gap is tracked as a separate functional fix outside this directive. | Phase 0.1 proceeds; no §4.10 navigation change                                                           |
| **R2** | **Dark only.** The light `--ds-*` block and the `.mws-root` scope are deleted outright.                                                                       | Phase 1 simplifies; Phase 3 is verified once, not twice                                                  |
| **R3** | **Keep the DECIDE set; do not retheme; re-evaluate after Phase 3.**                                                                                           | ~735 lines stay; the "nothing unreachable" done-condition is scoped to exclude them until Phase 3 closes |

The reasoning behind each is retained below.

### R1 — `/access-control` navigation entry

`layout/Sidebar.tsx:74` holds the **only link to `/access-control` anywhere in
the repository**, and that file is dead (zero importers). The Enterprise
door-access dashboard is therefore already reachable only by typing its URL.

Deleting the file is safe — it changes no behaviour, because nothing renders it.
But it makes the gap permanent. Adding `/access-control` to `WORKSPACE_NAV`
would fix it, and §4.10 explicitly forbids changing **navigation architecture**.

**Recommendation:** delete the file in Phase 0.1; do **not** add the nav entry
under this directive. Track it as a separate functional fix. The gap pre-dates
the overhaul and fixing it inside a visual-correction directive is exactly the
scope drift §4 exists to prevent.

### R2 — Is light theme retained?

The Appendix says light "may remain technically available… but light is **not**
the canonical visual identity." Two readings, materially different work:

- **Dark only.** Delete the light `--ds-*` block and the `.mws-root` scope
  entirely. Simplest, smallest, fastest. Every primitive stops carrying dual
  styling it will never exercise.
- **Dark default, light retained.** Keep both token sets, add a real theme
  mechanism (currently there is none — no toggle, no persistence, no
  `prefers-color-scheme` handling, and exactly one `dark:` utility in the entire
  workspace), and verify every screen twice.

**Recommendation: dark only.** Retaining light doubles Phase 3 verification for
a variant the Appendix says is not the product identity. It can be reintroduced
later against a clean dark baseline more cheaply than it can be carried through
this overhaul.

### R3 — Disposition of the DECIDE bucket

11 components, ~735 lines (§3.3): `CommandPalette`, `Accordion`, `Radio`,
`Spinner`, `Popover`, `NotificationMenu`, `DeleteDialog`, `SectionHeader`,
`FilterBar`, `Toolbar`, `SearchBar`. Unused, not superseded, not named by the
directive.

**Recommendation: keep, do not retheme, re-evaluate at the end of Phase 3.**
Four of them (`SectionHeader`, `FilterBar`, `Toolbar`, `SearchBar`) are likely
to be consumed by §5.9 compact toolbars and §5.18 section structure. Deleting
them now risks rebuilding them under new names, which §4.4 bans.

---

## 8. Additions to the Definition of Done

§10 of the directive defines done as a material change in perceived product
category. The dead-code scope adds three objective conditions, all
machine-checkable:

- [ ] **One design system.** `globals.css` contains no `.mws-*` rules;
      `grep -r "mws-" src` returns nothing outside comments.
- [ ] **Nothing unreachable.** No component under `src/components` or
      `src/features/*/components` has zero importers, except the two documented
      staged components (`RevenueMetricCard`, `InstallButton`).
- [ ] **No hardcoded design values.** Zero raw-palette utilities and zero `#fff`
      literals in `src/app`, `src/features`, `src/components` — enforced by the
      Phase 0.3 lint rules, not by inspection.

And one that is not machine-checkable but follows from §2 of this document:

- [ ] **Every interaction state is visible on the dark ground.** Sidebar active
      item, settings sub-nav active, tab active, table row hover, selected rows.
      These are the states that currently exist only as `rgba(0,0,0,α)` and will
      fail silently rather than loudly.

---

## 9. Cross-references

- `docs/architecture/METRIC_UI_DIRECTIVE.md` — authoritative target state
- `docs/architecture/workspace-ui-design-analysis.md` — the as-built audit this plan reconciles
- `.claude/DESIGN_SYSTEM.md` — layer model, primitive/composite registry (per the directive's Appendix, its workspace-theme assignment is superseded)
- `.claude/rules/architecture.md` §2.17 — Pattern Index entry
- `src/components/ui/tokens.ts` · `src/app/globals.css` · `tailwind.config.ts` — the three L1 files that must stay synchronized (§4.5)
