# Mobile UI Rebuild — Phase 1 Implementation Plan (v1.5, reviewed)

> **Status of this document.** The plan text below is the canonical,
> git-tracked implementation contract. **Execution status lives in the live
> tracker artifact, not here** — phase status, gate checklists, decision
> approvals, open-decision answers, risk states and an activity log are stored
> in the tracker's database so they can be updated from the page or from a
> Claude session without editing this file.
>
> **Tracker:** <https://claude.ai/code/artifact/8e3aa98b-6f13-4ec2-88ae-e7ada2a3bf1d>
> (private artifact; database collections `phases`, `decisions`, `open`,
> `risks`, `log`). Audit artifact:
> <https://claude.ai/code/artifact/ba103fc6-01c9-442e-aa5c-1fa24874c19e>.
>
> **How an implementation session updates status.** Use the Artifact tool's
> `read_db` / `write_db` against the tracker URL:
>
> - Phases: collection `phases`, docs `p0`…`p10`, fields
>   `{ status: 'not_started' | 'in_progress' | 'blocked' | 'done', notes, gates: { g1..g9: boolean }, updatedAt }`.
> - Decisions: collection `decisions`, docs `d01`…`d28`, fields
>   `{ status: 'proposed' | 'approved' | 'changed', note }`.
> - Open decisions: collection `open`, docs `o01`…`o11`, fields
>   `{ status: 'open' | 'resolved', answer }`.
> - Risks: collection `risks`, docs `r01`…`r19`, fields
>   `{ status: 'open' | 'mitigated' | 'realised' | 'closed', note }`.
> - Activity: document `log/entries`, field `entries: [{ t, actor, text }]`
>   (prepend; keep ≤ 300).
> - **Writes to existing documents must carry `if_version`** (the `version`
>   returned by `read_db`): read the document, then send a `write_db`
>   `db_op: "batch"` whose entries include `if_version`. A write without it is
>   refused with `version_mismatch`; `set` on a new document needs no pin.
>
> **Branch history (to avoid confusion).** The audit and this plan were written
> on `claude/mobile-ui-rebuild-audit`, merged into `master` at `9420269` and
> the branch deleted (never pushed). Implementation uses one branch per phase,
> `claude/mobile-ui-rebuild-p<N>`, cut from `master`; the per-phase session
> prompts are in `mobile-ui-rebuild-prompts.md`. `claude/workspace-ui-overhaul`
> is fully merged and closed (see `workspace-ui-overhaul-closeout.md`).
>
> **Version history.** v1 written 2026-09-13 from the Phase 0 audit
> (`mobile-ui-rebuild-audit.md`). **v1.5 (same day): Phase 1.5 review** —
> scope-creep removal, product-behaviour changes moved out of the rebuild,
> routing simplified, member-detail refactor minimised, and the visual
> specification, screen blueprints, state coverage, stress tests, visual gates,
> implementation discipline and amendment protocol added (§0 and §25–§31).
> Planning only: no source, configuration or dependency was changed. Audit
> correction carried here: the member-detail fork duplicates **six**
> `useMutation` blocks, not seven.

---

## 0. Plan Corrections (Phase 1.5 review)

Governing rule for this project, applied to every correction below:

> The mobile rebuild may alter presentation and interaction mechanics required
> for mobile usability, but must not silently change business-action
> semantics or desktop behaviour. Structural change is permitted only where it
> is strictly necessary for correct mobile navigation/presentation, to remove
> the existing broken mobile fork, or to preserve functional parity.
> **Do not perform engineering cleanup merely because it would make the
> implementation cleaner.**

### 0.1 Corrections made

| #   | Correction                                                                                                                                                                                                                                                                                                                                                         | Class                 | Effect on plan                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------- |
| C1  | **Member detail: drop the `useMemberMutations` extraction and the `MemberDetail` rename.** Parity is achieved by deleting the fork and rendering the existing `MemberDetailModal` on both tiers via `Modal placement`. Hook extraction is engineering cleanup.                                                                                                     | REQUIRED              | §10 rewritten; Phase 3 shrinks; risk r01 lowered; d09 changed.                         |
| C2  | **Remove the new confirmations on Remind and Send broadcast.** They change business-action semantics and desktop click count. Recorded as optional product decisions outside the rebuild.                                                                                                                                                                          | REQUIRED              | §8.10, §8.18, §11 amended; d21 changed; o04 moved to §23-B.                            |
| C3  | **`?member=<id>` URL state deferred.** Hardware/browser back is required for a fullscreen overlay and is delivered by the fullscreen `Modal`'s own history entry; refresh-restore and deep links are a new product capability.                                                                                                                                     | REQUIRED              | §3.2, §10 amended; d08 changed; o10 moved to §23-B; r03 narrowed.                      |
| C4  | **`openMember(id, { intent: 'pay' })` deferred.** A tap-count shortcut, not a usability necessity; Renewals' "Record payment" opens member detail whose sticky footer already carries Mark Paid.                                                                                                                                                                   | REQUIRED              | §8.10 amended; d24 changed.                                                            |
| C5  | **Membership Setup nested routes replaced** by a phone-only history entry on section enter (back returns to the menu) and single-tree rendering (no hidden desktop tree on phones). No new pages, no desktop URL change.                                                                                                                                           | REQUIRED              | §3.2, §8.13 amended; d23 changed; r10 removed; Phase 8 shrinks; UI3 unaffected.        |
| C6  | **Drop `Toolbar sticky/variant`, `Table pinFirstColumn`/`scrollCue`, `useSignOut`, the `max-tablet:` → `phone:` migration as a task.** Fullscreen `Modal` footer already is the sticky action bar; the cohort no longer needs a pinned column (C9); sign-out handler moves with the bar it belongs to; migration happens only when a file is already being edited. | REQUIRED              | §5 amended; file map amended.                                                          |
| C7  | **AppBar carries no page-action slot.** Page primary actions stay in page content (first row) — no context plumbing between pages and shell.                                                                                                                                                                                                                       | REQUIRED              | §3.1, §6, §8, blueprints amended; d27 added.                                           |
| C8  | **Navigation: four items — Dashboard · Members · Renewals · More** (option C). The dashboard's Revenue tile already gives Revenue one tap; four items hold at 320 px without truncation; fewer accidental taps.                                                                                                                                                    | RECOMMENDED           | §6 rewritten with the option comparison; d05 changed; o03 stays open for product veto. |
| C9  | **Analytics cohort: condensed rows + per-cohort expansion** (all M0–M12 values one tap away) instead of a 15-column scroller. Complete data access, not complete desktop representation.                                                                                                                                                                           | RECOMMENDED           | §13 rewritten; §12 Category C-alt; d20 changed.                                        |
| C10 | **Touch policy formalised as one rule** (§15.1) with `data-dense` marking dense controls; the same thresholds appear in the DS spec, primitives, probe and DoD.                                                                                                                                                                                                    | REQUIRED              | §15 rewritten; §17 probe; §24 DoD; d26 added.                                          |
| C11 | **"Information preserved" redefined as accessible, not simultaneously visible.** Per-list visible / disclosed / in-detail decisions (§9.4); the phone-tier test asserts that split.                                                                                                                                                                                | REQUIRED              | §9.4 added; §12 amended; DoD item 6 reworded.                                          |
| C12 | **PWA:** keep `viewport-fit=cover` + safe-area tokens + dark `background_color` (presentation). `start_url` change and `display_override` removed from the rebuild (product/config decision).                                                                                                                                                                      | REQUIRED              | §16 amended; d25 changed; o11 added to §23-B.                                          |
| C13 | **Print → Share** and **"Register another"** removed from the rebuild (new product actions).                                                                                                                                                                                                                                                                       | REQUIRED              | §8.14, §8.17, §14 amended; o07 moved to §23-B.                                         |
| C14 | **Mobile "Mark Paid" now uses `MarkPaidDialog`** — this is the one mobile behaviour change kept, because it restores parity with desktop and removes a defect of the fork (one-tap money with no date choice).                                                                                                                                                     | REQUIRED (parity)     | §10.                                                                                   |
| C15 | **Access activity and recent payments keep their plain `Table` on desktop**; phone renders `ListRow`s via the tier hook. No `Table` → `DataTable` conversions.                                                                                                                                                                                                     | REQUIRED              | §8.1, §8.15, §12 amended.                                                              |
| C16 | **Door Access sidebar entry on desktop** kept, but classified as a desktop navigation change that closes OPEN-1 and requires explicit approval (o12). Mobile "More" entry is required regardless.                                                                                                                                                                  | RECOMMENDED (approve) | §6; §23-B.                                                                             |
| C17 | **Added:** §25 visual design specification, §26 screen blueprints, §27 UI state coverage, §28 content stress tests, §29 visual regression gates, §30 implementation discipline, §31 plan amendment protocol.                                                                                                                                                       | REQUIRED              | New sections.                                                                          |
| C18 | **Definition of Done extended** with functional parity, presentation parity, mobile quality, state completeness, stress resilience, design-system integrity and controlled deviations.                                                                                                                                                                             | REQUIRED              | §24 rewritten.                                                                         |
| C19 | **UI6 ratchet** kept as tooling that protects the breakpoint decision; it is not product code.                                                                                                                                                                                                                                                                     | RECOMMENDED           | §4.                                                                                    |
| C20 | **Tablet default-collapsed sidebar** kept: 768–1023 receives the phone chrome today, so this defines a new tier rather than changing an existing desktop experience.                                                                                                                                                                                               | RECOMMENDED (o02)     | §4.                                                                                    |

### 0.2 Scope classification of every planned change

| Change                                                                        | UI-only | UI + necessary navigation | Structural refactor | Product-behaviour change | Decision                                    |
| ----------------------------------------------------------------------------- | :-----: | :-----------------------: | :-----------------: | :----------------------: | ------------------------------------------- |
| Tokens (touch, safe-area, input font, sheet height, bottom-nav height)        |    ✓    |                           |                     |                          | Keep                                        |
| `phone:` screen; `lg:`→`tablet:` in the shell                                 |    ✓    |                           |                     |                          | Keep                                        |
| `max-tablet:` → `phone:` migration in existing files                          |    ✓    |                           |                     |                          | Opportunistic only (when file is touched)   |
| `useViewportTier` provider + SSR hint in `(dashboard)/layout.tsx`             |    ✓    |                           |                     |                          | Keep (UI infrastructure)                    |
| `renderScreen({ viewport })`, probe, Playwright projects                      |    ✓    |                           |                     |                          | Keep (tests)                                |
| Primitive `phone:` sizing (Button, Input, Select, …)                          |    ✓    |                           |                     |                          | Keep                                        |
| `Modal placement` (+ history entry for fullscreen)                            |    ✓    |             ✓             |                     |                          | Keep                                        |
| `Drawer size`, `Tabs overflow`, `Pagination responsive`, `Charts compactAxis` |    ✓    |                           |                     |                          | Keep                                        |
| `DataTable mobileRow` + `ListRow`                                             |    ✓    |                           |                     |                          | Keep                                        |
| `Toolbar sticky`, `Table pinFirstColumn`/`scrollCue`                          |    ✓    |                           |                     |                          | **Dropped** (no longer needed)              |
| `AppBar`, `BottomNav` composites; delete old bars                             |    ✓    |             ✓             |                     |                          | Keep                                        |
| `nav.ts` mobile metadata + `mobileNav()`                                      |         |             ✓             |                     |                          | Keep                                        |
| Door Access entry — mobile More                                               |         |             ✓             |                     |                          | Keep                                        |
| Door Access entry — desktop sidebar                                           |         |                           |                     |     ✓ (desktop nav)      | Recommended; needs approval (o12)           |
| `useSignOut` hook                                                             |         |                           |          ✓          |                          | **Dropped**; handler moves with the bar     |
| Delete `MemberDetailModalMobile` + `MemberDetailModalResponsive`              |    ✓    |                           |  ✓ (fork removal)   |                          | Keep (required for parity)                  |
| `useMemberMutations` extraction; `MemberDetail` rename                        |         |                           |          ✓          |                          | **Deferred** (cleanup)                      |
| Mobile Mark Paid via `MarkPaidDialog`                                         |         |                           |                     |  ✓ (parity restoration)  | Keep                                        |
| `?member=<id>` URL state / deep links                                         |         |                           |                     |            ✓             | **Deferred** (§23-B)                        |
| `openMember(intent: 'pay')`                                                   |         |                           |                     |    ✓ (flow shortcut)     | **Deferred**                                |
| Membership Setup nested routes                                                |         |                           |          ✓          |     ✓ (desktop URLs)     | **Replaced** by history entry + single tree |
| Membership Setup history entry on section enter                               |         |             ✓             |                     |                          | Keep                                        |
| Members overflow menu (Day pass, Bulk import) on phone                        |    ✓    |                           |                     |                          | Keep (same actions)                         |
| Remind / Send broadcast confirmations                                         |         |                           |                     |            ✓             | **Removed** (§23-B)                         |
| Bulk import guidance sheet + "Open anyway"                                    |    ✓    |                           |                     |                          | Keep (§14)                                  |
| "Register another" on Add member                                              |         |                           |                     |            ✓             | **Removed** (§23-B)                         |
| Print → Share                                                                 |         |                           |                     |            ✓             | **Removed** (§23-B)                         |
| `viewport` export (`viewport-fit=cover`), safe-area CSS                       |    ✓    |                           |                     |                          | Keep                                        |
| Manifest `background_color`/`theme_color` dark                                |    ✓    |                           |                     |                          | Keep                                        |
| Manifest `start_url` → `/dashboard`, `display_override`                       |         |                           |                     |            ✓             | **Removed** (o11)                           |
| Toaster top-center offset on phone                                            |    ✓    |                           |                     |                          | Keep                                        |
| Tablet sidebar collapsed by default                                           |    ✓    |                           |                     |                          | Keep (new tier; o02)                        |
| UI6 `arch:check` ratchet                                                      |         |                           |     ✓ (tooling)     |                          | Recommended                                 |
| Announcement delivery log / SMS history / activity → `ListRow` on phone       |    ✓    |                           |                     |                          | Keep (plain `Table` stays on desktop)       |
| `aria-label` on icon-only buttons in member detail                            |    ✓    |                           |                     |                          | Keep (accessibility, presentation)          |

