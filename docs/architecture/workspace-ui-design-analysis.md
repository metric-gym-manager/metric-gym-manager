# App Workspace UI — Technical Design Analysis

> **What this is.** A high-level technical design analysis of the **App
> Workspace** — every authenticated surface in the product: the `(dashboard)`
> gym-manager routes, the `(admin)` SaaS-operator routes, the shell that wraps
> them, and the shared UI they are built from. The public landing page is out of
> scope.
>
> **What this is not.** Not a visual critique, not a redesign proposal, and not
> a task list. It describes _what is actually in the repository today_, where it
> diverges from the contract in `.claude/DESIGN_SYSTEM.md`, and why the
> divergence happened. Remediation is sequenced in §9 but deliberately kept
> subordinate to the diagnosis.

|                       |                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**              | 2026-08-29                                                                                                                                                                                        |
| **Branch**            | `claude/workspace-ui-overhaul` (from `origin/master` @ `523fde5`)                                                                                                                                 |
| **Surfaces analysed** | `src/app/(dashboard)`, `src/app/(admin)`, `src/components/{workspace,layout,common,ui,dashboard}`, `src/features/*/components`                                                                    |
| **Method**            | Static analysis of the working tree — import-graph reachability, class/token usage census, primitive-adoption census, CSS scope mapping. Every figure below is a counted result, not an estimate. |

---

## 1. Executive summary

The design system described in `.claude/DESIGN_SYSTEM.md` is **real, complete,
and largely unused**. Layers 1–3 (tokens, 32 primitives, 14 composites) exist,
are token-driven, are theme-aware and are well built. Layers 4–5 (feature UI and
pages) consume perhaps half of it, and the application _chrome_ — the sidebar,
the header, the sub-navigation — consumes almost none of it.

The workspace is not one design system with drift. It is **two complete design
systems running side by side**, split roughly down the middle of the product,
plus a third dialect on the admin surface:

- **The Metric Design System (`--ds-*` tokens, `@/components/ui`)** — the
  documented, intended system.
- **The `mws-*` CSS layer (`src/app/globals.css`, ~590 lines)** — a parallel
  system of hand-written classes and inline styles, with its own button, badge,
  table, input, tab, panel, nav-item, sub-nav and toggle implementations.
- **The admin dialect** — DS _color_ tokens with the default Tailwind _type_
  scale and no shell at all.

Which system a screen uses is essentially an accident of when it was last
touched. `/members` and `/payment-collection` are `mws-*`. `/dashboard` and
`/revenue` are DS. `/settings` is `mws-*` chrome wrapping DS content. The
shell that frames all of them is `mws-*`.

The consequence is not only visual inconsistency. It is **6,026 lines of dead or
unreachable UI** — including the entire payments table suite and the flagship
`DataTable` — because each rebuild orphaned the previous implementation instead
of replacing it.

### 1.1 Severity table

| #   | Finding                                                           | Severity                  | Blast radius                      |
| --- | ----------------------------------------------------------------- | ------------------------- | --------------------------------- |
| F1  | Two design systems coexist; screen-level split                    | **Critical**              | Whole workspace                   |
| F2  | The entire shell (sidebar, header, mobile nav) is outside the DS  | **Critical**              | Every authenticated page          |
| F3  | 6,026 lines of dead / unreachable UI                              | **High**                  | Maintenance, onboarding           |
| F4  | Five distinct status-badge languages                              | **High**                  | Every data screen                 |
| F5  | `DataTable` unused; 20 tables hand-rolled                         | **High**                  | Members, payments, revenue, admin |
| F6  | Type scale drift — 519 default-scale vs 50 DS-scale utilities     | **High**                  | Whole workspace                   |
| F7  | No focus-visible styling in the `mws-*` layer                     | **High**                  | Keyboard + a11y compliance        |
| F8  | Table rows are click-only (no keyboard path)                      | **High**                  | Members, renewals                 |
| F9  | Three card/surface implementations                                | Medium                    | Every screen                      |
| F10 | `/access-control` has no navigation entry point                   | Medium                    | Enterprise tier                   |
| F11 | No account menu; `DropdownMenu` unused in product                 | Medium                    | Shell                             |
| F12 | Four selection-control patterns (tabs / sub-nav / toggle / pills) | Medium                    | Settings, renewals, analytics     |
| F13 | Route-level `loading.tsx` matches no actual page                  | Medium                    | Perceived performance             |
| F14 | 119 raw-palette utilities outside the token system                | Medium                    | Theming, contrast                 |
| F15 | Workspace is hard-pinned to light; dual-theme work unexercised    | Low                       | Future theming                    |
| F16 | **Nothing enforces the design contract**                          | **Critical (root cause)** | All of the above                  |

