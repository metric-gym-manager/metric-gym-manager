# Workspace UI Overhaul — Inverted Check (Plan)

> **Premise.** Every phase of this overhaul reported green. That is the problem.
> The verification so far has been _confirmatory_ — it asked "did I do what the
> plan said?" and answered from the same greps that drove the work. This check
> is **falsifying**: it assumes each claim is wrong and tries to prove it, using
> a _different instrument_ from the one that produced the claim.
>
> A probe that reproduces my original method proves nothing. Where a claim came
> from a regex, the probe must come from the compiler, the compiled CSS, a
> render, or a manual read.

---

## 0. Why this is warranted — the instrument has already failed three times

| #   | Claim                                   | How it failed                                                                | Caught by           |
| --- | --------------------------------------- | ---------------------------------------------------------------------------- | ------------------- |
| 1   | "8 tokens unmirrored in `tokens.ts`"    | Extraction regex `[a-zA-Z]+` excluded digits, so `border1/2/3` false-flagged | A second look       |
| 2   | "`WorkspaceSidebar` still uses `mws-*`" | The match was a doc comment _describing_ the retired layer                   | `arch:check` itself |
| 3   | "`Tooltip` has 2 consumers"             | The match was **recharts'** `Tooltip` inside `Charts.tsx`                    | This log update     |

Three measurement errors in one session, all in the same direction: **the grep
said a thing existed or didn't, and it was wrong.** Every headline number in the
log rests on that instrument. That is the single largest risk to this work, and
probe group A exists to attack it directly.

---

## 1. Method

For each claim class: state the claim, state the **falsifier** (what must be
true for the claim to be false), then the probe. Probes are ranked by expected
yield — the ones most likely to find something real run first.

Rules for this check:

- **No probe may use the same method that produced the claim.**
- A probe that finds nothing is recorded as such. Absence of a finding is only
  meaningful if the probe could have detected the failure.
- Findings are graded: **BUG** (broken behaviour), **DEBT** (works, will cost
  later), **HOLE** (unverified, no evidence either way), **WRONG** (a stated
  assumption is false).

---

## 2. Probe groups, in priority order

### A — Behaviour regressions in the rewritten screens _(highest yield)_

**Claim:** §4.10 was honoured; the rewrites changed appearance only.
**Falsifier:** any capability present before and absent after.

Seven screens were rewritten wholesale: members, renewals, dashboard, revenue,
analytics, settings/gym, settings/policies, support, settings/layout, and both
admin pages. Nothing renders them in a test.

- **A1.** For each rewritten file, recover the pre-change version from git and
  diff the _capability surface_, not the markup: every state variable, event
  handler, API call, query key, mutation, prop passed to a child, and
  conditional branch. Anything in the old and not the new is a candidate BUG.
- **A2.** Specifically suspect: **`/members` sorting.** The old table had no
  sort. `DataTable` sorts **client-side**, over the 20 rows of the current
  server page. A user clicking "Name" now sorts one page and sees a result that
  looks global and is not. This is a defect _introduced_ by the migration.
- **A3.** `/renewals`: verify the SMS type mapping, the pending-button state,
  and that all three tab data sets still reach their tables.
- **A4.** `settings/gym`: the profile image moved into a `SettingsRow` control
  slot with a `tablet:w-72` cap. Verify it is not clipped.

### B — Test coverage of everything that changed

**Claim:** "Jest 1,357 passed" is evidence the migration is sound.
**Falsifier:** none of those tests render a migrated screen.

- **B1.** Enumerate which of the rewritten files are touched by any test. Expect
  near zero. Quantify the gap rather than asserting it.
- **B2.** Determine whether the E2E suite (`tests/`, Playwright) covers the
  rewritten flows, and whether it still passes — it was never run this session.
  E2E is the only layer that exercises real RLS and real rendering.

### C — The enforcement rules I added

**Claim:** the ratchets prevent regression.
**Falsifier:** a violation the rule does not catch.

- **C1.** Does the token rule catch **Tailwind arbitrary values** — `bg-[#fff]`,
  `text-[rgb(0,0,0)]`, `border-[--my-var]`? The selector matches named palette
  utilities and hex-in-`style` only. Strongly suspect **HOLE**.
- **C2.** Does it catch raw colour in `.css` files at all? It is an ESLint rule
  over `.tsx`. `globals.css` is unguarded — the file where the whole problem
  started.
- **C3.** Does UI1 detect a _chain_ of dead components in one pass, or does it
  need repeated runs? Phase 0.1b needed three iterations by hand.
- **C4.** Does UI2 survive its own success? The allowlist is empty; confirm the
  bidirectional half cannot now fail on an empty set.

### D — Dark-theme correctness

**Claim:** the palette is legible and WCAG AA.
**Falsifier:** any rendered pair below 4.5:1 for body text or 3:1 for UI.

Exactly **one** contrast ratio was calculated all session (`ink-muted` on
`surface-base`). Everything else was asserted.

- **D1.** Compute contrast for every semantic pair that actually renders: each
  ink on each surface, status text on base _and_ on its own tint, `brand-link`
  on base, `accent-text` on `accent`, placeholder on input. Arithmetic, not
  judgement.
- **D2.** Verify interaction states are _visible_, not merely present: the delta
  between `surface-base` and `surface-hover`/`-active`/`-selected` must exceed a
  perceptible threshold on the actual composited colour, since they are alpha
  overlays.

### E — Stated assumptions that were never tested

Each is a **WRONG** candidate.

- **E1.** "`Badge` is uppercase" — applied globally. Enumerate every `Badge`
  child in the app; any that renders a name, ID, email, or plan code is now
  shouting. Suspect real.
- **E2.** "Nothing consumed `colors.light` at runtime" — grep-derived.
- **E3.** "Removing `.mws-root` is safe" — it also carried custom scrollbar
  styling. Confirm `color-scheme: dark` actually compensates.
- **E4.** "`text-base` → 14px is safe" — 22 sites assumed to be headings.
- **E5.** "`getDaysUntilDue` matches the old inline expiry maths" — the new
  status indicator changed the calculation's source.

### F — Documentation now actively wrong

**Claim:** the docs describe the system.
**Falsifier:** a doc statement contradicted by the code.

- **F1.** `.claude/DESIGN_SYSTEM.md` still states **workspace = light**
  (§5), a 14-composite registry, `rounded-lg` cards, and a shadow scale that no
  longer exists. It is the "as-built contract" and is now false in several
  places. High-confidence **DEBT** bordering on **BUG** for future agents.