### 0.3 Structural changes that remain, and their justification

| Change                                                            | Why necessary                                                                                                                 | Why presentation alone is insufficient                                                | Why product behaviour is unchanged                                                                                          | Isolation & test                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete the member-detail fork + JS viewport switch                | The fork is the audit's one structural obstacle: duplicated mutations, missing SMS history, one-tap money, no dialog a11y.    | Styling the fork keeps two implementations that drift; parity requires one component. | The surviving component is the desktop one — same mutations, same dialogs, same requests. Mobile gains desktop's behaviour. | Phase 3 only; desktop screenshot diff at 1366; phone test asserts SMS history + `MarkPaidDialog`; request-body fixture test on the surviving component. |
| Replace the shell's private mobile bars with `AppBar`/`BottomNav` | The bars are the broken navigation the audit measured; they must be replaced, and the replacement is shared chrome.           | The 76 px scroller cannot be styled into a 4-item bar with a More sheet.              | Same routes, same `WORKSPACE_NAV`; desktop sidebar/header untouched.                                                        | Phase 2 only; shell test enumerates `WORKSPACE_NAV`; reachability spec.                                                                                 |
| `nav.ts` metadata                                                 | `BottomNav`/More must know which items sit in the bar without a second list.                                                  | A hard-coded mobile list is exactly the fork the plan forbids.                        | Metadata is inert for the desktop sidebar.                                                                                  | Type-checked; shell test.                                                                                                                               |
| Fullscreen overlay history entry (`Modal`)                        | Hardware/browser back on a phone must close a screen-filling overlay, not navigate away and lose the list state.              | Pure CSS cannot intercept back.                                                       | Overlay content, mutations and desktop `center` placement unchanged; entry is pushed only for `placement="fullscreen"`.     | Implemented once in `Modal`; unit test on `popstate`; Playwright back check.                                                                            |
| Membership Setup history entry                                    | Same reason, for the state-driven section on phones.                                                                          | Same.                                                                                 | Desktop tabs untouched; no URL change.                                                                                      | Same hook (`useHistoryBack`) as `Modal`; Playwright back check.                                                                                         |
| `useViewportTier` + SSR hint                                      | `DataTable` list mode, chart axis props and the shell's `data-tier` need a tier decision that is testable and hydration-safe. | CSS can hide but not change a `<table>` into a list or a chart's axis width.          | Reads request headers in a server layout; touches no data path.                                                             | Provider override in tests; zero console errors in Playwright.                                                                                          |

---

## 1. Executive Summary

The audit's conclusion stands: the phone experience is a chrome patch over
desktop compositions, and the fix is composition and presentation, not
architecture. This plan turns that into eleven phases (0–10), each
independently shippable and reversible, ordered by shared infrastructure and
risk rather than by route.

| Decision                | Choice                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone boundary          | One boundary at the DS `tablet` breakpoint (768 px). `< 768` = phone tier; `≥ 768` = desktop tier; 768–1023 renders the desktop shell with the sidebar collapsed by default. No third tier.                                                              |
| How compositions switch | CSS (`phone:` utilities) for chrome and primitive sizing; one `useViewportTier()` hook (SSR-hinted, test-overridable) where the DOM must differ. Never `window.innerWidth` in components.                                                                |
| Navigation              | `BottomNav` with **Dashboard · Members · Renewals · More**; More opens the existing `Drawer` with the remaining destinations (Revenue first), gym identity, tier and sign out. `nav.ts` gains metadata; no second list.                                  |
| Member detail           | The existing `MemberDetailModal` renders on both tiers through `Modal placement` (`center` desktop / `fullscreen` phone); the fork and the JS viewport switch are deleted. Phone differs only in placement, section order (CSS) and disclosure defaults. |
| Entity lists            | `DataTable` gains a declarative `mobileRow` mapping that renders a new L2 `ListRow` from the existing column definitions. Plain `Table` lists render `ListRow`s on phone via the tier hook. No card-per-row.                                             |
| Overlays                | `Modal placement: 'center' \| 'sheet' \| 'fullscreen'` (phone-only effect). Forms become full-screen views with the Modal footer as a keyboard-safe sticky action bar; confirmations stay compact; More/filters are sheets.                              |
| Touch                   | One rule (§15.1): 44 px primary / 40 px dense, `data-dense` marks dense controls; applied through `phone:` utilities inside primitives. Input font on phones raised to a 16 px token.                                                                    |
| Analytics cohort        | Condensed rows (Cohort · Size · M1 · M3 · M6) with per-cohort expansion to the full M0–M12 series. Complete data access without a 15-column scroller.                                                                                                    |
| Bulk import             | Retained. On phones an honest "larger-screen task" sheet with Copy link and a clearly-labelled "Open the desktop grid here" fallback.                                                                                                                    |
| PWA                     | `viewport-fit=cover`, safe-area tokens, dark manifest background. `start_url` unchanged.                                                                                                                                                                 |

Unchanged: every API, service, schema, Zod schema, form, query key, mutation
payload, permission check, auth flow, business-action semantics, and the
desktop composition and interaction of every screen (the one desktop change
that remains — the Door Access sidebar entry — is flagged for approval).

---

## 2. Target Mobile Product Model

**User and job (assumed; open decision o01):** the gym operator on their own
phone answering three questions in under ten seconds each — who is overdue
and can I record their payment now; find this member and see their status;
what needs attention today. Everything else is secondary or occasional and
reachable within two taps.

- Same product, same routes, same data, same actions — one business
  implementation; presentation differs.
- Operational, not consumer (directive §5.20): hairline rows, mono numerics,
  uppercase-tracked labels, colour as signal, no card-per-row, no FAB.
- Thumb-first: persistent navigation at the bottom; a view's primary action
  is the first row of page content (lists) or the sticky footer of a
  fullscreen overlay (detail/forms). Destructive actions demoted.
- Predictable back: the browser/OS back button closes a full-screen overlay,
  returns from a section to its menu, closes More.
- No dead ends: every destination reachable from `BottomNav`/More; every
  list's data and actions visible or one tap away, never behind an
  unindicated horizontal scroll.

---

## 3. Mobile UI Architecture

### 3.1 View hierarchy

```
Global shell (WorkspaceShell, data-tier="phone" | "desktop")
├─ AppBar (phone)         h-bar (52) + safe-top · leading: gym avatar+name (root) or Back (nested)
│                          · title (from crumbForPath / section name) · no action slot
├─ MemberLimitBar          unchanged; under the AppBar
├─ <main>                  root page view · nested page view (Back) · entity list view (ListRow)
│                          page primary action = first content row (never in the AppBar)
├─ Overlays (DS primitives, portalled, theme re-scoped)
│   ├─ Modal placement="fullscreen"  detail views & multi-field forms; footer = sticky action bar
│   ├─ Modal placement="sheet"       short forms / one decision (Day pass, Mark Paid date, Reactivate)
│   ├─ Modal placement="center"      ConfirmDialog / DeleteDialog (unchanged)
│   └─ Drawer                        More navigation, bulk-import guidance
├─ Toaster                 top-center on phone, offset below the AppBar
└─ BottomNav (phone)       h-bottom-nav (56) + safe-bottom · 3 destinations + More
```

Desktop keeps `WorkspaceSidebar` + `WorkspaceHeader`; both chromes read
`WORKSPACE_NAV`.

### 3.2 View vs overlay rule — "route what is a view; overlay what is a moment"

| Surface                   | Classification                                                               | Why                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Member detail             | Fullscreen overlay (phone) / centred modal (desktop); **history entry only** | Back must close it; list state must survive. Refresh-restore and deep links are a new capability → §23-B (o10).     |
| Add member                | Fullscreen overlay, history entry                                            | A task; one step per screen.                                                                                        |
| Edit member               | Fullscreen overlay, history entry                                            | Same; opened from detail.                                                                                           |
| Record payment            | `MarkPaidDialog` as a sheet over member detail (same dialog on desktop)      | Renewals' "Record payment" opens member detail; Mark Paid sits in its sticky footer (two taps). No intent shortcut. |
| Reactivate                | Sheet                                                                        | Short form.                                                                                                         |
| Filters (Members status)  | Inline native `Select`                                                       | One filter.                                                                                                         |
| More navigation           | `Drawer` (bottom sheet)                                                      | Navigation is a moment; closes on back.                                                                             |
| Settings sections         | Routes (already)                                                             | Already correct.                                                                                                    |
| Membership Setup sections | State-driven (as today) **+ phone history entry on enter**; single tree      | Back returns to the menu; no routes, no desktop URL change, no new UI3 pages.                                       |
| Confirmations             | Compact centred dialogs (unchanged)                                          | A yes/no needs no vertical room.                                                                                    |
| Bulk import               | `Drawer` guidance sheet → optional fullscreen overlay of the existing grid   | §14.                                                                                                                |
| Announcement send         | **Unchanged** (no new confirmation)                                          | Adding a confirm is a product decision (§23-B, o04).                                                                |

---

## 4. Breakpoint Strategy

**One boundary, `tablet` = 768 px.** Phone tier `< 768`; desktop tier
`≥ 768`.

- Why 768: already the DS `tablet` value and the boundary of four existing
  switches (`Drawer`, Settings, Membership Setup, member sheet); iPad portrait
  gets desktop; no new number to justify.