**F16 is the root cause of F1–F15.** `npm run arch:check` enforces only the
feature-first structural rules (R1/R4/R10/R11). ESLint restricts only imports
from the dissolved `core/`/`infrastructure/` layers. No check exists for raw
color values, raw type scales, `mws-*` usage, or primitive bypass. The
`DESIGN_SYSTEM.md` contract is documentation with no teeth, so every rule in it
has been broken somewhere without a single failing build.

---

## 2. Intended architecture vs. as-built

### 2.1 The intended model

`.claude/DESIGN_SYSTEM.md` specifies five layers with strictly downward
dependencies:

```
L1 tokens (tokens.ts · globals.css --ds-* · tailwind.config.ts)
   ↑
L2 primitives (@/components/ui — 32)
   ↑
L3 composites (@/components/common/composites — 14)
   ↑
L4 feature UI (src/features/<domain>/components)
   ↑
L5 pages (src/app/**)
```

with a prime directive of **one implementation per pattern** and a **token-only**
rule: no raw color, spacing, type, radius, shadow, z-index, duration or
breakpoint value outside the three L1 files.

### 2.2 The as-built model

```
L1a --ds-* tokens (86 props)      L1b --mws-* (22)   L1c --ma-* (~14)
L1d shadcn HSL block (~20)        L1e Apple-era vars (~15)
   ↑                                    ↑
L2a 32 DS primitives              L2b .mws-* CSS classes (~590 lines)
   ↑                                    ↑  + workspace/primitives.tsx
L3a 14 DS composites                     (StatusBadge · Panel · PanelHead)
   ↑  (8 of 14 have zero consumers)      ↑
   └──────────── L4/L5 pick one, per screen, by accident ────────────┘
```

`src/app/globals.css` alone declares **five** independent CSS custom-property
families (1,220 lines total):

| Family                                            | Count | Purpose                                   | Status                                                  |
| ------------------------------------------------- | ----- | ----------------------------------------- | ------------------------------------------------------- |
| `--ds-*`                                          | 86    | Metric Design System (L1)                 | Canonical                                               |
| `--mws-*`                                         | 22    | Workspace legacy — now _aliases_ `--ds-*` | Parallel system                                         |
| `--ma-*` / `.mauth-*`                             | ~14   | Auth/marketing surface                    | Out of scope, but a third scope                         |
| shadcn HSL (`--primary`, `--ring`, …)             | ~20   | Retired shadcn set                        | **Still declared** despite §12 claiming full retirement |
| Apple-era (`--bg-primary`, `--lanka-gradient`, …) | ~15   | Pre-DS landing page                       | Legacy                                                  |

The `--mws-*` aliasing is worth crediting: it was done correctly. Every
`--mws-*` variable now points at a `--ds-*` value, so the two systems already
share one palette. **The colors match; the components do not.** That materially
lowers the cost of the migration described in §9 — this is a component-layer
consolidation, not a re-theming.

---

## 3. The shell — nav bar, header, mobile navigation

The shell is `src/components/workspace/`: `WorkspaceShell` (213) →
`WorkspaceSidebar` (179) + `WorkspaceHeader` (133) + `nav.ts` (87) +
`primitives.tsx` (90). It wraps every `(dashboard)` route via
`src/app/(dashboard)/layout.tsx`.

**It uses zero design-system components.** Not one import from
`@/components/ui` or `@/components/common/composites` appears in any of the
five files. Instead:

- **Layout values are inline literals**, not layout tokens. `WorkspaceSidebar`
  hardcodes `width: collapsed ? 56 : 240`; `WorkspaceHeader` and `MobileTopBar`
  hardcode `height: 52`; `WorkspaceShell` hardcodes `padding: '24px'`. The
  matching tokens (`sidebarWidth: 240`, `sidebarCollapsedWidth: 56`,
  `breadcrumbHeight: 52`, `workspacePadding: 24`) exist in `tokens.ts` and are
  never referenced. The values agree today by coincidence, and nothing keeps
  them agreeing.