- **F2.** `instructions.md`, `README`, and any onboarding docs referencing the
  retired layer.

### G — Deleted-code regret

**Claim:** 4,170 deleted lines were unreachable.
**Falsifier:** a capability users had that is now gone.

- **G1.** For each deleted component, confirm the _feature_ it implemented is
  either still present elsewhere or was genuinely unreachable. `SMSHistoryModal`
  is the sharpest case: it was reachable only from a dead table, but SMS history
  may be a capability the product is expected to have.

### H — Things I changed without being asked

**Claim:** scope was respected.
**Falsifier:** a change outside the directive that nobody sanctioned.

- **H1.** The `Badge` API changed shape (`chip`, auto-dot). `StatCard`,
  `ChartCard`, `SettingsSection`, `StateLayouts`, `SideNav`, `Breadcrumb`,
  `TableRow` all gained or changed props. These are public L2/L3 API changes
  made unilaterally under a _visual_ directive.
- **H2.** The `COLLAPSE_KEY` rename discards a persisted user preference.

---

## 3. Deliverable

A findings table graded BUG / DEBT / HOLE / WRONG, each with the probe that
found it and the evidence. Findings feed back into
`workspace-ui-overhaul-log.md` §5 as open items; anything graded BUG is fixed
before this branch is proposed for merge.

**Explicitly out of scope:** §9.1 visual QA. It needs a human at the running
app, and no probe here substitutes for it.

---

# FINDINGS — PASS 1 (implementation), run 2026-08-30

Probes A2, B1, C1, C2, D1, D2 and E1 executed. **Eight findings, five of them
defects introduced by this overhaul.** The rest of the plan (A1, A3, A4, B2,
C3, C4, E2–E5, F, G, H) is not yet run.

| #   | Probe | Grade               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A2    | **BUG** _(fixed)_   | `/members` had sortable headers over a **server-paginated** table. `DataTable` sorts the array it is given — the 20 rows of the current page — so clicking "Name" sorted one page while appearing global. **I introduced this**: the old table had no sort at all. Removed the `sortValue` declarations; the list API offers four fixed orderings, not per-column sort, so there was nothing to wire a header to.                   |
| 2   | B1    | **HOLE**            | **Zero tests import or render any of the twelve rewritten screens.** Not one. The E2E suite (7 specs) covers access-control and subscriptions only. "Jest 1,357 passed" proves the code compiles and that unrelated logic still works — I cited it repeatedly as though it were evidence the migration is correct. It is not.                                                                                                       |
| 3   | C1    | **HOLE** _(fixed)_  | The token lint rule did not catch Tailwind **arbitrary values** — `bg-[#fff]`, `text-[rgb(0,0,0)]` — nor a hex smuggled through a `var()` fallback. A probe file using all three produced **zero output**. The entire token system could be bypassed with the gate green. Selectors added; re-probed.                                                                                                                               |
| 4   | C1    | **WRONG** _(fixed)_ | Consequently the claim **"raw colour: 150 → 0" was false.** It was zero only under an instrument blind to a whole class. The tightened rule immediately found **12 more** real violations in `verify-email`, `AuthShell` and `LegalLayout`. Now genuinely zero.                                                                                                                                                                     |
| 5   | D2    | **BUG** _(fixed)_   | **The interaction-state ladder was inverted.** `surface-selected` composited to L=0.0082 against `surface-active` at L=0.0115 — a _selected_ row rendered dimmer than one merely being pressed, contradicting §5.14's "strong active-state contrast". This is exactly the class of failure I named as the Phase 1 exit gate and then never measured. Raised to 0.30 and **encoded as a test**, since it is invisible to inspection. |
| 6   | D1    | **BUG** _(fixed)_   | `ink-muted` — which is the actual placeholder colour inside inputs — measured **4.05:1** on an input over a card, below AA. Lifted `#7d7d88` → `#85858f` (4.51 worst case, 5.07 on plain surfaces). A `Label`'s "(optional)" hint was using the _placeholder_ token at 3.03:1; moved to `ink-muted`.                                                                                                                                |
| 7   | E1    | **BUG** _(fixed)_   | `Badge` gained a global `uppercase`, and a device **serial number** was rendered in one — an identifier an operator cross-references against physical hardware, silently case-mangled. De-badged to mono text.                                                                                                                                                                                                                      |
| 8   | E1    | **DEBT** _(fixed)_  | The new auto-dot collided with 13 badges that pass their own icon, rendering **dot + icon + label** — two indicators for one state, against §5.21. Icons removed, orphaned imports pruned.                                                                                                                                                                                                                                          |

## What this says about the method

Every one of these came from **changing instrument**, never from looking harder
with the same one:

- A2 came from reading `DataTable`'s sort implementation instead of trusting
  that "migrated to the design system" meant correct.
- C1 came from writing a file designed to _evade_ the rule.
- D1/D2 came from arithmetic on composited colour. No amount of reading the
  token values would have shown an inverted ladder.
- E1 came from enumerating actual `Badge` children rather than reasoning about
  what a badge is for.

And the check caught the instrument failing **twice more while running**: a
coverage probe matched the word `page` in every test file, and an "unused
component" sweep counted **recharts'** `Tooltip` as the design system's. Both
were corrected before being recorded. That is now five measurement errors in
one session — the log's headline numbers should be read as _approximately_
right, not exact.

## Standing conclusion

The overhaul's **structure** holds up: the legacy layer really is gone, the
tokens really are synchronized, the composition audit really did drive the old
grammar out. What does not hold up is the **evidence I attached to it**. A green
gate meant far less than I implied, because nothing in that gate renders a
single migrated screen.

The highest-value remaining work is not more visual change — it is **B1**:
tests that actually render what was rewritten, and an E2E pass over the migrated
flows.

---

# FINDINGS — PASS 2 (capability & enforcement), run 2026-08-30

## A1 — Capability diff of every rewritten file vs `git HEAD`

Method: extract the _capability surface_ (state, handlers, `fetch` targets,
query keys, mutations, router calls, storage keys) from the old and new
versions and diff. Markup deliberately ignored.

