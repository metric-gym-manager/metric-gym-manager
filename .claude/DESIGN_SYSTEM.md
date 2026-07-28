# Metric Design System — Master Reference (as-built contract)

> **What this is.** The authoritative, _as-built_ contract for the Metric design
> system: the reusable UI foundation every feature and page in this application
> consumes. It is the realized counterpart to the raw _Metric Design System
> Specification_ — where the spec describes intent, this document describes what
> exists in the repository, where it lives, and the rules that govern its growth.
> Treat it as an **architectural contract, not a design reference**.
>
> **Status.** The foundation (Layers 1–3 + the authoring rules for Layers 4–5) is
> **complete and verified** (`tsc --noEmit`, `arch:check`, `eslint`, and the Jest
> suite all green). Legacy shadcn primitives have been consolidated onto the token
> system (Phase A remap + Phase B retheme-at-source). The retheme work currently
> lives on branch `claude/design-system-foundation-jeovtj`, pushed and awaiting
> **visual QA before merge to master**. Migrating existing feature screens onto the
> Layer 4 / Layer 5 patterns is downstream work by design — the prompt's objective
> was the foundation, and that is done.

---

## 1. Purpose, Precedence & Prime Directive

- **Precedence.** `.claude/rules/architecture.md` (ARCHITECTURE) governs project
  structure, dependency direction, and file organization. This document governs
  every **visual and interaction** decision. On conflict, architecture rules win
  for _where code lives_; this document wins for _how it looks and behaves_.
- **Prime directive — one implementation per pattern.** There is exactly **one**
  Button, one Modal, one Table, one Tooltip, one spacing scale, one type scale,
  one color system. New screens compose the existing primitives; they never
  fork a second implementation of a foundational pattern.
- **Token-only.** No raw color / spacing / font-size / radius / shadow / z-index /
  duration / breakpoint value may appear outside the three token source files
  (§4). If a needed value is missing, **add a token first**, then reference it.

---

## 2. Layered Architecture

The system is built in five layers. **Dependencies only ever point downward** — a
layer may consume the layers below it, never above or sideways into a sibling
feature.

| Layer                       | Owns                                                                                                                                   | Lives in                                                                     | Import via                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **L1 — Design Tokens**      | Every raw design value (color, type, space, radius, elevation, motion, z-index, blur, opacity, breakpoint, layout dims, chart palette) | `src/components/ui/tokens.ts` · `src/app/globals.css` · `tailwind.config.ts` | `import { tokens } from '@/components/ui'` (JS) / Tailwind utilities (CSS) |
| **L2 — Primitives**         | Reusable, business-free UI atoms/molecules with no domain logic                                                                        | `src/components/ui/primitives/*`                                             | `import { Button, Modal, DataTable } from '@/components/ui'`               |
| **L3 — Composites**         | Generic compositions of primitives (still business-free)                                                                               | `src/components/common/composites/*`                                         | `import { PageHeader, StatCard } from '@/components/common/composites'`    |
| **L4 — Feature Components** | Business-specific UI, one domain per folder                                                                                            | `src/features/<domain>/components/*`                                         | feature-local                                                              |
| **L5 — Pages**              | Route layout + orchestration only (no direct styling)                                                                                  | `src/app/**`                                                                 | route files                                                                |

**Non-negotiables (enforced by `npm run arch:check` + ESLint):**

- `src/components/` holds **shared UI only** — never business logic.
- No parallel component structure, no second design system, no folder reorg.
- A feature folder must remain deletable without breaking another feature.
- Route handlers/pages orchestrate; they do not restyle primitives.

---

## 3. File & Import Map

```
src/
  components/
    ui/
      tokens.ts                 # L1 — JS source of truth for every token
      index.ts                  # L2 barrel  →  import { … } from '@/components/ui'
      primitives/*.tsx          # L2 — 32 primitives + useVirtualRows hook
      <name>.tsx                # DEPRECATED legacy shadcn (rethemed to tokens; kept until screens migrate)
    common/
      composites/
        index.ts                # L3 barrel → import { … } from '@/components/common/composites'
        *.tsx                   # L3 — 14 composites
  app/
    globals.css                 # L1 — --ds-* CSS variables, light/dark + legacy scopes
    (dev)/design-system/page.tsx# living showcase of every primitive & composite
  features/<domain>/components/  # L4 — feature UI composes L2/L3
tailwind.config.ts              # L1 — maps --ds-* vars onto Tailwind utilities
```