- Tablet (768–1023): desktop shell and compositions, sidebar collapsed by
  default (user's `localStorage` choice still wins). Today this range gets
  the phone chrome, so this is a new tier assignment, not a change to an
  existing desktop experience. Open decision o02.
- Desktop (≥ 1024): unchanged.

Representation: Tailwind `screens` keeps `tablet: '768px'` and gains
`phone: { max: '767px' }`. `sm:`/`md:`/`lg:` stay legal for fluid refinements
inside a composition; composition switching uses `phone:`/`tablet:` only.
The shell's `lg:` classes migrate to `tablet:` (required). Existing
`max-tablet:` sites migrate only when their file is already being edited.
`arch:check` ratchet **UI6** (recommended): no `sm:|md:|lg:|max-tablet:` in
`src/components/workspace`, `src/components/ui/primitives`,
`src/components/common/composites`; allow-list seeded with current offenders,
required to reach zero by the Phase 2 gate.

JS without `window.innerWidth`: `useViewportTier(): 'phone' | 'desktop'`
(`src/hooks/useViewportTier.ts`) backed by `ViewportTierProvider` —
`useSyncExternalStore` over `matchMedia('(max-width: 767px)')`, server
snapshot = the provider's `initialTier`, derived in `(dashboard)/layout.tsx`
from `sec-ch-ua-mobile` / UA so a phone's first HTML is already the phone
composition. Explicit `tier` override; `renderScreen` gains
`{ viewport: 'phone' | 'desktop' }`. `WorkspaceShell` stamps `data-tier`. A
component reads the hook only to choose which composition to render;
sizing/spacing/visibility are CSS.

| Width | Tier             | Behaviour                                                                                                           |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| 320   | phone            | 4 nav items × 80 px; KPI 2×2 at 136 px tiles; `ListRow` value wraps under primary when needed; fullscreen overlays. |
| 360   | phone            | 4 × 90 px.                                                                                                          |
| 390   | phone            | Reference width; 4 × 97 px.                                                                                         |
| 430   | phone            | Same composition, more room.                                                                                        |
| 768   | desktop (tablet) | Desktop shell, sidebar collapsed by default; tables scroll in their containers; `Drawer` is a side panel again.     |
| 1024  | desktop          | Unchanged.                                                                                                          |
| ≥1366 | desktop          | Unchanged.                                                                                                          |

---

## 5. Design-System Changes (Phase 1, before any screen)

### 5.1 Tokens (`tokens.ts` + `globals.css` + `tailwind.config.ts`, parity-tested)

| Token                                        | Kind       | Value / status                 | Rationale                                                                                |
| -------------------------------------------- | ---------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `spacing.touch` → `min-h-touch`/`size-touch` | size       | 44 px                          | §15.1 primary target; applied via `phone:` only.                                         |
| `spacing.touch-sm`                           | size       | 40 px                          | §15.1 dense target.                                                                      |
| `layout.bottomNavHeight` → `h-bottom-nav`    | layout     | 56 px                          | `<main>` offset and toast offset derive from it.                                         |
| `layout.appBarHeight`                        | layout     | reuse `h-bar` (52)             | Already exists.                                                                          |
| `--ds-safe-top/bottom/left/right`            | safe-area  | `env(safe-area-inset-*, 0px)`  | Consumed by AppBar, BottomNav, fullscreen Modal footer, sheets; mirrored in `tokens.ts`. |
| `layout.sheetMaxHeight`                      | layout     | `90dvh`                        | `Modal sheet` and `Drawer` phone height (today `85vh`).                                  |
| `typeScale.input` → `text-input`             | typography | 16 px / 24 px                  | Stops Safari focus zoom; `phone:` only on Input/Select/Textarea.                         |
| `typeScale.bodyPhone`                        | typography | 14 / 20, **planned (o09)**     | Decide at the Phase 1 visual pass; applied at the shell root under `phone:`.             |
| Chart `chartAxisWidthCompact`                | chart      | 56 px **or** compact formatter | Phase 1 visual pass picks one (§5.9).                                                    |
| Tailwind `screens.phone`                     | breakpoint | `{ max: '767px' }`             | §4.                                                                                      |

No new z-index, motion, radius or colour tokens. Any further value is a plan
amendment (§31).

### 5.2 Control sizing on phones

Inside `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Switch`,
`Pagination`, `TabsTrigger`: `phone:min-h-touch` (dense sizes `xs`/`sm`,
`TabsTrigger`, `Pagination` → `phone:min-h-touch-sm` and `data-dense`),
`phone:text-input` on text controls, `phone:size-6` Checkbox/Radio with a
touch-height label hit area, Switch `phone:h-6 phone:w-11`. No new size names,
no call-site changes; desktop unaffected. Verified by class assertions in
primitive tests and the probe (§17).

### 5.3 `Modal` placements

`placement?: 'center' | 'sheet' | 'fullscreen'` (default `center` = today);
effects are `phone:` only. `sheet` → bottom-anchored, `max-h-sheet`, rounded
top, footer with `safe-bottom`. `fullscreen` → `inset-0 h-dvh`, header with
leading Back (chevron) instead of trailing ×, body `min-h-0 overflow-y-auto`,
**footer is the sticky action bar** (`safe-bottom`, buttons stretched at
320); pushes a history entry on open and closes on `popstate` via the shared
`useHistoryBack(open, onClose)` hook (`src/hooks`), default on for
`fullscreen` only. Radix focus trap, Escape, scroll lock and ARIA inherited.

### 5.4 `Drawer`

Align to `phone:` (this file is edited anyway), use `sheetMaxHeight`
(`dvh`), add `size?: 'auto' | 'full'` (More sheet is `auto`). Remove from
`UI1_ALLOW` when first consumed.

### 5.5 `Tabs`

`TabsList overflow?: 'scroll' | 'fit'` (default `fit`). `scroll` →
`overflow-x-auto scrollbar-hide`, snap, trailing-edge fade cue;
`TabsTrigger phone:min-h-touch-sm phone:px-3 data-dense`; `fit` on phones
distributes triggers `flex-1`.

### 5.6 `Pagination`

`responsive?: boolean` — numbered on `tablet:`, compact Prev / "2 of 3" / Next
on `phone:`, `touch-sm`, `data-dense`.

### 5.7 `DataTable` → `mobileRow` + new L2 `ListRow` — see §9.

### 5.8 `Table` — **no change** (C6).

### 5.9 Charts

`yTickFormatter?` and `compactAxis?` on `CartesianChartProps`; `compactAxis`
widens the axis to the token **or** applies a compact formatter
(`20000 → 20k`) — the Phase 1 visual pass picks one. Cause: `YAxis width={40}`
with `margin.left: -8`. Screens pass it under the phone tier.

### 5.10 `Toolbar` — **no change** (C6); fullscreen `Modal.footer` is the sticky bar.

### 5.11 New composites (genuinely new, non-synonymous)

| Component        | Why an existing primitive cannot carry it                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppBar` (L3)    | `PageHeader` is an in-flow heading; `WorkspaceHeader` is desktop chrome. Leading/title slots + safe-top. **No trailing action slot** (C7). |
| `BottomNav` (L3) | `SideNav` is a vertical rail; `Tabs` are content tabs. Fixed bar, icon-over-label, `aria-current`, safe-bottom. (Not "TabBar".)            |
| `ListRow` (L2)   | See §9. Not a Card, not a Table row.                                                                                                       |

Unchanged: `UserMenu`, `SideNav`, `SectionHeader`, `SettingsSection/Row`,
`StatCard`, `ChartCard`, `EmptyState`, `ConfirmDialog`, `DeleteDialog`,
`Toolbar`, `Table`.

### 5.12 Navigation metadata (`src/components/workspace/nav.ts`)

`WorkspaceNavItem` gains `mobile: { placement: 'bar' | 'more'; order }`,
optional `capability?: 'accessControlHardware'` (visibility via the existing
`PlanRestrictions` check), and the `/access-control` entry (`more`,
Enterprise-gated; desktop sidebar visibility per o12). `mobileNav()` selector
in the same file; `WORKSPACE_NAV` stays the only list.

### 5.13 Showcase and docs

`(dev)/design-system/page.tsx` gains sections for placements, `ListRow`,
`BottomNav`, `AppBar`, compact pagination, tabs overflow. `DESIGN_SYSTEM.md`
and `architecture.md` §2.21 updated in the same commits.

---

## 6. Shell & Navigation Plan

### 6.1 Persistent navigation — option comparison

Evidence from the application: Dashboard (home; daily), Members (primary
entity; daily), Renewals (money and urgency; daily; row actions), Revenue
(read-only; weekly; **already one tap from the Dashboard's Revenue tile**),
Analytics (read-only; monthly), Announcements (occasional; paid side effect
on send), Membership Setup / Settings / Support (rare), Door Access
(Enterprise only; daily if hardware exists).

| Option | Bar                                                                              | Frequency fit                 | Urgency / money | Accidental-tap risk   | 320 px fit               | Verdict                                                                             |
| ------ | -------------------------------------------------------------------------------- | ----------------------------- | --------------- | --------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| A      | Dashboard · Members · Renewals · Revenue · More                                  | good                          | good            | none (read-only)      | 5 × 64 px, 11 px labels  | Revenue is already one tap away via the dashboard tile; the fifth slot buys little. |
| B      | Dashboard · Members · Renewals · Analytics · More                                | poor (monthly)                | low             | none                  | same                     | Rejected.                                                                           |
| C      | Dashboard · Members · Renewals · More                                            | matches the audit's daily set | —               | lowest                | 4 × 80 px, no truncation | **Chosen.**                                                                         |
| D      | Capability-dependent fourth slot (Door Access for Enterprise, Revenue otherwise) | mixed                         | mixed           | confusing across gyms | same as A                | Rejected (inconsistent bar).                                                        |

**Decision (C):** `Dashboard · Members · Renewals · More`. Trade-off: Revenue
and Analytics cost two taps via More (or one via the dashboard tiles); in
return the bar never truncates at 320 px, items are 80–97 px wide, and the
persistent set is exactly the daily set. Product may veto (o03); switching to
A is one metadata entry.

### 6.2 The rest of the shell

- **More (`Drawer`, `size="auto"`):** identity header (avatar, name, email,
  tier badge); PRIMARY — Revenue · Member Analytics; OPERATIONS —
  Announcements · Membership Setup · Door Access (Enterprise only);
  MANAGEMENT — Settings · Support; Sign out. Items are `ListRow`s; the active
  route gets `surface-selected` (R7). Closes on back (Drawer is a Radix dialog;
  `useHistoryBack` applies).
- **Account:** the More header is the phone `UserMenu`. The sign-out handler
  (with its re-entrancy guard) moves from the deleted `MobileTopBar` into the
  More sheet unchanged; `WorkspaceHeader`'s stays. No new hook.
- **`AppBar`:** root pages — gym avatar + name (tap → More), title from
  `crumbForPath`; nested pages (`/settings/<section>`) — Back (to the menu
  route), section title. The in-flow `PageHeader` title is hidden on phones
  (the AppBar shows it); its `actions`, where present, render as the first
  content row. `MemberLimitBar` stays under the AppBar.
- **Back:** routes for Settings sections; fullscreen `Modal` history entry;
  Membership Setup section history entry; More sheet history entry. AppBar
  Back on `/settings/<section>` navigates to `/settings` (its parent), not
  `router.back()` — deterministic regardless of how the page was reached.
- **Door Access:** More → Operations, capability-gated (required). Desktop
  sidebar entry: recommended, closes OPEN-1, **needs approval (o12)**; if
  declined, the metadata gains `desktop: false`.
- **Other:** `<main>` `phone:px-4 phone:pt-3` and bottom padding
  `h-bottom-nav + safe-bottom` via tokens; `Toaster` `top-center` with offset
  `h-bar + safe-top` on phones (desktop unchanged); root carries `data-tier`.
- **Verification:** shell test renders phone tier and asserts 3 bar items +
  More + every remaining `WORKSPACE_NAV` item in More; Playwright at
  320/360/390 asserts `BottomNav.scrollWidth === clientWidth`, every
  destination reachable, Back from a nested route, from a fullscreen overlay
  and from More.

---

## 7. Mobile Information Architecture

| Screen           | Primary (first viewport)                                                     | Secondary                              | Tertiary                                                     | Primary action                  | Secondary              | Low-frequency                      | H-scroll |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ | ------------------------------- | ---------------------- | ---------------------------------- | -------- |
| Dashboard        | Overdue, Expiring, Revenue this month, Active (2×2 band)                     | Reminder queue                         | Revenue chart; recent payments list                          | — (tiles link)                  | Revenue tile → Revenue | —                                  | none     |
| Members          | Search + Add; status filter; rows = name, status-with-due, plan, fee         | Phone (row 2nd line)                   | Joined, member number (detail)                               | Add member (first content row)  | Search, filter         | Day pass, Bulk import (overflow)   | none     |
| Member detail    | Name, status + due, plan/amount, **Mark Paid / Re-activate** (sticky footer) | Phone links, plan grid, status actions | Photo, payment history, SMS history, door access (disclosed) | Mark Paid / Re-activate         | Edit, Suspend/Activate | Delete (last)                      | none     |
| Add member       | Step 1 fields                                                                | Step 2 payment summary                 | —                                                            | Next / Register (sticky footer) | Cancel/Back            | —                                  | none     |
| Renewals         | Tabs; rows = name, days overdue / due date, amount, actions                  | —                                      | Exact date (detail)                                          | Record payment (row)            | Remind (row)           | —                                  | tabs     |
| Revenue          | Month/year; Collected vs Billed (%), Active, Avg/member                      | Monthly chart                          | Breakdown list with share bar                                | Change month                    | —                      | —                                  | none     |
| Analytics        | Range; 4 KPIs                                                                | Trend (series select); at-risk         | YoY; cohort rows (expand for full series)                    | Change range                    | Series select          | —                                  | none     |
| Announcements    | Audience, message, counter, Send                                             | Progress                               | Delivery log (list)                                          | Send (unchanged behaviour)      | —                      | —                                  | none     |
| Membership Setup | Menu                                                                         | —                                      | Sections (state + history entry)                             | Open section                    | —                      | Delete plan/discount               | none     |
| Settings         | Menu                                                                         | Sections as routes                     | —                                                            | Open section                    | —                      | Register new gym, Reset to default | none     |
| Door Access      | Reader cards                                                                 | Activity list + chips                  | Device capacity/clock                                        | Remote open (existing confirm)  | Filter chips           | —                                  | none     |
| Support          | Contact rows; ticket form                                                    | —                                      | —                                                            | Submit                          | Call/WhatsApp          | —                                  | none     |
| Subscription     | Current plan; status panel                                                   | Pricing cards                          | Billing history list                                         | Upgrade/Subscribe               | Print (unchanged)      | Cancel subscription                | none     |

---

## 8. Screen-by-Screen Rebuild Plan

Each: problem → composition → interaction → reused / adapted / new → logic
preserved → routing → desktop → verify. Blueprints in §26, states in §27.

**8.1 Dashboard.** Axis clipped; payments table 461 px. `PageHeader` title
hidden (AppBar shows "Overview"; the timestamp renders as a mono caption
under the band); KPI band unchanged; chart `compactAxis`; reminder queue as
`ListRow`s; recent payments `Table` on desktop / `ListRow` list on phone via
the tier hook (rows open member). Logic: all four queries, `fmt`, tile hrefs.
Route unchanged. Verify: both-tier test; probe; axis tick text intact; tiles
≥ 44 px.

**8.2 Members.** 767 px table; 3-row toolbar; sticky header ineffective.
First content row: `SearchBar` (flex-1) + `Add member` (`Button`, touch) +
`DropdownMenu` "⋯" (Day pass, Bulk import, touch items); second row: status
`Select` + record count (mono caption, right); list = `DataTable mobileRow`
(primary name+avatar; status = status badge + due; meta phone (`tel:`) ·
plan; value fee); `Pagination responsive`. Logic: `useQuery(['members',
search, status, page])`, server pagination, `openMember`. Route unchanged;
overlays get history entries. Verify: phone test asserts the §9.4 visible set
(name, status label, due, plan, fee, phone) and that joined/member number are
absent from the row but present in detail; probe clean; rows ≥ 44 px.

**8.3 Member detail.** §10.

**8.4 Add member.** `Modal placement="fullscreen"`, one step per screen,
footer = sticky bar (Cancel · Next / Back · Register). Logic: `useForm` +
`addMemberSchema`, `trigger()` steps, three queries, `PaymentCalculator`,
`POST /api/members`. Verify: footer visible at reduced height; back closes;
submit creates a member on the E2E gym.

**8.5 Edit member.** Same as 8.4, single step; detail → edit → back → detail.

**8.6 Reactivate.** `placement="sheet"`; logic untouched.

**8.7 Mark Paid.** `placement="sheet"`; used by member detail on both tiers.

**8.8 Day pass.** `placement="sheet"`; results as `ListRow`s (VERIFY current
markup).

**8.9 Bulk import.** §14.

**8.10 Renewals.** Actions off-screen; tabs overflow; 26 px buttons.
`TabsList overflow="scroll"`; `DataTable mobileRow` with the two existing
actions visible at dense touch size (Record payment first; **variants and
behaviour unchanged** — Remind sends on tap as today, Record payment opens
member detail as today); compact sort from `sortValue`; phone-only
`pageSize={25}` with `Pagination responsive` (desktop unpaginated as today).
Logic: both queries, SMS route, expired/dueSoon split, counts. Verify: both
actions visible at 320/390 without scrolling; Record payment opens the
fullscreen detail with Mark Paid in its footer; Remind writes one mocked
`sms_logs` row on tap (unchanged).

**8.11 Revenue.** Month/year native selects in a two-column row; KPI band
unchanged; chart `compactAxis`; breakdown as `ListRow`s with a share bar
(`Progress`); desktop keeps the `Table`. Logic unchanged.

**8.12 Analytics.** §13.

**8.13 Membership Setup.** Keep `BillingSetupPageClient` and its
`mobileSection` state. Changes: render **one** tree chosen by
`useViewportTier()` (no hidden desktop `Tabs` on phones); on phone, entering a
section calls `useHistoryBack` so back returns to the menu; the section
header uses the AppBar Back (title = section label). Plan-type inline edit on
phone → `placement="sheet"` with the same inputs and `updateMutation`;
desktop keeps inline editing. Discounts table → `mobileRow`; add/edit modal
→ sheet. No new routes; UI3 unaffected. Verify: back returns to the menu; one
request per section endpoint on phones.

**8.14 Settings.** Keep. Touch sizing from primitives; in-flow "‹ Settings"
hidden on phone (AppBar Back); Security's four modals → `sheet`; Policies
textareas `phone:text-input`. Print unchanged (o07).

**8.15 Door Access.** Nav entry (§6); `AccessActivityLog` keeps its `Table`
on desktop and renders `ListRow`s on phone via the tier hook; chips touch
height; `MemberAccessPanel` unchanged. No write-path changes (rule 2.20).

**8.16 Support.** Sizing only.

**8.17 Subscription.** Sizing; `BillingHistoryTable` → `ListRow`s on phone;
Print unchanged. Dialogs stay compact.

**8.18 Announcements.** Compose `Card` stays; **Send behaviour unchanged**;
delivery log → `ListRow`s on phone (VERIFY whether the log is capped);
`AnnouncementProgress` unchanged.

**8.19 Auth, `/join`, legal, admin.** Untouched.

---

## 9. Entity / List Strategy

### 9.1 `ListRow` anatomy (L2)

```
┌ leading ┐ primary ─────────────────────────── trailing value ┐
│ avatar/ │ Nimal Perera                              3,500     │
│ checkbox│ ● EXPIRED · 12 DAYS AGO   (status line)             │
│         │ +94 77 123 4567 · Monthly (secondary meta)          │
│         │ [ Record payment ] [ Remind ]  (actions, optional)  │
└─────────┴─────────────────────────────────────────────────────┘
```

Slots: `leading?`, `primary` (required; `line-clamp-2`), `status?`,
`meta?` (segments joined by " · "; single line, ellipsis), `value?` (mono
tabular, right, `min-w-24`; drops under `primary` when the row is narrower
than 340 px), `actions?` (1–2 dense buttons; 3+ → `DropdownMenu`),
`onClick?`/`href?`. Hairline `border-b border-line-subtle`, `min-h-touch`,
`px-4 py-2`, no radius, no background; selected → `surface-selected`;
pressed → `active:bg-surface-active`. Semantics: `<li>` in
`<ul role="list">`; the tap target is a `<button>`/`<a>` wrapping the primary
text with `aria-describedby` → status/meta.

### 9.2 Lists that share it

Members, Renewals (expired/due), Collected, dashboard recent payments,
dashboard reminder queue, revenue breakdown (+ share bar), SMS history,
access activity, announcement delivery log, billing history, analytics cohort
rows (condensed). Plain `Table` lists (recent payments, activity, SMS history,
delivery log, billing history, breakdown) render `ListRow`s on phone via the
tier hook and keep their `Table` on desktop; `DataTable` lists use
`mobileRow`.

### 9.3 `DataTable` API decision

Rejected: column priority metadata (still a squeezed table); `renderMobileRow`
JSX (per-feature layouts → drift); a separate list primitive per screen
(duplicates table state). **Chosen:** declarative `mobileRow` mapping:

```ts
mobileRow?: {
  primary: string            // column id
  status?: string
  meta?: string[]
  value?: string
  actions?: string
  leading?: (row: T) => ReactNode   // defaults to the selection checkbox when `selectable`
}
```

`DataTable` renders `ListRow`s from the same `columns` (`cell` formatting,
`header` as hidden labels, `sortValue` → compact "Sort" `Select`, `numeric` →
alignment) and shares filtering, pagination, selection, skeleton, `empty`,
`error`, `caption`, `onRowClick` with the table path. Columns not named in
the mapping are **not rendered in the row** (§9.4). Tier switch via
`useViewportTier()`; `forceLayout?: 'table' | 'list'` for showcase/tests. No
JSX escape hatch in v1.

### 9.4 Information: accessible, not simultaneously visible

| List                      | Visible in the row                                | Disclosed (2nd line / expand)    | Available in detail / elsewhere            | H-scroll |
| ------------------------- | ------------------------------------------------- | -------------------------------- | ------------------------------------------ | -------- |
| Members                   | name, status+due, plan, fee                       | phone (2nd line, `tel:`)         | joined date, member number, photo (detail) | no       |
| Renewals expired / due    | name, days overdue or due date, amount, 2 actions | —                                | exact dates, plan (detail)                 | no       |
| Collected                 | name, paid on, amount, Receipt                    | —                                | plan (detail)                              | no       |
| Dashboard recent payments | name (+NEW), amount                               | plan · date (2nd line)           | detail                                     | no       |
| Reminder queue            | name, amount                                      | reminder type · when (2nd line)  | —                                          | no       |
| Revenue breakdown         | plan, collected, share bar                        | members · payments (2nd line)    | —                                          | no       |
| SMS history               | type, status, sent at                             | message (2 lines, tap to expand) | —                                          | no       |
| Announcement delivery log | message excerpt, status                           | sent · delivered (2nd line)      | —                                          | no       |
| Access activity           | who, badge, when                                  | reader (2nd line)                | —                                          | no       |
| Billing history           | date, amount, status                              | order id (2nd line)              | —                                          | no       |
| Analytics cohort          | cohort, size, M1, M3, M6                          | full M0–M12 series (expand)      | —                                          | no       |

The phone-tier test for each list asserts the visible set **and** the
disclosure set, and that nothing else from the desktop columns is silently
dropped without a listed home.

---

## 10. Member Detail (minimal parity change)

**Required for functional parity**

1. Delete `MemberDetailModalMobile.tsx` and `MemberDetailModalResponsive.tsx`;
   `MemberModalProvider` renders `MemberDetailModal` on both tiers. The barrel
   export `MemberDetailModalResponsive` is replaced by `MemberDetailModal`;
   `UI1_ALLOW`/tests adjusted.
2. `MemberDetailModal` passes `placement={tier === 'phone' ? 'fullscreen' : 'center'}`
   to its two `Modal`s (loading skeleton and main). Its existing footer
   (`Close` · `Mark Paid` / `Re-activate`) becomes the sticky action bar on
   phones automatically. Its sub-dialogs (`MarkPaidDialog`, reactivate,
   activate-with-date, delete) get `placement="sheet"` / `center`.
3. Mobile therefore gains: `MarkPaidDialog` (date choice + confirm),
   `MemberSmsHistory` (already inside the desktop component, behind its
   existing View/Hide toggle), Radix dialog semantics, Escape and back.
4. Accessibility fix inside the component: the icon-only Edit/Delete buttons
   gain `aria-label` (they carry only `title` today).

**Presentation on phone (CSS / props only)**

5. Section order via `phone:order-*` on the existing section wrappers:
   identity → plan grid → status actions → photo → door access (`accessSlot`)
   → payment history (existing toggle, collapsed by default) → SMS history
   (existing toggle) → delete. No new section components.
6. `phone:` sizing arrives from primitives; the `grid-cols-2` info grids stay
   (four short values).

**Optional engineering cleanup — deferred (§23-B, o13)**

- Extracting mutations into `features/members/hooks/useMemberMutations.ts`.
- Renaming `MemberDetailModal` → `MemberDetail`.
- `?member=<id>` URL state (o10) and `intent: 'pay'`.

**Migration order (each step green):** (1) `Modal placement` exists (Phase 1);
(2) `MemberDetailModal` reads the tier and passes placements — desktop
pixel-diff at 1366 unchanged; (3) provider renders it for both tiers; delete
the two files; barrel, allow-lists, tests; (4) phone order/disclosure CSS;
(5) `aria-label`s. A phone-tier test asserts `MemberSmsHistory`'s toggle and
that Mark Paid opens `MarkPaidDialog` (falsified by mutation before trusted).
A request-body fixture test on the surviving component guards the six
mutations.

---

## 11. Forms & Dialog Strategy

- Containers: multi-field → `fullscreen`; ≤ 4 controls / one decision →
  `sheet`; confirmations → `center`. Add member, Edit member (fullscreen);
  Reactivate, Mark Paid, Day pass, Security ×4, Discount add/edit, Plan-type
  edit on phone (sheet); Announcement compose and Settings forms in-page.
- Keyboard: `dvh` heights; fullscreen body is the scroller; footer outside
  it; `scroll-padding-bottom` = footer height; inputs 16 px on phones.
- Footer: `Modal.footer` renders as the sticky bar on fullscreen; primary
  right, stretched at 320.
- Validation: unchanged (`FormField`); first invalid field scrolled into view
  (VERIFY `shouldFocusError`).
- Steps: Add member's stepper stays; one step per screen; `currentStep` logic
  untouched.
- Date/select/photo: native, unchanged.
- **Confirmations: unchanged.** Existing confirms stay; no new ones (C2).

---

## 12. Table Strategy

| Table                     | Category  | Phone treatment                                                            | Desktop   |
| ------------------------- | --------- | -------------------------------------------------------------------------- | --------- |
| Members                   | A         | `mobileRow` → `ListRow`                                                    | unchanged |
| Renewals expired / due    | A         | `mobileRow`, two visible actions, `pageSize` 25                            | unchanged |
| Collected                 | A         | `mobileRow` with Receipt                                                   | unchanged |
| Recent payments           | A         | `ListRow` list via tier hook                                               | `Table`   |
| Announcement delivery log | A         | `ListRow` list via tier hook                                               | `Table`   |
| Access activity           | A         | `ListRow` list via tier hook                                               | `Table`   |
| SMS history               | A         | `ListRow` list via tier hook                                               | `Table`   |
| Billing history           | A         | `ListRow` list via tier hook                                               | `Table`   |
| Revenue breakdown         | A + bar   | `ListRow` + share bar                                                      | `Table`   |
| Analytics cohort          | **C-alt** | condensed `ListRow` (Cohort · Size · M1 · M3 · M6) + expand to full series | `Table`   |
| Admin failure tables      | B         | unchanged                                                                  | unchanged |

Category A shows the §9.4 visible set and discloses the rest; nothing is
dropped without a listed home. Category C-alt keeps every cell reachable.

---

## 13. Analytics Strategy

KPI band stays. Range selector: touch-sm snap-scrolling segmented row (stays
visible). Series control: native `Select` on phone (`useViewportTier()`
chooses), same state variable. Charts `compactAxis`.

**Cohort matrix — challenged and revised.** A 15-column matrix with a pinned
Cohort column leaves ~200 px for M-columns at 390 (≈2.7 visible) and ~130 px at
320 — the comparison the matrix exists for is impossible while scrolling.
Revised: on phone each cohort is a `ListRow` — primary "Sep 2026", value
"12 members", meta "M1 79% · M3 — · M6 —" (the three milestone columns; a
missing value renders "—") — and expanding the row (`DataTable
renderExpanded`, which already exists) shows the full M0–M12 series as a
compact list (`M0 100% · M1 79% · …`). Every value the desktop matrix holds is
one tap away; nothing is removed. Desktop keeps the `Table`. (VERIFY that the
cohort data structure exposes per-cohort arrays, which the current render
loop implies.) Page length: "Jump to" anchors are **not** added (C7 — no
AppBar slot); the page remains a scroll of four sections.

---

## 14. Bulk Import Decision

Chosen: **explicit larger-screen workflow with discoverability and an honest
fallback.** On phones, "Bulk import" (in the Members overflow menu) opens a
`Drawer` sheet:

> **Bulk import works best on a larger screen.** It is a spreadsheet of many
> members at once and does not fit a phone. Open Metric on a laptop or tablet
> to use it. [Copy link] [Open the desktop grid here]

- "Open the desktop grid here" opens the existing `BulkAddMemberModal` at
  `placement="fullscreen"` with the grid horizontally scrollable and a
  persistent `Alert` inside it: "This grid is not optimised for phones — swipe
  sideways to reach every column." It is the current component, unchanged
  and unpolished; it is **not** counted as a mobile screen in the Definition
  of Done and is excluded from the phone probe's overflow rule (marked
  `data-scroll="x"`).
- The user is never trapped: the fullscreen overlay has Back/Escape and the
  same Cancel button.
- "Register another" (a new product action) is **not** part of the rebuild
  (§23-B).

---

## 15. Touch & Accessibility Strategy

### 15.1 One touch-target rule (used verbatim in the DS spec, primitives, probe and DoD)

| Class                     | Examples                                                                   | Minimum target                                                                                                        | Marking                             |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Primary interaction       | `Button md/lg/xl`, `Input`, `Select`, `Textarea`, `ListRow`, KPI tiles     | **44 px** tall; ≥ 44 px wide or full-width                                                                            | default                             |
| Navigation item           | `BottomNav` items, More sheet rows, Settings menu rows                     | **44 px** tall (bar is 56); full item width                                                                           | default                             |
| Dense / secondary         | `Button xs/sm`, row actions, `TabsTrigger`, `Pagination`, segmented, chips | **40 px** tall and wide; ≥ 8 px gap between neighbours                                                                | `data-dense` (set by the primitive) |
| Icon-only control         | Modal close/back, Edit/Delete icons, overflow "⋯"                          | glyph 16–20 px inside a **44 px** hit area (40 if dense); `aria-label` required                                       | via padding, never glyph scaling    |
| Text-only inline link     | links inside prose/captions                                                | exempt from the box rule; ≥ 24 px line box (WCAG 2.5.8); standalone text links become `Button variant="link"` (40 px) | —                                   |
| Checkbox / Radio / Switch | forms, consents                                                            | control 24 px; **44 px** label hit area (label wraps the control)                                                     | default                             |

Probe rule (§17): every interactive element on a phone route must be ≥ 40 px
tall and wide; elements **without** `data-dense` must be ≥ 44 px tall; inline
text links are exempt via an allow-list of selectors. The same numbers are
the tokens `touch` (44) and `touch-sm` (40). No phase may introduce a third
threshold.

### 15.2 Other rules

- All overlays are Radix dialogs (Escape); fullscreen ones also close on back.
- Row actions visible in the row; 3+ → `DropdownMenu` with 44 px items.
- `BottomNav` `aria-label="Workspace"` + `aria-current`; `AppBar` is
  `<header>`; the fullscreen footer is `<div role="group" aria-label="Actions">`;
  `<main>` padding reserves the bars' space.
- `ListRow`: `<ul role="list">`/`<li>`; tap target wraps the primary text
  with `aria-describedby`.
- Focus: `focus-visible:shadow-focus`; fullscreen moves focus to the title.
  Touch feedback: `active:bg-surface-active`; `touch-action: manipulation`.
- Sort glyph `phone:opacity-60` (never hover-only on phones).

---

## 16. PWA & Safe-Area Strategy

- `export const viewport` in `src/app/layout.tsx`: `width=device-width`,
  `initialScale: 1`, `viewportFit: 'cover'`, `themeColor: '#08080a'` (VERIFY
  the Next 16 export shape). No `user-scalable=no`.
- Tokens `--ds-safe-*`; `AppBar` padding-top, `BottomNav` padding-bottom,
  `<main>` bottom padding, fullscreen footers and sheets add `safe-bottom`;
  landscape side insets on AppBar/BottomNav only.
- Manifest via `scripts/generate-pwa-assets.js` (edit the generator, never
  the output — rule 2.19): `background_color` → `#08080a` and `theme_color`
  aligned (presentation: avoids a white splash on a dark app). **`start_url`
  stays `/members`** and no `display_override` (o11).
- Verification: CSS-override probe (`--ds-safe-bottom: 34px`) asserts nothing
  is covered; one physical-device check at sign-off.

---

## 17. Testing & Verification

- **Unit/component:** primitive phone-size classes and `data-dense` per
  variant; `Modal` placements + `useHistoryBack` (`popstate`); `Drawer` phone
  classes; `Tabs overflow`; `Pagination responsive`; `DataTable` list mode
  (visible set, disclosure set, sort select, selection, empty/error/loading);
  `ListRow` slots/roles; `BottomNav`/`AppBar` from `WORKSPACE_NAV`;
  `Charts compactAxis`; `useViewportTier` override + mocked `matchMedia`;
  token parity extended; request-body fixtures for `MemberDetailModal`'s six
  mutations (drift guard).
- **UI3/jsdom:** every `(dashboard)` page test runs in both tiers via
  `renderScreen(ui, { viewport })`; `arch:check` UI1/UI3/UI4/UI6 green.
- **Browser (Playwright, seeded E2E Enterprise gym + the §28 stress fixtures):**
  320×568, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×800. Probe
  (`tests/e2e/helpers/mobile-probe.ts`): `scrollWidth === innerWidth`; no
  `main *` beyond the viewport except inside `data-scroll="x"` containers;
  §15.1 touch rule; `BottomNav.scrollWidth === clientWidth`; fixed/sticky
  inventory; axis tick text intact; no text clipped (`scrollWidth >
clientWidth` on single-line text nodes without `text-overflow`).
- **Interaction:** back closes member detail, forms, More and Membership
  Setup sections; fullscreen forms at height 500 keep the footer; Add member
  creates; Mark Paid from member detail via the date sheet; Remind sends on
  tap (unchanged); suspend/activate/cancel/delete; More reaches every
  destination; sign-out; Door Access visible only for the Enterprise gym.
- **Desktop regression:** 1366 screenshot comparison per phase; 768 differs
  only by the collapsed-sidebar default; the Door Access sidebar entry (if
  approved) is the only expected desktop diff.
- **Visual review:** §29.

---

## 18. Implementation Sequence

| #   | Phase                                                                | Prereq  | Areas / components                                                                                                                                                                                                                                                                                                  | Risk       | Completion → unlocks                            |
| --- | -------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| 0   | Test scaffolding                                                     | —       | `renderScreen({ viewport })`, `ViewportTierProvider` skeleton, Playwright mobile spec + probe + stress fixtures, 1366 screenshot baselines                                                                                                                                                                          | low        | Every later phase is measurable                 |
| 1   | Design-system foundations                                            | 0       | tokens ×3, `phone` screen, `useViewportTier`, `useHistoryBack`, primitive `phone:` sizing + `data-dense`, `Modal placement`, `Drawer`, `Tabs overflow`, `Pagination responsive`, `Charts compactAxis`, `ListRow`, `DataTable mobileRow`, `AppBar`, `BottomNav`, showcase, `viewport` export, manifest colours, docs | medium     | All screens gain touch sizing; primitives ready |
| 2   | Shell & navigation                                                   | 1       | `nav.ts` metadata + Door Access, `WorkspaceShell` chrome swap + `data-tier` + padding + toast + `lg:`→`tablet:` + tablet default, More sheet (sign-out handler moved), layout provider with SSR hint, UI6 ratchet, delete old bars                                                                                  | medium     | Phone navigation complete                       |
| 3   | Member detail parity                                                 | 1, 2    | `MemberDetailModal` placements + phone order + `aria-label`s; delete fork + responsive switch; provider; barrel; tests                                                                                                                                                                                              | medium     | Rows have a correct target                      |
| 4   | Members + member forms                                               | 1, 3    | `MembersPageClient`, Add/Edit fullscreen, Day pass sheet, bulk guidance sheet                                                                                                                                                                                                                                       | medium     | First fully mobile operational screen           |
| 5   | Renewals + payment dialogs                                           | 3, 4    | `PaymentCollectionPageClient`, MarkPaid/Reactivation sheets                                                                                                                                                                                                                                                         | low–medium | Both daily screens done                         |
| 6   | Dashboard + Revenue                                                  | 1, 3    | `DashboardClient`, `RevenuePageClient`                                                                                                                                                                                                                                                                              | low        | —                                               |
| 7   | Analytics                                                            | 1       | `MemberAnalyticsClient`, `RangeSelector`, cohort rows + expand                                                                                                                                                                                                                                                      | medium     | —                                               |
| 8   | Membership Setup + Settings / Support / Subscription / Announcements | 1, 2    | `BillingSetupPageClient` single tree + history entry, plan-edit sheet, discounts; Settings Back via AppBar, security sheets; delivery log list; billing history list                                                                                                                                                | low–medium | All secondary destinations complete             |
| 9   | Door Access + SMS / activity lists                                   | 1, 2, 3 | `AccessActivityLog` phone list, chips; `MemberSmsHistory` phone list                                                                                                                                                                                                                                                | low        | Enterprise surface complete                     |
| 10  | Cleanup, sweep, sign-off                                             | all     | `UI1_ALLOW` shrink (`Drawer`, `Accordion` if used), UI6 to zero, dead code, 7-viewport probe + stress run, visual review (§29), human sign-off, docs (§2.21 mobile invariants, `DESIGN_SYSTEM.md`, closeout)                                                                                                        | low        | Definition of Done                              |

---

## 19. Phase Gates

A phase closes only when all hold:

1. **Composition match** — screens match their §26 blueprint at 320/390/430
   (§29 review recorded).
2. **Function intact** — the phase's interaction checks pass on the seeded E2E
   gym; touched mutations' request bodies equal recorded fixtures; no
   business action gained or lost a step.
3. **Desktop acceptable** — 1366 screenshot diff within tolerance for touched
   screens; 768 diff explained.
4. **Phone verified** — probe green at 320/360/390/430 for touched routes,
   including the §28 stress fixtures.
5. **Automated gate** — `type-check`, `lint`, `arch:check`, `test` green;
   touched screen tests run in both tiers; at least one new test falsified by
   mutation (recorded in the PR).
6. **Rules** — UI1/UI3/UI4/UI6 allow-lists did not grow; token parity green;
   no `sm:|md:|lg:` composition switch; no `window.innerWidth`.
7. **No duplication** — no feature file named like a DS export; one member
   detail component; no second nav list.
8. **Scope** — the diff touches only the phase's areas; every deviation from
   this plan is logged as an implementation exception (§30) or an amendment
   (§31).
9. **States** — loading, empty, error and populated states of touched screens
   verified (§27).
10. **Docs** — `DESIGN_SYSTEM.md`/`architecture.md` updated for additions.

---

## 20. Risk Register

| Id  | Risk                                                           | Likelihood | Impact | Mitigation                                                                                | Detection                              | Rollback                          |
| --- | -------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------- |
| r01 | Member-detail change alters a mutation body/dialog             | low        | high   | Component kept intact; only placement/order/labels change; fixture tests; desktop diff    | Fixtures; Playwright pay/suspend flows | Revert Phase 3                    |
| r02 | SSR/hydration mismatch from tier switching                     | medium     | medium | Header hint; provider snapshot = hint; CSS for chrome; JS only in DataTable/charts/series | Zero console errors in Playwright      | CSS-only switch for the component |
| r03 | History-entry handling misbehaves (double back, stuck entries) | medium     | medium | One `useHistoryBack` implementation; unit tests; Playwright back sequences                | Back-sequence spec                     | Disable for the affected consumer |
| r04 | Navigation redesign hides a destination                        | low        | high   | Derived from `WORKSPACE_NAV`; enumerating test; capability gating tested for both gyms    | Shell test + reachability              | Revert Phase 2                    |
| r05 | Breakpoint migration alters 768–1023 layouts                   | high       | low    | Documented tablet decision; screenshots at 768/1024                                       | Screenshot diff                        | Keep `lg:` for the shell          |
| r06 | `DataTable` list mode regresses table mode                     | medium     | high   | Separate render branch; existing tests unchanged                                          | Primitive tests; desktop screenshots   | Remove `mobileRow` props          |
| r07 | Fullscreen modal + keyboard hides footer on iOS                | medium     | medium | `dvh`, footer outside scroller, `scroll-padding-bottom`; manual iPhone check              | Reduced-height run + human             | `sheet` fallback                  |
| r08 | Cohort expansion loses a value                                 | low        | medium | Test asserts all 13 values per cohort in the expanded list                                | Phone-tier test                        | Fall back to scrolling `Table`    |
| r09 | Bulk import fallback mistaken for a supported mobile flow      | low        | low    | Persistent in-grid `Alert`; excluded from DoD; sheet copy                                 | Visual review                          | Remove the fallback link          |
| r10 | _(removed — no new routes)_                                    | —          | —      | —                                                                                         | —                                      | —                                 |
| r11 | Desktop regressions from primitive `phone:` rules              | low        | high   | All rules `max-width: 767px`; desktop screenshot suite per phase                          | Screenshot diff                        | Remove the rule                   |
| r12 | Feature-level duplicate components                             | low        | medium | UI4 + review; §5.11 naming                                                                | `arch:check`                           | Re-express as variant             |
| r13 | UI3/jsdom failures from `matchMedia` absence                   | medium     | low    | Provider default tier; explicit tier in tests                                             | Jest                                   | —                                 |
| r14 | Token parity failures (`--ds-safe-*`)                          | medium     | low    | Add to three files + `RENAMES` in one commit                                              | `token-parity.test.ts`                 | —                                 |
| r15 | Accessibility regressions                                      | low        | medium | Radix overlays; `ListRow` semantics tested; optional axe run                              | Tests + VoiceOver at sign-off          | —                                 |
| r16 | Safe-area not applied                                          | medium     | medium | `viewport` export + CSS var defaults `0px`; standalone check                              | Human sign-off                         | Insets default to 0               |
| r17 | _(removed — no confirmation changes)_                          | —          | —      | —                                                                                         | —                                      | —                                 |
| r18 | Phone body-size decision (13→14 px) shifts layouts late        | low        | low    | Decide at Phase 1 visual pass; shell-root scoped                                          | Screenshots                            | Keep 13 px                        |
| r19 | Phone-only CSS `order` in `MemberDetailModal` leaks to desktop | low        | medium | `phone:` prefix only; 1366 pixel diff                                                     | Screenshot diff                        | Remove the order classes          |
| r20 | Implementation invents UX not in the plan                      | medium     | high   | §30 discipline; exception log; gate 8                                                     | PR review against blueprints           | Revert the deviation              |

---

## 21. File-Level Change Map

Paths verified unless marked VERIFY DURING IMPLEMENTATION.

- **Design system:** `src/components/ui/tokens.ts`, `src/app/globals.css`,
  `tailwind.config.ts`; `src/components/ui/primitives/{Button,Input,Select,Textarea,Checkbox,Radio,Switch,Tabs,Pagination,Modal,Drawer,Charts,DataTable}.tsx`;
  new `ListRow.tsx` + `ui/index.ts`; new `composites/{AppBar,BottomNav}.tsx`,
  `composites/index.ts`; new `src/hooks/useViewportTier.ts`,
  `src/hooks/useHistoryBack.ts`; `(dev)/design-system/page.tsx`;
  `ui/__tests__/*` (+ `ListRow.test.tsx`, `useViewportTier.test.tsx`,
  `useHistoryBack.test.tsx`); `.claude/DESIGN_SYSTEM.md`,
  `.claude/rules/architecture.md` §2.21, `docs/architecture/` log.
- **Shell/navigation:** `src/components/workspace/{WorkspaceShell,WorkspaceSidebar,nav}`
  (+ `WorkspaceHeader` only if the header changes); `src/app/(dashboard)/layout.tsx`;
  `src/app/layout.tsx` (`viewport`); `ui/primitives/Toast.tsx`;
  `scripts/generate-pwa-assets.js` (colours only; VERIFY it writes
  `manifest.json`); `scripts/check-architecture.mjs` (UI6, `UI1_ALLOW`); shell
  tests (VERIFY existence).
- **Members:** delete `MemberDetailModalMobile.tsx`,
  `MemberDetailModalResponsive.tsx`; `MemberDetailModal.tsx` (placements,
  phone order, labels); `features/members/index.ts`;
  `src/contexts/member-modal.context.tsx` (render the desktop component);
  `(dashboard)/members/MembersPageClient.tsx` + test;
  `{AddMemberModal,EditMemberModal,DayPassModal,BulkAddMemberModal}.tsx`;
  `features/members/tests/`.
- **Renewals:** `(dashboard)/payment-collection/PaymentCollectionPageClient.tsx`
  - test; `features/payments/components/{MarkPaidDialog,ReactivationDialog}.tsx`.
- **Dashboard/Revenue/Analytics:** `DashboardClient.tsx`,
  `RevenuePageClient.tsx`, `features/analytics/components/{MemberAnalyticsClient,RangeSelector}.tsx`
  - tests.
- **Forms/dialogs:** `settings/security/page.tsx`,
  `billing-setup/{BillingSetupPageClient,PlanTypesTab,DiscountsTab}.tsx`,
  `make-announcement/page.tsx` (log list only),
  `features/sms/components/MemberSmsHistory.tsx`,
  `features/subscriptions/components/BillingHistoryTable.tsx`.
- **Settings:** `settings/layout.tsx` (phone Back hidden in favour of AppBar).
- **Door access:** `features/access-control/components/{AccessActivityLog,AccessControlDashboard}.tsx`.
- **Tests (browser):** new `tests/e2e/mobile-{shell,members,renewals,forms}.spec.ts`,
  `desktop-regression.spec.ts`, `tests/e2e/helpers/mobile-probe.ts`,
  `tests/e2e/helpers/stress-fixtures.ts`; `playwright.config.ts` viewport
  projects (VERIFY current projects); `src/test-utils/renderScreen.tsx`.

Removed from the map (C1, C5, C6): `useMemberMutations.ts`, `MemberDetail.tsx`,
`useSignOut.ts`, `billing-setup/layout.tsx` and section pages, `Toolbar.tsx`,
`Table.tsx`.

---

## 22. Decision Log

| Id  | Decision                                | Chosen approach                                                                                          | Alternatives rejected                                    | Reason                                                                                        |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| d01 | Phone breakpoint                        | One boundary at `tablet` 768; `phone:` = `max-width: 767px`                                              | 640, 600, 1024, a third tier                             | Already the DS value and the boundary of four switches                                        |
| d02 | Tablet treatment                        | Desktop composition, sidebar collapsed by default at 768–1023                                            | Phone on tablets; dedicated tablet layout                | New tier assignment (today: phone chrome); flagged (o02)                                      |
| d03 | Composition switching                   | CSS first; `useViewportTier()` where DOM differs                                                         | `innerWidth`; both trees in DOM; always JS               | No flash, no double fetch, testable                                                           |
| d04 | Navigation model                        | `BottomNav` + More (`Drawer`)                                                                            | Scrolling 9-item bar; hamburger only                     | Daily set under the thumb; one nav source                                                     |
| d05 | Bar contents **(changed)**              | Dashboard · Members · Renewals · More                                                                    | + Revenue (A); + Analytics (B); capability-dependent (D) | Revenue is one tap via the dashboard tile; no truncation at 320; fewest accidental taps (o03) |
| d06 | Account on phone                        | More sheet header + sign out (handler moved, not re-implemented)                                         | Account page; bare logout icon; `useSignOut` hook        | Parity with `UserMenu`; no new route, no cleanup                                              |
| d07 | Door Access placement                   | Mobile More (required); desktop sidebar (recommended, approval o12)                                      | Settings only; bar slot                                  | Closes OPEN-1; desktop entry is a nav change                                                  |
| d08 | Member detail model **(changed)**       | Overlay via `Modal placement`; history entry only                                                        | `?member=<id>` URL state; `/members/[id]` route          | Back is required; refresh/deep link is a new capability (o10)                                 |
| d09 | Member detail unification **(changed)** | Delete fork + responsive switch; keep `MemberDetailModal` as is                                          | Hook extraction + rename                                 | Parity needs one component, not a refactor (o13)                                              |
| d10 | Primary action placement                | Lists: first content row; detail/forms: fullscreen Modal footer                                          | FAB; AppBar slot with context plumbing                   | Thumb reach without new abstractions (C7)                                                     |
| d11 | DataTable mobile API                    | Declarative `mobileRow` → `ListRow`                                                                      | Column priority; `renderMobileRow`; separate list        | One table state, no per-feature JSX                                                           |
| d12 | List-row strategy                       | New L2 `ListRow`; hairline rows; plain `Table` lists render it via the tier hook                         | Cards; squeezed `Table`; `Table`→`DataTable` conversions | §5.20; desktop untouched                                                                      |
| d13 | Modal strategy                          | `placement: center \| sheet \| fullscreen`; footer = sticky bar                                          | New Sheet component; `Toolbar sticky`                    | Radix a11y inherited; one mechanism                                                           |
| d14 | Overlay back behaviour                  | Fullscreen, More and Setup sections push a history entry via `useHistoryBack`                            | All overlays push; none push                             | Back closes what fills the screen                                                             |
| d15 | Touch sizing                            | §15.1 rule; `touch` 44 / `touch-sm` 40; `data-dense`                                                     | New size names; density context                          | One rule everywhere                                                                           |
| d16 | Input font on phones                    | 16 px `input` token under `phone:`                                                                       | Keep 13; disable zoom via meta                           | Only non-regressive fix                                                                       |
| d17 | Tabs overflow                           | `overflow="scroll"` with snap + edge cue                                                                 | Dropdown of tabs; wrap                                   | Tabs stay visible and swipeable                                                               |
| d18 | Pagination                              | `responsive` compact on phone; Renewals phone-only `pageSize` 25                                         | Infinite scroll                                          | Server pagination unchanged; long lists bounded on phones                                     |
| d19 | Charts axis                             | `compactAxis` (width token or compact formatter — tune)                                                  | Hide axis; smaller font                                  | Labels must name reachable values                                                             |
| d20 | Analytics cohort **(changed)**          | Condensed rows (M1/M3/M6) + expand to full series                                                        | 15-column scroller with pinned column; summary-only      | Complete data access with a usable phone representation                                       |
| d21 | Confirmation policy **(changed)**       | **No new confirmations.** Existing confirms stay; mobile Mark Paid uses the desktop date dialog (parity) | Confirms on Remind/Send (both or phone-only)             | Business-action semantics are out of scope (o04)                                              |
| d22 | Bulk import **(changed)**               | Guidance sheet + Copy link + labelled desktop-grid fallback; no "Register another"                       | Mobile spreadsheet; wizard; hide                         | Preserves function honestly; no new product action                                            |
| d23 | Membership Setup sections **(changed)** | State-driven + phone history entry; single tree                                                          | Nested routes; search-param state                        | Back works; no new pages, no desktop URL change                                               |
| d24 | Renewals → payment path **(changed)**   | Row opens member detail; Mark Paid in its sticky footer                                                  | `openMember(intent: 'pay')`                              | Same flow as desktop; shortcut deferred                                                       |
| d25 | PWA **(changed)**                       | `viewport-fit=cover`, safe-area tokens, dark manifest colours; `start_url` unchanged                     | Change `start_url`; `display_override`                   | Presentation only (o11)                                                                       |
| d26 | Touch rule ownership                    | §15.1 is the single source; primitives set `data-dense`; probe reads it                                  | Per-phase thresholds                                     | No drift between spec, code, probe, DoD                                                       |
| d27 | AppBar scope                            | Identity/Back + title only; no action slot                                                               | Context-fed trailing action                              | No new plumbing; actions stay with their pages                                                |
| d28 | Desktop untouched by default            | Every desktop diff must be listed in the phase PR and match this log                                     | Opportunistic desktop fixes                              | Presentation parity is a DoD item                                                             |

---

## 23. Open Decisions

### 23-A. Need product direction before or during implementation (defaults chosen; not blocking)

| Id  | Question                                                     | Default                                          |
| --- | ------------------------------------------------------------ | ------------------------------------------------ |
| o01 | Who is the phone user? (owner/operator vs floor staff)       | Owner/operator (audit)                           |
| o02 | Tablet treatment (768–1023)                                  | Desktop with collapsed sidebar                   |
| o03 | Persistent bar: keep 4 items (C) or add Revenue (A)?         | C — four items                                   |
| o06 | PWA/standalone priority                                      | Safe-area implemented; one physical-device check |
| o09 | Body type size on phones (13 vs 14 px)                       | Decide at Phase 1 visual pass                    |
| o12 | Door Access entry in the **desktop** sidebar (closes OPEN-1) | Yes (recommended) — a desktop nav change         |

### 23-B. Product-behaviour decisions **outside** the mobile rebuild (not implemented by this project)

| Id  | Question                                                       | Note                                                          |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| o04 | Add confirmation before Remind (SMS) and Send broadcast        | Changes click count on both surfaces; separate product change |
| o05 | "Register another" loop on Add member                          | New product action                                            |
| o07 | Share (`navigator.share`) beside Print                         | New product action                                            |
| o08 | Cohort summary as a desktop representation                     | Additive; separate                                            |
| o10 | Member detail deep links / refresh restore (`?member=<id>`)    | New capability; cheap to add later on the same `Modal`        |
| o11 | PWA `start_url` → `/dashboard`                                 | Changes installed-app behaviour                               |
| o13 | Extract member mutations into hooks; rename component          | Engineering cleanup; do after the rebuild if wanted           |
| o14 | Renewals "Record payment" pre-opening the date dialog on phone | Flow shortcut                                                 |

---

## 24. Definition of Done

**Functional parity** — no business capability removed or semantically
changed: every action has the same steps and the same requests as before on
desktop; on phone the only behavioural difference from the previous mobile
fork is that Mark Paid now uses the desktop date dialog. Fixture tests prove
the six member mutations' bodies; Playwright proves each flow on the E2E gym.

**Presentation parity** — 1366 screenshot suite within tolerance for every
screen; 768–1023 differs only by the collapsed-sidebar default; the Door
Access sidebar entry (if approved) is the only desktop navigation diff; no
other desktop diff exists that is not listed in §22.

**Mobile quality** — every `(dashboard)` screen matches its §26 blueprint at
320/390/430 (visual review recorded, §29): no page or unintended internal
horizontal overflow (only `Tabs` lists and the bulk-import fallback scroll
sideways); every row action and page primary action visible without sideways
scrolling; fullscreen footers visible with the keyboard open; every
`WORKSPACE_NAV` destination reachable in ≤ 2 taps; the bar never scrolls.

**Touch** — §15.1 probe green on every phone route at four widths; inputs do
not trigger Safari zoom.

**State completeness** — loading, cached, empty, no-results, error and
populated states of every screen in §27 render correctly (tests + review).

**Stress resilience** — the §28 fixtures produce no clipping, overflow or
collapsed rows in `ListRow`, `AppBar`, `BottomNav`, tabs, buttons and modal
footers.

**Information access** — for each list, the §9.4 visible and disclosed sets
are asserted by the phone-tier test; every cohort's full series is reachable.

**One member detail** — the fork and the responsive switch no longer exist;
both tiers use `MemberDetailModal` with `MarkPaidDialog` and SMS history.

**Design-system integrity** — `type-check`, `lint`, `arch:check`
(UI1/UI3/UI4/UI6 allow-lists at zero growth; `Drawer` out of `UI1_ALLOW`),
`test` (both tiers), token parity green; no feature-specific visual hack, no
component named like a DS export, no `window.innerWidth`, no
`sm:|md:|lg:` composition switch in shell/DS layers; only the §5.1 tokens were
added.

**Controlled deviations** — every deviation from this plan is recorded in the
tracker's activity log as an implementation exception (§30) or a plan
amendment (§31) with its rationale; none is silent.

**Safe area** — `viewport-fit=cover` respected (probe + one device check).

**Human sign-off** — recorded against §29.

---

## 25. Visual Design Specification (mobile)

Values are existing tokens unless marked **new** (all new values are in
§5.1). "Phone" = `< 768`.

### 25.1 Global

| Aspect               | Specification                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewport assumptions | 320–767 px wide; 568–932 px tall; DPR 2–3; `viewport-fit=cover`; on-screen keyboard may take up to ~45 % of height.                                                                                                                                                                                                                                                                           |
| Ground               | `surface-base`; panels (`AppBar`, `BottomNav`, sheets) `surface-panel`; overlays `surface-card`.                                                                                                                                                                                                                                                                                              |
| Horizontal padding   | `px-4` (16) on `<main>`, `AppBar`, sheets and fullscreen bodies; `ListRow` `px-4`. Content width 288–398 px.                                                                                                                                                                                                                                                                                  |
| Vertical rhythm      | Sections separated by `gap-6` (24); within a section `gap-3` (12); rows `py-2` (8); form fields `gap-4` (16); `<main>` `pt-3` (12), bottom = `h-bottom-nav` + safe.                                                                                                                                                                                                                           |
| Typography           | Page title in `AppBar`: `text-h2` (16/24, 600). Section labels: `text-metadata` uppercase (11/16). Primary row text: `text-body` (13/20) — o09 may raise to 14/20. Secondary/meta: `text-caption` (12/16) `ink-secondary`; mono meta `text-mono-sm` (11/16) `ink-muted`. Values: `font-mono text-body tabular-nums`. KPI values `text-readout` (24/28). Inputs `text-input` (16/24, **new**). |
| Icon sizes           | Nav icons 20 (`iconSize.lg`); action icons 16 (`size-4`); status dots 9.                                                                                                                                                                                                                                                                                                                      |
| Dividers             | Hairlines only: `border-line-1` for structural boundaries (bars, section heads), `border-line-subtle` between rows. No shadows, no radius on rows.                                                                                                                                                                                                                                            |
| Radius               | `rounded-sm` (4) on controls; `rounded-t-sm` on sheets; `rounded-none` fullscreen.                                                                                                                                                                                                                                                                                                            |
| Row height           | `min-h-touch` (44); one-line row ≈ 44; two-line ≈ 52–56; with an action row ≤ 96.                                                                                                                                                                                                                                                                                                             |
| Control heights      | §15.1: 44 primary, 40 dense.                                                                                                                                                                                                                                                                                                                                                                  |
| Selected / active    | Persistent selection (nav item, More row, table row): `surface-selected` fill + `text-ink`; local position (tabs): 2 px `bg-ink` underline (R7). Pressed: `active:bg-surface-active`.                                                                                                                                                                                                         |
| Disabled             | `opacity-50`, `cursor-not-allowed` (existing primitive behaviour).                                                                                                                                                                                                                                                                                                                            |
| Focus                | `focus-visible:shadow-focus`.                                                                                                                                                                                                                                                                                                                                                                 |
| Loading              | Lists: `SkeletonText` rows (5) at row height; KPIs: value "—"; charts: `Skeleton` at chart height; overlays: the existing skeleton `Modal`.                                                                                                                                                                                                                                                   |
| Empty                | `EmptyState` compact (directive §5.17): metadata label + one sentence + one action; `py-10` max.                                                                                                                                                                                                                                                                                              |
| Error                | `Alert variant="error"` at the top of the section with the existing retry action where one exists; never technical detail (rule 2.8).                                                                                                                                                                                                                                                         |
| Overflow             | Text: `truncate` for single-line meta, `line-clamp-2` for primary names and messages; numbers never wrap (`whitespace-nowrap`, mono). Containers: only `Tabs` lists and the bulk-import fallback scroll sideways (`data-scroll="x"`).                                                                                                                                                         |
| Sticky / fixed       | `AppBar` sticky top (`z-sticky`); `BottomNav` fixed bottom (`z-sticky`); fullscreen `Modal` footer sticky bottom inside the overlay (`z-modal`); DataTable `stickyHeader` is **off** on phones.                                                                                                                                                                                               |
| Safe area            | `AppBar` `pt-[safe-top]`; `BottomNav` `pb-[safe-bottom]`; fullscreen footer and sheets `pb-[safe-bottom]`; landscape `px-[safe-left/right]` on bars only.                                                                                                                                                                                                                                     |
| Toasts               | `top-center`, offset `h-bar` + safe-top; single line; 4 s.                                                                                                                                                                                                                                                                                                                                    |

### 25.2 App bar anatomy

`<header>` · height `h-bar` (52) + safe-top · `surface-panel` · `border-b line-1`
· grid `[44px 1fr 44px]`:

- **Leading:** root pages — `Avatar size="sm"` (gym) as a 44 px button that
  opens More; nested pages — Back chevron (`size-4` glyph, 44 px hit area,
  `aria-label="Back"`).
- **Title:** `text-h2`, `truncate`; root = `crumbForPath` (e.g. "Overview",
  "Members", "Renewals"); nested = section name; fullscreen overlays use the
  Modal's own header (title `text-metadata` as today) — not the AppBar.
- **Trailing:** empty (44 px reserved so the title centres); no actions.

### 25.3 Bottom navigation anatomy

`<nav aria-label="Workspace">` · fixed · height `h-bottom-nav` (56) +
safe-bottom · `surface-panel` · `border-t line-1` · 4 items `flex-1`, each a
`<a>` 44 px min height: icon 20 over label `text-mono-xs` (10/14) uppercase
tracked; active `text-brand-link` + `aria-current="page"`; inactive
`text-ink-secondary`; pressed `active:bg-surface-active`. "More" uses a
`MoreHorizontal`-class icon and opens the `Drawer`; it is `aria-expanded`.

### 25.4 Per-screen deltas

| Screen           | Deltas from global                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard        | KPI band `grid-cols-2` with `divide-line-1`, tiles `min-h-touch`, value `text-readout` mono, sub `text-caption` `line-clamp-2`. Chart height 160. Queue rows two-line. Payments rows two-line + trailing value.                                                                                                                                                                                    |
| Members          | Row 1: `SearchBar` (`flex-1`) + `Button` "Add member" (`size="md"`, 44) + "⋯" icon button (44). Row 2: `Select` (`flex-1`) + count `text-mono-sm` right. Rows: avatar `sm` (26) leading; status line = `Badge` dot + mono due date; value fee `min-w-24`. Pagination compact.                                                                                                                      |
| Member detail    | Fullscreen; header = Modal header (Back + "MEMBER DETAILS"); identity block: name `text-h2`, member id `text-mono-sm`, status/plan badges; plan grid `grid-cols-2 gap-4`; status section hairline-separated; disclosure toggles as today (`Button variant="ghost" size="sm"` → 40); footer: `Close` (secondary) · `Mark Paid`/`Re-activate` (accent) stretched. Delete: `destructive-ghost`, last. |
| Add member       | Fullscreen; stepper row `text-caption`; fields `FormField` stacked `gap-4`; native date/select; footer stretched buttons.                                                                                                                                                                                                                                                                          |
| Renewals         | Tabs `overflow="scroll"` with badges (count `Badge`); rows: avatar `sm`, primary name, status line (`● 12 DAYS AGO` error / due date warning), value amount, action row with two dense buttons (40) `gap-2`. Sort `Select` right of the tab list on its own row only when a sort is applied? — No: always present as a compact `Select` under the tabs (deterministic).                            |
| Revenue          | Selects row `grid-cols-2 gap-2`; KPI band as Dashboard; breakdown rows: primary plan, meta "19 members · 10 payments", value collected, bottom `Progress` (share) 2 px.                                                                                                                                                                                                                            |
| Analytics        | Range row: 5 dense segmented buttons in a snap-scroll `TabsList overflow="scroll"`-like row (reuse `Tabs` variant? — no: `RangeSelector` keeps its buttons, sized dense, in an `overflow-x-auto` row); series `Select` full width; charts 160–180; cohort rows: primary "Sep 2026", value "12", meta "M1 79% · M3 — · M6 —", chevron; expanded: mono list `M0 100% · M1 79% …` wrapping.           |
| Announcements    | Compose `Card` full width; `Textarea` min 120 px; counter `text-mono-sm`; Send `Button` full width 44. Log rows: primary excerpt `line-clamp-2`, status `Badge`, meta "sent 120 · delivered 118".                                                                                                                                                                                                  |
| Membership Setup | Menu: 3 `ListRow`s (48) with chevrons; sections: existing forms; plan rows: primary name, meta price, status `Badge`, actions dense (Edit · Enable/Disable · Delete → "⋯" when 3).                                                                                                                                                                                                                 |
| Settings         | As today (48 px menu rows, `SettingsSection`/`SettingsRow` stacked).                                                                                                                                                                                                                                                                                                                               |
| Door Access      | Reader cards stacked (`Card` justified: independent objects); activity rows: primary who, status `Badge`, meta reader, value when; chips dense 40.                                                                                                                                                                                                                                                 |
| More sheet       | `Drawer size="auto"`: identity block (`Avatar md`, name `text-body` 500, email `text-mono-sm`, tier `Badge`), group labels `text-metadata`, rows `ListRow` 44 with chevrons, "Sign out" last (`destructive-ghost` text).                                                                                                                                                                           |

---

## 26. Screen Blueprints (phone, top → bottom)

Legend: `═` fixed/sticky boundary, `─` hairline, `[ ]` control, `(scroll)` the
scrolling region.

```text
DASHBOARD                                 MEMBERS
═══ APP BAR: [avatar] Overview ═══════    ═══ APP BAR: [avatar] Members ══════
SEP 13 2026, 08:42 IST      (mono cap)   [ Search by name or phone ][+ Add][⋯]
┌───────────────┬───────────────┐         [ All statuses      ▾ ]   46 records
│ OVERDUE       │ REVENUE · SEP │         ─────────────────────────────────
│ 0             │ 126,200       │ (band)  (scroll)
│ 0 critical…   │ LKR collected │         (FH) Fathima Herath          16,000
├───────────────┼───────────────┤              ● ACTIVE · due 2027-02-16
│ EXPIRES WEEK  │ ACTIVE        │              +94 75 123 0428 · 6-Months
│ 5             │ 46            │         ─────────────────────────────────
└───────────────┴───────────────┘         (VB) Vimukthi Bandara         30,000
REMINDER QUEUE            ● 5 QUEUED           ● EXPIRED · 2026-08-09
(scroll)                                       +94 76 119 3769 · Annual
Janani Silva                   3,500      ─────────────────────────────────
  Due-today reminder · today              …
─────────────────────────────────         [‹ Prev]   1 of 3   [Next ›]
REVENUE · TRAILING 8 MONTHS      LKR      ═══ BOTTOM NAV ═══════════════════
[ bar chart, compact axis 160px ]         Dashboard  Members  Renewals  More
RECENT PAYMENTS
(NP) Nimal Perera  ● NEW       3,500
  Monthly · 2026-09-13
…
═══ BOTTOM NAV ═══════════════════════
Dashboard  Members  Renewals  More

MEMBER DETAIL (fullscreen overlay)        ADD MEMBER (fullscreen overlay)
═══ [‹] MEMBER DETAILS ═══════════════    ═══ [‹] ADD NEW MEMBER ═════════════
(scroll)                                  Step 1 of 2 · Member Info ── Payment
Fathima Herath                            (scroll)
Member ID #0046 · ● ACTIVE · 6-MONTHS     NAME *            [                ]
PHONE  +94 75 123 0428  (tel: link)       WHATSAPP NUMBER * [ 0771234567     ]
REGISTERED 16/08/2026                     PLAN TYPE *       [ Monthly      ▾ ]
─────────────────────────────────         PLAN AMOUNT *     [ 3500           ]
PLAN TYPE 6-Months   PLAN AMOUNT 16,000   DISCOUNT          [ No discount  ▾ ]
START 16/08/2026     NEXT DUE 16/02/2027  [ ] Apply discount to future payments
─────────────────────────────────         MEMBERSHIP START* [ 2026-09-13     ]
STATUS ACTIONS · current: active          REMARKS           [                ]
[ Suspend Member ]                        ═══ FOOTER ═══════════════════════
─────────────────────────────────         [ Cancel ]          [ Next: Payment ]
PHOTO         [Take photo] [Choose file]
DOOR ACCESS   ● CAN GET IN  …             RENEWALS
[ View Payment History ]                  ═══ APP BAR: [avatar] Renewals ═════
[ View SMS History ]                      [Expired 15][Expires this week 5][Collected 24]›
─────────────────────────────────         Sort [ Expired ▾ ]
[ Delete member ]  (destructive-ghost)    ─────────────────────────────────
═══ FOOTER ═══════════════════════════    (scroll)
[ Close ]              [ Mark Paid ]      (RS) Ravindu Samaraweera       3,500
                                               ● 299 DAYS AGO
REVENUE                                        [ Record payment ] [ Remind ]
═══ APP BAR: [avatar] Revenue ════════    ─────────────────────────────────
[ September ▾ ]        [ 2026 ▾ ]         …
┌───────────────┬───────────────┐         [‹ Prev]   1 of 1   [Next ›]
│ COLLECTED·SEP │ BILLED · SEP  │         ═══ BOTTOM NAV ═══════════════════
│ 126,200       │ 217,500       │
│ all cash      │ 58% · 15 over │         ANALYTICS
├───────────────┼───────────────┤         ═══ APP BAR: [avatar] Analytics ════
│ ACTIVE 46     │ AVG / MEMBER  │         [1M][3M][YTD][1Y][MAX]   (snap row)
└───────────────┴───────────────┘         ┌──────────────┬──────────────┐
MONTHLY COLLECTED REVENUE        LKR      │ ACTIVE 46    │ NEW 12       │
[ bar chart, compact axis ]               │ RENEWAL 20%  │ CHURN 25%    │
BREAKDOWN BY PLAN TYPE                    └──────────────┴──────────────┘
Monthly                       61,500      MEMBERSHIP TREND     [ Sign-ups ▾ ]
  19 members · 10 payments                [ line chart 180 ]
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░ 49%              NEW SIGN-UPS · YEAR OVER YEAR
…                                         [ bar chart 160 ]
═══ BOTTOM NAV ═══════════════════════    AT-RISK MEMBERS · DUE SOON
                                          [ bar chart 160 ]
ANNOUNCEMENTS                             COHORT RETENTION · BY SIGN-UP MONTH
═══ APP BAR: [avatar] Announcements ══    Sep 2026                          12 ›
COMPOSE BROADCAST (card)                    M1 — · M3 — · M6 —
AUDIENCE [ All members (Active…) ▾ ]      Aug 2026                          14 ›
MESSAGE  [                          ]       M1 79% · M3 — · M6 —
         [                          ]       ↳ expanded: M0 100% · M1 79% · …
0/160 · 1 segment                         …
[ Send broadcast ]  (unchanged action)    Renewal, churn … estimated from payments
DELIVERY LOG                              ═══ BOTTOM NAV ═══════════════════
Gym closed tomorrow…      ● DELIVERED
  sent 120 · delivered 118                MEMBERSHIP SETUP            SETTINGS
…                                         ═══ [avatar] Membership Setup   ═══ [avatar] Settings
═══ BOTTOM NAV ═══════════════════════    Plan types                  ›   Gym Information      ›
                                          Discounts                   ›   Registration         ›
DOOR ACCESS                               Admission fee               ›   Rules & Terms        ›
═══ APP BAR: [avatar] Door Access ════    (section: [‹] in app bar,      Security             ›
Who came in, and whether readers…          existing form/list)           Access Control       ›
READERS                                   ═══ BOTTOM NAV ═════════════   Subscription         ›
┌ Front door · ● ONLINE ─────────┐                                       ═══ BOTTOM NAV ═══════
│ capacity 12% · clock ok        │
│ [Open door] [Reboot] [⋯]       │
└────────────────────────────────┘
RECENT ACTIVITY  [All][Entries][Refusals][Alerts][Device]›
Nimal Perera            ● IN     08:41
  Front door
…
[‹ Prev]  1 of 4  [Next ›]
═══ BOTTOM NAV ═══════════════════════
```

Above-the-fold rule (390×844, ≈ 690 px usable): Dashboard shows the band and
the first two queue rows; Members shows search/add, filter and ≈ 6 rows;
Renewals shows tabs, sort and ≈ 5 rows with their actions; member detail
shows identity, plan grid, status actions and the sticky footer without
scrolling.

---

## 27. UI State Coverage

Global behaviours apply to every list/screen; per-screen rows note the
exceptions.

| State                    | Global behaviour                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial loading          | Lists: 5 `SkeletonText` rows at row height inside the same container; KPI values "—"; charts `Skeleton`; no layout shift.                                                                                                                                                                        |
| Loading with cached data | react-query shows cached rows immediately; no skeleton; no "refreshing" indicator (unchanged behaviour).                                                                                                                                                                                         |
| Empty                    | Compact `EmptyState` (§25.1) inside the section; primary action stays in place (e.g. Add member).                                                                                                                                                                                                |
| No search results        | Members: "No members match your search." + `[Clear search]` (calls the existing `setSearch('')`).                                                                                                                                                                                                |
| Error                    | `Alert error` with the existing retry where the screen has one; the rest of the screen still renders.                                                                                                                                                                                            |
| Partially populated      | Missing optional values render "—" (`ink-muted`); rows never collapse; meta segments with no value are omitted from the " · " join.                                                                                                                                                              |
| Long names               | `line-clamp-2`; row grows to ≤ 76 px; value column stays right-aligned (drops under primary below 340 px).                                                                                                                                                                                       |
| Long phone numbers       | Sri Lankan numbers are fixed-length (`+94 7X XXX XXXX`); rendered mono, `whitespace-nowrap`; the fixture still tests a 20-char string.                                                                                                                                                           |
| Long plan names          | Plan labels are a fixed enum (≤ 8 chars); discount names (user text) `truncate` at one line.                                                                                                                                                                                                     |
| Large money              | `12,345,678` mono tabular; value column `min-w-24`; KPI `text-readout` may wrap to two lines inside the tile (`break-words`).                                                                                                                                                                    |
| Missing optional values  | "—".                                                                                                                                                                                                                                                                                             |
| Very long SMS / message  | `line-clamp-2` in the row; tap expands the row (`renderExpanded` / local state) to full text; 320-char (2-segment) fixture.                                                                                                                                                                      |
| Maximum list size        | Members: server pages of 20 (unchanged). Renewals: phone `pageSize` 25. SMS history: pages of 20 (unchanged). Activity: `PAGE_SIZE` (unchanged). Reminder queue: as returned (VERIFY cap). Delivery log: VERIFY cap; if uncapped, phone `pageSize` 25. Recent payments: 6. Cohorts: as returned. |

Per-screen verification list (each state rendered in the phone-tier test or
the Playwright stress run): Dashboard (loading, empty queue, empty payments,
error), Members (loading, empty gym, no results, error, long names, 300
members), Member detail (loading skeleton, missing photo/discount, cancelled
status, long history), Renewals (loading, all three tabs empty, error, 100
dues), Revenue (loading, month with no data, error), Analytics (loading, no
cohorts, single cohort, 24 cohorts), Announcements (empty log, long message,
sending progress), SMS history (empty, long message, failed status), Access
activity (empty, alert rows), Membership Setup (no plans, no discounts),
Settings (unchanged).

---

## 28. Content Stress Tests

`tests/e2e/helpers/stress-fixtures.ts` seeds (through the app's own APIs, on
the E2E Enterprise gym, idempotent by name) and asserts on:

| Fixture                                           | Validates                                                       |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Member name "Wickramasinghe Arachchige Dona" (29) | `ListRow` primary clamp; `AppBar` title truncation; modal title |
| Phone string of 20 characters (test-only render)  | mono no-wrap, no overflow                                       |
| Discount name 40 chars                            | meta truncation                                                 |
| Plan amount 12,345,678; payment 99,999,999        | value column width; KPI wrap; breakdown                         |
| 300 members / 100 dues                            | pagination, list height, probe runtime                          |
| SMS text 320 chars; message with newlines         | clamp + expand                                                  |
| Empty remarks / no discount / no photo            | "—" rendering                                                   |
| Row with NEW badge + status badge                 | badge stacking in status line                                   |
| Two row actions at 320 px                         | dense button wrap (must not overflow; may stack to two lines)   |
| "299 DAYS AGO"; date 2027-02-16                   | status line width                                               |
| Tab badge counts 128 / 1,024                      | `TabsList` overflow                                             |
| `aria-label` text on every icon button            | probe: every icon-only control has a name                       |

Each fixture is run at 320/360/390/430; the probe's overflow, touch and
clipping rules apply; screenshots are captured for §29.

---

## 29. Visual Regression Gates (mobile)

Per phase, for every screen the phase touched:

1. Render at 320, 390 and 430 with the E2E data **and** the §28 fixtures.
2. Compare against the §26 blueprint: what is above the fold, what scrolls,
   what is fixed; primary action placement; disclosure defaults.
3. Inspect hierarchy (title → primary data → secondary → tertiary), density
   (no card-per-row; rows within the §25 heights) and action placement.
4. Inspect long-content behaviour (clamps, wraps, value column drop).
5. Record deviations in the tracker's activity log with a screenshot name.
6. Correct before closing the phase gate.

Automated screenshot similarity is used only for **desktop** regression; the
mobile review is a human comparison against the blueprint, because the
objective is intentional composition, not pixel matching.

---

## 30. Implementation Discipline

The implementation session executes this plan; it does not discover the
product design while coding.

- When a question is answered by this plan, follow the plan.
- When it is answered by the design-system rules (`DESIGN_SYSTEM.md`,
  directive §5.20, §15.1 here), follow those.
- Otherwise **stop and record an implementation exception** in the tracker's
  activity log (`actor: claude-session`, prefix `EXCEPTION:`) naming the
  screen, the question and the choice made, and choose the option that
  changes the least.
- No new navigation model, information hierarchy, row anatomy, modal
  behaviour, breakpoint, design token or component abstraction may appear
  without (1) explicit justification against this plan in the PR and the
  activity log, or (2) a plan amendment (§31).
- Every PR description lists: phase, blueprint(s) implemented, deviations,
  the test falsified by mutation, and the desktop diff (expected: none).

---

## 31. Plan Amendment Protocol

If implementation finds the plan technically incorrect:

1. Document the conflict (what the plan says; what the code/framework does).
2. Identify why the plan does not work (with the verifying spike or failing
   test).
3. Propose the smallest correction.
4. State desktop and mobile impact.
5. Update the affected decision in §22 (status `changed`, with the note) and
   this document (increment the version in the header), and write an
   `AMENDMENT:` entry in the tracker's activity log.
6. Only then implement.

Amendments never widen scope into §23-B without a separate product decision.

First implementation session: run the two VERIFY spikes that gate the
architecture — `useHistoryBack` behaviour with the App Router's own history
handling, and the `viewport` export shape (§16) — before any primitive work.