| File                                                                   | Delta                         | Verdict                                                                                                                                                              |
| ---------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MembersPageClient`                                                    | `useState` 7→6, `onClick` 6→3 | **Explained.** The debounce pair (`inputValue`+`search`) collapsed into `SearchBar`; `Pagination` and `onRowClick` replaced hand-wired handlers. No capability lost. |
| `PaymentCollectionPageClient`                                          | `onClick` 4→3                 | **Explained.** The tab button's `onClick` became `Tabs.onValueChange`.                                                                                               |
| `WorkspaceHeader`                                                      | `useState` 1→0, `onClick` 1→0 | **BUG (fixed).** See below.                                                                                                                                          |
| gym / policies / layout / support / shell / sidebar / both admin pages | none                          | Clean.                                                                                                                                                               |

### FINDING A1-1 — **BUG** _(fixed)_ — desktop logout lost its re-entrancy guard

The old header held `isLoggingOut`, returned early on re-entry, disabled the
button and showed a spinner. `UserMenu` exposes **no pending state**, so the
rewrite fires `POST /api/auth/logout` on every click — a double-click sends two.

Worse, it was _inconsistent_: `MobileTopBar` kept its guard, so the two logout
paths silently diverged. Low blast radius (logout is idempotent and redirects),
but it is a §4.10 behaviour regression and exactly what a capability diff exists
to catch.

Fixed with a `useRef` guard in `WorkspaceHeader`. The deeper issue — `UserMenu`
having no way to express a pending action — is left as **DEBT**.

---

## A3 — Renewals capability diff · CLEAN

`reminderType`, all four SMS type strings, `pendingId`, `smsType`,
`invalidateQueries` and the `regular-payments` query key are present in
identical counts. No loss.

## A4 — `ProfileImageUpload` inside a `SettingsRow` · CLEAN

Intrinsic width is a 96px avatar in a `flex items-center gap-4` row; the row's
`tablet:w-72` (288px) accommodates it. Not clipped.

---

## C3 — UI1 chain detection · **DEBT → fixed, then the fix was wrong twice**

The probe (two components, one importing the other, neither reachable) confirmed
UI1 reported **only the head of the chain**. It counted references rather than
computing reachability, which is why Phase 0.1b needed three manual iterations.

Rewritten as a real module-graph walk from `src/app`. Then the probe caught the
rewrite being wrong — **twice**:

1. **Barrels made everything reachable.** Importing `@/components/ui` marked all
   32 primitives live. Traded under-reporting for over-reporting. Fixed by
   making barrels transparent: named imports resolve to the module that actually
   exports them.
2. **A type-only import pulled the whole barrel.** `memberStatusIndicator.ts`
   does `import type { BadgeProps } from '@/components/ui'`; the regex captured
   `type` as a _default import name_, skipped the named-import path, and marked
   the barrel — and therefore every primitive — reachable. Type-only imports are
   erased at build time and now create no edge at all.

A third, smaller error: the dev showcase was an entry point, so it kept the
whole library alive.

**Net result:** UI1 is now a genuine reachability check, made bidirectional
(a reachable component sitting in the allowlist is a stale exemption), and the
allowlist fell from **24 → 14**. It also found two orphans the manual audit had
missed — see F/G below.

> Debugging note worth keeping: my first trace of this was itself invalid —
> I copied the script to `/tmp`, where `SRC` resolved to `/src`, so every
> reachability answer came back vacuously `false`. Sixth measurement error.

## C4 — UI2 with an empty allowlist · CLEAN

The reverse loop iterates the empty Set and cannot fire. Safe.

---

## E3 — Scrollbar styling after `.mws-root` removal · **ACCEPTED**

The custom `::-webkit-scrollbar` rules did go with the block. `color-scheme:
dark` is set on the token scope, so browsers render native dark scrollbars.
Acceptable; recorded so it is a decision rather than an oversight.

## E4 — `text-base` → 14px · **ACCEPTED**

All but three sites are `font-semibold` headings, where 14px is the `h3` size.
The three exceptions are `JoinForm` inputs, which drop 16px → 14px. On-scale and
deliberate; noted because it affects a public mobile form.

## E5 — Day maths · **BUG (fixed)**

The old inline expiry used `Math.ceil` on raw timestamps; `getDaysUntilDue`
normalises both dates to midnight and uses `Math.floor`. Compared empirically
across 96 time/offset combinations: **16 diverge.**

The important divergence is not the off-by-one. A member still flagged `active`
whose due date has **passed** produced `-0` under the old maths, which passed a
`days >= 0` test and rendered amber "Expires soon". The new maths returns a
clean negative, which fell through to **green "Active"** — an overdue member
displayed as healthy, which is precisely the signal the front desk acts on.

Added an explicit `days < 0 → error "Overdue"` branch, with a regression test
that spells out the history.

---

## F1 — `.claude/DESIGN_SYSTEM.md` · **WRONG (fixed)**

The "as-built contract" still asserted `[data-theme='light']` + `.mws-root` as
the **App Workspace** surface and that `WorkspaceShell` stamps
`data-theme="light"`. Both are false — the light block and `.mws-root` are
deleted and the shell stamps `dark`. A future agent reading the authoritative
design document would have been told the opposite of the truth.

§5 now carries a SUPERSEDED banner pointing at the directive and ruling R2, and
the surface-wrapper line is corrected.

## F2 — Other docs · **DEBT (open)**

`docs/architecture/legacy-ui-migration.md` and
`docs/architecture/feature-gaps-app-workspace.md` still describe the retired
layer as current. Historical by nature, but neither says so. Unfixed.

## G1 — SMS history · **HOLE (pre-existing, now visible)**

`GET /api/members/[id]/sms-history` and `sms-history.service.ts` are **live and
have no UI consumer**. `SMSHistoryModal` was the only caller, and it was
reachable solely from the already-dead `PaymentRemindersTable`.

So the capability was lost _before_ this overhaul — my deletion removed the
vestige, not the feature. But the finding stands: a gym cannot view a member's
SMS history anywhere in the product, while the endpoint, the service and the
Text.lk delivery-status webhook that feeds it all still run. **Not a UI-directive
problem; a product gap that should be raised separately.** The endpoint also has
no test.

## Additional finding — `Toaster` bypassed the design system · **BUG (fixed)**

Surfaced by the reachability rewrite: `app/layout.tsx` imported `Toaster`
directly from **sonner**, so the DS `Toast.tsx` wrapper — fully token-styled,
theme-aware, 5s auto-dismiss per spec — was never mounted. Every toast in the
product rendered with sonner's own palette (`richColors`), unaffected by the
dark retune.

Switched to `@/components/ui`; `richColors` dropped because it re-applies
sonner's colours over the token classNames. Verified `bg-solid` and
`text-solid-text` resolve.

## H — Unilateral API changes · **DEBT (accepted, recorded)**

Made under a directive scoped to _visual_ correction: `Badge` (`chip`, auto-dot,
global uppercase), `StatCard`/`ChartCard`/`SettingsSection`/`StateLayouts`
(`boxed`/`bordered`), `SideNav` (`linkComponent`), `Breadcrumb`
(`BreadcrumbItem`), `TableRow` (keyboard activation), plus a new `readout` type
token and an `h-bar` layout utility.

Each is defensible individually and §7 explicitly sanctions extending
primitives. Collectively they are a public L2/L3 API expansion that nobody
approved. Recorded so it is visible rather than discovered later.

`COLLAPSE_KEY` was also renamed, discarding a persisted user preference — noted
at the time, restated here.

---

# FINDINGS — PASS 3 (premises), run 2026-08-30

> **Hypothesis for this pass: everything implemented, assumed and understood was
> wrong.** Passes 1 and 2 attacked the implementation — did the code do what the
> plan said. This pass attacks the _premises_: was the plan itself built on
> things I never checked? No probe here is allowed to conclude "fine, as
> expected"; each had to try to break a belief I had been operating on.

The pass found the most consequential defect of the entire overhaul, and it was
sitting in plain sight for eleven phases.

---

## P1 — **BUG (fixed)** — the document body was white the entire time

**The belief:** "the workspace is dark" — asserted since Phase 1, backed by
compiled-CSS evidence that `--ds-surface-base` is `#08080a`.

