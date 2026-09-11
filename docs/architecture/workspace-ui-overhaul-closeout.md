# Branch Close-Out — `claude/workspace-ui-overhaul`

> Merge-readiness record for the 30 commits on this branch. Written 2026-09-06.
>
> Read §1 before merging: **seven migrations on this branch are already applied
> to production.** Everything else can be read in any order.
>
> The branch is named for the UI overhaul it started as. It grew: each closing
> pass asked what the last one had not checked, and the answers reached the SMS
> feature, the revenue model, routing, and database security. §3 lists the
> whole scope.

---

## 1. Read this first — production is ahead of `master`

Seven migrations were applied to the live database as the work was done, via the
Supabase MCP, and verified against it afterwards:

| Migration        | Effect                                             |
| ---------------- | -------------------------------------------------- |
| `20260905000001` | `delivery_status` gains `pending`                  |
| `20260905000002` | Index on `sms_logs.text_lk_message_id`             |
| `20260905000003` | `member_status_history` table, trigger, RLS        |
| `20260905000004` | Status transitions timestamped `clock_timestamp()` |
| `20260905000005` | `search_path` pinned on 5 access-control functions |
| `20260905000006` | `frozen` removed from `member_status`              |
| `20260905000007` | `payments.admission_fee`                           |

**Merging does not apply them — they are live now.** Each is idempotent and
no-ops on replay, so a fresh database rebuilt from the chain lands in the same
place. But `master` currently describes a schema that already exists, and a
reviewer comparing the two will find production ahead.

Related: the Supabase migration **history table is not a record of what has been
applied** here — 23 repo migrations have no entry, 10 entries have no file, and
14 of 15 unrecorded ones were found to have been applied anyway. Decide whether
a migration ran by probing its schema effect, never from the history.

---

## 2. State

|                                      |                                                   |
| ------------------------------------ | ------------------------------------------------- |
| Commits vs `origin/master`           | 30                                                |
| Diff                                 | 212 files, +14,330 / −9,103                       |
| Tests                                | 1,347 → **1,563** passing                         |
| `type-check` · `lint` · `arch:check` | clean (10 pre-existing lint _warnings_, 0 errors) |
| Screens rendered by a test           | 0 of 12 → **12 of 12**                            |

Verified against the running application, not only the suite: every workspace
screen loads with zero console errors, a delivery receipt moves a row
`sent → delivered`, the revenue endpoint and the dashboard return the same
figure, and `gyms.member_count` matches the real active count for all 13 gyms
after an enum type swap that had to drop and recreate three triggers.

---

## 3. What this branch delivers

**The UI overhaul** (`METRIC_UI_DIRECTIVE.md`). The workspace is dark-first and
operational: the parallel `mws-*` CSS layer is deleted, tokens are dark-first,
all twelve screens are rewritten onto the design system, off-scale type is at
zero, and hand-copied card divs went 25 files → 1.

**Twelve screens now have tests.** The suite previously covered pure logic and
isolated primitives, so a screen could compose a correct primitive incorrectly —
or fail to mount — with the whole gate green. Every assertion guarding a known
defect was falsified before being trusted: the source was mutated to reintroduce
the defect and the test had to fail.

**SMS delivery tracking, which had never once worked.** 1,137 dispatched
messages over seven months, every one frozen on the `sent` column default, zero
ever `delivered`. Four independent defects; the read endpoint returned 500 on
every call it ever served. Now working, with the member-drawer UI that OPEN-6
originally asked for.

**The revenue model.** "Projected" was a run-rate valuation presented as a bill
and divided into cash under the label "% of billed" — one gym rendered
**127.7% of billed**. It is now _billed_: what members owe from their real due
dates.

**Payment integrity.** Duplicate payments are stopped at the server; the
admission fee is recorded as its own component; the money arithmetic has one
implementation instead of four.

**Legal pages made public** (OPEN-5) — terms, privacy, refund policy and contact
all answered `307 → /login` to a logged-out visitor.

**Database security.** All 25 project-owned functions pinned
`pg_catalog, public, pg_temp`; no SECURITY DEFINER function executable by `anon`
or `authenticated`.

---

## 4. Outstanding — what merging does not finish

### 4.1 §9.1 human visual sign-off — **CLOSED 2026-09-09**

The directive's §10 defines completion as _"the perceived product category has
moved"_. That was the judgement half — not a question a screenshot answers, and
not one the person who did the work can answer about themselves. It was signed
off by the project owner on 2026-09-09. §9.2's composition audit and §9.3's
smell test were already finished.