**Canonical imports** — always the barrel, never a deep path:

```ts
import { Button, Input, Modal, DataTable, tokens } from '@/components/ui'
import {
  PageHeader,
  StatCard,
  ConfirmDialog,
} from '@/components/common/composites'
```

---

## 4. Layer 1 — Design Token Catalog

Tokens have a **single source of truth split across three synchronized files**:

1. `tokens.ts` — the JS/TS mirror (chart palettes, motion, programmatic theming).
2. `globals.css` — the CSS custom properties (`--ds-*`), resolved per theme.
3. `tailwind.config.ts` — binds those variables to Tailwind utility classes.

> **RULE:** These three files are the _only_ place raw hex/px values may appear.

### 4.1 Color — semantic (theme-resolved)

Components reference **semantic** names only (surface / border / text / accent /
status), never the primitive ramp. Each resolves per theme (§5).

| Group                | Tokens                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface              | `surface-base`, `surface-card`, `surface-panel`, `surface-input`, `surface-hover`, `surface-active`, `surface-selected`, `surface-overlay`                |
| Border / line        | `line-1`, `line-2`, `line-3`, `line-hover`, `line-strong`, `line-subtle`, `line-dashed`                                                                   |
| Text / ink           | `ink` (primary), `ink-secondary`, `ink-muted`, `ink-placeholder`                                                                                          |
| Solid / primary      | `solid` / `solid-text` (high-contrast fill), `primary` / `primary-text`                                                                                   |
| Accent (interactive) | `accentui`, `accentui-hover`, `accentui-text`, `brand-link`, `brand-link-hover`, `focus`                                                                  |
| Status               | `success` / `success-bg` / `success-border`, `warning` / `warning-bg` / `warning-border`, `error` / `error-bg` / `error-border`, `danger` / `danger-text` |

### 4.2 Primitive color ramp (raw — never referenced by components)

`neutral 50–900`, `dark 50–1000/base/black`, `blue 500–700/tint/bg/ring/border`,
`green`, `yellow`, `red`. Used _only_ to compose the semantic tokens above.

### 4.3 Non-color scales

| Scale                                 | Tokens                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spacing** (8-pt grid, 4px sub-grid) | `0, 0.5(2px), 1(4px), 2(8px), 3(12px), 4(16px), 5, 6, 8, 10, 12, 16, 20, 24, 32`                                                                                                                                                              |
| **Radius**                            | `none, xs(2), sm(4), md(5), lg(6), xl(8), 2xl(10), 3xl(12), full`                                                                                                                                                                             |
| **Elevation / shadow**                | `none`, `focus`, `focusError`, `overlay`, `marketingOverlay` — elevation is background + hairline, **not** decorative drop shadows                                                                                                            |
| **Z-index**                           | `base(0), sticky(50), drawerBackdrop(60), drawer(61), modalBackdrop(70), modal(71), modalNested(72/73), paletteBackdrop(80), palette(81), toast(90), demoModal(100)`                                                                          |
| **Motion**                            | duration `fast(150), normal(200), slow(300), verySlow(600), drawer(180), modal(140)`; easing `default/in/out/inOut`                                                                                                                           |
| **Blur**                              | `nav(16px)`, `modal(6px)`, `marketingModal(8px)`                                                                                                                                                                                              |
| **Opacity**                           | `disabled(.5), hoverLight(.04), hoverDark(.06), pressed(.08), backdropLight(.45), backdropDark(.7)`                                                                                                                                           |
| **Icon size**                         | `xs(12), sm(13), md(14), default(15), lg(20), xl(26)`                                                                                                                                                                                         |
| **Breakpoints**                       | `mobile(480), tablet(768), laptop(1024), desktop(1440)`                                                                                                                                                                                       |
| **Layout dims**                       | `sidebarWidth(240)`, `sidebarCollapsedWidth(56)`, `workspaceSelectorHeight(52)`, `breadcrumbHeight(52)`, `workspacePadding(24)`, `maxContentWidthApp(1200)`, `maxContentWidthMarketing(1120)`, `drawerWidth(420)`, `settingsSubNavWidth(160)` |
| **Chart palette**                     | per-theme `bar, highlight, success, warning, error, grid, axis` (max 3 colors per chart)                                                                                                                                                      |