**The reality:**

```css
body {
  @apply bg-background text-foreground; /* shadcn light: 0 0% 100% */
  background-color: var(--bg-primary); /* Apple-era light: #ffffff */
  color: var(--text-primary); /* #1d1d1f */
}
```

The `body` element **was never on the token system at all.** Every shell painted
a dark surface _over_ a white document. The consequences:

- Overscroll / rubber-banding exposed white.
- Anything inheriting the body colour rendered `#1d1d1f` text — near-black on a
  near-black ground, i.e. invisible.
- Any route without its own dark wrapper rendered light.

I verified the _tokens_ were dark and concluded the _app_ was dark. Those are
different claims, and I never tested the second one. Phase 1's exit gate — which
I wrote myself — asked whether interaction states survived the flip; it did not
ask whether the page behind them had.

Fixed: `body` now takes `--ds-surface-base` / `--ds-text-primary`. Confirmed in
both the dev-served stylesheet and the production build.

## P2 — **BUG (fixed)** — I never once loaded the application

Across every phase I cited `next build` as evidence. A build is a _compile_. In
this pass I finally started the server and requested pages:

| Route                    | Result                                |
| ------------------------ | ------------------------------------- |
| `/`                      | 200, 110 KB, no runtime-error markers |
| `/login`                 | 200, carries `data-theme="dark"`      |
| `/join/testtoken`        | 200                                   |
| `/dashboard`, `/members` | 307 → `/login` (expected — auth)      |

Nothing was broken, which is a genuine relief and _not_ something I had earned
the right to assume. It also immediately produced P3.

## P3 — **WRONG** — `/contact` and the legal pages are behind authentication

`PUBLIC_ROUTES` contains `/`, `/login`, `/register` and the auth callbacks.
It does **not** contain `/contact`, `/terms`, `/privacy` or `/refund-policy`.
All four `307 → /login?redirect=…` for a logged-out visitor.

This falsifies my own reasoning for **R5**. I argued for widening scope on the
grounds that _"`/contact` is a public marketing page rendering white while every
other marketing page is dark"_ — a brand-discontinuity argument that assumed
anyone could see it. Nobody can, unless they already have an account.

Worse than the aesthetic point: **terms of service, privacy policy and refund
policy are unreachable to the public.** Payment providers and app stores
generally require those at public URLs. This is a pre-existing product/routing
defect, entirely outside the visual directive, and it should be raised on its
own. I have not changed routing.

_The lesson is about me, not the router:_ I built a scope argument on an
unverified premise about who could reach a page, and nobody — including me —
checked it for two full passes.

## P4 — **DEBT (fixed)** — "selected" meant three different colours

Unifying the design system was the whole point, and selection was fragmented:

| Component                    | Selected treatment               |
| ---------------------------- | -------------------------------- |
| `SideNav`, settings sub-nav  | `surface-selected` (indigo 0.30) |
| `Table` row selection        | `accentui-bg` (indigo 0.16)      |
| `CommandPalette` active item | `surface-hover` (white 0.055)    |

And I **widened the gap myself**: raising `surface-selected` from 0.18 → 0.30 in
the pass-1 contrast fix moved navigation further from table rows without my
noticing they used a different token.

`Table` now uses `surface-selected`. `CommandPalette` is left alone — its
`data-selected` is the keyboard-highlighted item, which is semantically a hover,
not a persistent selection.

## P5 — **ACCEPTED, but my recommendation was under-argued** — ruling R2

I recommended "dark only" and framed the trade-off as _cost_: retaining light
"doubles Phase 3 verification for a variant that is not the product identity."

The directive's own Appendix says light may remain **"for accessibility, user
preference, or future requirements."** I quoted that sentence and then argued
past it on schedule grounds. Dark-only is defensible — there was no theme
mechanism to preserve, and a gym floor is not obviously a bright-light
environment — but _accessibility_ is not a cost line, and I presented it as one.

The decision stands (it was ruled on). The reasoning I offered to support it was
weaker than I made it sound, and re-introducing light later against a clean dark
baseline is now a real piece of work, not the trivial thing I implied.

## P6 — **DEBT** — the `readout` token changed nothing visually

OPEN-4 was closed by adding a `readout` type token at **24px** — the same size
as the `text-2xl` it replaced. It is a genuine improvement in _semantics_ (the
value is on the scale, named for its role, and `text-2xl` is gone from the
design system). It is **not** a visual change, and closing OPEN-4 implied a KPI
readout had been designed. It had not; only the band around it had.

## P7 — **HOLE** — `EmptyStateLayout`'s defaults were changed and are untested

Pass-3 check on my own de-containment: I flipped `EmptyStateLayout` from
`bordered = true` to `false` and `minHeight` 320 → 240. The component has **zero
consumers**. So a default nobody uses was changed on the strength of a directive
reading, and nothing anywhere exercises it. Harmless today; a trap for whoever
first mounts it expecting the documented behaviour.

---

## What pass 3 says that passes 1 and 2 did not

Passes 1 and 2 found defects _inside_ the work. Pass 3 found that two of the
foundations were never checked at all:

1. **I verified tokens and inferred the application.** The body being white for
   eleven phases is the purest example — every measurement I took was correct,
   and the conclusion I drew from them was wrong.
2. **I verified compilation and inferred execution.** Eleven phases of "gate
   green" without once loading a page.

