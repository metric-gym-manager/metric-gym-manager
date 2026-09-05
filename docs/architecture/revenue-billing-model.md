# Revenue Billing Model

> On-demand reference. What `/revenue` means, why it was changed on 2026-09-05,
> and the constraints anyone changing it again has to work inside.

---

## 1. What was wrong

`/revenue` presented a **run-rate** and called it "projected": every active
member's plan normalised to a month — annual ÷ 12, 6-month ÷ 6, daily × 30,
weekly × 4.33. That is a valuation of the membership base. It was then divided
into cash collected in a calendar month and the ratio labelled **"% of billed"**,
over a denominator that had never been billed.

The symptom that started the investigation was two tiles contradicting each
other on a new gym — `COLLECTED 0 / 0% of billed` beside `PROJECTED 5,000 /
**Fully collected**` in green. The green label was driven by
`hasOverduePayments`, so it meant "nobody is currently past due" while claiming
the money was in.

Measured on production, the model also produced **127.7% of billed** for one
gym — a figure a real billing model cannot emit.

Four further defects rode on the same function:

| #   | Defect                                                              | Status at the time                                                |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Summed raw `plan_amount`, ignoring recurring discounts              | 3 members affected                                                |
| 2   | `switch` had **no `custom` case** — those members contributed **0** | latent, 0 members                                                 |
| 3   | daily × 30 / weekly × 4.33 assumed a drop-in member pays every day  | latent, 0 active                                                  |
| 4   | **Historical** projection computed from _today's_ active set        | live; every past month rewrote itself whenever a member cancelled |

Defect 4 is the worst: the historical series was not history.

---

## 2. Why the schedule is derived, not looked up

There is **no dues or invoices table**. Nothing records what was _owed_ — only
`payments` (what was paid) and `members.next_due_date` (where a member stands
now). Both obvious alternatives were checked against production and rejected:

- **`next_due_date` alone is wrong**, because it advances on payment. For
  September on the largest gym: 87 active members still due, and **49 who had
  already paid** and so no longer looked due. Filtering on it undercounts what
  was billed by **36%**.
- **Reconstructing from payment history is unreliable**: 31 duplicate payment
  rows across 22 members (3.6% of 871), plus 7 future-dated payments. One member
  has three identical payments on one day producing the same next-due-date, so
  any chain-walk yields nonsense.

The membership itself — `membership_start_date` plus the plan's period from
`PLAN_CONFIGS` — is deterministic, duplicate-proof, and independent of whether
anyone has paid. `features/revenue/domain/BillingSchedule.ts` computes it, pure
and without a database, so it can be tested exhaustively.

---

## 3. The model

**Billed** — what billable members owe for the period, from their due dates.
`dueOccurrencesInMonth` returns 0 or 1 for month-based plans and a real **count**
for day-based ones, so a weekly member in a five-Monday month is billed five
times rather than 4.33.

**Billable statuses** — `active` and `expired`. `expired` means the payment is
overdue, which is exactly why the renewals screen chases those members.
`suspended` and `cancelled` do not owe. Stated once in `BILLABLE_STATUSES`.

**Effective amount** — `plan_amount × (1 − pct/100)` when the discount recurs.
Same formula as the renewals read model; two ways of computing what a member
owes is one too many.

**Collected** — cash from **plan payments only**. Day passes are one-off revenue
no schedule predicts, so they are reported separately as `oneOffRevenue` and
kept out of the ratio.

**Overdue** — a count of billable members past their due date. The tile states
that, instead of making a claim about collection it cannot support.

### Effect on real gyms (Sep 2026)

| Gym                 | Old (run-rate) | New (billed) | Collected |      Old % |      New % |
| ------------------- | -------------: | -----------: | --------: | ---------: | ---------: |
| Fitness Empire      |        504,583 |      567,500 |   182,500 |      36.2% |      32.2% |
| Yomak Health Hub    |         94,000 |  **120,000** |   120,000 | **127.7%** | **100.0%** |
| Titan Fitness       |         50,383 |       49,800 |         0 |         0% |         0% |
| Royal Fitness World |          5,250 |        **0** |         0 |         0% |          — |
| LifeLine Fitness    |          1,000 |        **0** |         0 |         0% |          — |

Yomak collected exactly what it billed, and only the new model can say so. The
two zeros are correct: those gyms have nobody with a September due date, and the
page now reads "Nothing billed this month". **Expect the figure to be lumpy for
annual-heavy gyms** — high in anniversary months, zero otherwise. That is the
point, and it is a visible change to a number owners read monthly.

---

## 4. What is deliberately not shown

**There is no historical "billed" series.** `members` stores only the current
`status`; there is no `cancelled_at` and, before 2026-09-05, no audit trail. For
any past month it is impossible to know who was billable at the time. The old
code papered over this by using today's active set, which erased anyone who had
since cancelled. The history now carries `collectedRevenue` only — a fact from
`payments`.

`20260905000003_member_status_history.sql` starts recording transitions so this
becomes answerable **going forward**. It does not recover the past; that
information was never written down. `from_status IS NULL` marks the baseline
snapshot, not a real transition, and its `changed_at` is `members.updated_at` —
a lower bound, labelled as such.

`20260905000004` follows immediately because the first version used `now()`,
which is _transaction_ time: two status changes in one transaction received an
identical timestamp and the log could not be ordered. Caught by flipping a test
member active → suspended → active and seeing both rows land on
`…10:39:28.062528`, with `ORDER BY changed_at` returning them reversed. Cron
jobs move many members per transaction, which is exactly where it would have
bitten. `clock_timestamp()` advances within a transaction.

---

## 5. Known gaps

- **Admission fees cannot be separated.** The gym-level fee is folded into the
  first payment's `amount_paid` with no column of its own, so 8 first payments
  exceed the plan amount and inflate `collectedRevenue` against a schedule that
  never predicted them. Splitting it needs a schema change.
- **`/api/revenue/yearly` has no UI consumer.** It was updated to the new model
  for consistency, but it is dead. Build on it or retire it.
- **The DB `member_status` enum has `frozen`; TypeScript's `MemberStatus` does
  not.** No member is in it today. `isBillable` treats unknown statuses as
  non-billable, which is the safe direction, but the drift should be closed.
- **Pre-existing, outside this work:** the access-control functions still carry
  `SET search_path = public`, which rule 2.18 calls exploitable — it must be
  `pg_catalog, public, pg_temp` with `pg_temp` last. `record_member_status_change`
  is pinned correctly; the older ones are not.

---

## 6. Traps

1. **Do not reintroduce a normalised run-rate.** If a number divides an annual
   plan by 12, it is a valuation and must not be compared to a month's cash.
2. **`w-*` on a flex child needs `shrink-0`.** The month selector rendered
   `w-44` at 102px because the flex parent compressed it, truncating "September"
   to "Septen". Measured in the browser, not guessed.
3. **A `Select` wraps itself in `w-full`** — size the container, never the
   component (same trap as the members toolbar, §2.21).
4. **Unit tests cannot see this class of defect.** The old model passed every
   test it had. What caught it was reading the derivation and comparing old
   against new on real gyms.
