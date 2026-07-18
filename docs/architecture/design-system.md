# Design System Rules

> Reference for rule **2.14** in `.claude/rules/architecture.md`. This governs
> the _visual_ language of the product the way the feature-first rules govern
> its _structural_ language. It applies to every surface — the dashboard app,
> the public marketing site, and the admin dashboard.

The goal is a dense, precise, keyboard-first interface in the spirit of
Stripe, Linear, and Cursor — but expressed **through the tokens this codebase
already has**, not a bolt-on second theme. "Surgical" here means _density and
precision_, not _dark_: the app is light, and stays light.

---

## 1. Color: tokens only, monochrome-first

- **Single source of color:** the shadcn HSL CSS variables defined in
  `src/app/globals.css` (`--background`, `--foreground`, `--card`,
  `--popover`, `--border`, `--input`, `--muted(-foreground)`, `--accent(-foreground)`,
  `--primary`, `--destructive`, `--ring`) and the `brand` scale in
  `tailwind.config.ts` (`brand.accent = #1b17ff`, plus the `primary` blue
  `221 83% 53%`). Consume them via Tailwind's semantic classes (`bg-popover`,
  `text-muted-foreground`, `border-border`, …).
- **No ad-hoc colors** in components. Do not introduce new hex values, new
  gradients, or a parallel palette. If a shade is missing, add a token — don't
  inline it.
- **Monochrome-first (the "95% rule"):** the overwhelming majority of any
  surface is background, foreground, and grays. Color carries **meaning only**:
  - `primary` / `brand.accent` → the single interactive/active accent
    (selected row, active nav item, focus ring).
  - `destructive` → dangerous/irreversible actions and errors.
  - status greens/ambers → member/subscription status semantics.
    Decorative color is not allowed in app UI.

## 2. Elevation: borders, not shadows

- Separate surfaces with **1px hairline borders** (`border-border`, or
  `border-gray-200`/`border-gray-100` on the app shell) and **layered
  backgrounds** (`bg-background` base → `bg-card`/`bg-popover` raised), not
  heavy drop shadows. Reserve real shadow for genuinely floating layers
  (dialogs, the command palette).

## 3. Density & typography

- App body text is **13–14px**, not 16px. Metadata/labels are **11px**,
  `uppercase`, `tracking-wider`, `text-muted-foreground`.
- Numeric/technical values (phone numbers, shortcuts, IDs) use `font-mono`.
- Headings use `tracking-tight`. Rows are tight (`h-8`/`h-9`).

## 4. Shared primitives are mandatory

- New UI is composed from the primitives in `src/components/ui/` (`button`,
  `input`, `select`, `dialog`, `command`, `table`, `badge`, …). Do not
  hand-roll a bespoke button/input/dialog with inline styles when a primitive
  exists — extend the primitive instead.
- Primitives are unopinionated about layout and never ship surprise margins.

## 5. The command palette is the keyboard-first entry point

- The global **⌘K / Ctrl+K** command palette
  (`src/components/command-palette/`) is the canonical fast path through the
  app: navigate anywhere, search live member records, or fire a quick action.
- **Navigation has one source of truth:** `src/components/layout/navigation.ts`
  (`primaryNavigation`). The sidebar and the palette both render from it — never
  duplicate the route list. Add a destination there once and it appears in both.
- Palette commands wire to **real** flows (routes, contexts, endpoints), never
  mock data. Static command groups filter through the pure `matchesQuery`
  helper (`command-palette/filter.ts`); async results (e.g. member search) come
  pre-filtered from the server.

## 6. Modals & overlays

- Dialogs are top-anchored or centered, fixed-width, with a `backdrop-blur`
  overlay and a 1px border — no muddy heavy-shadow center cards.
- Prefer the command palette or a focused dialog over sprawling nested menus.

---

### Enforcement & scope

Rules 1–4 are review-enforced today (there is no lint rule for "monochrome" —
it is a code-review standard). Rule 5's single-source-of-truth for navigation
is structural: adding a route to the sidebar without going through
`navigation.ts` is a regression.

This document is the **first slice** of a broader visual overhaul. Public
marketing pages already follow much of this language (Apple-style light,
token-driven); future work extends the same system to every remaining surface.
Any such visual change must be verified in a rendering environment (local dev
or a preview deploy) — note that `next/font/google` requires network access to
`fonts.googleapis.com`, so pages cannot render in a fully sandboxed build.
