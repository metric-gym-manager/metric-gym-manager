# Member writes — every write names its columns

Rule 2.24 in `.claude/rules/architecture.md`. This is the reference behind it.

## The problem

A writer read a member, changed one to three columns, and `SupabaseMemberRepository.update()` wrote all ~22 back from the copy it had read. Anything another request changed in between was put back:

| Writer A (stale copy)                                             | Writer B (landed in between)    | Result before                                         |
| ----------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| Collect payment / day pass                                        | Profile edit (phone, fee, name) | Edit reverted; receipt sent to the old number         |
| Suspend, cancel, reactivate, verify                               | Profile edit                    | Edit reverted                                         |
| Photo save (waits on R2 between read and write)                   | Profile edit                    | Edit reverted                                         |
| Nightly status cron (reads every member once, writes for minutes) | A payment or reactivation       | Paid member put back to expired with the old due date |
| Profile edit                                                      | Payment                         | Payment's status and due date reverted                |

It follows from reading the writes and was first demonstrated by deterministic interleaving tests; the fixes were then checked against a database (see Verification).

## The rule

There is no whole-row member write. `IMemberRepository` has one write:

```ts
updateFields(member, fields, { expectedNextDueDate?, expectedStatus?, expectedPlan? })
```

It writes the named fields plus `updated_at`, returns the row **as stored after the write**, and can be conditional on the due date and/or status the caller read. A missed guard throws `ConflictError`; an unmatched row without a guard throws `NotFoundError`; the quota trigger maps to `MemberLimitError`.

`update()` is deleted and `MemberWriteFields.test.ts` fails if the repository regains it. Do not add a "save the member" helper under another name.

## Field groups (`features/members/config/MemberWriteFields.ts`)