Both are the same error in different clothes: **checking the thing I built
instead of the thing the user sees.** Every probe in this document that found
something did so by moving one step closer to the rendered product — from grep,
to compiler, to compiled CSS, to arithmetic on composited colour, to an HTTP
request. The remaining step is the one no probe can take:

> **§9.1 visual QA is still outstanding, and pass 3 raises its priority rather
> than lowering it.** The strongest evidence in this document is that the app
> responds `200`. That is a very long way from "the perceived product category
> has moved", which is the directive's actual definition of done.

## Consolidated open items

| #   | Item                                                                                                         | Owner                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 1   | **Zero tests render any rewritten screen** (pass 1, B1)                                                      | Highest-value remaining work             |
| 2   | **Legal + contact pages unreachable to the public** (pass 3, P3)                                             | Product/routing — outside this directive |
| 3   | **SMS history: live endpoint, no UI** (pass 2, G1)                                                           | Product gap — outside this directive     |
| 4   | `legacy-ui-migration.md`, `feature-gaps-app-workspace.md` describe the retired layer as current (pass 2, F2) | Docs                                     |
| 5   | `EmptyStateLayout` defaults changed, unused, untested (pass 3, P7)                                           | Trivial                                  |
| 6   | **§9.1 visual QA**                                                                                           | Requires a human at the running app      |

---

# FINDINGS — PASS 4 (visual QA), run 2026-08-30

The pass every earlier one deferred, and the one pass 3 said was the only
remaining step. Driven through Playwright (already a dev dependency, already
configured on port 3100 to avoid exactly the port-3000 collision that blocked
the first attempt) against the running dev server, authenticating with the
seeded E2E enterprise gym. Eight screens captured at 1440×900 and **looked at**.

## What held up

The operational grammar works. Dark canvas with hairline structure, uppercase
tracked metadata labels, the KPI band separated by vertical dividers rather than
four floating tiles, `● ACTIVE` as a dot-and-label, mono tabular numerics
right-aligned, and settings rendering as §5.18 describes — section header,
hairline, aligned label/control rows, no nested cards. The sidebar's active item
is clearly visible on the dark ground, which was the Phase 1 exit gate.

## V1 — **BUG (fixed)** — the members toolbar rendered on three rows

Search on one row, the status filter on a second, the buttons on a third, in a
1440px viewport with ~1150px of content width.

`Select` wraps itself in a hardcoded `<div className="relative w-full">`. A
width passed via `className` lands on the inner `<select>`; the wrapper still
claims the entire flex line. Sized the container instead.

**This is the important one**, not because it is severe but because of what it
says: `tsc`, `eslint`, `arch:check` and 1,359 tests all passed with the primary
screen's toolbar in three pieces. No check in this repository could see it.

## V2 — **BUG (fixed)** — a string `empty` was worse than no `empty`

`DataTable.empty` is typed `ReactNode`, and a string fell straight into the
`<td>`: unpadded, left-aligned, reading as a second header row. Passing nothing
renders a properly centred `EmptyState` — so the documented, typed usage was
strictly worse than omitting the prop. A trap in the API, hit by all four call
sites the migration created. Strings are now normalised into the `EmptyState`.

## V3 — **BUG (fixed)** — "1 records"

## V4 — **OPEN, for a human** — two stacked indigo fills

On `/settings` the sidebar's "Settings" item and the sub-nav's "Gym Information"
item are both filled `surface-selected`, one inside the other. Each alone reads
as system state; together they are a lot of indigo for a palette whose whole
argument is restraint.

This is a **direct consequence of my own fix**: raising `surface-selected` from
0.18 → 0.30 to correct the inverted ladder (pass 1, D2) also made it more
saturated, and §5.14 warns the selected item should read "as a system state, not
a large colourful pill." I have already changed this token twice on arithmetic;
whether 0.30 is right is a judgement about the rendered result, and it belongs
to whoever does the §9.1 sign-off.

## V5 — **DEBT** — pre-existing hydration mismatch on `/login`

React reports a server/client attribute mismatch on the password field:
`style={{paddingRight:52}}` serialised as `padding-right:"52px"`. Present in
`AuthShell`/login, unrelated to this overhaul, and worth its own fix.

## What pass 4 changes about the conclusion

Pass 3 ended by saying the strongest evidence in this document was that the app
responds `200`, and that visual QA was the one step no probe could take. That
was wrong in one respect: **the step was available the whole time.** Playwright,
Chromium and seeded credentials were all already in the repository. The blocker
was never tooling; it was that I kept treating "the gate is green" as the end of
the work.

Three real defects surfaced within minutes of actually looking, and none of them
was findable by any automated check that exists here. §9.1 sign-off still needs
a human — "has the perceived product category moved" is not a thing a screenshot
answers — but the mechanical half of visual QA is now done, and it should be
done _first_ next time, not last.

---

# FINDINGS — PASS 5 (close-out), run 2026-08-30

Ran the visual pass **first**, which is what pass 4 concluded should happen.
Then closed the consolidated open items.

## The consolidated table, resolved

| #   | Item                                        | Outcome                                                                                                                                    |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Zero tests render any rewritten screen (B1) | **CLOSED.** 0 of 12 → **12 of 12**; 1,357 → 1,457 tests.                                                                                   |
| 2   | Legal + contact behind auth (P3)            | **RAISED**, not fixed — log OPEN-5. Needs a routing decision.                                                                              |
| 3   | SMS history: live endpoint, no UI (G1)      | **RAISED**, not fixed — log OPEN-6. Needs a product call.                                                                                  |
| 4   | Docs describing the retired layer (F2)      | Still open; historical by nature.                                                                                                          |
| 5   | `EmptyStateLayout` defaults (P7)            | Still open; trivial.                                                                                                                       |
| 6   | §9.1 visual QA                              | **Mechanical half done twice over.** The judgement half still needs a human.                                                               |
| —   | V4 — two stacked indigo fills               | **RULED** (log R7). Sub-nav marks position with a rule; fill is reserved for persistent selection. Token unchanged at 0.30, ladder intact. |
| —   | V5 — `/login` hydration mismatch            | **NOT A DEFECT.** See below.                                                                                                               |

## V5 — the finding was a `next dev` artifact

Pass 4 recorded a server/client attribute mismatch on `/login`. Four instruments,
each stronger than the last, say there is nothing there:

1. `/login`, `/register`, `/verify-email`, `/` → **zero** console errors,
   warnings or page errors, in a cold browser context and again after reload.