- **`background: '#fff'`** appears literally in `WorkspaceShell` (twice) and
  `WorkspaceSidebar`, alongside `color: '#fff'` for avatar text — direct
  token-only violations in the highest-traffic component in the product.
- **Buttons are `className="mws-btn mws-btn-sm"`**, not `<Button>`.
- **The status pill is `mws-badge mws-badge-ok`**, not `<Badge variant="success">`.
- **The breadcrumb is hand-assembled** from two `<span>`s and a `/` literal,
  while the DS `Breadcrumb` primitive (70 lines, with `aria-current="page"`)
  sits unused.
- **There is no account menu.** The header renders a non-interactive avatar, an
  email string, and a bare logout icon button. The `UserMenu` composite (96
  lines) and `NotificationMenu` (70 lines) — both built and both wired to
  `DropdownMenu`/`Popover`/`Avatar` — have zero consumers. Those three
  primitives are consequently unreachable in the product.

### 3.1 A second, older shell still exists

`src/components/layout/` contains `Sidebar.tsx` (301), `Header.tsx` (143) and
`EmailVerificationBanner.tsx` (84) — a complete earlier shell with **zero
importers**. It is not merely dead: `Sidebar.tsx:74` holds the **only link to
`/access-control` anywhere in the codebase**. The Enterprise door-access
dashboard is therefore reachable only by typing its URL, or indirectly from
Settings → Access Control. Deleting the dead file without adding a nav entry
would make that finding permanent; adding the nav entry is the actual fix.

### 3.2 Navigation structure

`nav.ts` defines three groups — Primary (5), Operations (2), Management (2) —
resolved by longest-prefix match. The model is sound and is the one genuinely
well-factored piece of the shell. Two observations:

- **`/access-control` is absent** from `WORKSPACE_NAV` (F10, above).
- **Mobile shows all 9 items in a horizontally scrolling bottom bar**
  (`minWidth: 76` each ≈ 684px of content in a ~390px viewport). Roughly half
  the navigation is permanently off-screen behind a scroll gesture with no
  affordance. The DS `Drawer` primitive (76 lines, unused) is the conventional
  answer.

### 3.3 Sub-navigation

`src/app/(dashboard)/settings/layout.tsx` implements the settings sub-nav as
`mws-subnav` pills with `width: 160` inline (the `settingsSubNavWidth: 160`
token exists, unused), and drives its responsive behaviour through four
CSS-only visibility classes (`mws-settings-nav-root`, `-nav-sub`,
`-content-root`, `-content-sub`). It is a bespoke master/detail pattern with no
counterpart in the DS. The `SettingsSection` composite (77 lines), built for
exactly this, has zero consumers.

---

## 4. Subsystem analysis

### 4.1 Primitive adoption census

Files containing live JSX usage, excluding tests and the `(dev)/design-system`
showcase:

| Primitive  | Files | Primitive    | Files | Primitive      | Files |
| ---------- | ----: | ------------ | ----: | -------------- | ----: |
| Button     |    48 | Skeleton     |     7 | Tabs           |     1 |
| Badge      |    29 | Progress     |     4 | Toaster        |     1 |
| Input      |    22 | Alert        |     3 | Accordion      | **0** |
| Card       |    19 | FormField    |     3 | Breadcrumb     | **0** |
| Modal      |    19 | Textarea     |     3 | CommandPalette | **0** |
| Table      |    17 | Switch       |     2 | DataTable      | **0** |
| Select     |    14 | Tooltip      |     2 | Divider        | **0** |
| Label      |    14 | Pagination   |     1 | Drawer         | **0** |
| Checkbox   |     7 | Popover      |    1* | Radio          | **0** |
| EmptyState |     7 | DropdownMenu |    1* | Spinner        | **0** |
|            |       | Avatar       |    1* |                |       |

\* `Popover`, `DropdownMenu` and `Avatar` appear **only** inside `UserMenu` /
`NotificationMenu`, which themselves have zero consumers — so they are
unreachable in the running product.

**11 of 32 primitives (34%) have no live product usage.** The healthy core is
Button / Badge / Input / Card / Modal / Table / Select / Label — the pieces a
form or a table needs. Everything structural (DataTable, Drawer, Breadcrumb,
CommandPalette, Divider) went unadopted, which is precisely the set the shell
and the list screens would have consumed.

### 4.2 Composite adoption