| Group                 | Fields                                                                 | Used by                                                            |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PROFILE_FIELDS`      | name, phoneNumber, planType, planAmount, discountId, recurringDiscount | `UpdateMemberProfile` (only the fields the request carries)        |
| `LIFECYCLE_FIELDS`    | status, nextDueDate                                                    | `CollectPayment`, `IssueDayPass`, `ReactivateMember`               |
| `PLAN_FIELDS`         | planType, planAmount                                                   | added to a payment's write only when the payment switches the plan |
| `STATUS_FIELDS`       | status                                                                 | `SuspendMember`, `CancelMember`, the three status crons            |
| `PHOTO_FIELDS`        | photoPath, photoUpdatedAt                                              | member photo route, public QR registration                         |
| `VERIFICATION_FIELDS` | verifiedAt                                                             | `VerifyMember`                                                     |

Two writers are safe to interleave exactly when their groups do not overlap. `PROFILE_FIELDS` and `LIFECYCLE_FIELDS` are disjoint, which is the guarantee behind "a payment cannot revert an edit and an edit cannot revert a payment". The one overlap is the plan columns on a reactivation that switches the plan, and that payment carries a plan guard (below).

## Guards: who uses which

The options type is `MemberWriteGuard` (`IMemberRepository.ts`). Every guard names a value the caller read; a write whose guard no longer matches throws `ConflictError`, which the request routes answer with 409 and the crons count as skipped.

| Writer                                              | Guard                                                                | On a conflict                                 |
| --------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `CollectPayment`                                    | `expectedNextDueDate`; plus `expectedPlan` when it switches the plan | 409, no payment recorded                      |
| `IssueDayPass`                                      | `expectedNextDueDate`                                                | 409, no payment recorded                      |
| `SuspendMember`, `CancelMember`, `ReactivateMember` | `expectedStatus`                                                     | 409; the member screen says why and refetches |
| The three status crons                              | `expectedStatus` and `expectedNextDueDate`                           | skipped and counted as `skippedChanged`       |
| `UpdateMemberProfile`, `VerifyMember`, photo save   | none                                                                 | n/a                                           |

- **Payments and day passes write the member FIRST, then record the payment**, so a refused write (a conflict, or the quota trigger's `MemberLimitError` at the cap) leaves no payment behind. The due-date guard stops a second submission (double-tap, retry, second tab). There is **no** status guard on a payment: payment wins on status, so a payment on a member the cron expired a moment earlier still activates them.
- **A payment that switches the plan** also passes `expectedPlan`, because a profile edit writes the same two columns: a plan edit saved after the payment read refuses the switch instead of being overwritten. A plan edit saved after the payment still wins.
- **The three status crons** pass both `expectedStatus` and `expectedNextDueDate`. A targeted write alone does not fix them: a member paid while the cron runs would be left `expired` with a future due date. A member who changed meanwhile is **skipped and counted** as `skippedChanged` in the summary, the audit-log entry (`cron_logs.summary`, jsonb) and the response; it is not an error.
- **Suspend, cancel and reactivate** pass the status they read: each was chosen against it, and a change landing in between (the cron, a payment on another device) means it no longer applies. Unguarded, a cancel released behind a payment left the paying member cancelled.
- **Profile edits, verify and photo** carry no guard. Their writes do not depend on the status, and their groups do not overlap a guarded writer's except the plan columns above.

## Why `status` is always listed when it can change

The quota, member-count and status-history triggers on `members` are `UPDATE OF status`: they fire only when `status` is in the SET list. Every group that changes status lists it, even for a renewal that leaves the member Active, so they fire exactly as they did under the whole-row write. Profile, photo and verification writes omit it, which is correct because status is unchanged. (`record_member_status_change` inserts a history row only when the status actually differs, so a status that is written but unchanged adds nothing.)

Checked against the live database on 2026-11-03: the five triggers (`trg_enforce_active_member_quota`, `trg_record_member_status_change`, `trg_sync_gym_member_count` are `UPDATE OF status`; `trg_enqueue_access_sync` is any UPDATE and compares old and new itself; `update_members_updated_at` is any UPDATE), the `Gym owners can update own members` policy (`USING` and `WITH CHECK` on gym ownership, column-agnostic), and `UPDATE` privilege for `authenticated` on every column written.

## The edit form and the use case

`UpdateMemberProfile` writes only the fields the request carries (`null` counts: it removes the discount) and returns the member untouched when none is carried. The edit form (`EditMemberModal`) sends only the fields the user changed, so a field this user never touched cannot overwrite what another desk device saved since the form was filled. A stored name with stray spaces counts as unchanged once trimmed. Nothing changed: no request, a "No changes to save" toast.

Phone uniqueness is checked only when the phone changes (a number already shared in the gym must not lock its members out of every other edit), against any member of the gym, cancelled included, through `findByPhoneNumber` (`limit(1).maybeSingle()`; `.single()` failed for several rows exactly as for none and the failure was read as "not found").

## Known gaps

- Two profile edits to the **same** field are last-writer-wins.
- The duplicate-phone check is check-then-write, so two simultaneous edits can both pass it. A unique index on `(gym_id, phone_number)` would close that, but cannot be created while duplicates exist: as of 2026-11-03 the database holds 4 groups covering 49 members, 45 of them in one test gym and 4 in a customer gym (two shared-number pairs). They need a data decision first.
- A profile edit to the plan saved after a plan-switching payment overwrites the payment's plan (the latest decision stands; the due date stays the payment's).

## Verification

- **Production, read-only plus one rolled-back write run (2026-11-03):** the policy, privileges and triggers listed above; a `DO` block as the E2E gym owner, ending in an unconditional exception, showed a profile write surviving a later payment, stale due-date and status guards writing 0 rows, a stale cron write after a payment writing 0 rows, and cross-gym writes writing 0 rows.
- **Concurrent writers (2026-11-03):** a local Postgres 17 + PostgREST 13 copy of production's member schema (columns, constraints, the six triggers, RLS policies and grants, transcribed from the live catalog) ran the real repository and use cases through supabase-js. Writers were released together from a held row lock after `pg_stat_activity` showed each one blocked. Under READ COMMITTED a blocked guarded `UPDATE` re-evaluates its `WHERE` against the row the other transaction committed: with A holding its open transaction, B (blocked on A's transaction id) wrote 0 rows when A committed and applied when A rolled back. Two payments gave one payment and one 409; a payment and a profile edit both survived in either order; the expiry cron behind a payment counted `skippedChanged`; two reactivations at 99/100 on a Lite gym serialised on the gym row and stopped the count at exactly 100; a renewal at 100/100 applied; the real payment and day-pass routes answered 403 `MEMBER_LIMIT_REACHED` at the cap with nothing written. Removing the due-date guard, restoring the whole-row write, or dropping the limit mapping each failed the run.

## Adding a writer

1. Read the member, change the entity through its methods (domain rules apply).
2. Pick the group whose columns you change, or add one to `MemberWriteFields.ts` and a column to `FIELD_COLUMNS` in the repository (a field without a column does not compile).
3. If a slow read-then-write loop or a duplicate submission is possible, pass `expectedNextDueDate` and/or `expectedStatus` and handle `ConflictError` by skipping and counting, not failing.
4. Add an interleaving test using `createMemberStore` (`src/test-utils/memberStore.ts`): `duringNextRead(fn)` lands `fn` after your read has taken its snapshot.

- **Inverted check (2026-11-04):** every claim above re-attacked with different instruments (production's PostgREST 14.5, UTC, the real routes with `payments` and `sms_logs`, rolled-back production transactions, a real browser, an exact pixel diff). Findings and the clean list: `member-writes-inverted-check.md`.

## Tests

`MemberWriteFields.test.ts` (group contract, no `update()`), `SupabaseMemberRepositoryUpdateFields.test.ts` (payloads, guards including the plan guard, errors, phone lookup), `PaymentVsProfileEditRace.test.ts` (also a day pass submitted twice and a plan switch after a plan edit), `IssueDayPass.test.ts`, `MemberTransitionWrites.test.ts` (also the status guard), `CronMemberRaces.test.ts`, `status-routes.test.ts` and the day-pass route test (409 and 403 mapping), `MemberDetailModalRequests.test.tsx` and `DayPassModal.test.tsx` (409 and the upgrade dialog), `photo.route.test.ts`, `UpdateMemberProfile.test.ts`, `EditMemberModal.submit.test.tsx`, `member-modal.context.test.tsx`.