2. The SSR stream emits `style="padding-right:52px"` — byte-identical to what
   React computes on the client. There is nothing to mismatch.
3. The error **is** reproducible, but only by forcing a recompile: warm load of
   `/settings/security` → 0 errors; `touch` the page file, reload → 1 hydration
   error. `next dev` streamed HTML from the pre-recompile module graph.
4. **A production build serves 12 workspace routes with zero hydration errors.**

Recorded at length because "I could not reproduce it" is a much weaker claim
than a deliberate reproduction plus a production build that refutes it.

## Two more failures of the instrument, both mine, both this session

The tally in §0 is now **eight** measurement errors across this work.

**7. A screenshot suggested a difference that did not exist.** I read the
`/payment-collection` empty table as sitting in a bordered box while `/members`
did not, and was about to file it. Computed styles: both wrappers are
`rounded-sm border border-line-1 bg-surface-card`, radius 4px, identical. The
eye is an instrument too, and it also needs checking against a stronger one.

**8. A test of mine passed against the defect it existed to catch.** The logout
re-entrancy test clicked "Sign out" three times and asserted one POST. It passed
with the `useRef` guard **deleted** — Radix closes the menu on select, so clicks
two and three hit a detached node. This is precisely the failure this whole
document is about, reproduced inside the fix for it.

The countermeasure that caught it generalises: **every assertion guarding a
known defect was falsified before being trusted** — mutate the source to
reintroduce the defect, and require the test to fail. Nine mutations run; the
discipline paid three times (the vacuous logout test above, a mutation that was
a no-op because `twMerge` strips the losing background, and two tests rendering
nothing at all behind an incomplete mock).

## What pass 5 changes about the conclusion

Pass 4 said the mechanical half of visual QA should be done _first_ next time.
It was, and it took about two minutes to find a real defect ("Trailing 1 months")
plus the V4 evidence.

The remaining gap is no longer evidence. It is the one question none of these
instruments can answer: whether the perceived product category has moved.

---

# Pass 6 — the enforcement layer itself · 2026-09-09

Passes 1–5 checked the product against the rules. This one checks **the rules
against themselves**: the ratchets added on 2026-09-09 (UI3/UI4/UI5, off-scale
type + radius, third-file token parity) and the six screen tests written the
same day. A gate nobody has attacked is a claim, not a check.

Method: for every rule, ask its question a second way and see whether the two
answers agree. For every test, mutate the source until it fails.

## Findings

### 6.1 — UI3's own filter silently exempted a class of screen · **BUG (fixed)**

The rule matched `^src/app/\((dashboard|admin)\)/.*\/page\.tsx$`. The `.*\/`
requires at least one path segment between the route group and the file, so
every route-group **root** page was invisible to it. `src/app/(dashboard)/page.tsx`
— where an authenticated user lands on `/` — was exempt with the gate green.

Found by re-implementing UI3's question over _every_ `page.tsx` and diffing the
two answers, rather than reading its filter. The probe said one screen was
uncovered; `arch:check` said all were. Both could not be right.

Fixed to `(.*\/)?page\.tsx$`, and the page it was hiding now has a test — the
redirect target is a bare string, and pointing it at a dead route breaks the
first screen after login with nothing to notice.

### 6.2 — Rules & Terms silently destroyed the gym's Terms of Service · **BUG (fixed)**

The draft state was one whole `GymPolicies` object overlaying the fetched one.
Typing into Rules **before the GET resolved** built a draft carrying
`gym_terms: ''`, and because a non-null draft masked the response for the rest
of the session, Terms rendered empty and Save PATCHed that empty string over the
real document — the one members legally agree to at registration.

Reachable by any operator who types faster than the network. Found on the first
day this screen had a test at all, which is precisely what ruling B1 predicted.
Fixed to a per-field `Partial` overlay; the regression guard fails against the
old implementation.

### 6.3 — "Off-scale type is at zero" was false twice · **WRONG (rule now sees it)**

- Six `text-[10px]` in `AnnouncementProgress`, found the moment the className
  rule existed. Exempted under R6 (mobile), guarded by UI5.
- **Far more the rules could not see at all.** First counted as "thirteen";
  that number was itself wrong, produced by a regex that stopped at the first
  `}` inside a `style={{...}}`. The real figure is **95 violations across 8
  files** — every one in the auth/legal surface, none anywhere else.

The measurement was never wrong about what it counted. It counted `className`.

**Closed 2026-09-09**: two selectors added (inline-style
fontSize/lineHeight/letterSpacing/fontWeight/borderRadius, and named CSS colour
keywords), scoped to `name.name="style"` so recharts' `contentStyle`/
`wrapperStyle` SVG props are untouched. The 8 auth/legal files carry a
documented exemption — that surface runs its own `--ma-*` system and retheming
it is a project, not a lint fix — and UI5 now fails if any exemption outlives
its file or its need.

### 6.4 — The token rules see `className`, and only `className` · **HOLE (mostly closed)**

Four evasions written and run. Three work:

| Evasion                                     | Result |
| ------------------------------------------- | ------ |
| `style={{ fontSize: 13, borderRadius: 7 }}` | EVADES |
| `style={{ color: 'red' }}` (named colour)   | EVADES |
| `className={'bg-' + 'red-500'}`             | EVADES |
| `className={['text-[11px]'].join(' ')}`     | CAUGHT |

The inline-style rule only fired on `#hex` or `rgb(`, so a named CSS colour
passed; and nothing inspected numeric style values. The block was also scoped to
`**/*.tsx`, so a `.ts` module holding class strings escaped entirely.

**Closed 2026-09-09** for the first two rows and the `.ts` gap (scope is now
`**/*.{ts,tsx}`). The concatenation case stays **open and accepted**: neither
`'bg-'` nor `'red-500'` matches a palette pattern on its own, and a rule that
fired on either fragment would be noise. It is also the one form nobody writes
by accident.

### 6.5 — UI4 matches filenames, not exports · **HOLE (fixed)**

`export function Card()` inside `MemberPanel.tsx` produced zero violations. The
rule caught the honest fork (`Card.tsx`) and missed the disguised one — which is
the shape a fork actually takes once someone knows the rule exists.

**Fixed 2026-09-09**: UI4 now checks the filename AND every PascalCase export
against the design system's barrel names. Falsified against exactly that case.

### 6.6 — UI3 guards the workspace only · **HOLE (closed for auth)**