### 4.4 Typography

- **Families:** `sans` = Geist, `mono` = Geist Mono. Weights `400/500/600/700`.
- **Type scale** (`typeScale` → Tailwind `text-*`): `displayXl, display, displaySm,
h1, h2, h3, bodyLg, body(13px default), bodyEmphasis, bodySm, caption, metadata
(uppercase +tracking), label, button, buttonSm, mono, monoSm, monoXs, code`.
- `cn()` (`src/lib/utils`) uses `extendTailwindMerge` so these custom `text-*`
  size tokens don't collide with `text-*` color utilities.

---

## 5. Theming Model (Light + Dark)

- **Mechanism.** Semantic tokens are CSS custom properties (`--ds-*`) declared
  under theme scopes in `globals.css`:
  - `[data-theme='light']` (+ legacy `.mws-root`) → the **App Workspace** surface.
  - `[data-theme='dark']` (+ legacy `.mauth-root`) → **Marketing / Auth / Legal**.
- **Tailwind.** `darkMode: ['selector', '[data-theme="dark"]']` — dark utilities
  key off the same attribute; the legacy `.mws-*`/`.mauth-*` variables are
  re-pointed at `var(--ds-*)` so old markup inherits the tokens for free.
- **Surface wrappers.** `WorkspaceShell` stamps `data-theme="light"`, `AuthShell`
  stamps `data-theme="dark"`. **Portalled overlays re-apply the theme scope**
  (`Modal`, `Drawer`, `Popover`, `DropdownMenu`, `CommandPalette`) because they
  render outside the wrapper in a portal — without this they'd lose the tokens.
- **Contract.** A component styles both themes _by construction_ (it only uses
  semantic tokens); it must never hardcode a light- or dark-specific color.

---

## 6. Layer 2 — Primitive Registry (32 + 1 hook)

No business logic. Every entry is token-driven, light+dark, keyboard-accessible,
WCAG AA, responsive, strongly typed, and exports a `*Props` type.

**Form controls:** `Button` (variants: primary · secondary · accent · ghost ·
destructive · destructive-ghost · success-ghost · link; sizes: xs · sm · md · lg ·
xl · icon) · `Input` · `Textarea` · `Select` · `Checkbox` · `Radio` · `Switch` ·
`Label` · `FormField` (+ `HelperText`).

**Display & feedback:** `Badge` · `Avatar` · `Card` (+ Header/Title/Label/Body/
Footer) · `Divider` · `Spinner` · `Skeleton` (+ `SkeletonText`) · `Progress` ·
`Tooltip` (+ `TooltipProvider`) · `Alert` · `Toast`/`Toaster` · `EmptyState`.

**Overlays:** `Modal` · `Drawer` · `Popover` (+ Anchor/Trigger/Content).

**Navigation:** `Tabs` (List/Trigger/Content) · `Accordion` (Item/Trigger/Content)
· `Breadcrumb` (Link/Page/Separator) · `Pagination`.

**Menus:** `DropdownMenu` (Trigger/Content/Item/Checkbox/Radio/Group/Label/
Separator) · `CommandPalette` (+ Command Empty/Group/Item/Separator).

**Data & table:** `Table` (Container/Header/Body/Row/Head/Cell) — the low-level
markup primitive · `DataTable` — the full-featured system (§8.1) · `useVirtualRows`
— virtualization hook.

**Charts:** `LineChart` · `BarChart` · `AreaChart` · `PieChart` · `DonutChart` ·
`ScatterChart` · `Sparkline` (§8.2).

---

## 7. Layer 3 — Composite Registry (14)

Generic, business-free compositions built from L2. Feature UI composes _these_;
pages orchestrate them. Neither restyles primitives directly.

