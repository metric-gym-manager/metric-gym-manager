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

None of this was reproduced against a live database; it follows from reading the writes. It was demonstrated by deterministic interleaving tests (see below).

## The rule

There is no whole-row member write. `IMemberRepository` has one write:

```ts
updateFields(member, fields, { expectedNextDueDate?, expectedStatus? })
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

Two writers are safe to interleave exactly when their groups do not overlap. `PROFILE_FIELDS` and `LIFECYCLE_FIELDS` are disjoint, which is the guarantee behind "a payment cannot revert an edit and an edit cannot revert a payment". The only deliberate overlap is the plan columns on a reactivation that switches the plan: last writer wins.

## Guards: who uses which

- **Payments** pass `expectedNextDueDate` (stops duplicate payments) and **no** status guard: payment wins on status. A payment on an expired member must activate it even if a cron flipped the status a moment earlier.
- **The three status crons** (`update-expired-status`, `expire-suspended-members`, `cancel-overdue-members`) pass **both** `expectedStatus` and `expectedNextDueDate`. A targeted write alone does not fix them: a member paid while the cron runs would be left `expired` with a future due date. A member who changed meanwhile is **skipped and counted** as `skippedChanged` in the summary, the audit-log entry (`cron_logs.summary`, jsonb) and the response; it is not an error.
- **Manual transitions** (suspend, cancel, reactivate, verify, photo, day pass) write only their columns and carry no guard. Their window is milliseconds and a guard would add a 409 their routes do not map. They can still apply a transition computed from a stale status; they can no longer destroy data.

## Why `status` is always listed when it can change

The quota, member-count and status-history triggers on `members` are `UPDATE OF status`: they fire only when `status` is in the SET list. Every group that changes status lists it, even for a renewal that leaves the member Active, so they fire exactly as they did under the whole-row write. Profile, photo and verification writes omit it, which is correct because status is unchanged. (`record_member_status_change` inserts a history row only when the status actually differs, so a status that is written but unchanged adds nothing.)

Checked against the live database on 2026-11-03: the five triggers (`trg_enforce_active_member_quota`, `trg_record_member_status_change`, `trg_sync_gym_member_count` are `UPDATE OF status`; `trg_enqueue_access_sync` is any UPDATE and compares old and new itself; `update_members_updated_at` is any UPDATE), the `Gym owners can update own members` policy (`USING` and `WITH CHECK` on gym ownership, column-agnostic), and `UPDATE` privilege for `authenticated` on every column written.

## The edit form and the use case

`UpdateMemberProfile` writes only the fields the request carries (`null` counts: it removes the discount) and returns the member untouched when none is carried. The edit form (`EditMemberModal`) sends only the fields the user changed, so a field this user never touched cannot overwrite what another desk device saved since the form was filled. A stored name with stray spaces counts as unchanged once trimmed. Nothing changed: no request, a "No changes to save" toast.

Phone uniqueness is checked only when the phone changes (a number already shared in the gym must not lock its members out of every other edit), against any member of the gym, cancelled included, through `findByPhoneNumber` (`limit(1).maybeSingle()`; `.single()` failed for several rows exactly as for none and the failure was read as "not found").

## Known gaps

- Two profile edits to the **same** field are last-writer-wins.
- The duplicate-phone check is check-then-write, so two simultaneous edits can both pass it. A unique index on `(gym_id, phone_number)` would close that, but cannot be created while duplicates exist: as of 2026-11-03 the database holds 4 groups covering 49 members, 45 of them in one test gym and 4 in a customer gym (two shared-number pairs). They need a data decision first.
- `IssueDayPass` has no duplicate-submission guard.
- Nothing here has been exercised against a live write. The RLS policy and privileges make a column-limited UPDATE valid on paper; the E2E suite and a staging replay are what would show it.

## Adding a writer

1. Read the member, change the entity through its methods (domain rules apply).
2. Pick the group whose columns you change, or add one to `MemberWriteFields.ts` and a column to `FIELD_COLUMNS` in the repository (a field without a column does not compile).
3. If a slow read-then-write loop or a duplicate submission is possible, pass `expectedNextDueDate` and/or `expectedStatus` and handle `ConflictError` by skipping and counting, not failing.
4. Add an interleaving test using `createMemberStore` (`src/test-utils/memberStore.ts`): `duringNextRead(fn)` lands `fn` after your read has taken its snapshot.

## Tests

`MemberWriteFields.test.ts` (group contract, no `update()`), `SupabaseMemberRepositoryUpdateFields.test.ts` (payloads, guards, errors, phone lookup), `PaymentVsProfileEditRace.test.ts`, `MemberTransitionWrites.test.ts`, `CronMemberRaces.test.ts`, `photo.route.test.ts`, `UpdateMemberProfile.test.ts`, `EditMemberModal.submit.test.tsx`, `member-modal.context.test.tsx`.