19 screens under `(dashboard)`/`(admin)` are gated and covered. **13 are not
gated at all, and 12 of those have no test**: all five `(auth)` screens, the
landing page, `/contact`, `/terms`, `/privacy`, `/refund-policy`, `/demo-sms`
and the dev showcase. `/join/[token]` — the public registration funnel — is the
only ungated screen that happens to be covered.

Login and register are where a mount failure locks every user out of the
product. They are outside the workspace directive's scope, which is why the rule
stopped there; that is an explanation, not a justification.

**Closed 2026-09-09 for `(auth)`.** All five auth screens were written tests and
the rule now covers `(dashboard|admin|auth)` — 24 of 32 `page.tsx` files. The
login suite pins the two directives that meet there: §2.15's full-document
navigation (asserting `router.push` is NOT called), and `getSafeRedirect`
against an absolute URL, a protocol-relative URL and a `javascript:` URL. All
three hostile redirects are correctly refused.

Still ungated: the landing page, the four legal/marketing routes, `/demo-sms`
and the dev showcase. `/join/[token]` is covered but not gated.

### 6.7 — A third token namespace exists · **FINDING (now tested)**

`globals.css` declares 44 `--ds-*` variables and **14 `--ma-*`** ones for the
auth surface. `token-parity.test.ts` checks the 44. "One design system" is true
of the workspace; the auth screens run their own, styled with inline numeric
type against `var(--ma-*)`, which is why 6.3's population lives there.

**Closed 2026-09-09**: `token-parity.test.ts` now walks the whole source tree
and fails on any `var(--ds-*)`/`var(--ma-*)` reference that globals.css does not
declare — inline styles included, which no earlier check read. A companion
assertion fails if either namespace parses as empty, so a restructure of
globals.css cannot make the check vacuous.

### 6.8 — Clean

- **No dangling CSS variables.** All 27 `--ds-*`/`--ma-*` references resolve to
  a declaration. Checked because 6.3 made it plausible they would not.
- **The `reachableFrom()` extraction is behaviour-preserving.** The pre-refactor
  script and the current one produce identical UI1 output against an injected
  two-deep dead chain, and identical output on a clean tree.
- **Nine mutations, nine caught.** One per screen test plus the reset-crosswire
  and price-transposition cases. No test passed with its defect reintroduced.

## What this pass says about the method

**Two of the three probes were wrong before the code was.** Running the
pre-refactor script from a scratchpad made it resolve `ROOT` to the wrong
directory and bail on `src/features/ does not exist` — which read exactly like
"the old rule never worked". And the first data-loss probe waited on the draft
value, which was already on screen, so it settled before the query resolved and
"failed" against the fix that had just made it pass.

Both would have produced a confident, wrong finding written up as fact. The only
thing that caught them was that the result was _too_ interesting: a rule that
had never worked, and a fix that did not fix. Surprise is the signal to re-check
the instrument, not to start writing.

The standing conclusion from Pass 5 holds and now cuts at the rules too: **an
instrument nobody has tried to fool is a claim.** Every gate here that was
attacked leaked somewhere.

## 6.9 — New findings from the fixing pass

Fixing the above surfaced two more, plus two more wrong probes.

- **`verify-email` prints its error message twice** · **FIXED**. On
  `status === 'error'` the message rendered as the subtitle paragraph _and_
  again in the alert below it. The error state now has its own fixed subtitle
  and the alert is the sole carrier of the server's reason. **Verified in a
  browser**, not only in jsdom — before: `Verification failed` / `Invalid or
expired verification link` / `Invalid or expired verification link`; after:
  `Verification failed` / `We couldn't confirm this link…` / `Invalid or
expired verification link`. The test asserts _exactly one_ occurrence and
  fails when the duplicate branch is restored.
- **`reset-password` navigates with `router.push`** · the finding was wrong,
  and what it was sitting on top of was far worse — see 6.10.

**And two more probes that were wrong before the code was**, bringing this
pass's total to four:

- The login validation test asserted a Zod message for a malformed email. jsdom
  implements `type="email"` constraint validation, so the form never submits and
  the Zod branch is unreachable — in a real browser too. Rewritten to assert
  what actually happens (no request), plus a case native validation _does_ let
  through (empty password) to reach the Zod handler.
- The register strength-meter table was built on arithmetic done in my head:
  `abcdefgh` was called FAIR when it scores 2 (WEAK), `Abcdefgh` GOOD when it
  scores 3 (FAIR). Recomputed from the function, then pinned at all five
  boundaries.

Both would have been written up as defects in the product. **Four wrong probes
against two real product bugs is the honest ratio for this pass**, and it is the
argument for running the instrument against a known-good case before trusting
what it says about a suspect one.

## 6.10 — Password recovery was broken end to end · **BUG (fixed)**

Chasing the harmless-looking `router.push` in 6.9 turned up the real defect one
layer down. `AUTH_ROUTES` — "auth routes that authenticated users shouldn't
access" — contained `/reset-password`. But recovery is **session-bearing**:

1. The emailed link hits `/auth/callback?type=recovery`.
2. The callback calls `verifyOtp`, which **writes the auth cookies**.
3. It then redirects to `/reset-password`.
4. Middleware sees `isAuthenticated && isAuthRoute` and returns
   **`307 → /dashboard`**.

So a gym owner clicking "reset my password" was silently signed in and dropped
on the dashboard. The form never rendered and the password never changed. The
guard and the flow contradicted each other outright: `resetPassword()` calls
`getUser()` and refuses _without_ a session, while the router refused the page
_with_ one.

`/verify-email` is the standing precedent — public, session-bearing, and
deliberately absent from `AUTH_ROUTES`. `/reset-password` now matches it.

**Why nothing caught it.** The page component mounts perfectly in isolation and
now has seven passing tests, none of which touch middleware. `tsc`, ESLint,
`arch:check` and 1,673 tests were green across a completely broken flow — the
same shape as every other defect in this document. Middleware had **no test of
any kind**; it now has one pinning all four routing decisions.

**Proven, not reasoned.** The claim came from running `authMiddleware` against a
mocked authenticated user and reading the response: `307 → /dashboard`. After
four wrong probes earlier in this pass, reading the branch and inferring the
outcome would not have been good enough.

**Second-order fix.** With the route reachable, the user finishes the reset
_still holding_ the recovery session — so `/login?reset=success` would tell
someone already signed in to sign in. The screen now `POST`s `/api/auth/logout`
and hard-navigates, matching what `verify-email` already does after an email
change. That makes it a genuine auth-boundary navigation, so **§2.15 applies and
`router.push` was wrong after all** — the opposite of what 6.9 first recorded.