| Composite                                 | Purpose                                                           |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `SectionHeader`                           | Titled section divider with optional action slot                  |
| `PageHeader`                              | Page title, breadcrumb slot, primary/secondary actions            |
| `Toolbar`                                 | Horizontal action/control bar                                     |
| `SearchBar`                               | Debounced search input with affordances                           |
| `FilterBar`                               | Composable filter control row                                     |
| `StatCard` / `MetricCard` (+ `StatDelta`) | KPI tiles with delta indicators                                   |
| `ChartCard`                               | Titled chart container with state handling                        |
| `StateLayouts`                            | `EmptyStateLayout` · `LoadingLayout` (skeleton/spinner scaffolds) |
| `SettingsSection` (+ `SettingsRow`)       | Settings page section pattern                                     |
| `ConfirmDialog`                           | Generic confirmation (default/destructive)                        |
| `DeleteDialog`                            | Destructive-delete confirmation                                   |
| `SideNav` (+ Group/Item)                  | Application sidebar navigation                                    |
| `UserMenu`                                | Account/avatar dropdown                                           |
| `NotificationMenu`                        | Notification dropdown                                             |

---

## 8. Cross-Cutting Subsystems

Each is a **single reusable implementation**. Every future screen reuses it —
never a page-specific fork.

### 8.1 Tables — `DataTable`

Sorting · filtering · pagination · sticky header · sticky columns · row selection ·
bulk actions · loading · skeletons · empty state · error state · virtualization
(`useVirtualRows` hook) · expandable rows · **opt-in column resizing** (per-column
`resizable`/`minWidth`, `onColumnResize`, persisted via `storageKey`, keyboard
`role="separator"`) · responsive behavior. Column contracts via `DataTableColumn`.

### 8.2 Charts

Primitives `LineChart · BarChart · AreaChart · PieChart · DonutChart · ScatterChart
· Sparkline` sharing one `chartPalette` token, typography, tooltips, legends, grid
styling, animations, and empty/loading states (max 3 colors per chart; accent
highlights the active series). Business charts **compose** these — never re-draw.

### 8.3 Forms

`FormField` is the single form scaffold — label, required indicator, helper text,
character counter, validation/error presentation. Pages **never** hand-roll form
layout; they wrap the control primitives (`Input`/`Select`/`Checkbox`/…) in
`FormField`.

### 8.4 Navigation

`SideNav`, `Breadcrumb`, `Tabs`, `DropdownMenu`, `Pagination`, `CommandPalette`
are the _only_ navigation components used app-wide.

---

## 9. Component Contract & State Matrix

### 9.1 Every reusable component must

Support light + dark · use design tokens exclusively · implement all documented
variants and sizes · be keyboard accessible · meet WCAG AA · be responsive ·
expose a clean composable API · be strongly typed · be extensible via `className`

- variants — **never** by duplication.

### 9.2 Interaction states (implement every applicable one)

`default · hover · active · focus · focus-visible · disabled · loading · error ·
success · warning · selected · checked · expanded · collapsed · read-only`.

Applied consistently: e.g. inputs implement default/hover/focus-visible/disabled/
error/read-only; toggles add checked/selected; disclosure components add
expanded/collapsed; async components add loading.

---

## 10. Composition & Consistency Rules

**Prefer:** composition over inheritance · configuration over duplication ·
variants over separate components · shared primitives over custom implementations.

**Banned** — never create feature-flavored forks:

- ✗ `BlueButton`, `DashboardButton`, `DeleteButton` → use `<Button variant=…>`
- ✗ `RevenueCard`, `CustomTable` → use `StatCard` / `DataTable`

**Single-implementation mandate.** There is exactly one of each: button, modal,
table, form scaffold, tooltip, spacing system, type system, color system.

---

## 11. Layout System

Build layouts from the documented dimensions in the `layout` token — sidebar
(240 / 56 collapsed), workspace selector & breadcrumb heights (52), workspace
padding (24), content max-widths (1200 app / 1120 marketing), drawer (420),
settings sub-nav (160). Respect the 8-pt spacing grid, container max-widths,
gutters, vertical rhythm, and the four breakpoints. **No arbitrary spacing, no
magic numbers.**

---

## 12. Legacy shadcn Consolidation

The application previously carried a second shadcn UI set. It has been **fully
retired** so there is one visual language and one implementation per pattern:

- **Phase A — token unification:** the shadcn CSS variables (`--primary`, `--ring`,
  `--destructive`, foregrounds, `--muted-foreground`, …) were remapped to the
  Metric tokens, so existing shadcn markup renders in the Metric palette.
- **Phase B — retheme-at-source:** the 13 shared `@/components/ui/<name>` shadcn
  primitives (button, badge, input, textarea, label, checkbox, progress, card,
  table, tooltip, dialog, select, alert-dialog) were edited in place to consume
  tokens directly while preserving every export, prop, and behavior — migrating
  all consumers with zero consumer changes. `calendar` relied solely on the
  Phase A remap and needed no source edit.
- **L4/L5 consumer migration:** every feature component (L4) and page (L5),
  including the shared layout/pwa components and the admin dashboards, was moved
  onto the Metric primitives (`@/components/ui`) and composites
  (`@/components/common/composites`). Confirmation dialogs converged on the single
  L3 `ConfirmDialog` composite — the top-level `common/ConfirmDialog` duplicate
  was deleted and the imperative `useConfirmDialog` hook now renders the composite.
- **Legacy set deleted:** with zero importers remaining (verified repo-wide), all
  14 deprecated `@/components/ui/<name>` shadcn bridge files (the 13 above +
  `calendar`) were removed, along with the npm deps only they used —
  `@radix-ui/react-{alert-dialog,checkbox,label,progress,select}`,
  `react-day-picker`, and its peer `date-fns` (also pruned from
  `next.config.js` `optimizePackageImports`). `@radix-ui/react-{dialog,slot,tooltip}`
  remain — still used by the DS Modal/Drawer, Button, and Tooltip primitives.
- Historical traced inventory + decision-free mapping:
  `docs/architecture/legacy-ui-migration.md`.

**Known unwired UI (retained, not dead).** Two components currently have zero
importers and are **not** exported from any barrel, but were migrated onto the
Metric system and are intentionally kept — they are staged for future wiring,
not dead code, so do not delete them on a dead-code sweep without confirming
intent, and do not assume they are mounted:

- `src/features/revenue/components/RevenueMetricCard.tsx` — composes the DS
  `MetricCard` composite; awaiting a revenue-dashboard placement.
- `src/components/pwa/InstallButton.tsx` — PWA install CTA (native + iOS
  instructions); awaiting a landing/marketing placement.

> **State.** The design-system foundation (Phases 0–3) merged to master via
> PR #42. The L4/L5 consumer migration + legacy retirement was then merged to
> master from branch `claude/design-system-foundation-jeovtj`, green on the full
> functional gate (`tsc` + `arch:check` + `eslint` 0 errors + `jest`). Visual QA
> was deferred to post-merge review.

---

## 13. Validation Checklist

Before any UI work is considered complete, verify:

- [ ] Every reusable component adheres to this document / the spec.
- [ ] Structure adheres to `architecture.md`; Feature-First not violated (`arch:check`).
- [ ] No hardcoded design values; only approved tokens used.
- [ ] Components are generic, not feature-specific; business logic isolated from UI.
- [ ] Accessibility (keyboard + WCAG AA) satisfied; responsive behavior correct.
- [ ] Light **and** dark themes fully supported.
- [ ] Existing components reused rather than duplicated (one impl per pattern).
- [ ] Gate green: `npm run type-check && npm run arch:check && npm run lint && npm test`.

---

## 14. Conflict-Resolution Protocol

If a requested implementation conflicts with `architecture.md` or this document:
**explain the conflict and preserve architectural integrity** rather than
introducing an inconsistent pattern. Do not fork a second implementation to
satisfy a one-off; extend the existing primitive/composite (new variant, new prop)
or add the missing token. Structure conflicts defer to `architecture.md`; visual/
interaction conflicts defer to this document.

---

## 15. Cross-References

- `.claude/rules/architecture.md` — project structure & precedence (Pattern Index).
- `docs/architecture/feature-first-growth-rules.md` — binding growth rulebook.
- `docs/architecture/legacy-ui-migration.md` — legacy shadcn traced inventory.
- `docs/architecture/frontend-patterns.md` — Radix/React 19 & hard-navigation notes.
- `src/app/(dev)/design-system/page.tsx` — living showcase of every primitive & composite.
- `src/components/ui/tokens.ts` — the token source of truth.
