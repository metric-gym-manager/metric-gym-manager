# Mobile UI Rebuild — Phase 0: Current-State Audit

> **Status:** analysis only. Written 2026-09-13 on branch
> `claude/mobile-ui-rebuild-audit`. No source, configuration, dependency or
> schema was changed to produce it. It is the input to a separate
> implementation instruction; nothing here is a design.
>
> **Companion rulings.** Ruling **R6** in `workspace-ui-overhaul-log.md`
> ("keep the mobile bottom bar; mobile is being rebuilt from scratch in a
> separate effort") and closeout §4.2 ("mobile is the largest remaining gap")
> are the reason this document exists. Directive §5.20 (responsive behaviour)
> and §4.10 (functional preservation) bind the rebuild that follows it.

---

## How this was verified

Rendered, not inferred. Every "current mobile state" below was observed in a
real browser, because this repository has shipped a white `<body>` and a
three-row toolbar through a fully green gate (`CLAUDE.md` Verification
Directives).

| What             | How                                                                                                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering        | `next dev` on a throwaway port, headless Chromium via the repo's Playwright, `isMobile` + `hasTouch`, iPhone UA, **390×844** (primary) and **360×800 / 320×568** (secondary), DPR 2. Desktop reference at 1366×800.                                                  |
| Session          | Logged in as the seeded **E2E Enterprise gym** (`@metricgym.test`) through the app's own `/api/auth/login`. No account was minted, no auth rows written by hand.                                                                                                     |
| Data             | That gym had 1 member. **45 members were seeded through the app's own APIs** (`POST /api/members/bulk` → `register_member_guarded`, 12 extra `POST /api/members/:id/payment`), with start dates spread over 400 days so Dashboard/Renewals/Analytics have real rows. |
| Side effects     | `ENABLE_REAL_SMS=false` — every welcome SMS and the one "Remind" I tapped were mocked (they exist as `sms_logs` rows for the E2E gym only). No cron was triggered, so all 46 seeded members carry `status='active'` even where `next_due_date` is in the past.       |
| Measurement      | Per route: `documentElement.scrollWidth`, every `main *` whose box exceeds the viewport, every scroll container with `scrollWidth > clientWidth`, every interactive element under 40 px tall, every `<table>` (columns, rendered width), every fixed/sticky element. |
| Not rendered     | `/demo-sms`, `(dev)/design-system`, the SaaS-admin pages (`/system-health`, `/qr-codes`) — inventoried from code only and marked as such.                                                                                                                            |
| Repo state after | `git status --porcelain` → empty. Dev server stopped. Screenshots live only in the session scratchpad.                                                                                                                                                               |

Numbers quoted below (table widths, hidden columns, tap-target sizes) are the
measured values at 390 px unless another width is named.

---

## A. Executive Summary

**Classification: primarily desktop, with responsive patches.** Not
mobile-ready, and not "partially responsive" in any sense a gym owner would
recognise on a phone.

What exists for phones today is a **chrome patch, not a mobile product**:

- A mobile top bar (gym name + logout) and a fixed bottom bar that lays the
  same nine desktop destinations out at 76 px each — **754 px of navigation in
  a 390 px viewport**. Four items are fully visible; **Renewals, Announcements,
  Membership Setup, Settings and Support are off-screen behind a horizontal
  scroll with no affordance** (the scrollbar is hidden by design). At 320 px,
  six of nine are hidden.
- Settings and Membership Setup have a genuine **master/detail** pattern on
  phones (menu → back link → section). Auth pages and the public `/join`
  self-registration page are **genuinely mobile-usable** — they were designed
  for a phone in the first place.
- Everything operational — **Members, Renewals, Dashboard, Revenue, Member
  Analytics** — is the desktop composition rendered into 390 px. Every data
  table overflows its container: Members is 767 px wide (7 columns, 2½
  visible), Renewals 674 px, Revenue breakdown 577 px, the cohort table
  1,093 px (15 columns, 3½ visible), the dashboard's recent-payments table
  461 px. `DataTable`'s only responsive behaviour is `overflow-x: auto`.
- **On Renewals the screen's primary actions — "Remind" and "Record payment" —
  are entirely off-screen.** Nothing indicates they exist. This is the screen
  a gym owner is most likely to open on a phone (someone is at the desk, has
  their membership expired?).
- The one deliberately mobile component, `MemberDetailModalMobile`, is a
  716-line **fork** of the 842-line desktop modal: seven duplicated mutations,
  a hand-rolled `fixed inset-0` sheet with no `role="dialog"`, no focus trap,
  no Escape-to-close (verified), an unlabelled close button, and **two
  functional divergences** — SMS history is absent on mobile, and "Mark Paid"
  on mobile posts today's date immediately with no confirmation, where desktop
  opens `MarkPaidDialog` to choose the date. It is the last hand-copied card
  in the codebase and the overhaul left it alone by ruling (R6).
- Controls are desktop-sized: buttons 26–32 px, inputs 32 px, checkboxes
  14 px, switch 19 px, pagination 32 px, tab triggers 36 px; body text 13 px,
  labels 11 px, mono captions 10 px. **Inputs render at 13 px — below the 16 px at which iOS
  Safari stops auto-zooming a focused field** (Safari's documented behaviour;
  not reproducible in headless Chromium, so flagged rather than observed). There is no safe-area handling anywhere, and
  the PWA manifest is `display: standalone`, so on a modern iPhone the fixed
  bottom bar sits under the home indicator.

The good news is structural. The design system is token-only, dark, and
machine-enforced; the primitives are sound; business logic is fully separated
from presentation (routes → feature `services/factory.ts`; screens are
`useQuery` + composition). The `Drawer` primitive already becomes an 85vh bottom
sheet below the tablet breakpoint and has **zero consumers**. A mobile rebuild
is a **composition and presentation** problem, and the codebase is unusually
well prepared for exactly that — with one real structural obstacle (the member
detail fork) and a handful of rules (`UI1`, `UI3`, `UI4`, token lint) that the
rebuild must be designed to satisfy rather than fight.

---

## B. Application Architecture

| Layer                | Reality                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework            | Next.js 16.3 (App Router, Turbopack), React 19, TypeScript strict. Route groups `(dashboard)`, `(admin)`, `(auth)`, `(dev)`; public `/`, `/contact`, `/join/[token]`, legal pages.                                                                                                                                                                                                |
| Routing              | Pages are thin: `page.tsx` renders a `*PageClient.tsx` or a feature component. Auth-boundary navigation is full-document (§2.15). **The only route-driven master/detail is Settings**; Membership Setup's mobile sections are `useState`, not URL.                                                                                                                                |
| Shell                | `WorkspaceShell` (client) → `WorkspaceSidebar` (`hidden lg:flex`, 240/56 px, collapse state in `localStorage`) + `WorkspaceHeader` (`hidden lg:flex`, breadcrumb + static status badge + `UserMenu`) + `MobileTopBar` (`lg:hidden`, sticky 52 px) + `MemberLimitBar` + `<main class="p-6 pb-24 lg:pb-6">` + `MobileBottomNav` (`lg:hidden`, fixed 54 px). One shell, two chromes. |
| UI architecture      | Metric Design System, five layers: L1 tokens (`tokens.ts` + `globals.css --ds-*` + `tailwind.config.ts`, parity-tested) → L2 32 primitives (`@/components/ui`) → L3 14 composites → L4 feature components → L5 pages. Dependencies point downward only.                                                                                                                           |
| Styling              | Tailwind 3 with the DS scale bound to `--ds-*` variables. **Dark-only** since ruling R2 (light block deleted; `:root` resolves dark). Raw colour/type/radius outside L1 is an ESLint error, in `className` and inline `style`.                                                                                                                                                    |
| Breakpoints          | Two overlapping sets: Tailwind defaults `sm 640 / md 768 / lg 1024 / xl 1280` **and** DS `mobile 480 / tablet 768 / laptop 1024 / desktop 1440` (added via `extend`). Both are in use (see §H). The shell switches on `lg` (1024); the member detail switches on `window.innerWidth < 768` in JS.                                                                                 |
| State/data           | `@tanstack/react-query` per screen; `react-hook-form` + Zod in forms; a `MemberModalProvider` context mounts the member detail/edit overlays once for the whole `(dashboard)` group and exposes `openMember(id)`.                                                                                                                                                                 |
| Enforcement          | `npm run arch:check`: R1/R4/R10/R11 plus **UI1** (no component unreachable from `src/app`), **UI2** (`mws-*` may not return), **UI3** (every `(dashboard)`/`(admin)`/`(auth)` `page.tsx` rendered by a test — allow-list empty), **UI4** (no file or export named like a DS primitive/composite — allow-list empty), **UI5** (stale ESLint exemptions). Token-parity Jest test.   |
| Relevant constraints | Screens must stay renderable by a jsdom test (UI3). New shared UI must be a DS variant, not a sibling (UI4). Any new spacing/size needs a token first. Navigation changes were forbidden under the visual directive (§4.10) — that directive is closed; this project is explicitly about navigation.                                                                              |

Documentation vs implementation — discrepancies that matter here:

1. `DESIGN_SYSTEM.md` §6/§9 say every primitive is "responsive". In practice
   "responsive" means `w-full` and, for tables, `overflow-x-auto`. No primitive
   has a phone composition except `Drawer` (bottom sheet) and `Modal`
   (`max-w-[calc(100vw-2rem)]`).
2. `DESIGN_SYSTEM.md` §4.3 lists breakpoints `mobile/tablet/laptop/desktop`;
   the app's shell and most feature code use Tailwind's `sm/md/lg`. There is
   no single breakpoint the app switches on.
3. `WorkspaceSidebar`'s docblock says "the mobile shell opens the same
   navigation in a drawer". It does not — R6 reverted that; the bottom bar is
   what ships.
4. `workspace-ui-overhaul-log.md` §2 records "hand-copied card divs: 1
   (mobile)". Correct, and it is `MemberDetailModalMobile`.
5. `manifest.json` has `background_color: #ffffff` and `start_url: /members`
   for a dark-only app whose home is `/dashboard`.

---

## C. Complete Screen Inventory

Severity scale — **Low**: composition works, polish only · **Medium**:
re-compose with existing primitives · **High**: needs a deliberate mobile
composition · **Very High**: the desktop interaction model has no phone
equivalent.

### C.1 Gym workspace `(dashboard)`

| Area                 | Route                      | Screen                                                                                                                                           | Primary task                           | Current mobile state (390 px)                                                                                                                                                                                                                                                                                                                                                                   | Rebuild severity   |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Shell                | all                        | Top bar / bottom bar / sidebar / header                                                                                                          | Get anywhere                           | 5 of 9 destinations hidden behind unindicated horizontal scroll (6 of 9 at 320 px). No account menu on mobile (only logout). No page-level back. Fixed bar has no safe-area inset. 10 px labels.                                                                                                                                                                                                | **Very High**      |
| Dashboard            | `/dashboard`               | Overview: 4 KPI tiles, trailing-revenue bar chart, reminder queue, recent payments                                                               | See what needs attention today         | KPI 2×2 grid works; subtitles wrap to 2–3 lines. Chart y-axis labels clipped ("20000" → "0000"). Reminder queue list works. Recent-payments table 461 px (Amount column off-screen); dates wrap `2026-\n09-13`.                                                                                                                                                                                 | **Medium**         |
| Members              | `/members`                 | Search + status filter + 3 actions + 7-column DataTable + pagination                                                                             | Find a member, open them; add a member | Toolbar wraps to 3 rows. Table **767 px** — Name, Phone, half of Plan visible; **Status, Joined, Next due, Fee hidden**. `stickyHeader` does not stick (sticks to the overflow container, not the page). Rows 73 px because names wrap beside 32 px avatars.                                                                                                                                    | **High**           |
| Member detail        | overlay on any screen      | `MemberDetailModalMobile` — full-screen hand-rolled sheet: photo, plan grid, status card, door access, payment history (collapsed), footer icons | Record a payment; change status; edit  | Opens full-screen. **Primary action "Mark Paid" is below the fold**, after Suspend, Door Access and Payment History. Footer = two icon-only buttons (delete/edit) with no labels. No Escape, no focus trap, no `role=dialog`. **No SMS history.** Mark Paid = one tap, no date/confirm.                                                                                                         | **Very High**      |
| Add member           | overlay                    | `AddMemberModal` — 2-step wizard (member info + plan / payment summary), 8 inputs, stepper                                                       | Register a walk-in                     | Renders as a 358×748 `Modal` from y=96 to the viewport bottom (no bottom margin). Content scrolls inside a fixed `100vh`-derived height. Native date input. Works, but is a desktop dialog squeezed, and the footer is at risk behind the on-screen keyboard.                                                                                                                                   | **High**           |
| Edit member          | overlay                    | `EditMemberModal` — 5 inputs + read-only grid                                                                                                    | Correct details / change plan          | Same `Modal` shape as above; usable.                                                                                                                                                                                                                                                                                                                                                            | **Medium**         |
| Day pass             | overlay                    | `DayPassModal` — member search + amount                                                                                                          | Sell a day pass to an expired member   | Compact dialog, fits.                                                                                                                                                                                                                                                                                                                                                                           | **Low**            |
| Bulk import          | overlay                    | `BulkAddMemberModal` — defaults toolbar + spreadsheet grid (`w-[1200px]`, ≥3 rows × 5 inputs) + footer                                           | Register many members at once          | Toolbar clipped (Start Date cut), grid overflows (76 elements past the edge), footer wraps to three lines. A spreadsheet in a 358 px dialog.                                                                                                                                                                                                                                                    | **Very High**      |
| Renewals             | `/payment-collection`      | 3 tabs (Expired / Expires this week / Collected) + 4-column DataTable with row actions                                                           | Chase and record dues                  | Tab bar overflows slightly. Table **674 px**; **Amount and the Remind / Record-payment actions are off-screen.** "Record payment" opens the member sheet rather than a payment dialog.                                                                                                                                                                                                          | **Very High**      |
| Revenue              | `/revenue`                 | Month/year selects + 4 KPI tiles + monthly bar chart + 5-column breakdown table                                                                  | Read the month's money                 | KPI band works. Chart labels clipped. Breakdown **577 px** (Collected, Share hidden). "AVG / MEMBER 8,967.391" unrounded (not mobile-specific).                                                                                                                                                                                                                                                 | **Medium**         |
| Analytics            | `/member-analytics`        | Range selector + 4 KPI + trend chart with 5-way series toggle + YoY bars + at-risk bars + 15-col cohort table                                    | Understand growth and churn            | Segmented controls are 26 px tall and the series toggle wraps to two rows. Charts render. Cohort table **1,093 px** — 3½ of 15 columns visible. Page is 1,846 px tall.                                                                                                                                                                                                                          | **High**           |
| Announcements        | `/make-announcement`       | Compose card (audience select + SMS textarea + counter + send) + delivery-log table (4 cols) + progress                                          | Broadcast an SMS                       | Single column; compose is usable. Delivery-log table fits only because it is empty (347 px). Send has no confirm; audience count is shown, cost is not.                                                                                                                                                                                                                                         | **Low–Medium**     |
| Membership setup     | `/billing-setup`           | Mobile: link list → section. Desktop: 3 tabs. Plan types = inline-edit rows; Discounts = table + modal; Admission fee = form                     | Configure plans/discounts/fee          | Master/detail exists **but section state is `useState`** — the browser back button leaves the page instead of returning to the menu, and a refresh loses the section. **Both trees are in the DOM** (`tablet:hidden` + `hidden tablet:block`): the hidden desktop `Tabs` mounts its active tab on phones too, so Plan types renders and fetches unseen — and twice once that section is opened. | **Medium**         |
| Settings index       | `/settings`                | Full-width menu of 6 sections (route-driven)                                                                                                     | Reach a setting                        | Works; 48 px rows with chevrons. This is the right pattern.                                                                                                                                                                                                                                                                                                                                     | **Low**            |
| Gym info             | `/settings/gym`            | `SettingsSection` + 4 `SettingsRow` (image, name, address, website) + save bar                                                                   | Edit identity                          | Single column, back link. Buttons 26–32 px.                                                                                                                                                                                                                                                                                                                                                     | **Low**            |
| Registration         | `/settings/registration`   | QR card: code, link, Copy / Download PNG / Print                                                                                                 | Print or share the join link           | Fits. Print is a desktop verb; share-sheet would be the phone equivalent.                                                                                                                                                                                                                                                                                                                       | **Low**            |
| Rules & Terms        | `/settings/policies`       | Two large textareas + reset links + save                                                                                                         | Edit policy text                       | Fits; "Reset to default" links are 16 px tall.                                                                                                                                                                                                                                                                                                                                                  | **Low**            |
| Security             | `/settings/security`       | 4 rows (username, email, phone, password) each opening a `Modal` (994-line page)                                                                 | Change credentials                     | Rows fit; modals are the squeezed-dialog shape.                                                                                                                                                                                                                                                                                                                                                 | **Low–Medium**     |
| Access-control setup | `/settings/access-control` | Enterprise gate → account card (4 inputs, connect/test) + readers card (add form, per-reader switch)                                             | Connect hardware                       | Single column; `sm:grid-cols-2` collapses. Usable.                                                                                                                                                                                                                                                                                                                                              | **Low**            |
| Subscription         | `/settings/billing`        | Current-plan card + 3 pricing cards + billing-history table + return-status panel                                                                | See / change SaaS plan                 | Stacks (`md:grid-cols-3` → 1). 1,570 px tall. Billing table 4 cols.                                                                                                                                                                                                                                                                                                                             | **Low**            |
| Support              | `/support`                 | Contact rows + ticket form (subject, category, email, message)                                                                                   | Get help                               | Fits.                                                                                                                                                                                                                                                                                                                                                                                           | **Low**            |
| Door access          | `/access-control`          | Readers grid (`md:grid-cols-2 xl:3`) + activity log (4-col table, filter chips, pagination)                                                      | Who came in; are readers healthy       | **Not in any navigation** (OPEN-1) — reachable only by URL or Settings → Access Control. Empty on the E2E gym; the activity table is a 4-column `Table` and will overflow with data.                                                                                                                                                                                                            | **Medium** (+ nav) |

### C.2 Auth `(auth)` and public

| Area   | Route                                                  | Screen                                                                         | Current mobile state                                                                                    | Severity |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------- |
| Auth   | `/login`                                               | Segmented Log in / Register, email, password, sign in                          | Designed for phones already (`.mauth-rail` hides < 900 px, 36 px inputs). "SHOW" is 28×20 px.           | **Low**  |
| Auth   | `/register`                                            | 2-step (account → gym profile) with progress                                   | Same. Good.                                                                                             | **Low**  |
| Auth   | `/forgot-password`, `/reset-password`, `/verify-email` | Single forms                                                                   | Same.                                                                                                   | **Low**  |
| Public | `/join/[token]`                                        | Member self-registration (name, phone, plan, selfie, consents, amount summary) | Phone-first by design; `capture="user"`. 16 px checkboxes.                                              | **Low**  |
| Public | `/contact`, legal                                      | Long-form text                                                                 | Fit (1,150 px). Out of scope for the rebuild beyond consistency.                                        | —        |
| Public | `/` landing                                            | Marketing                                                                      | 9 overflowing elements at 390 px (marketing scroller). Excluded from the overhaul by R5; excluded here. | —        |

### C.3 SaaS admin `(admin)` — inventoried from code, not rendered

| Route            | Screen                                                                                                    | Mobile relevance                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/system-health` | Cron status grid (`md:2 lg:4`), raw SMS failure table (6 fixed-width cols + filter), billing failures (6) | Operator tooling with copy-to-clipboard, raw error text and fixed `w-[…px]` columns. Desktop-appropriate; a phone view is not a product need. |
| `/qr-codes`      | Per-gym poster cards (`sm:2 lg:3`), regenerate-token modal                                                | Already stacks. Low.                                                                                                                          |

---

## D. Responsive Audit

### Navigation

- **Bottom bar overflow** is the single largest failure: nine `min-w-[76px]`
  links, `overflow-x-auto` with `scrollbar-hide`, `aria-current` set. 754 px
  of content; at 390 px the fifth item ("Renewals") is cut mid-word and the
  next four are invisible. There is no "more" affordance, no fade, no
  scrollbar.
- **No account menu on mobile.** Desktop has `UserMenu` (account, email, sign
  out); mobile has a bare logout icon button. Gym identity is a truncating
  name beside an avatar.
- **No back navigation** except the hand-written links in Settings and
  Membership Setup. Overlays are the only "detail" level, and they are
  modals, so the browser back button closes nothing.
- **Sidebar collapse state** is persisted in `localStorage` and meaningless
  on a phone; harmless.
- `/access-control` has no entry anywhere (OPEN-1) — it has to be given one
  in whatever mobile IA emerges.

### Dashboards (Overview, Revenue, Analytics)

- The KPI band's 2×2 mobile grid is the one composition that was designed for
  narrow widths (`grid-cols-2 … lg:grid-cols-4`). It works; the `sub` lines
  wrap and tiles become uneven heights (129/113 px).
- Charts: Recharts' fixed left-axis width clips five-digit LKR values
  (rendered "0000", "5000") on both dashboard and revenue at 390 px. Legends
  and x-axis survive. Line chart is fine.
- Analytics is a 1,846 px scroll with four charts and a 15-column table; no
  jump navigation, no collapse.

### Tables

Every table is `Table`/`DataTable` inside `overflow-x-auto`; nothing hides,
reorders, stacks or pins columns. Measured at 390 px (container ≈ 340 px):

| Table                      | Columns | Rendered width | Visible without scrolling       | Hidden                               |
| -------------------------- | ------: | -------------: | ------------------------------- | ------------------------------------ |
| Members                    |       7 |         767 px | Name, Phone, ½ Plan             | Status, Joined, Next due, Fee        |
| Renewals (Expired)         |       4 |         674 px | Member, Expired                 | **Amount, Action (Remind / Record)** |
| Renewals (Collected)       |       4 | (not measured) | Member, Paid on, edge of Amount | Amount, Receipt (observed)           |
| Revenue breakdown          |       5 |         577 px | Plan, Members, Payments         | Collected, Share (bar)               |
| Analytics cohort           |      15 |       1,093 px | Cohort, Size, M0, ½ M1          | M1–M12                               |
| Dashboard recent payments  |       4 |         461 px | Member, Plan, Date              | Amount                               |
| Announcements delivery log |       4 |         347 px | all (empty)                     | — (will overflow with message text)  |
| Access activity log        |       4 |              — | not rendered with data          |                                      |
| Member SMS history         |       4 |              — | desktop-only component          |                                      |

Secondary: `stickyHeader` on Members does not stick on a page-scrolled phone
(the sticky context is the overflow container). Name cells wrap to two lines
next to the avatar, doubling row height. Dates in mono wrap at the hyphen.

### Forms

- Every form is already single-column; nothing relies on `grid-cols-2` except
  read-only info grids and `AccessReadersCard` (`sm:grid-cols-2`, collapses).
- The problem is not columns but **containers**: forms live inside a
  `Modal` sized `w-[480px] max-w-[calc(100vw-2rem)]`, positioned `top-24`
  (96 px) with `max-h-[calc(100vh-96px)]` — on a phone the dialog runs from
  y=96 to the bottom edge with no bottom margin, and `100vh` does not shrink
  when the keyboard opens on iOS, so the footer with the submit button can
  sit behind the keyboard.
- `AddMemberModal` is a two-step wizard with its own stepper markup; the
  stepper labels ("Member Info", "Payment") wrap at 358 px.
- `BulkAddMemberModal` is a spreadsheet: a 1,200 px grid with per-row Name /
  WhatsApp / Plan / Amount / Start date inputs and an "apply to all" toolbar.
  It has no phone form at all.
- Native `<input type="date">` is used throughout — good on phones.
- Photo capture uses `<input capture>` — good on phones.

### Dialogs

- 16 `Modal` consumers, 0 `Drawer` consumers. Every confirmation
  (`ConfirmDialog`/`DeleteDialog`) is a centred 480 px modal; on a phone it
  becomes a 358 px card anchored 96 px from the top — acceptable for
  confirmations, wrong for forms.
- `MemberDetailModalMobile` is not a `Modal` at all (see §I).

### Cards

- Directive §5.3/§5.4 already stripped most containers. What remains on
  phones: the Members `DataTable` is inside a bordered `TableContainer`;
  Announcements has two `Card`s; the mobile member sheet stacks
  `Status Actions` (filled) → `Door Access` (bordered) → `Payment History`
  (bordered) → payment tiles (bordered) — the depth-two shape the directive
  bans, retained by R6.

### Actions

- Page-level actions sit in `PageHeader.actions` (right-aligned) or a
  `flex-wrap` toolbar. On Members the toolbar becomes three rows (search /
  filter / three buttons); the primary "Add member" is the last of three
  equal-weight buttons.
- Row-level actions are table cells (Renewals) or the row itself
  (Members → open sheet). Off-screen on Renewals.
- Destructive actions: delete member (icon-only, red outline, footer of the
  sheet), suspend/cancel (buttons in the status card), delete plan type /
  discount (inline row buttons), cancel subscription. All go through
  `ConfirmDialog` except mobile "Mark Paid" (money, no confirm) and Renewals
  "Remind" (sends an SMS on one tap with no confirm — desktop too).

### Typography

Measured text nodes on the dashboard: 13 px ×23, 12 px ×15, 11 px ×24,
10 px ×7, 24 px ×4, 20 px ×1. The scale is a desktop density scale
(`body` 13, `caption` 12, `metadata`/`label` 11, `mono-xs` 10). On a 390 px
phone at arm's length 11 px uppercase tracked labels and 10 px mono are at
the legibility floor. Inputs inherit `text-body` (13 px) → below Safari's 16 px auto-zoom
threshold (documented behaviour, not reproduced here).

### Spacing

`workspacePadding` 24 px (`p-6`) on every side at 390 px leaves 342 px of
content. `pb-24` (96 px) clears the 54 px bottom bar with 42 px to spare. No
safe-area padding (`env(safe-area-inset-bottom)`) anywhere in `src/`.

### Data density

The directive's density is right for a 1,366 px screen and wrong for a
phone: the Members row carries seven facts; Renewals four plus two actions;
the cohort table 15 percentages. Nothing is prioritised — the primitives
have no notion of primary vs secondary columns.

### Interaction

See §E.

### Fixed positioning

Top bar `sticky top-0 z-sticky` 52 px; bottom bar `fixed bottom-0 z-sticky`
54 px; DataTable `thead` `sticky top-0` inside its own scroller; the mobile
sheet `fixed inset-0 z-modal` with its own sticky header. No collisions, but
the bottom bar covers content in every full-page capture until `pb-24`
kicks in, and both bars are opaque panels that consume 106 px of an 844 px
viewport (12.5%).

### Overflow

`documentElement.scrollWidth` stayed at the viewport width on every
workspace route (the `overflow-x-auto` wrappers contain it), so the page
never scrolls sideways — the overflow is inside wrappers that give no visual
cue. At 360 px the landing page's marquee pushes the document to 385 px.

---

## E. Mobile Interaction Audit

| Pattern                 | Where                                                                                         | Touch verdict                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hover reveal            | `DataTable` sort glyph `opacity-0 group-hover:opacity-100`; `hover:` colour states everywhere | Sort affordance invisible on touch; hover colours are harmless.                                                                         |
| Native `title` tooltips | `SideNav` (collapsed), `WorkspaceHeader` badge, admin tables                                  | Desktop-only; nothing critical depends on them. `Tooltip` primitive has no consumers.                                                   |
| Click row to open       | Members `DataTable onRowClick`                                                                | Fine on touch. Rows are 73 px because of wrapping — tall but tappable.                                                                  |
| Row-action buttons      | Renewals (`size="xs"`, 26 px), plan types / discounts (inline edit/delete)                    | 26 px tall buttons side-by-side; below any touch guideline; on Renewals off-screen.                                                     |
| Icon-only buttons       | Mobile sheet footer (delete/edit), top bar logout, modal close (16 px glyph in 24 px box)     | No labels; close targets ~24 px.                                                                                                        |
| Tabs                    | Renewals (Radix `Tabs`, 36 px triggers), Membership Setup (desktop only)                      | Overflow at 390 px; roving-focus keyboard model irrelevant on touch; swipeable panes absent.                                            |
| Segmented controls      | Analytics range (5) and series (5) — 26 px `Button size="xs"` groups                          | Wrap to two rows; too small.                                                                                                            |
| Native `<select>`       | Members status, Revenue month/year, Announcement audience, plan type                          | Good on phones (native picker). 32 px tall.                                                                                             |
| Native date picker      | Add/Edit/Reactivate/Mark-paid                                                                 | Good.                                                                                                                                   |
| Search                  | `SearchBar` (debounced) on Members; member search inside Day pass                             | Fine. `w-56` fixed width on Members.                                                                                                    |
| Filters                 | One status select; no filter bar                                                              | Fine.                                                                                                                                   |
| Pagination              | 32 px number buttons, server-side on Members; client on activity log                          | Small; numbered pages are a desktop idiom (phones expect load-more/infinite).                                                           |
| Sortable columns        | `DataTable` header buttons (16 px tall text)                                                  | Hidden sort glyph + 16 px targets.                                                                                                      |
| Multi-select / bulk     | `DataTable` supports it; **no screen uses it**                                                | Nothing to translate.                                                                                                                   |
| Inline editing          | Plan types tab (row flips to inputs + Save/Cancel)                                            | Works in one column but the row grows to ~6 stacked controls.                                                                           |
| Drag-and-drop           | `DataTable` column resize (opt-in, unused)                                                    | None in use.                                                                                                                            |
| Keyboard shortcuts      | `CommandPalette` ⌘K (unused, UI1 allow-listed)                                                | None in use.                                                                                                                            |
| Right-click / context   | None                                                                                          | —                                                                                                                                       |
| Modals                  | Radix `Dialog`: focus trap, Escape, scroll lock — except the mobile sheet                     | Centred modals are wrong for multi-field forms on a phone; the mobile sheet lacks every accessibility behaviour Radix gives the others. |
| Popovers / menus        | `UserMenu` (`DropdownMenu`), `NotificationMenu` (`Popover`, unused)                           | Desktop header only.                                                                                                                    |
| Sticky headers          | Top bar (works), table `thead` (does not, on page scroll)                                     | —                                                                                                                                       |
| Fixed action bars       | Bottom nav only; no screen has a fixed primary action                                         | The primary action (Add member, Mark paid, Record payment) is never within thumb reach.                                                 |
| One-tap side effects    | Renewals "Remind" (sends SMS), mobile "Mark Paid" (records money)                             | No confirmation on either; on a phone an accidental tap is far likelier.                                                                |
| Camera                  | `capture="environment"` (member photo), `capture="user"` (join selfie)                        | Good.                                                                                                                                   |
| Print                   | Registration QR "Print", billing history "Print"                                              | Desktop verb; phones want Share / Save.                                                                                                 |

---

## F. Information Architecture Audit

What a phone user needs first, from the actual data on each screen — not the
desktop column order.

### Navigation

- **Primary destinations** (daily): Dashboard, Members, Renewals.
- **Secondary** (weekly/monthly): Revenue, Analytics, Announcements.
- **Low-frequency** (setup): Membership Setup, Settings (+ Access Control
  setup), Support, Door Access (Enterprise only; daily _if_ hardware exists).
- Global: gym identity, sign out, subscription state (`MemberLimitBar`,
  trial/past-due banners live in Settings → Subscription only).

### Dashboard

- **Primary:** overdue count, expiring-this-week count, revenue this month.
- **Secondary:** active members, reminder queue (who is being nudged today).
- **Tertiary:** trailing revenue chart, recent payments list.
- **Primary action:** none today (tiles link to Renewals / Revenue /
  Members); the natural one is "go to Renewals".

### Members

- **Primary per row:** name, status-with-due (one combined signal: the
  `memberStatusIndicator` already merges status and `next_due_date`), plan.
- **Secondary:** phone (tap-to-call/WhatsApp is the phone-native form), fee.
- **Tertiary:** joined date, member number, photo.
- **Primary action:** open a member (row). Page action: **Add member**.
- **Secondary actions:** search, status filter, day pass.
- **Low-frequency:** bulk import (a desk/laptop task), pagination.

### Member detail

- **Primary:** name, status + due date, amount due, the **Mark Paid /
  Re-activate** action.
- **Secondary:** phone (call/WhatsApp), plan type/amount/start, suspend or
  activate, edit.
- **Tertiary:** photo capture, payment history, SMS history, door-access
  state and fingerprint enrolment, member number, delete.
- Today's mobile order is photo → plan grid → status card → door access →
  payment history → **Mark Paid** → icon footer. The primary action is last.

### Renewals

- **Primary per row:** name, how overdue (days) or when due, amount.
- **Primary action per row:** Record payment. **Secondary:** Remind.
- **Tertiary:** avatar, exact dates. Tabs are the filter and must stay.
- "Collected" is a receipt view: name, paid on, amount, Receipt.

### Revenue

- **Primary:** collected this month vs billed (with % and overdue count).
- **Secondary:** active members, avg/member, monthly trend.
- **Tertiary:** breakdown by plan (share bars).
- **Action:** month/year selection.

### Analytics

- **Primary:** active, new sign-ups, renewal %, churn %.
- **Secondary:** trend chart, at-risk bars.
- **Tertiary:** YoY bars, cohort table (a laptop artefact — 15 columns).
- **Action:** range selector; series toggle is a chart control, not a page
  action.

### Announcements

- **Primary:** compose + audience + send. **Secondary:** progress of the
  current send. **Tertiary:** delivery log.
- **Destructive-ish:** send (costs SMS credits) — needs a confirm on a phone.

### Membership Setup / Settings

- Already list → section. Primary per section is the form; low-frequency
  actions ("Register new gym", "Reset to default", delete plan) are
  correctly demoted.

### Door access (Enterprise)

- **Primary:** are readers online; **secondary:** latest scans; **tertiary:**
  device capacity/clock. Remote open is a per-device action.

---

## G. Component Audit

| Component / group                                                                                             | Verdict         | Why                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 tokens (colour, radius, motion, z-index, chart palette)                                                    | **Keep**        | Complete and theme-safe. Mobile needs additions (§H), not changes.                                                                                                                                                                             |
| `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `Label`, `FormField`                  | **Adapt**       | Token-driven and variant-based; they need a touch-size variant (or a scoped density), not a rewrite. `Select` wraps itself in `w-full` (call sites size the container — fine).                                                                 |
| `Badge`, `Avatar`, `Divider`, `Spinner`, `Skeleton`, `Progress`, `Alert`, `Toast`, `EmptyState`               | **Keep**        | Size-agnostic.                                                                                                                                                                                                                                 |
| `Modal`                                                                                                       | **Adapt**       | Needs a phone presentation (full-height sheet or full-screen) as a variant; the Radix behaviour (focus, Escape, scroll lock) is exactly what mobile should inherit.                                                                            |
| `Drawer`                                                                                                      | **Keep → wire** | Already an 85vh bottom sheet below `tablet`. Zero consumers. The obvious host for mobile detail/filters.                                                                                                                                       |
| `Popover`, `DropdownMenu`, `Tooltip`, `CommandPalette`, `Accordion`                                           | **Keep**        | Unused or header-only; `Accordion` is a candidate for progressive disclosure.                                                                                                                                                                  |
| `Tabs`                                                                                                        | **Adapt**       | Needs horizontal-scroll/fit behaviour for ≥3 triggers with badges.                                                                                                                                                                             |
| `Breadcrumb`, `Pagination`                                                                                    | **Adapt**       | Breadcrumb unused on mobile; pagination needs a load-more / prev-next-only mode.                                                                                                                                                               |
| `Table` (low-level)                                                                                           | **Keep**        | Correct for genuinely tabular data that may scroll sideways (§5.20 sanctions this).                                                                                                                                                            |
| `DataTable`                                                                                                   | **Adapt**       | The API is column-centric with no priority or row-renderer concept. A mobile list needs either a `renderMobileRow`-style escape hatch or column `priority`/`hideBelow` metadata. Doing it here keeps one implementation (UI4).                 |
| Charts (`BarChart`, `LineChart`, …)                                                                           | **Adapt**       | Axis width/label formatting for narrow widths (the clipping is a prop, not a redesign).                                                                                                                                                        |
| `PageHeader`, `SectionHeader`, `Toolbar`, `SearchBar`, `FilterBar`                                            | **Adapt**       | `PageHeader.actions` needs a phone placement rule; `Toolbar`/`FilterBar` are unused and could host the mobile filter row.                                                                                                                      |
| `StatCard` / `MetricCard`, `ChartCard`                                                                        | **Keep**        | Already compose into the 2×2 band.                                                                                                                                                                                                             |
| `SettingsSection` / `SettingsRow`                                                                             | **Keep**        | Already `tablet:` responsive; the settings pages are the best mobile screens in the workspace.                                                                                                                                                 |
| `ConfirmDialog`, `DeleteDialog`                                                                               | **Keep**        | Confirmations can stay compact dialogs.                                                                                                                                                                                                        |
| `SideNav`, `UserMenu`, `NotificationMenu`                                                                     | **Keep**        | Desktop chrome; the mobile chrome should consume `WORKSPACE_NAV` (the data), not these.                                                                                                                                                        |
| `WorkspaceShell` (+ `MobileTopBar`, `MobileBottomNav`)                                                        | **Rebuild UI**  | The mobile chrome is the thing R6 deferred. Both inner components are private functions inside the shell file.                                                                                                                                 |
| `nav.ts` (`WORKSPACE_NAV`, `activeNavItem`, `crumbForPath`)                                                   | **Keep**        | Single navigation source of truth — extend with grouping/priority metadata, do not fork.                                                                                                                                                       |
| `MembersPageClient`, `PaymentCollectionPageClient`                                                            | **Rebuild UI**  | Desktop table compositions; the queries, columns' cell renderers and mutations are reusable.                                                                                                                                                   |
| `DashboardClient`, `RevenuePageClient`, `MemberAnalyticsClient`                                               | **Adapt**       | KPI band already works; charts need axis fixes; the tables at the bottom need a list form.                                                                                                                                                     |
| `MemberDetailModal` (desktop) + `MemberDetailModalMobile` + `MemberDetailModalResponsive`                     | **Rebuild UI**  | Two forks with duplicated mutations and divergent behaviour. The rebuild should end with one member-detail feature component whose _presentation_ varies, not two components. `MemberDetailModalResponsive`'s JS viewport switch goes with it. |
| `AddMemberModal`, `EditMemberModal`, `ReactivationDialog`, `MarkPaidDialog`, `DayPassModal`                   | **Adapt**       | Forms are sound (`react-hook-form` + Zod); they need a mobile container and step layout, not new forms.                                                                                                                                        |
| `BulkAddMemberModal`                                                                                          | **Investigate** | A spreadsheet has no phone equivalent; the product decision is whether bulk import is a phone task at all (it stays available — §1 forbids removal — but may be a "use a larger screen" surface).                                              |
| `AnnouncementProgress`                                                                                        | **Keep**        | Already has `sm:`/`md:` variants (the one sanctioned R6 exemption).                                                                                                                                                                            |
| `MemberSmsHistory`                                                                                            | **Adapt**       | Desktop-only today; a 4-column table that should become a list on phones.                                                                                                                                                                      |
| `RegistrationQRCard`, `ProfileImageUpload`, `JoinForm`                                                        | **Keep**        | Already `tablet:` responsive / phone-first.                                                                                                                                                                                                    |
| Access-control components (`AccessReadersCard`, `DeviceStatusCard`, `AccessActivityLog`, `MemberAccessPanel`) | **Adapt**       | Card-based already; the activity table needs the list treatment; the member panel is already a vertical stack.                                                                                                                                 |
| Subscription components (`CurrentPlanCard`, `PricingTable`, `BillingHistoryTable`, banners)                   | **Keep**        | Stack correctly.                                                                                                                                                                                                                               |
| Admin (`CronStatusGrid`, failure tables, `QrCodesDashboardClient`)                                            | **Keep**        | Operator tooling; out of the mobile product surface.                                                                                                                                                                                           |

---

## H. Design System Audit

### Supports mobile as-is

- Semantic colour, status colours, dark-only theme, focus rings, overlay
  z-index ladder (`drawer 60/61`, `modal 70/71`, `toast 90`), motion
  durations, chart palette.
- Radius scale (`none/xs/sm` operational).
- `Drawer` bottom-sheet behaviour; `Modal` `max-w-[calc(100vw-2rem)]`.
- Native form controls (`select`, `date`, `capture`).
- Spacing scale (4/8 pt) — mobile needs the same scale, used differently.

### Needs adaptation (as tokens/variants — never forks)

| Gap                                  | Evidence                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two breakpoint sets**              | `sm/md/lg` in 18 files, `tablet/laptop` in 10 (`max-tablet` in the settings layout and `Drawer`), `window.innerWidth < 768` in JS. The shell flips at 1024, the member sheet at 768, Settings at 768, the Drawer at 768. A rebuild must pick one phone boundary and state it. |
| **No touch-size scale**              | Button `xs 26 / sm 30 / md 32 / lg 36 / xl 40`; Input `md 32 / lg 36`; Checkbox/Radio 14 px; Switch 19×34; Pagination 32; Tabs 36. Only `xl` (40) approaches a touch minimum; nothing reaches 44.                                                                             |
| **Type scale has no phone tier**     | `body 13`, `caption 12`, `metadata/label 11`, `mono-sm 11`, `mono-xs 10`. Inputs at 13 px sit under Safari's 16 px auto-zoom threshold (needs ≥16 px on the control on phones, which is a token decision).                                                                    |
| **No safe-area tokens**              | `env(safe-area-inset-*)` appears nowhere; `viewport-fit=cover` is not set; the manifest is `standalone`.                                                                                                                                                                      |
| **Layout tokens are desktop dims**   | `sidebarWidth`, `breadcrumbHeight`, `drawerWidth 420`, `settingsSubNavWidth 160`, `workspacePadding 24`. Missing: phone gutter, bottom-bar height, sheet heights. (`h-bar` 52 mirrors `layout.breadcrumbHeight`; nothing mirrors the 54 px bottom bar.)                       |
| **`DataTable` column contract**      | `id/header/cell/sortValue/numeric/width/resizable/minWidth` — nothing about priority, visibility per breakpoint, or a row-level renderer.                                                                                                                                     |
| **`Modal` size variants are widths** | `sm 480 / md 560 / lg 720`; no height/placement variant for phones.                                                                                                                                                                                                           |
| **Chart axis width**                 | Recharts default `YAxis width` clips 5-digit values below ~400 px.                                                                                                                                                                                                            |
| **Icon sizes**                       | `xs 12 … lg 20 xl 26`; nav icons are 20 — fine; action icons at 14–16 inside 24–32 px buttons are small targets.                                                                                                                                                              |
| **`scrollbar-hide` utility**         | Exists and is used to hide the only overflow cue on the bottom bar.                                                                                                                                                                                                           |

### Rules the rebuild inherits (and should not try to route around)

- Token-only: every new size/height/gutter is a token in three files plus
  the parity test.
- UI4: nothing in `features/**/components` or `app/**` may be named like a
  DS export (`Card`, `DataTable`, `Modal`, `Tabs`, `PageHeader`, …). Mobile
  variants belong _inside_ the primitive as variants/props, or as new L2/L3
  names that are not synonyms of existing ones.
- UI1: a component unreachable from `src/app` fails the check — a mobile
  shell must be mounted the day it is written, or allow-listed with a reason.
- UI3: every `page.tsx` under `(dashboard)` must be rendered by a test; a
  mobile composition selected at runtime by viewport must be rendered in
  jsdom too (which cannot measure width — the selection mechanism must be
  test-controllable).
- §5.20: do not "stack every element into cards" or "add containers solely
  to create mobile grouping"; horizontal scroll is allowed for genuinely
  tabular data; drawers/sheets are sanctioned.

---

## I. Structural Constraints

| #   | Constraint                                                                                                                                                                                                                                                                                                                                                                                                                             | Classification                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **`MemberDetailModalMobile` is a fork of `MemberDetailModal`**: 7 duplicated `useMutation`s, its own delete/activate/reactivate sub-modals, no `MemberSmsHistory`, no `MarkPaidDialog` (records today's date on one tap), hand-rolled overlay with none of Radix's a11y. `MemberDetailModalResponsive` switches on `window.innerWidth` and renders `null` on the server. Any mobile rebuild that keeps two components keeps the drift. | **Potential architectural constraint** (the one real one)        |
| 2   | Mobile chrome (`MobileTopBar`, `MobileBottomNav`) are private functions inside `WorkspaceShell.tsx`; `MemberLimitBar` and `<main>` padding are hard-wired between them. Replacing the chrome means editing the shell, which is shared by every screen.                                                                                                                                                                                 | **Moderate UI refactor**                                         |
| 3   | Shell breakpoint is `lg` (1024): tablets in portrait (768–1023) get the phone chrome with desktop page compositions. The member sheet and Settings flip at 768. No single "is phone" decision exists.                                                                                                                                                                                                                                  | **Moderate UI refactor**                                         |
| 4   | `BillingSetupPageClient` keeps **both** trees in the DOM (`tablet:hidden` + `hidden tablet:block`): the hidden desktop `Tabs` mounts its active tab on phones (unseen fetch; a second copy when the same section is opened), and the mobile section lives in `useState` (no URL, no back button). The desktop tab state is Radix-internal.                                                                                             | **Minor UI refactor**                                            |
| 5   | `DataTable` has no row-renderer or column-priority concept; `Table` cells are `whitespace-nowrap` by default in headers. Screens pass `columns` arrays whose `cell` renderers are the reusable part.                                                                                                                                                                                                                                   | **Moderate UI refactor**                                         |
| 6   | `Modal` geometry (`top-24`, `max-h-[calc(100vh-96px)]`, `overflow-hidden` on the content with the scroll on an inner div) is a desktop placement baked into the primitive's base class, not a variant.                                                                                                                                                                                                                                 | **Minor UI refactor**                                            |
| 7   | Screens are `flex max-w-app flex-col gap-4` with `PageHeader` first; page actions live in `PageHeader.actions`. There is no slot for a fixed/sticky primary action, and `<main>`'s `pb-24` is the only accommodation of the bottom bar.                                                                                                                                                                                                | **Minor UI refactor**                                            |
| 8   | `Tabs` (Radix) triggers are `whitespace-nowrap h-9`; the `TabsList` has no overflow handling. Renewals' three badged tabs already exceed 342 px.                                                                                                                                                                                                                                                                                       | **Minor UI refactor**                                            |
| 9   | `stickyHeader` sticks to `TableContainer` (which is `overflow-x-auto`, hence a scroll container), never to the page. Mobile lists that scroll the page cannot use it.                                                                                                                                                                                                                                                                  | **Minor UI refactor**                                            |
| 10  | `BulkAddMemberModal` grid is `w-[1200px]` with per-column `w-[…px]` — the only component with hard desktop dimensions in its DOM.                                                                                                                                                                                                                                                                                                      | **Significant UI refactor** (or explicit "desktop-only" surface) |
| 11  | Inputs inherit 13 px `text-body`; the iOS zoom fix is a control font-size ≥16 px on phones, which contradicts the desktop density decision unless scoped by breakpoint at the token/primitive level.                                                                                                                                                                                                                                   | **Minor UI refactor** (token)                                    |
| 12  | No safe-area handling and no `viewport` export; `manifest.json` `background_color` is white and `start_url` is `/members`.                                                                                                                                                                                                                                                                                                             | **Minor UI refactor** (config, in scope as presentation)         |
| 13  | `/access-control` has no navigation entry (OPEN-1) — a mobile IA has to place it, which is a navigation change the previous directive forbade and this one must own.                                                                                                                                                                                                                                                                   | **No issue** (decision needed)                                   |
| 14  | UI3 requires jsdom rendering of every screen; jsdom has no layout, so any viewport-driven composition switch must be driven by something a test can set (a prop, a provider value, a media-query mock), not by reading `innerWidth` inside the component.                                                                                                                                                                              | **Moderate UI refactor** (design of the switch)                  |
| 15  | Business logic is not entangled with presentation: `useQuery`/`useMutation` blocks are colocated in screen components but call APIs, not Supabase; the members/payments services are behind routes. Nothing below the component layer needs to move.                                                                                                                                                                                   | **No issue**                                                     |
| 16  | Settings master/detail is route-based and already correct; Membership Setup is state-based. Two patterns for the same idea.                                                                                                                                                                                                                                                                                                            | **Minor UI refactor**                                            |

---

## J. Mobile Rebuild Surface

| Area                                                                                                        | Estimate        | What drives it                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell & navigation (top bar, primary nav, overflow/"more", account, back, safe area, banners)               | **High**        | New chrome, single nav source, a decision on which 3–5 destinations are primary, page-level back for overlays that become views.            |
| Members list                                                                                                | **High**        | List row composition (status-with-due as the primary signal), thumb-reachable Add member, filter/search placement, load-more vs pages.      |
| Member detail (unification + mobile view)                                                                   | **Very High**   | Collapsing two forks into one; re-ordering to put Mark Paid first; SMS history on mobile; confirm-before-money; sheet vs full-screen route. |
| Renewals                                                                                                    | **Very High**   | Row actions must be the visible primary; tabs must fit; Record payment path should not detour through the full member sheet.                |
| Dashboard                                                                                                   | **Medium**      | KPI band stays; chart axis; recent payments as a list; a real primary action.                                                               |
| Revenue                                                                                                     | **Medium**      | Chart axis; breakdown as a list with share bars; selects into a compact control.                                                            |
| Member Analytics                                                                                            | **High**        | Segmented controls, chart controls, cohort table (scroll with a pinned first column, or a different representation), page length.           |
| Announcements                                                                                               | **Low–Medium**  | Send confirmation; delivery log list; compose is fine.                                                                                      |
| Add / Edit / Reactivate / Day pass forms                                                                    | **Medium**      | Container (full-screen sheet), keyboard-safe footer, step layout; forms themselves unchanged.                                               |
| Bulk import                                                                                                 | **Investigate** | Product call: phone-capable redesign vs explicit larger-screen surface. Functionality must remain reachable either way.                     |
| Membership Setup                                                                                            | **Medium**      | Route the sections; stop double-mounting; inline-edit rows → edit sheet on phones.                                                          |
| Settings (all six)                                                                                          | **Low**         | Touch sizes; modal container for the security forms; Share instead of Print.                                                                |
| Door access + setup                                                                                         | **Medium**      | Navigation entry; activity list; device cards already stack.                                                                                |
| Support                                                                                                     | **Low**         | Touch sizes only.                                                                                                                           |
| Auth + `/join`                                                                                              | **Low**         | Already phone-first; align control sizes with whatever the workspace adopts.                                                                |
| Design-system additions (tokens, variants, DataTable row mode, Modal sheet mode, Tabs overflow, chart axis) | **High**        | Cross-cutting; everything above consumes it; must pass token parity, UI4 and the showcase page.                                             |
| Admin pages                                                                                                 | **Low / none**  | Not a phone surface.                                                                                                                        |

---

## K. Recommended Rebuild Strategy

No code here — the shape of the work, given what §B–§I found.

1. **Decide the phone boundary once, and make it test-controllable.** Today
   the app flips at 1024 (shell), 768 (member sheet, Settings, Drawer,
   Membership Setup) and in JS. The rebuild should declare one "phone"
   breakpoint in the token layer and expose the decision through a single
   provider/hook that a jsdom test can set — because UI3 will render every
   mobile composition in an environment that has no width. Whether tablets
   get the phone product or the desktop one is a product decision to make
   explicitly (see §L).

2. **Build the mobile experience as compositions, not as a second component
   library.** The primitives (L2) and composites (L3) are the right
   foundation and are locked by UI4. Mobile needs come in as _variants and
   props_ on existing primitives (a sheet/full-screen placement on `Modal`, a
   touch size tier on controls, an overflow mode on `Tabs`, a row-renderer or
   column-priority contract on `DataTable`, an axis-width prop on charts) and
   as a small number of genuinely new L3 composites with non-synonymous names
   (a mobile app bar, a primary/overflow navigation bar, a list-row
   composite for entity lists). Feature components (L4) then compose those.
   This keeps one implementation per pattern and keeps the desktop untouched.

3. **Replace the mobile chrome in the shell; keep `nav.ts` as the single
   navigation source.** Bottom navigation for the 3–5 daily destinations,
   the rest behind a "more"/drawer (the unused `Drawer` primitive is built
   for this), an account affordance, page-level back where an overlay
   becomes a view, safe-area padding, and a place for the subscription
   banners. Extend `WORKSPACE_NAV` with the metadata this needs (primary
   flag/ordering, and the `/access-control` entry that OPEN-1 is waiting on)
   rather than writing a second list.

4. **Unify member detail before touching its mobile presentation.** Fold the
   seven duplicated mutations and the sub-dialogs into one feature component
   (or hooks in `features/members`), with SMS history and `MarkPaidDialog`
   on both surfaces, and let only the container and section order vary by
   viewport. Delete `MemberDetailModalMobile` and the `innerWidth` switch as
   part of the same change. This is the highest-risk item and the one that
   most benefits from being done first, because Renewals, Members and the
   Dashboard all route into it.

5. **Treat entity lists (Members, Renewals, Collected, recent payments, SMS
   history, activity log, revenue breakdown) as one problem.** Each list has
   a primary line, a status signal, a numeric, and 0–2 row actions; the
   desktop `columns[].cell` renderers already encode the formatting. A single
   row composition fed by the same column definitions — with actions visible
   in the row, not off-screen — covers all of them and respects §5.20 (no
   card-per-row, hairline rows, mono numerics). Keep genuinely tabular data
   (cohort matrix, breakdown share bars if desired) as horizontally
   scrollable `Table`s with a pinned first column and a visible scroll cue.

6. **Forms keep their logic and change their container.** `react-hook-form`
   - Zod + the existing field markup stay; on phones the container is a
     full-height sheet with a keyboard-safe footer, and multi-step forms show
     one step per screen. Confirm anything that moves money or sends SMS.

7. **Route what is a view, overlay what is a moment.** Member detail and the
   Add-member flow are views on a phone (back button must work; a refresh
   must not lose them); confirmations remain dialogs; filters and "more"
   navigation are sheets. Membership Setup should follow Settings' route-based
   master/detail so both behave the same.

8. **Tokens first, then screens, in the order that pays down risk:** DS
   additions → shell → member detail (unified) → Members → Renewals →
   Dashboard/Revenue → Analytics → forms → Setup/Settings polish → door
   access → decide bulk import. Every step is renderable and screenshot-able
   on the same seeded E2E gym used here, and every step must keep UI1/UI3/UI4
   and the token-parity test green.

9. **Verification standard.** As with the overhaul: render every screen on a
   real phone viewport (including 320 px and standalone/PWA), measure
   overflow and target sizes with the same probe used for this audit, and
   have a human do the §9.1-style sign-off. jsdom tests prove a mobile
   composition mounts; they cannot prove it is usable.

---

## L. Questions / Unknowns

Only what inspection could not settle.

1. **Who is the phone user, and for what?** The audit assumed the gym owner
   at the desk (Members, Renewals, Mark Paid) — the login copy itself says
   "Gym operator access. Members use the mobile app." If staff on the floor
   are a target (check-in, day pass, remote door open), the primary
   navigation and the Renewals/Members priorities change.
2. **Tablet treatment.** 768–1023 px currently gets phone chrome with desktop
   pages. Phone product, desktop product, or a third layout?
3. **Bulk import on a phone.** Redesign (e.g. one-member-at-a-time repeat,
   or contact-picker import) or an explicit "use a larger screen" surface?
   §1 forbids removing it; it does not say it must be _good_ on a phone.
4. **PWA/standalone as a first-class target.** `manifest.json` says
   `standalone`; the visual and safe-area work is different if the app is
   expected to be installed (no browser chrome, home indicator, white splash).
5. **Print actions** (QR poster, billing history) — Share/Save on phones, or
   leave as is?
6. **Analytics cohort table** — is the full M0–M12 matrix needed on a phone
   at all, or is a summary (M1/M3/M6 retention) acceptable as the phone
   representation of the same data?
7. **Confirmation policy for one-tap side effects** (Remind sends an SMS;
   mobile Mark Paid records money). This is presentation, but it changes a
   click count, so it needs an explicit yes.
8. **Member detail as a route.** Making it a view with a URL touches routing
   architecture "only if necessary for UI navigation" — the audit's view is
   that back-button behaviour makes it necessary, but that is a call to
   confirm.

---

### Appendix — measurement snapshot (390×844, E2E Enterprise gym, 46 members)

```
/dashboard           scroll 390x1385  tables: recent-payments 4 cols 461px   small targets: 0
/members             scroll 390x1566  tables: members 7 cols 767px           small targets: 10 (search 220x32, select 176x32, 3 buttons 32h, pagination 32x32 ×5)
/revenue             scroll 390x1040  tables: breakdown 5 cols 577px         small targets: 2 (selects 32h)
/member-analytics    scroll 390x1846  tables: cohort 15 cols 1093px          small targets: 10 (segmented 26h)
/payment-collection  scroll 390x1120  tables: dues 4 cols 674px              small targets: 36 (tabs 36h, sort 16h, row buttons 26h)
/make-announcement   scroll 390x844   tables: log 4 cols 347px               small targets: 2
/billing-setup       scroll 390x844   (mobile menu)                          small targets: 0
/settings/*          scroll 390x844–1570                                     small targets: 4–8 (26–32h)
/access-control      scroll 390x866   (empty state)                          small targets: 6 (30–32h)
bottom nav           client 390 / scroll 754 / 9 items × 76px / 53.5px tall; visible: Dashboard, Members, Revenue, Member Analytics
sticky/fixed         top bar 52px sticky; bottom nav 54px fixed; DataTable thead sticky (ineffective on page scroll)
member sheet         fixed inset-0, 390x844, no role=dialog, Escape does not close, close button unlabelled
add-member modal     x16 y96 358x748 (flush with viewport bottom), 8 inputs, overflow inside
bulk-import modal    358x748, 22 inputs, 76 elements past the right edge, 1 table
```
