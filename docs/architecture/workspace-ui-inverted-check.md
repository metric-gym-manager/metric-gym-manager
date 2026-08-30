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