| Composite             | Consumers | Composite        | Consumers |
| --------------------- | --------: | ---------------- | --------: |
| ConfirmDialog         |         9 | SectionHeader    |     **0** |
| PageHeader            |         6 | Toolbar          |     **0** |
| StatCard / MetricCard |     3 + 3 | SearchBar        |     **0** |
| ChartCard             |         3 | FilterBar        |     **0** |
|                       |           | StateLayouts     |     **0** |
|                       |           | SettingsSection  |     **0** |
|                       |           | SideNav          |     **0** |
|                       |           | UserMenu         |     **0** |
|                       |           | NotificationMenu |     **0** |
|                       |           | DeleteDialog     |     **0** |

**10 of 14 composites (71%) have zero consumers.** L3 is the layer that failed
hardest. The four that survived (`ConfirmDialog`, `PageHeader`, `StatCard`,
`ChartCard`) are exactly the four that solve a problem a page author hits
immediately; the rest solve problems the page authors solved inline instead.

### 4.3 Tables

| Implementation                      | Files | Notes                                                                                                                              |
| ----------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DataTable` (647 lines)             | **0** | Sorting, filtering, pagination, sticky header/columns, selection, bulk actions, virtualization, expandable rows, resizable columns |
| `Table` low-level primitive         |    17 | Markup + styling only; every behaviour hand-rolled per site                                                                        |
| Raw `<table className="mws-table">` |     3 | `MembersPageClient`, `PaymentCollectionPageClient`, `BulkAddMemberModal`                                                           |

The flagship subsystem of the design system has **never been used**. Twenty
tables were built on the layer beneath it, each re-implementing whatever subset
of sorting, pagination and empty-state handling it needed. Hand-rolled
`Previous`/`Next` pagination appears in three files against a single use of the
`Pagination` primitive.

The clearest single illustration of F1 is the members list. Two complete
implementations exist:

|                 | `MembersPageClient.tsx` (186)   | `MembersTable.tsx` (673)                |
| --------------- | ------------------------------- | --------------------------------------- |
| Status          | **Live**                        | **Dead** (barrel-exported, no consumer) |
| System          | `mws-*`                         | Design System                           |
| Table           | `<table className="mws-table">` | `Table` primitive                       |
| Buttons         | `className="mws-btn"`           | `<Button>`                              |
| Status display  | `StatusBadge tone=…`            | `<Badge>` + `getStatusDotClass`         |
| Plan display    | `PLAN_LABEL` map                | `getPlanBadgeColor` (raw palette)       |
| Search / filter | Inline, debounced               | Inline, debounced                       |
| Pagination      | Hand-rolled                     | Hand-rolled                             |
| Responsive      | Horizontal scroll               | Desktop table + mobile card fork        |
| Formatting      | semicolons, single quotes       | no semicolons                           |

The live one is the newer, smaller, `mws-*` one. The DS one was left in the tree.

### 4.4 Status badges — five languages

The same concept (member status) is rendered five different ways:

| #   | Mechanism                                                            | Shape                                                                        | Where                                              |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | DS `<Badge variant>`                                                 | 4px radius, mono 11px, tint recipe                                           | 29 files                                           |
| 2   | `workspace/primitives.tsx` `StatusBadge` → `.mws-badge`              | Parallel implementation of the same recipe                                   | `MembersPageClient`, `PaymentCollectionPageClient` |
| 3   | `.mws-badge-ok` raw class                                            | Same again, no component                                                     | `WorkspaceHeader`                                  |
| 4   | `utils/badge-colors.ts` → `<Badge className={getPlanBadgeColor(…)}>` | Pastel `bg-orange-100 text-orange-800` **passed in to override the variant** | `MembersTable`, `PaymentDetailsModal`              |
| 5   | `common/UrgencyBadge.tsx`                                            | `rounded-full` pill, `text-xs`, pastel palette                               | `MembersTable`, `PaymentDetailsModal`              |

Mechanisms 4 and 5 use raw Tailwind palette values and a fully different visual
grammar (pill vs. square, 12px sans vs. 11px mono, pastel vs. tint). Mechanism 4
is the sharpest violation of the "variants, never duplication" rule: it takes
the correct component and defeats its variant system through `className`.

Compounding this, `getStatusVariant` — the member-status → badge-variant map —
is **duplicated byte-for-byte** in `MemberDetailModal.tsx:369` and
`MemberDetailModalMobile.tsx:309`, while `MembersTable` maps the same four
statuses to a _third_ representation (`getStatusDotClass`, a colored dot).
Four statuses, four separate mappings, no shared source of truth.

### 4.5 Buttons

| Implementation                          |          Sites |
| --------------------------------------- | -------------: |
| DS `<Button>`                           |       48 files |
| `.mws-btn` / `-primary` / `-sm` classes | 14 occurrences |
| Raw `<button>` with ad-hoc classes      |       17 files |

`Button` is the best-adopted primitive in the system, and its variant/size
matrix is complete. The `mws-btn` set is confined to the shell and the two
`mws-*` pages, so this one is close to resolved — the remaining work rides along
with the page migrations in §9.

### 4.6 Cards and surfaces

| Implementation                                               |  Files |
| ------------------------------------------------------------ | -----: |
| Ad-hoc `rounded-lg border border-line-1 bg-surface-card` div | **25** |
| DS `Card` / `CardHeader` / `CardBody`                        |     19 |
| `Panel` / `.mws-panel`                                       |      7 |

The most common card in the product is a hand-written div that reproduces
`Card`'s exact class string. Because it is copied rather than imported, padding
has drifted freely — `p-3`, `p-4`, `p-6`, `p-8`, `px-4 py-3` all appear, as do
`rounded-md`, `rounded-lg` and `rounded-xl` on the same conceptual surface, and
one instance of raw `bg-white`.

### 4.7 Graphs

| Chart                                                    | Live uses |
| -------------------------------------------------------- | --------: |
| `BarChart`                                               |         4 |
| `LineChart`                                              |         1 |
| `AreaChart`                                              |         1 |
| `PieChart` / `DonutChart` / `ScatterChart` / `Sparkline` |     **0** |

Charts are the healthiest subsystem. `/dashboard`, `/revenue` and
`/member-analytics` all compose `ChartCard` + a DS chart primitive with proper
`loading` and `empty` props, shared formatting and shared palette. This is the
one place the intended L2 → L3 → L5 composition actually happens, and it should
be the reference pattern for the rest of the migration.

The single exception is `features/revenue/components/RevenueChart.tsx` (100
lines) — a direct recharts re-draw with `bg-white`, `text-green-600`,
`shadow-lg`, its own tooltip and its own currency formatter. It has **zero
consumers** and should be deleted rather than migrated.

### 4.8 Links

There is **no `Link` primitive** in the design system — the only one of the
user-facing element categories with no L2 representative. Link styling is
consequently ad-hoc: `text-brand-link` (the token) competes with `text-blue-600`
and `text-blue-700` (raw palette), and underlines are applied inconsistently
(`underline`, `hover:underline`, `underline underline-offset-4`, or nothing).
Focus and visited states are unspecified everywhere.

### 4.9 Forms and inputs

`Input` (22), `Select` (14), `Label` (14) and `Checkbox` (7) are reasonably
adopted, but `FormField` — documented in §8.3 as "the single form scaffold",
which pages "never" bypass — appears in only **3 files**. Label/helper/error
layout is therefore hand-assembled almost everywhere.

Raw `<input>` remains in 6 workspace files (`support`, `settings/gym`,
`MembersPageClient`, `ProfileImageUpload`, `JoinForm`, `BulkAddMemberModal`,
`MemberPhotoSection`), raw `<select>` in 3, raw `<textarea>` in 1
(`support/page.tsx`, which uses raw `<input>`, `<select>` and `<textarea>`
together).

### 4.10 Selection controls

Four patterns express "pick one of N" in the workspace:

| Pattern                  | Implementation                                       | Site                  |
| ------------------------ | ---------------------------------------------------- | --------------------- |
| DS `Tabs`                | `TabsList` / `TabsTrigger`                           | `/billing-setup`      |
| `.mws-tab` underline bar | Raw CSS class                                        | `/payment-collection` |
| `.mws-subnav` pills      | Raw CSS class                                        | `/settings`           |
| Button group             | `role="group"` + `aria-pressed` + `<Button variant>` | `/member-analytics`   |

The button-group variant in `MemberAnalyticsClient` is the most accessible of
the four and is the only one with correct ARIA state.

---

## 5. Token discipline

### 5.1 Typography — the largest single source of drift

| Scale                                                               | Occurrences |
| ------------------------------------------------------------------- | ----------: |
| Default Tailwind (`text-xs`/`sm`/`base`/`lg`/`xl`/`2xl`/`3xl`)      |     **519** |
| DS scale (`text-body`/`caption`/`metadata`/`h1`/`h2`/`h3`/`mono-*`) |      **50** |

The DS type scale was **added to** Tailwind's defaults in `tailwind.config.ts`
rather than replacing them, so `text-sm` and `text-body` are both valid and the
default scale won 10 to 1.

This is not cosmetic. `.mws-root` sets the workspace base font to **13px**,
matching the DS `body` token. Tailwind's `text-sm` is **14px** and `text-base`
is **16px** — neither is a Metric size, and both are _larger_ than body text.
So the dominant type utilities in the product render at sizes the design system
does not define, and typically render secondary text larger than primary text.
Worst concentrations: `settings/security/page.tsx` (38), `MemberDetailModal`
(29), `MemberDetailModalMobile` (28), `AddMemberModal` (26).

### 5.2 Color

**119 raw-palette utilities** (`bg-white`, `bg-gray-200`, `text-blue-600`,
`text-orange-800`, …) remain in workspace code. Concentrations: `JoinForm` (33),
`(dashboard)/loading.tsx` (10), `TrialBanner` (6), `RevenueChart` (6),
`PastDueBanner` (4), `MemberLimitBar` (4), `UrgencyBadge` (3). Plus `#fff`
literals in the three shell components.