**Still unverified**: the real email round-trip. Minting a genuine Supabase
recovery token is out of reach here. The middleware test pins the exact hop that
broke; one real reset link should be clicked before this is called done.

---

# Pass 7 — the password-recovery repair · 2026-09-12

Two phases, each inverted-checked before the next began. Fourteen mutations, all
caught. The checks found one real test weakness, one hole created during the fix
itself, and **a third production bug of the same family as the one being fixed**.

## 7.1 — Phase 1: a test that passed by way of a crash · **WEAK TEST (fixed)**

`resetPassword`'s guard is `verifyError || !data.user`. The test named after the
second half — "treats a success-shaped response with no user as a failure" —
asserted only `success === false` and `updateUser` not called. Deleting
`|| !data.user` still satisfied both: the function crashes on `data.user.email`,
lands in the outer catch, and returns a failure. **The test was verifying the
crash, not the guard.** It now asserts the exact message, which is what tells
the two paths apart.

## 7.2 — Two probes wrong before the code was · **METHOD**

Of the first four Phase 1 mutations, two were bad probes:

- `await supabase.auth.signOut()` occurs **twice** in `auth.service.ts`. A
  `replace(old, new, 1)` mutated a different function 155 lines earlier, so the
  test correctly did not fail. Fixed by scoping the mutator to the body of the
  function under test.
- A mutation meant to sign out on the failure path was inserted _after_ the
  early `return` — unreachable, so it changed nothing.

Both first read as "the test is weak". The tell was the same as in Pass 6: a
result too interesting to accept without re-checking the instrument. Running
tally for this document is **six wrong probes against six real defects**.

## 7.3 — Phase 2 created a hole, then closed it · **CAUGHT IN REVIEW**

Legacy recovery links were first redirected to
`/forgot-password?error=link_expired`. That screen never reads query params, so
the explanation would have vanished and the user would have met a bare form.
Changed to `/reset-password` with no token, whose "Reset link incomplete" state
already says links are single-use and offers a fresh one — a state that had been
rendered and verified in a browser minutes earlier.

## 7.4 — A third production bug, same family · **BUG (fixed)**

Grepping for other consumers of `/auth/callback` turned up
`changeEmail`, which built its confirmation link from **`NEXT_PUBLIC_SITE_URL`**
while every other call site uses `NEXT_PUBLIC_APP_URL`. That variable is
referenced exactly once in the codebase and **defined nowhere** — not in
`.env.local`, not in `.env.example`. In production it resolved to `undefined`,
so the email-change confirmation link pointed at `http://localhost:3000`.

Nobody was looking for this. It surfaced because the check asked "who else
depends on the thing I just changed", which is a different question from "does
my change work".

## 7.5 — What the live probes proved that tests could not

- **`POST /verify` → 403** in the project's auth logs, from a curl against the
  real endpoint with a bogus token. The new flow only ever POSTs, and only on
  submit; the old one verified on GET. A scanner issues GETs. That difference is
  the whole anti-scanner fix, and it is visible in production telemetry.
- **The `?code=` probe produced no Supabase log entry at all.**
  `exchangeCodeForSession` failed locally — with no stored code verifier the
  client never makes a request. This independently confirms, by observation
  rather than by reasoning, why PKCE recovery cannot work when the email is
  opened on a different device from the one that requested it.
- **Both `/reset-password` states rendered in a browser**, zero console errors,
  and **no network call to Supabase on load** — the property the whole design
  rests on. Rendering also caught a copy defect no test would have: the heading
  read "Create a new password" above a link that could not create one.

## 7.6 — Still unverified

The real email round trip. It needs a genuine recovery token, which cannot be
minted here, and it depends on dashboard configuration this session cannot
change. **Phase 0 remains outstanding**, and until it lands the code changes are
inert: the templates still emit PKCE links and Site URL still points at the old
domain. The close-out is one real reset link, clicked **on a phone rather than
the browser that requested it** — the case 7.5 shows was silently impossible.

## 7.7 — Phase 0: the config half, and how to check it without a dashboard

Phase 0 is dashboard configuration and **cannot be applied from this
environment**. Established three ways rather than assumed:

- the Supabase MCP exposes no auth-configuration tool;
- no Supabase CLI, no `~/.supabase/access-token`, no `supabase/config.toml`, and
  no management token in the environment — the Management API needs an
  account-scoped personal access token (`sbp_…`), and the service-role key is
  not one;
- `GET /auth/v1/settings`, which the publishable key _can_ read, returns
  provider flags and signup settings but neither Site URL nor the allow list.

An attempt to probe the Management API with the service-role key was refused by
the sandbox, correctly — that would have sent a privileged credential to an
external host. Not worked around.

### The check is buildable even though the change is not

`npm run auth:verify` (`scripts/verify-auth-redirects.mjs`). Supabase validates
`redirect_to` against the allow list **when it issues the redirect**, so a
deliberately invalid token reads the decision straight back: an allow-listed
candidate is echoed, a rejected one is replaced by Site URL. No email, no
secrets beyond the publishable project URL, no side effects.

Baseline, recorded before any dashboard change — it must fail, or it proves
nothing:

| Candidate                                    | Result                            |
| -------------------------------------------- | --------------------------------- |
| `https://www.metricgymos.com/reset-password` | ✗ → `http://metricgymmanager.com` |
| `https://www.metricgymos.com/auth/callback`  | ✗ → `http://metricgymmanager.com` |
| `https://metricgymos.com/reset-password`     | ✗ → `http://metricgymmanager.com` |
| `http://localhost:3000/reset-password`       | ✗ → `http://metricgymmanager.com` |
| `http://localhost:3000/auth/callback`        | **✓ allow-listed**                |

### What that table says

**The allow list holds essentially one entry**, `http://localhost:3000/auth/callback`,
from initial setup. It was never updated for production. That single fact
explains the whole incident, and Site URL is now confirmed as
`http://metricgymmanager.com` a second time, independently of the auth logs.

**Local development password reset has never worked either** — `localhost:3000/reset-password`
is rejected just as the production URLs are. Nobody noticed, because nobody
resets a password in dev.

**The check discriminates.** One candidate passes and an arbitrary third-party
URL (`https://example.com/…`) is correctly rejected, so both branches are
exercised. A verifier that failed everything would have looked identical on the
four rows that matter.

### Remaining

Phase 0 itself. Until it is applied the Phase 1 and 2 code is inert: the
templates still emit PKCE links and Site URL still points at the retired domain.
`npm run auth:verify` flips from red to green the moment the allow list is
corrected, and is the fastest confirmation that the dashboard half landed.