**With this closed, the overhaul is complete**, and its rules change status:
they are no longer migration state but standing invariants. Rule 2.21 was
rewritten on the same date from a phase narrative ("IN PROGRESS", "Phases 0–5
are complete") into the invariants themselves, each naming the check that
enforces it — because a rule injected into every future session as a progress
report teaches the next agent that it is provisional.

### 4.2 Deferred by ruling — not defects

- **OPEN-1: `/access-control` has no sidebar entry.** Reachable only by URL or
  via Settings → Access Control. Deferred because §4.10 forbids navigation
  changes under a visual directive. One line in `WORKSPACE_NAV`, as its own
  change.
- **Mobile is a separate effort (R6)** and is the largest remaining gap: nine
  nav items in a 76px scroller, and `MemberDetailModalMobile` holds the last
  hand-copied card. Nothing here rebuilds it.
- **No historical _billed_ revenue series** until `member_status_history`
  accumulates depth. `members` stores only the current status, so who was
  billable in a past month is unknowable and cannot be backfilled. The table
  added here starts recording it going forward.

### 4.3 Known and deliberately not fixed

- **31 duplicate payment rows across 22 members** (3.6% of 871), plus 7
  future-dated payments. The cause is fixed — payment collection is serialised
  now — but the rows are untouched, because deleting a customer's payment
  records is not a silent decision. **Historical monthly revenue is overstated
  by them**, which matters if any of those months were filed with the inland
  revenue service. This needs a decision from the gyms and their accountants.
- **Admission fees are not backfilled.** The fee on a pre-2026-09-05 payment is
  unrecoverable: deriving `amount_paid − plan_amount` assumes the plan price
  never changed, and it often has. Those fees remain inside plan revenue.
- **`npm run db:audit` is not wired into CI**, though it now runs locally:
  `SUPABASE_DB_URL` is the session pooler (the direct endpoint is IPv6-only and
  unreachable from WSL). Its first real run showed the enum check had never
  worked — `array_agg(enumlabel)` returns `name[]`, which node-postgres cannot
  parse, so the array arrived as a string and was compared character by
  character. Fixed with `::text`. It had been green-by-luck: nothing could
  connect to run it.
- **Two docs still describe the retired `mws-*` layer as current**:
  `legacy-ui-migration.md`, `feature-gaps-app-workspace.md`.
- **`EmptyStateLayout`** had its defaults changed and has no consumers.

---

## 5. How the work was checked, and what that is worth

The branch's recurring failure — recorded across four adversarial passes in
`workspace-ui-inverted-check.md` — was **verifying the artifact instead of the
product**: eight measurement errors, and two beliefs that went unexamined for
eleven phases ("tokens are dark, therefore the app is dark"; "it compiles,
therefore it runs"). The `<body>` element was white the entire time, and the
members toolbar rendered on three rows while `tsc`, `eslint`, `arch:check` and
1,359 tests all passed.

What actually found defects, in order of yield:

1. **Loading the application.** The three-row toolbar, "1 records", the white
   body, the overflowing SMS column — none was findable by any automated check
   in this repository.
2. **Querying the live database.** Delivery tracking having never worked, the
   enum drift, the migration-history drift, the duplicate payments.
3. **Arithmetic on real data.** The inverted interaction-state ladder; comparing
   old and new revenue models per gym.
4. **Mutating the source to make a test fail.** Caught three tests that passed
   for the wrong reason — including one guarding a defect it did not detect.

Unit tests found almost none of it, and could not have: they mock Supabase, so a
column that does not exist and an RLS refusal both look like success.

**Two defects in this branch were introduced by the work itself and caught by
these checks**: the revenue page under-reporting the tax figure, and a
status-history trigger that timestamped with `now()` so two changes in one
transaction were unorderable.

---

### 5.1 What now carries these lessons forward without a human

Prose in `docs/` only works on an agent who opens the file. Three tiers exist,
and a principle survives in whichever it lands:

| Tier                        | Reaches a future session              | Cost                         |
| --------------------------- | ------------------------------------- | ---------------------------- |
| A check that fails          | Always, whether or not anyone read it | Must be written and pinned   |
| `.claude/rules` + CLAUDE.md | Always injected — but only advisory   | ~9.6k tokens **per session** |
| A doc under `docs/`         | Only if the agent opens it            | Free                         |

Added on 2026-09-09, all falsified by mutating the source until each failed:

- **UI3** — every `(dashboard)`/`(admin)` screen must be rendered by a test.
  Ruling B1 fixed twelve screens by hand and left nothing to stop the thirteenth.
  Seeded with the six screens B1 never reached — and those six were written the
  same day, so the allow-list is **empty**. An entry now means a screen shipped
  that can break with the whole gate green.
- **UI4** — one implementation per pattern. A feature-local `Card.tsx` is how a
  second design system starts: it looks like feature code and passes every other
  rule. Zero forks today, so the allow-list is empty.
- **UI5** — the one ESLint exemption (R6 mobile type) fails the build if the file
  stops needing it. An exemption whose reason has expired reads as sanctioned.
- **Off-scale type and radius** are now ESLint errors, not just colour. This
  found six live `text-[10px]` in `AnnouncementProgress` — so the log's claim
  that off-scale type was "at zero" was wrong.
- **`tailwind.config.ts` joined the token-parity test.** Two of the three
  synchronised files were checked; a Tailwind utility pointing at an undeclared
  `--ds-*` variable renders nothing, silently.
- **`CLAUDE.md` gained Verification Directives** — render it, query the database,
  make the test fail — which is §5 above compressed into the auto-loaded path.
- **`arch:check` joined the `PostToolUse` hook** (and the hook stopped firing on
  every `Bash` call), so the UI ratchets reach an agent before commit time.

What none of this can do is judge the result. §9.1 stayed a human gate.

## 6. Reviewing this

Reading order that makes the diff tractable:

1. `docs/architecture/workspace-ui-overhaul-log.md` — decisions, rulings R1–R7,
   measured baselines, per-phase progress.
2. `docs/architecture/workspace-ui-inverted-check.md` — the five adversarial
   passes and every finding they produced.
3. `docs/architecture/sms-delivery-tracking.md`,
   `revenue-billing-model.md` — the two domain rewrites, each with the
   production figures that justified them.
4. `.claude/rules/architecture.md` §2.7, §2.18, §2.21, §2.22 — the standing
   facts a future agent gets injected automatically.

Commit messages carry the reasoning; several are long because the _why_ is the
part that does not survive in code.