`globals.css` violates its own rule internally: `.mws-input:focus` hardcodes
`box-shadow: 0 0 0 3px rgba(27, 23, 255, 0.25)` — a duplicate of the
`--ds-focus-ring` token declared 500 lines above it.

### 5.3 Layout and spacing

Inline `style={{…}}` occurrences: **61** in `(dashboard)` pages, **28** in the
shell, **28** in feature components. Container width is expressed three ways —
`max-w-app` (the token, 6 pages), `style={{ maxWidth: 1200 }}` (the same value,
literal, 2 pages), `style={{ maxWidth: 720 }}` and `max-w-3xl` (neither, 2
pages). The `layout` token group in `tokens.ts` is referenced by nothing.

---

## 6. Accessibility

The DS primitives are built to standard — `Button` implements
`focus-visible:border-focusring focus-visible:shadow-focus`, `Breadcrumb`,
`Pagination` and `SideNav` all set `aria-current="page"`. The problem is that
the shell does not use them.

| Gap                                       | Detail                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No focus-visible in the `mws-*` layer** | `.mws-btn`, `.mws-nav-item`, `.mws-subnav`, `.mws-tab` and `.mws-row-click` have **zero** `:focus` or `:focus-visible` rules. Only `.mws-input`/`.mws-select`/`.mws-textarea` restyle focus — and they do it by setting `outline: none` first, which is correct only because they replace it with a border + ring. |
| **Rows are click-only**                   | `MembersPageClient.tsx:149` renders `<tr className="mws-row-click" onClick={…}>` with no `tabIndex`, no `onKeyDown` and no `role`. Opening a member — the primary action of the primary screen — is unreachable by keyboard. `PaymentCollectionPageClient` has the same shape.                                     |
| **No `aria-current` in live navigation**  | The sidebar, the mobile bottom nav and the settings sub-nav all signal the active item with color alone. `aria-current` appears in the codebase only inside the three unused primitives.                                                                                                                           |
| **Unnamed collapse toggle**               | `WorkspaceSidebar`'s collapse button renders `<PanelLeft/>` plus a `<span>Collapse</span>` that is removed when collapsed, and carries no `aria-label` — so in its collapsed state it is a button with no accessible name.                                                                                         |
| **No `<nav>` labels, no skip link**       | Neither `<nav>` element is labelled, and there is no skip-to-content link ahead of the sidebar's 9 links.                                                                                                                                                                                                          |
| **Status by color alone**                 | `getStatusDotClass` renders member status as a bare colored dot. The DS `Badge` supports `dot` _plus_ a text label specifically to avoid this; the hand-rolled version drops the label.                                                                                                                            |

`UrgencyBadge` deserves credit as the counter-example: it sets `role="status"`
and a full `aria-label`, and is the most accessible status indicator in the
product despite being the least token-compliant.

---

## 7. Theming

`WorkspaceShell` stamps `data-theme="light"` as a **literal**, and `AuthShell`
stamps `data-theme="dark"`. There is no toggle, no persistence, and no
`prefers-color-scheme` handling for the workspace. Exactly one workspace file
contains a `dark:` utility.

This matches the documented intent (§5: light = workspace, dark =
marketing/auth), so it is not a defect. It is worth recording as a
**deliberate constraint** because every primitive carries dual-theme styling
that the workspace can never exercise — a standing cost with no current return,
and a decision to revisit explicitly if a dark workspace is ever wanted.

---

## 8. Dead and unreachable UI

Verified by import-graph reachability from `src/app`. "Barrel-only" means the
component is exported from a feature's public `index.ts` but nothing imports it.

| Area                                                                                                                                                                                     |  Files |     Lines | Status                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | --------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments table suite** — `PaymentRemindersTable`, `SMSHistoryModal`, `ReminderStatusTable`, `RegularPaymentTable`, `PaymentCollectedTable`                                             |      5 |     1,813 | Unreferenced. Orphaned when `/payment-collection` was rebuilt in `mws-*`. Not even barrel-exported — `features/payments/index.ts` exports no components at all. |
| **DS primitives with no live usage** — `DataTable`, `CommandPalette`, `DropdownMenu`, `Drawer`, `Accordion`, `Breadcrumb`, `Avatar`, `Divider`, `Radio`, `Spinner`, `Popover`            |     11 |     1,427 | Built, tested, showcased, never wired                                                                                                                           |
| **DS composites with no consumers** — `SideNav`, `StateLayouts`, `DeleteDialog`, `UserMenu`, `SettingsSection`, `SearchBar`, `NotificationMenu`, `SectionHeader`, `FilterBar`, `Toolbar` |     10 |       779 | Built, never wired                                                                                                                                              |
| **`MembersTable`**                                                                                                                                                                       |      1 |       673 | Barrel-only. Superseded by `MembersPageClient`                                                                                                                  |
| **Old shell** — `layout/Sidebar`, `layout/Header`, `layout/EmailVerificationBanner`                                                                                                      |      3 |       528 | Zero importers. **`Sidebar.tsx:74` is the only `/access-control` link in the repo**                                                                             |
| **`PaymentCollectionModal`**                                                                                                                                                             |      1 |       424 | Barrel-only                                                                                                                                                     |
| **`components/dashboard/*`** — `MetricCard` + 4 KPI cards                                                                                                                                |      5 |       282 | Entire folder orphaned. `MetricCard` is a second implementation of the `StatCard`/`MetricCard` composite                                                        |
| **`RevenueChart`**                                                                                                                                                                       |      1 |       100 | Unreferenced recharts re-draw                                                                                                                                   |
| **Total**                                                                                                                                                                                | **37** | **6,026** |                                                                                                                                                                 |

Two further components — `RevenueMetricCard` (60) and `pwa/InstallButton` (97) —
are also unwired but are **documented in `DESIGN_SYSTEM.md` §12 as intentionally
staged for future placement**. They are excluded from the table above and must
not be swept.

The pattern is consistent and worth naming: **every rebuild has been additive.**
The new implementation ships, the old one stays in the tree, and the barrel keeps
exporting it so no tooling flags it. Nothing in the repo detects an
unreferenced component.

---

## 9. Remediation — sequenced

Ordered so that each phase makes the next one cheaper, and so that enforcement
lands before the bulk work rather than after it.

### Phase 0 — Stop the bleeding (prerequisite)

Without this, any migration re-drifts. This is the fix for F16.

1. **Add design-system lint rules.** ESLint `no-restricted-syntax` on raw
   palette utilities (`bg-*-100`, `text-blue-600`, …), on `bg-white`/`#fff`
   literals in `className`/`style`, and on `mws-*` classes outside
   `globals.css`. Start as warnings, ratchet to errors per directory as it
   clears.
2. **Extend `scripts/check-architecture.mjs`** with a DS rule group: fail on a
   component under `src/components/{ui,common}` with zero importers, and fail on
   new files introducing `mws-*`.
3. **Remove the default Tailwind type scale**, or alias `text-sm`/`text-base`
   onto DS sizes, so 519 existing utilities resolve to design-system values
   instead of 14px/16px. This is the single highest-leverage change in the
   document — it converts the largest category of drift into compliance without
   touching a component.

### Phase 1 — Delete (low risk, high clarity)

Remove the 37 files / 6,026 lines in §8, **except** the two documented staged
components. Before deleting `layout/Sidebar.tsx`, add `/access-control` to
`WORKSPACE_NAV` in `nav.ts` (F10) so the route keeps an entry point. Prune the
matching barrel exports in `features/members/index.ts`.

Reconsider before deleting: `DataTable`, `Drawer`, `Breadcrumb`, `SideNav`,
`UserMenu`, `SettingsSection`, `StateLayouts`. All seven are _targets_ of
Phases 2–3 — they are unused because the shell and the list screens were never
migrated onto them, not because they are wrong. Keep those; delete the rest.

### Phase 2 — Rebuild the shell on the design system

The highest-visibility change and the one that fixes F2, most of F7, and F11.
Rebuild `WorkspaceSidebar` on `SideNav`, `WorkspaceHeader` on `Breadcrumb` +
`UserMenu` + `Badge` + `Button`, and the mobile nav on `Drawer`. Replace every
inline dimension with the `layout` tokens that already hold the same values.
This alone retires most of the `mws-*` CSS the shell depends on, and it brings
`aria-current`, focus-visible and accessible names in for free because the
primitives already implement them.

### Phase 3 — Converge the list screens

Migrate `/members` and `/payment-collection` onto `DataTable`. Both currently
hand-roll search, filtering, pagination and empty states that `DataTable`
provides, so this is a net deletion. It resolves F5 and F8 (`DataTable` handles
row interaction accessibly) and removes the last two `mws-table` sites.

### Phase 4 — Unify status display

Collapse the five badge languages to one. Concretely: add a single
`memberStatusBadge(status)` helper in the members feature returning
`{ variant, label }`; delete `utils/badge-colors.ts`; re-express `UrgencyBadge`
as a `<Badge variant="error|warning">` wrapper keeping its `role="status"` and
`aria-label`; delete `workspace/primitives.tsx`'s `StatusBadge` and `Panel` once
Phase 2 lands.

### Phase 5 — Surfaces, forms and states

Replace the 25 ad-hoc card divs with `Card`. Adopt `FormField` as the form
scaffold. Rewrite `(dashboard)/loading.tsx` on `Skeleton` and
`StateLayouts.LoadingLayout` — or, better, give each route its own `loading.tsx`
matching that route's actual layout, since one generic table skeleton is wrong
for `/dashboard`, `/revenue`, `/member-analytics` and all of `/settings` (F13).

### Phase 6 — Admin surface

Give `(admin)` a real shell. It currently renders `<div className="admin-layout">`
with no navigation, and mixes DS color tokens with `text-3xl font-bold` and
`container mx-auto`. It is the smallest surface and the least urgent, but it is
the last place a third dialect survives.

### Sequencing note

Phases 1 and 2 can run in parallel with Phase 0 lint rules landing as warnings.
Phases 3–5 should not start before Phase 0 item 3 (the type scale), or they will
bake 14px/16px text into freshly-migrated screens.

---

## 10. What is already right

Stated plainly, because the analysis above is necessarily weighted toward
defects and the foundation is better than the adoption numbers suggest:

- **The token layer is genuinely well built.** 86 semantic properties, correct
  light/dark resolution, sound naming, and the `--mws-*` → `--ds-*` aliasing was
  done properly — which is why the two systems already share a palette and this
  is a component consolidation rather than a re-theme.
- **The primitives are high quality.** Full state matrices, `focus-visible`
  throughout, `cva` variants, forwarded refs, exported prop types, portalled
  overlays that correctly re-stamp their theme scope.
- **Charts are the model.** `/dashboard`, `/revenue` and `/member-analytics`
  demonstrate the intended L2 → L3 → L5 composition working exactly as designed,
  including loading and empty states. Use them as the reference for Phase 3.
- **`nav.ts` is well factored.** Declarative groups, longest-prefix active
  matching, breadcrumb labels — the navigation _model_ needs no work, only its
  rendering.
- **The `(dev)/design-system` showcase exists and is current.** It is the reason
  this analysis could be written against ground truth quickly.

---

## 11. Cross-references

- `.claude/DESIGN_SYSTEM.md` — the as-built contract this analysis measures against
- `.claude/rules/architecture.md` §2.17 — the Pattern Index entry for the design system
- `docs/architecture/legacy-ui-migration.md` — the earlier shadcn retirement
- `docs/architecture/frontend-patterns.md` — Radix/React 19 and hard-navigation notes
- `src/app/(dev)/design-system/page.tsx` — living showcase of every primitive and composite
- `src/components/ui/tokens.ts` · `src/app/globals.css` · `tailwind.config.ts` — the L1 sources
