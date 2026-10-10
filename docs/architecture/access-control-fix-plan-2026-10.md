# Access Control — Fix Plan after Visit 1 (2026-10-09)

> **Status of this file.** Canonical task text for the fix work. **Live status is the tracker's database, not this file**:
> https://claude.ai/artifact/FTKSkGm7B9Gx4ukCoDQgdC (collections `tasks`, `owner`, `review`, `log`).
> Written 2026-10-09 by Opus 5.5 after reading both visit reports, the code and the production database.
> Executed by a Sonnet 5.5 session, one task at a time. Reviewed afterwards by Opus 5.5 (tracker collection `review`).

---

## 0. How the executing session uses this file

1. Read §1–§4 once at the start of the session. Do not re-read them per task.
2. For each task, read **only that task's section in §6**, then follow the protocol in §4.
3. Every decision in this file is already made. **If a task seems to need a decision this file does not make, stop that task, set it `blocked` in the tracker with the question, and move to the next task that does not depend on it** (dependencies are in §5).
4. Never edit this file. Corrections go in the tracker note of the task and in the hand-off.

---

## 1. Sources

| Source                                                                                                                                                                     | What it holds                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/architecture/access-control-physical-visit-report-2026-10-09.md` (copied in T-00 from `backups/hw-session/physical-visit-2026-10-09-report.md`, which is gitignored) | Physical visit: defects **D1–D5**, minor observations, PH-01…PH-30 |
| `docs/architecture/access-control-remote-day-report-2026-10-09.md`                                                                                                         | Remote day: findings **F-01…F-18**, LD/OB/LC/AP/EV/XC tasks        |
| `docs/architecture/access-control-master.md`                                                                                                                               | Design principle, traps (§9), defect history (§6)                  |
| `docs/integrations/vft/vft-api-reference.md`                                                                                                                               | Vendor endpoints (fact)                                            |

Facts established while writing this plan (production database, read-only, 2026-10-09):

- **D5 is real.** Reader A stored HW3 (subject `100017`) scans at 16:42:38, 16:44:41, 16:47:20 SLT. The ~16:40 offline admission never arrived. No code here can recover it; it goes to VFT (O-5) and to visit 2 (R-3).
- **F-01 shape.** The three re-delivered rows are byte-identical to the originals except `AttTime`, which is **UTC** (`07:04:07` for an original `12:34:07` SLT). There is no field that marks a pulled delivery. So a pulled copy can only be recognised as "an existing row shifted by exactly the reader's UTC offset".
- `members.next_due_date` is `date NOT NULL`. `access_devices`: both serials already upper-case; `template_capacity` null on both; `template_count` 0 on both. No `access_control_accounts.base_url` uses `http://`.
- Event code **23** = "Refused — no access rights" (our table); **29** = "Refused — membership expired". The reader shows 23 as "invalid time period".
- The reader runs its command queue **in order and one at a time**: commands queued behind an `Enroll User` stay `NEVER SENT` until the enrolment ends (PH-14). `Enroll User` returns **0 when a finger was taken and 6 when the reader's ~10 s window timed out** (PH-07, PH-21).
- PR #103 (`chore/hw-session-reader-a-serial`, commits `a78efce`, `4c922da`) is **open, not merged**.

---

## 2. Decisions already made (do not reopen)

| #      | Decision                                                                                                                                                                                                                                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-01 | Every reader that is **handed** a member (a `SyncToDevice` command) also gets an **Access Grant** before the window, even when we believe the member was never blocked.                                                                                                                                                                                            | D3: 4 of 5 enrolments were refused (event 23) until a re-send that carried Access Grant; the one enrolment preceded by a grant worked (PH-08). Grant to an unblocked member is a benign duplicate (audit Y1).                                                                                                                                                                         |
| DEC-02 | After a successful enrolment request, the same reader is sent **Access Grant + the member's window**, queued behind the `Enroll User`.                                                                                                                                                                                                                             | The reader runs its queue in order, so these land after the finger is taken (PH-14 evidence). Covers the case DEC-01 cannot: an enrolment resetting the user record.                                                                                                                                                                                                                  |
| DEC-03 | New derivation option **`reseat`**: one `RevokeBiometric` (vendor `fromdev`, which deletes the subject from **every** reader) **then** the full forced push (`SyncToDevice` to every reader, Grant, window). Used by the desk **"Re-send to readers"** and by the **post-restart repair**. Never by the nightly reconcile or the routine outbox.                   | D1: after a restart a forced resend did not restore lost templates; delete-then-add (cancel + reactivate) did (PH-15). A re-seat briefly removes the member from all readers for the seconds the queue takes; accepted. Known edge: a template enrolled at a reader's own menu while that reader was offline and never uploaded would be lost by a re-seat (documented, not handled). |
| DEC-04 | Restarting a reader through our app queues a **re-seat of every member that reader holds**, due **180 s** later (`REBOOT_RESEAT_DELAY_SECONDS`). No device-level "repair" button in this plan.                                                                                                                                                                     | D1. Whether a power cut also drops templates is unknown (PH-26 not run); visit 2 answers it (R-3). Until then, the member-level Re-send (now a re-seat) is the manual fix.                                                                                                                                                                                                            |
| DEC-05 | **Removing a fingerprint erases the vendor record** (`DELETE /api/template/{EmpId}`, our `removeSubject`), then gives the member a **new subject id**, clears consent, and queues a reconcile that re-provisions the member **without** a template if still entitled. **Cancellation is unchanged** (block + `fromdev`, central copy kept).                        | D2 (privacy, HIGH): `fromdev` keeps the central copy and any later sync restored the withdrawn finger. A new subject id makes resurrection impossible even if the vendor keeps templates keyed by the old EmpId. F-05: withdrawal left an active member on no reader with nothing queued.                                                                                             |
| DEC-06 | A **refused fingerprint scan (event 23 or 29) of a member our decision allows** queues a **forced** re-push (not a re-seat), at most once per member per **15 min** (`REFUSAL_REPAIR_COOLDOWN_SECONDS = 900`).                                                                                                                                                     | D3 for menu enrolments and any other window loss we cannot see; makes "Can get in while the reader refuses" self-correct. Bounded so a wrong reader clock cannot loop.                                                                                                                                                                                                                |
| DEC-07 | Desk enrolment waits **30 s** (`ENROLMENT_POLL_TIMEOUT_MS`), then keeps checking quietly every 3 s for **180 s** more (`ENROLMENT_CONFIRM_GRACE_MS`) and flips to "registered" by itself.                                                                                                                                                                          | D4 + PH-04 minor: the reader gives up after ~10 s; confirmation is the member's first scan.                                                                                                                                                                                                                                                                                           |
| DEC-08 | A scan whose stored twin exists **exactly `timezone_offset_minutes` later** (same gym, reader, subject, event code) is a **duplicate** (pulled re-delivery in UTC). Clock skew is recorded **only** from a delivery that stored at least one new scan, and only from scans that are not such duplicates. Production does **not** start calling `GetEventsbyDevSN`. | F-01; see §1 facts.                                                                                                                                                                                                                                                                                                                                                                   |
| DEC-09 | HTTP **429 and 408** are retryable. `Retry-After` is not honoured (the backoff ladder already starts at 30 s).                                                                                                                                                                                                                                                     | F-02.                                                                                                                                                                                                                                                                                                                                                                                 |
| DEC-10 | Sign-in **400/401/403** = credentials rejected: job dead-lettered **needing attention**, and the gym's account is marked verification-failed (the settings card already shows that state). Sign-in **5xx or network** failure is an ordinary vendor failure (retryable per the existing rules).                                                                    | F-03.                                                                                                                                                                                                                                                                                                                                                                                 |
| DEC-11 | An unparseable start or due date makes the decision **refused** (`Expired`), checked after the Cancelled and Suspended branches.                                                                                                                                                                                                                                   | F-04: fails closed.                                                                                                                                                                                                                                                                                                                                                                   |
| DEC-12 | Outbox job results are written only if the job is still `in_flight` **at the attempt number we claimed** (`attempts` is incremented by every claim). A stale write is counted as `superseded` and dropped. No migration.                                                                                                                                           | F-10.                                                                                                                                                                                                                                                                                                                                                                                 |
| DEC-13 | A queued door-open or restart job (not `dispatchedInline`) runs **at most once**: on `attempts > 1` it is dead-lettered with a plain message and not dispatched.                                                                                                                                                                                                   | F-11: a door opened ten minutes late is worse than not opened.                                                                                                                                                                                                                                                                                                                        |
| DEC-14 | Reader serials are **upper-cased and trimmed** when registered. Registration is refused (400) only when the gym's VFT device list **is readable, non-empty and lacks the serial**; any vendor or credential error skips the check.                                                                                                                                 | F-07. The mock's device list is empty, so E2E is unaffected.                                                                                                                                                                                                                                                                                                                          |
| DEC-15 | Vendor base URL must be `https:`; `http:` is accepted only for host `localhost` or `127.0.0.1` (the console's stub).                                                                                                                                                                                                                                               | F-08.                                                                                                                                                                                                                                                                                                                                                                                 |
| DEC-16 | Sign-in is rate limited with the existing in-memory `checkRateLimit`: **10 per IP and 5 per email per 15 min**, answering 429. The webhook gets **no event cap**; it is made fast instead (member lookups once per delivery).                                                                                                                                      | F-09. A cap would drop real scans after an outage.                                                                                                                                                                                                                                                                                                                                    |
| DEC-17 | The reader card's count is recounted by the 5-minute drain and labelled **"Members on this reader"** (it counts members we hold there, not fingerprints). Capacity UI otherwise unchanged.                                                                                                                                                                         | F-13, PH-16. LD-06 ("no bar at 0 / 100") is a 0 % bar; R-2 checks it visually.                                                                                                                                                                                                                                                                                                        |
| DEC-18 | No database migration in this plan. No production data is changed by the executing session. Cleanups are owner decisions (O-4).                                                                                                                                                                                                                                    | Safety.                                                                                                                                                                                                                                                                                                                                                                               |

---

## 3. Hard rules for the executing session

**Never, under any circumstances:**

1. Write to the production database (no Supabase MCP `execute_sql`, `apply_migration`, or any write tool). Reading it is not needed for any task and is also not allowed.
2. Run `scripts/hw-session.ts` commands other than `help` and `coverage`, or any script that calls the VFT vendor (`vft-probe.ts`, `vft-lifecycle.ts`, `vft-queue-probe.ts`, `provision-access-control-test-gym.ts`).
3. Print, cat, grep the value of, or paste anything from `.env.local` or `.env`. The only allowed read is a key-presence/value check that prints a count, e.g. `grep -c '^ACCESS_CONTROL_ENABLED=false$' .env.local`.
4. Push to `master`, merge any PR, create or move tags, bump `package.json`, or edit `CHANGELOG.md` (versioning rules).
5. Edit files outside the task's **Files** list, except: test fakes in `src/features/access-control/tests/fakes.ts` when a port method changes, and the tracker.
6. Edit a test's expectation to make it pass, except in the exact cases a task names under **Allowed test updates**.
7. Narrow a vendor-table transcription (trap 25) or touch `DoorAgreement.reverse.test.ts` assertions.
8. Use `RemoveSubject` anywhere except `ManageMemberBiometric.clear` (T-08). Cancellation stays block + `fromdev` (trap 5).
9. Send a validity period to a blocked subject (trap 4). Every new path below derives from `resolveAccessDecision`.
10. Use `pkill -f next-server` unanchored (trap 24). Use `pkill -f '^next-server'`.

**Stop the whole session (set the current task `blocked`, write the hand-off, stop) when:**

- `.env.local` does not report `ACCESS_CONTROL_ENABLED=false` (needed by T-26's E2E run; ask the owner, see O-6).
- The baseline gate in T-00 fails before any change.
- Two consecutive tasks end `blocked`.
- Anything asks you to rotate, re-enter or print a credential.

---

## 4. Per-task protocol (every task)

1. Tracker: set the task `in_progress` (see §8 for the exact call).
2. **Write the tests first** (CLAUDE.md TDD). Run only them: `npx jest <test files>`. They must **fail** for the reason the task states. If they pass before the change, the test is wrong: fix the test, not the code.
3. Make the change exactly as specified.
4. Run the task's tests again: they must pass. Then run the task's **Run** command (the feature's suites).
5. **Mutation check** (Verification Directive 3): apply the task's named mutation to the source, run the new tests, confirm at least one fails, revert the mutation with `git checkout -- <file>` **only for that file** or by re-applying your edit. Record "mutation: <what> → <which test failed>" in the tracker note.
6. `npm run type-check`. If it fails with TS2307/TS1005 inside `.next/`, apply the stale-types fix in §9 and re-run.
7. Commit with the task's exact commit message (body bullets may be added; keep the `Release-Note:` line as given). The pre-commit hook runs lint-staged and related tests; if it fails, fix the cause (never `--no-verify`).
8. Tracker: set `done` with `commit` = short hash and a note: tests added, mutation result, anything surprising. Append one log entry.
9. After every **third** completed task, run the full gate: `npm run type-check && npm test && npm run arch:check && npm run lint`. Record the result in the log. A red full gate stops new tasks until it is green.

---

## 5. To-do list (order and dependencies)

| ID   | Finding          | Title                                                                              | Depends on |
| ---- | ---------------- | ---------------------------------------------------------------------------------- | ---------- |
| T-00 | —                | Branch, baseline gate, commit the reports and this plan                            | —          |
| T-01 | D3               | Grant every reader a member is handed to                                           | T-00       |
| T-02 | D3               | Enrolment queues grant + window behind the Enroll                                  | T-01       |
| T-03 | D1               | `reseat` option in command derivation                                              | T-01       |
| T-04 | D1               | SyncMemberAccess: reseat, in-order held readers, partial-failure safety, retry job | T-03       |
| T-05 | D1               | Outbox: force/reseat from payload; delayed and bulk enqueue                        | T-04       |
| T-06 | D1               | Desk "Re-send to readers" re-seats and queues a retry on failure                   | T-04       |
| T-07 | D1               | Restarting a reader queues a re-seat of its members                                | T-05       |
| T-08 | D2, F-05         | Removing a fingerprint erases the vendor record and re-provisions                  | T-05       |
| T-09 | D3               | Refused scan of an entitled member queues a forced re-push                         | T-05       |
| T-10 | D4, PH-04        | Enrolment: 30 s wait, 3 min quiet confirmation, new copy                           | T-00       |
| T-11 | F-02             | 429 and 408 are retryable                                                          | T-00       |
| T-12 | F-03             | Rejected sign-in needs attention and marks the account; sign-in 5xx retries        | T-11       |
| T-13 | F-04             | Unparseable dates refuse access                                                    | T-00       |
| T-14 | F-01             | Shifted re-delivery is a duplicate; skew only from fresh scans                     | T-09       |
| T-15 | F-09             | Webhook resolves members once per delivery                                         | T-14       |
| T-16 | F-10             | Job results guarded by the claimed attempt                                         | T-05       |
| T-17 | F-11             | Door opens and restarts never repeat after an interruption                         | T-16       |
| T-18 | F-06             | Undecodable session cookie answers 401                                             | T-00       |
| T-19 | F-07             | Serial upper-cased; checked against the VFT account                                | T-00       |
| T-20 | F-08             | Vendor address must be https                                                       | T-00       |
| T-21 | F-09             | Sign-in rate limit                                                                 | T-00       |
| T-22 | F-13, PH-16      | Re-send debounced; reader count refreshed and relabelled                           | T-06       |
| T-23 | F-14             | Attempt-limit constant and retention figure pinned                                 | T-16       |
| T-24 | F-15, F-17       | Console: stub-log redaction, e2e-account, closed pipe                              | T-17       |
| T-25 | D4, F-01, D2, D1 | Docs: brief §7, vendor reference, master §6 audit, Pattern Index 2.20              | T-01…T-24  |
| T-26 | —                | Final gate, access-control E2E specs, draft PR, hand-off                           | T-25       |

Work strictly in this order unless a task is `blocked`; then take the next task whose dependencies are all `done`.

---

## 6. Task specifications

Shared facts for all tasks:

- Test fakes: `src/features/access-control/tests/fakes.ts` (`FakeAccessControlRepository`) and `src/lib/access-control/MockAccessControlProvider.ts`. When a port method is added or changed, implement it in the fake **with real behaviour over the fake's stored state** (a fake returning a constant hid a real bug before — master §6, tenth finding).
- Model new SyncMemberAccess tests on `src/features/access-control/tests/ForcedResend.test.ts` lines 1–57 (setup) and new drain tests on `DrainAccessSyncQueue.test.ts`.
- `MockAccessControlProvider` has no failure switch. To make one vendor call fail, spy on it: `jest.spyOn(provider, 'syncSubjectsToDevice').mockResolvedValueOnce({ status: 'failed', error: 'Vendor returned status 502', retryable: true })`. To simulate something happening _during_ a job (T-16's reclaim), do it inside such a spy's `mockImplementationOnce` and then call through to the real method.
- Import enums from `@/features/access-control/config/AccessControlConfig` (never the feature barrel from client code — trap 1).
- The feature's own suites (the **Run** command used below):
  `npx jest src/features/access-control src/lib/access-control src/app/api/access-control src/app/api/cron/__tests__/access-control-crons.test.ts src/features/members/tests/BiometricConsentPersistence.test.ts`

### T-00 — Branch, baseline gate, commit the reports and this plan

- **Steps:**
  1. `git fetch origin`.
  2. `git merge-base --is-ancestor 4c922da origin/master && echo MERGED || echo NOT_MERGED`.
     - `MERGED` → `git switch -c fix/access-control-visit-1-defects origin/master`.
     - `NOT_MERGED` → `git switch -c fix/access-control-visit-1-defects 4c922da` and write in the tracker note: "based on PR #103 head; the PR will show #103's two commits until #103 merges".
  3. `cp backups/hw-session/physical-visit-2026-10-09-report.md docs/architecture/access-control-physical-visit-report-2026-10-09.md`.
  4. `grep -c '^ACCESS_CONTROL_ENABLED=false$' .env.local` → must print `1`. Otherwise stop the session (§3).
  5. Baseline gate: `npm run type-check && npm test && npm run arch:check && npm run lint`. Must be green. (Stale `.next` types → §9.)
  6. `git add docs/architecture/access-control-fix-plan-2026-10.md docs/architecture/access-control-fix-plan-2026-10-prompt.md docs/architecture/access-control-remote-day-report-2026-10-09.md docs/architecture/access-control-physical-visit-report-2026-10-09.md` — **only these four**. Do not add `.agents/`, `graphify-out/`, `skills-lock.json`, `.claude/settings.local.json`.
- **Commit:** `docs(access-control): visit 1 reports and the fix plan`
- **Done when:** branch exists, baseline green, commit made.

### T-01 — Grant every reader a member is handed to (D3)

- **Files:** `src/features/access-control/domain/AccessCommands.ts`, `src/features/access-control/tests/AccessCommands.test.ts`.
- **Change:** in `deriveAccessCommands`, in the allowed path, replace the grant block so grants go to:
  - every active reader (`deviceSerials`) when `subject.lastSyncedBlocked === true || force` (unchanged), otherwise
  - every reader in `missingFrom` (the readers being handed the member now).
    Grants stay **after** the `SyncToDevice` commands and **before** the `SetValidPeriod` commands. Update the comment above the block: cite "visit 1, D3: event 23 'invalid time period' on the first scan until an Access Grant arrived (PH-04/06/07; PH-08 the exception)".
- **Tests (new `describe('grant on hand-over (visit 1, D3)')` in `AccessCommands.test.ts`, using its existing `subject()`/`decisionFor()` helpers):**
  1. Never-provisioned allowed member, readers `['A','B']` → intents exactly `[Provision, SyncToDevice, SyncToDevice, Grant, Grant, SetValidPeriod, SetValidPeriod]` and grant serials `['A','B']`.
  2. Provisioned member held by `['A']`, readers `['A','B']`, window unchanged → exactly `[SyncToDevice(B), Grant(B), SetValidPeriod(A), SetValidPeriod(B)]`.
  3. Provisioned member held by `['A','B']`, window changed → no `Grant` at all.
  4. Suspended member → no `Grant`, no `SetValidPeriod`.
- **Allowed test updates:** in any file under `src/features/access-control/tests/`, an existing test that asserts an **exact** intent list (or an exact count of provider calls) for an allowed member being pushed to a reader may fail only because `Grant` now appears between the last `SyncToDevice` and the first `SetValidPeriod`. Insert the `Grant` entries there (or raise the count by the number of readers pushed). List every test you changed in the tracker note. Any other failure → stop the task (`blocked`).
- **Mutation:** make the non-forced, non-blocked branch grant `[]` → tests 1 and 2 fail.
- **Run:** the feature suites. `DoorAgreement.reverse.test.ts` must stay green unchanged.
- **Commit:**
  ```
  fix(access-control): grant door access on every reader a member is pushed to

  Release-Note: Newly registered fingerprints now open the door on the first scan.
  ```

### T-02 — Enrolment queues grant + window behind the Enroll (D3)

- **Files:** `src/features/access-control/services/ManageMemberBiometric.ts`, new test `src/features/access-control/tests/EnrolmentWindow.test.ts`.
- **Change:** in `enrol`, after `startFingerEnrolment` returned a non-`failed` outcome and before `return { applicable: true, dispatched: true }`:
  ```ts
  // Visit 1, D3: the reader runs its queue in order, so these land after the
  // enrolment ends and restore anything the enrolment reset.
  const target = {
    deviceSerial: device.device_serial,
    subjectId: String(subject.subject_id),
  }
  try {
    const granted = await this.provider.grantAccess(credentials, target)
    const windowed =
      granted.status !== 'failed' && decision.validFrom && decision.validTo
        ? await this.provider.setValidPeriod(credentials, {
            ...target,
            startDate: formatDeviceDate(decision.validFrom),
            endDate: formatDeviceDate(decision.validTo),
          })
        : granted
    if (granted.status === 'failed' || windowed.status === 'failed') {
      await this.repo.enqueue(
        input.gymId,
        input.memberId,
        AccessIntent.ReconcileMember,
        { reason: 'post_enrol_window', force: true }
      )
    }
  } catch {
    await this.repo.enqueue(
      input.gymId,
      input.memberId,
      AccessIntent.ReconcileMember,
      { reason: 'post_enrol_window', force: true }
    )
  }
  ```
  Import `formatDeviceDate` from `@/features/access-control/utils/getGymToday` and `AccessIntent` from the config. (`force` in a payload is read by the drain from T-05 on; until then the job runs as an ordinary reconcile, which is acceptable in between.)
- **Tests:** (fake repo + `MockAccessControlProvider`, an allowed member with consent on file, one active reader)
  1. Successful enrolment records, in this order, `startFingerEnrolment` → `grantAccess` → `setValidPeriod` on that reader with the decision's `YYYYMMDD` dates.
  2. When `grantAccess` returns `failed`, the result is still `dispatched: true` and one job with payload `{ reason: 'post_enrol_window', force: true }` is enqueued.
  3. When `startFingerEnrolment` fails, neither `grantAccess` nor `setValidPeriod` is called (unchanged behaviour pinned).
  4. `BiometricConsent.test.ts` stays green (no enrolment command without consent).
- **Mutation:** delete the `setValidPeriod` call → test 1 fails.
- **Commit:**
  ```
  fix(access-control): re-send the grant and window after an enrolment

  Release-Note: none
  ```

### T-03 — `reseat` option in command derivation (D1)

- **Files:** `src/features/access-control/domain/AccessCommands.ts`, new test `src/features/access-control/tests/Reseat.test.ts`.
- **Change:**
  1. Add to `DeriveCommandsInput`: `reseat?: boolean` with a doc comment: "Delete-then-add. Implies `force`. One `RevokeBiometric` (vendor `fromdev`, which removes the subject from every reader while the vendor keeps its central copy) before the forced push, because a reader that lost its templates (restart, visit 1 D1/PH-15) ignores a plain re-push for a user it already lists. Only for an allowed, provisioned member; otherwise identical to `force`."
  2. In `deriveAccessCommands`: `const { decision, subject, deviceSerials, reseat = false } = input; const force = (input.force ?? false) || reseat`.
  3. In the allowed path, **before** the `Provision`/`SyncToDevice` pushes: if `reseat && subject.provisioned`, push exactly one `{ intent: AccessIntent.RevokeBiometric, deviceSerial: deviceSerials[0], subjectId }`.
  4. The `removeFromDevice` (cancelled) path and the not-allowed path are unchanged.
- **Tests (`Reseat.test.ts`):**
  1. Allowed, provisioned, held by `['A','B']`, readers `['A','B']`, `reseat: true` → exactly `[RevokeBiometric(A), SyncToDevice(A), SyncToDevice(B), Grant(A), Grant(B), SetValidPeriod(A), SetValidPeriod(B)]`.
  2. Allowed, **not** provisioned, `reseat: true` → no `RevokeBiometric`; first intent `Provision`.
  3. Suspended, `reseat: true` → no `RevokeBiometric`, no `SetValidPeriod` (`containsValidPeriod` false).
  4. Cancelled, `reseat: true` → identical to the same input with `reseat: false`.
  5. Allowed, provisioned, `reseat: false, force: true` → no `RevokeBiometric`.
- **Mutation:** remove the `subject.provisioned` condition → test 2 fails; remove the revoke push → test 1 fails.
- **Commit:**
  ```
  feat(access-control): derive a delete-then-add re-seat for a member

  Release-Note: none
  ```

### T-04 — SyncMemberAccess: reseat, in-order held readers, partial-failure safety, retry job (D1)

- **Files:** `src/features/access-control/services/SyncMemberAccess.ts`, new test `src/features/access-control/tests/ReseatSync.test.ts`.
- **Change:**
  1. `SyncMemberAccessInput` gains `reseat?: boolean` ("delete-then-add; see `DeriveCommandsInput.reseat`") and `retryOnFailure?: boolean` ("queue a forced reconcile when anything failed; set by the desk route, whose toast promises we will keep trying").
  2. Pass `reseat: input.reseat ?? false` to `deriveAccessCommands`.
  3. Rewrite `resolveHeldSerials(commands, heldBefore)` to apply commands **in order**: start from `new Set(heldBefore)`; `SyncToDevice` adds its serial; `RevokeBiometric` deletes its serial. Update its doc comment ("in order, because a re-seat revokes before it pushes; the cancellation sequence has no pushes, so its result is unchanged").
  4. After the dispatch loop, if `failures.length > 0`:
     - if `commands.slice(0, sent).some((c) => c.intent === AccessIntent.RevokeBiometric)` → `await this.repo.markSubjectOffDevice(context.memberId)` (fromdev already removed the member from every reader; our record must not keep claiming otherwise);
     - if `input.retryOnFailure` → `await this.repo.enqueue(context.gymId, context.memberId, AccessIntent.ReconcileMember, { reason: 'desk_resend_failed', force: true })`.
- **Tests (`ReseatSync.test.ts`):**
  1. Re-seat of an allowed member held by A and B succeeds → `updateSyncState` receives `syncedDeviceSerials` containing exactly A and B.
  2. Cancelled member held by A and B → `syncedDeviceSerials` `[]` (unchanged behaviour pinned).
  3. Re-seat where the first `syncSubjectsToDevice` fails (mock provider configured to fail it) → `markSubjectOffDevice` called once; `updateSyncState` not called.
  4. Forced (no reseat) sync failing on the first command with `retryOnFailure: true` → one job `{ reason: 'desk_resend_failed', force: true }`; with `retryOnFailure` unset → no job.
- **Mutation:** restore the old "pushes then remove revoked" order → test 1 fails; delete the `markSubjectOffDevice` call → test 3 fails.
- **Commit:**
  ```
  fix(access-control): keep our record honest when a re-seat stops halfway

  Release-Note: none
  ```

### T-05 — Outbox: force/reseat from payload; delayed and bulk enqueue (D1)

- **Files:** `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/services/DrainAccessSyncQueue.ts`, `src/features/access-control/tests/fakes.ts`, new test `src/features/access-control/tests/ReseatOutbox.test.ts`, `src/features/access-control/tests/SupabaseAccessControlRepository.test.ts` (new cases only).
- **Change:**
  1. Port: `enqueue(gymId, memberId, intent, payload?, notBefore?: Date): Promise<void>` — when `notBefore` is given, the insert sets `next_attempt_at: notBefore.toISOString()`.
  2. Port: `enqueueMany(gymId: string, jobs: Array<{ memberId: string; intent: string; payload?: Record<string, unknown>; notBefore?: Date }>): Promise<number>` — inserts in chunks of **500** rows (one `.insert([...]).select('id')` per chunk), returns rows inserted; throws `DatabaseError` on error; returns 0 for an empty list without calling the database.
  3. Drain `runJob` member path: `this.syncMember.execute({ memberId: job.member_id, today, force: job.payload?.force === true, reseat: job.payload?.reseat === true })`.
  4. Fake: both methods store jobs including `next_attempt_at`; the fake's `claimDueJobs` must skip jobs whose `next_attempt_at` is in the future (add that if it does not already).
- **Tests:**
  1. (`ReseatOutbox.test.ts`) A job with payload `{ reseat: true }` for an allowed member held by A and B makes the mock provider record `revokeBiometrics` before the first `syncSubjectsToDevice`.
  2. A job with payload `{ force: true }` re-pushes (`syncSubjectsToDevice` for both readers) with no `revokeBiometrics`.
  3. A job enqueued with `notBefore` 180 s ahead is not claimed by a drain now.
  4. (`SupabaseAccessControlRepository.test.ts`, following its existing client-mock style) `enqueueMany` with 1,001 jobs issues 3 inserts (500/500/1); `enqueue` with `notBefore` writes `next_attempt_at`.
- **Mutation:** drop `reseat:` from the `runJob` call → test 1 fails.
- **Commit:**
  ```
  feat(access-control): let outbox jobs carry force and re-seat, and wait

  Release-Note: none
  ```

### T-06 — Desk "Re-send to readers" re-seats and queues a retry on failure (D1)

- **Files:** `src/app/api/access-control/members/[id]/sync/route.ts`, `src/app/api/access-control/__tests__/access-control.routes.test.ts` (new cases only).
- **Change:** the `execute` call becomes `execute({ memberId: id, force: true, reseat: true, retryOnFailure: true })`. Update the route's header comment: add a paragraph "Visit 1 (D1): forced is not enough after a reader restart — the reader keeps the user and ignores a re-pushed template — so this re-seats: delete from the readers, then add back from VFT's central copy. A failure queues a forced retry, which is what the desk toast promises."
- **Tests:** following the route test file's existing mocking of `createSyncMemberAccess`: the route calls `execute` with exactly `{ memberId, force: true, reseat: true, retryOnFailure: true }`; 404 for another gym's member is unchanged.
- **Mutation:** set `reseat: false` → the new test fails.
- **Commit:**
  ```
  fix(access-control): re-send to readers now repairs lost fingerprints

  Release-Note: Re-send to readers now also repairs fingerprints a reader has lost.
  ```

### T-07 — Restarting a reader queues a re-seat of its members (D1)

- **Files:** `src/features/access-control/config/AccessControlConfig.ts`, `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/services/OperateDevice.ts`, `src/features/access-control/tests/fakes.ts`, `src/features/access-control/components/DeviceStatusCard.tsx`, new test `src/features/access-control/tests/ReseatAfterRestart.test.ts`.
- **Change:**
  1. Config: `export const REBOOT_RESEAT_DELAY_SECONDS = 180` with a doc comment: "A ZAM70 restart takes about a minute; the repair waits three so it lands on a reader that is back. Visit 1, D1 (PH-15): a restart kept the users and dropped their fingerprints."
  2. Port: `listMemberIdsOnDevice(gymId: string, deviceSerial: string): Promise<string[]>` — Supabase: `member_access_subjects` `.select('member_id').eq('gym_id', gymId).contains('synced_device_serials', [deviceSerial])`, paged with the repository's existing `pageAll` helper. Fake: filter its subjects the same way.
  3. `OperateDevice`: `OperateDeviceResult` gains `membersQueuedForRepair?: number`. In `operate`, after a non-`failed` outcome and only when `intent === AccessIntent.RebootDevice`:
     ```ts
     let membersQueuedForRepair = 0
     try {
       const memberIds = await this.repo.listMemberIdsOnDevice(
         input.gymId,
         device.device_serial
       )
       const notBefore = new Date(
         Date.now() + REBOOT_RESEAT_DELAY_SECONDS * 1000
       )
       membersQueuedForRepair = await this.repo.enqueueMany(
         input.gymId,
         memberIds.map((memberId) => ({
           memberId,
           intent: AccessIntent.ReconcileMember,
           payload: {
             reason: 'reader_restarted',
             reseat: true,
             deviceSerial: device.device_serial,
           },
           notBefore,
         }))
       )
     } catch (error) {
       console.error('[access-control] restart repair not queued', {
         gymId: input.gymId,
         deviceSerial: device.device_serial,
         message: error instanceof Error ? error.message : 'unknown',
       })
     }
     return { applicable: true, dispatched: true, membersQueuedForRepair }
     ```
  4. `DeviceStatusCard.tsx` restart confirm `description` becomes exactly: `'The reader will be unusable for about a minute while it restarts. Nobody can scan in during that time. Afterwards, members’ fingerprints are sent to the readers again, which takes a few minutes.'`
- **Tests:**
  1. Reboot of reader A where the fake holds members m1 (A,B), m2 (A), m3 (B) → `enqueueMany` jobs for m1 and m2 only, each payload `{ reason: 'reader_restarted', reseat: true, deviceSerial: 'A' }`, `notBefore` ≥ now + 179 s.
  2. Door open → nothing enqueued beyond the existing audit row.
  3. Reboot whose vendor call fails → nothing enqueued.
  4. `enqueueMany` throwing → result still `dispatched: true`, `membersQueuedForRepair: 0`.
- **Mutation:** remove the `intent === RebootDevice` condition → test 2 fails.
- **Allowed test updates:** a render test asserting the old restart description text may be updated to the new text.
- **Commit:**
  ```
  fix(access-control): repair fingerprints after a reader restart

  Release-Note: Fingerprints keep working after a reader is restarted from the Door Access page.
  ```

### T-08 — Removing a fingerprint erases the vendor record and re-provisions (D2, F-05)

- **Files:** `src/features/access-control/services/ManageMemberBiometric.ts`, `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/tests/fakes.ts`, new test `src/features/access-control/tests/BiometricErasure.test.ts`.
- **Change:**
  1. Port: `replaceSubjectAfterErasure(memberId: string, newSubjectId: number): Promise<void>`. Supabase: one `update` on `member_access_subjects` `.eq('member_id', memberId)` setting `subject_id: newSubjectId, provisioned_at: null, synced_device_serials: [], device_removed_at: now, last_synced_at: null, last_synced_valid_from: null, last_synced_valid_to: null, last_synced_blocked: null, finger_enrolled: false, finger_id: null, enrolled_at: null, updated_at: now`, with `.select('id')`; throw `DatabaseError('Failed to replace subject after erasure: no row updated')` when zero rows come back (rule 2.7: a no-match update reports success). Fake: same fields on its stored subject; throw when absent.
  2. `ManageMemberBiometric.clear(gymId, memberId)` becomes, after the existing credential and member checks:
     1. If `context.subject.provisioned_at !== null`: `outcome = await this.provider.removeSubject(credentials, String(context.subject.subject_id))`. If `outcome.status === 'failed'` **and** `!/not found/i.test(outcome.error)` → return `{ applicable: true, dispatched: false, error: 'The reader did not accept the request' }` (consent stays — existing rule).
     2. `const newSubjectId = await this.repo.allocateSubjectId()`
     3. `await this.repo.replaceSubjectAfterErasure(memberId, newSubjectId)`
     4. `await this.repo.clearBiometricConsent(memberId)`
     5. `await this.repo.enqueue(gymId, memberId, AccessIntent.ReconcileMember, { reason: 'biometric_withdrawn' })`
     6. `return { applicable: true, dispatched: true }`
        Remove the old `revokeBiometrics` / `setBiometricEnrolled(false)` / `markSubjectOffDevice` calls from `clear`.
  3. Rewrite the file header's "Why clearing is its own operation" paragraph: clearing now deletes the vendor's record ("server and all devices"), because `fromdev` keeps a central copy that any later sync re-installed without consent (visit 1, D2/PH-19); the member gets a new subject id so no template keyed to the old id can ever be re-attached; a still-entitled member is re-provisioned by the queued reconcile with no fingerprint. Keep the sentence that a membership is untouched.
- **Tests (`BiometricErasure.test.ts`):**
  1. Provisioned member with a fingerprint and consent → provider records `removeSubject(oldId)` and **no** `revokeBiometrics`; afterwards the stored subject has a new `subject_id ≠ oldId`, `provisioned_at` null, `synced_device_serials` `[]`, `finger_enrolled` false; consent cleared; one `reconcile_member` job `{ reason: 'biometric_withdrawn' }`.
  2. Then running `SyncMemberAccess` for that (active, allowed) member → provider records `upsertSubject(newId)`, `syncSubjectsToDevice` for each active reader, grants and windows — and never anything with `oldId`.
  3. Vendor answers `failed` with error "Cannot delete Employee with id=… The Employee was not found!" → proceeds exactly as test 1.
  4. Vendor answers `failed` with any other error → `dispatched: false`, consent **not** cleared, subject id unchanged, no job.
  5. Never-provisioned subject → no vendor call; still rotated, consent cleared, job queued.
  6. `BiometricConsent.test.ts` and `BiometricConsentPersistence.test.ts` stay green.
- **Allowed test updates:** an existing test of `clear` that asserts `revokeBiometrics` was called may be changed to assert `removeSubject`; one asserting `markSubjectOffDevice`/`setBiometricEnrolled(false)` may be changed to assert the subject row state from test 1. Nothing else.
- **Mutation:** skip step 2.3 (no rotation) → test 2 fails on the old id; use `revokeBiometrics` instead of `removeSubject` → test 1 fails.
- **Commit:**
  ```
  fix(access-control): removing a fingerprint now erases it at the vendor

  - fromdev kept VFT's central copy; the next re-send or registration sync put
    the withdrawn finger back without consent (visit 1, D2, PH-19)
  - the member gets a new device id, so no old template can be re-attached
  - a still-active member is re-provisioned without a fingerprint (F-05)

  Release-Note: Removing a member's fingerprint now deletes it everywhere, and it cannot come back without asking the member again.
  ```

### T-09 — Refused scan of an entitled member queues a forced re-push (D3)

- **Files:** `src/features/access-control/config/AccessControlConfig.ts`, `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/services/RecordAccessEvents.ts`, `src/features/access-control/tests/fakes.ts`, new test `src/features/access-control/tests/RefusalRepair.test.ts`.
- **Change:**
  1. Config: `export const REFUSAL_REPAIR_EVENT_CODES = ['23', '29'] as const` and `export const REFUSAL_REPAIR_COOLDOWN_SECONDS = 900`, with a doc comment citing visit 1 D3 and DEC-06.
  2. Port: `hasRecentJob(memberId: string, reason: string, sinceSeconds: number): Promise<boolean>` — Supabase: `access_sync_jobs` `.select('id').eq('member_id', memberId).eq('payload->>reason', reason).gte('created_at', <now − sinceSeconds>).limit(1)`; true when a row comes back. Fake: same over stored jobs (store `created_at` on enqueue).
  3. `RecordAccessEvents`: summary gains `refusalRepairsQueued: number` (initialise 0). After `confirmEnrolments` for a device, call a new private `repairRefusals(normalised, summary)`:
     - collect distinct `memberId`s of events with `memberId` set, `verifyType === VerifyType.Fingerprint`, and `eventCode` in `REFUSAL_REPAIR_EVENT_CODES`;
     - for each, inside its own `try`: `getMemberAccessContext(memberId)`; skip if null; `resolveAccessDecision({ status, membershipStartDate, nextDueDate, registrationSource, verifiedAt, today: getGymToday() })`; skip if not `allowed`; skip if `hasRecentJob(memberId, 'door_refused', REFUSAL_REPAIR_COOLDOWN_SECONDS)`; else `enqueue(context.gymId, memberId, AccessIntent.ReconcileMember, { reason: 'door_refused', force: true })` and `summary.refusalRepairsQueued += 1`;
     - `catch` → `summary.errors.push(\`Refusal repair for member ${memberId}: ${message}\`)`. Never throw (the webhook is always-200).
- **Tests (`RefusalRepair.test.ts`):**
  1. Active member, due in the future, scan `Event '23'`, `VerifyType '1'` → one job `{ reason: 'door_refused', force: true }`; `refusalRepairsQueued` 1.
  2. Same with `'29'` → one job.
  3. `'3'` (granted) → no job.
  4. Member whose due date is yesterday → no job.
  5. Two deliveries of a refusal 1 minute apart → one job total.
  6. Card scan (`VerifyType '2'`) with `'23'` → no job.
  7. `getMemberAccessContext` throwing → delivery still stores the scan; error recorded; no throw.
- **Mutation:** remove the `allowed` check → test 4 fails; remove the cooldown check → test 5 fails.
- **Commit:**
  ```
  fix(access-control): re-send access when a paid-up member is refused at the door

  Release-Note: If a paid-up member is turned away at the door, their access is sent to the readers again automatically.
  ```

### T-10 — Enrolment: 30 s wait, 3 min quiet confirmation, new copy (D4, PH-04)

- **Files:** `src/features/access-control/config/AccessControlConfig.ts`, `src/features/access-control/hooks/useAccessControl.ts`, `src/features/access-control/components/MemberAccessPanel.tsx`, `src/features/access-control/tests/useEnrolmentPoll.test.tsx`.
- **Change:**
  1. `ENROLMENT_POLL_TIMEOUT_MS = 30_000`. Rewrite its doc comment: "Thirty seconds. The reader's own enrolment window is about ten seconds (ZAM70, measured on visit 1, PH-21); the rest covers the member's confirming scan. **Timing out is not failure** (keep the existing paragraph)."
  2. New `export const ENROLMENT_CONFIRM_GRACE_MS = 180_000` with doc: "After the visible wait ends, the panel keeps checking quietly this long, so the member's first scan flips it to Registered without a reload (visit 1, PH-04)."
  3. `useEnrolmentPoll` tick: keep a closure flag `let timedOut = false`. When `elapsed >= ENROLMENT_POLL_TIMEOUT_MS` and `!timedOut`: set `timedOut = true`, `setState('timed-out')`, invalidate the member query (as today), and **keep scheduling**. When `elapsed >= ENROLMENT_POLL_TIMEOUT_MS + ENROLMENT_CONFIRM_GRACE_MS`: stop scheduling. An `enrolled` answer at any point (before or after the timeout) does what it does today: `setState('enrolled')`, both invalidations, stop.
  4. `MemberAccessPanel.tsx` `EnrolmentStatus` copy, exactly:
     - `awaiting`: `The reader is waiting for the finger now and gives up after about 10 seconds. Once it accepts the finger, ask the member to scan once to confirm.`
     - `timed-out`: `Not confirmed yet. If the reader accepted the finger, ask the member to scan once and this will update by itself for the next few minutes. If the reader gave up, start again.`
- **Tests (`useEnrolmentPoll.test.tsx`, following its existing timer helpers):**
  1. Existing timeout tests keep passing unchanged (they use the constant).
  2. New: after the timeout, an `enrolled: true` answer at timeout + 60 s moves the state to `enrolled`.
  3. New: no enrolment request is made after timeout + grace + 10 s (count the mocked `getMemberEnrolment` calls before and after advancing).
- **Allowed test updates:** (a) a test asserting the old panel copy may be updated to the new copy; (b) the existing test `'stops polling once it has timed out'` encodes the old rule and **must** change: rename it `'stops polling once the quiet confirmation window has passed'`, advance `ENROLMENT_POLL_TIMEOUT_MS + ENROLMENT_CONFIRM_GRACE_MS + 5_000` before taking `callsAtTimeout`, keep the rest. (That makes new test 3 the same assertion; keep only the renamed one if they are identical.)
- **Mutation:** stop scheduling at the timeout (old behaviour) → test 2 fails.
- **Commit:**
  ```
  fix(access-control): match the enrolment wait to the reader and confirm quietly

  Release-Note: Registering a fingerprint now finishes in about 30 seconds and confirms itself when the member scans.
  ```

### T-11 — 429 and 408 are retryable (F-02)

- **Files:** `src/lib/access-control/VftAccessControlProvider.ts`, new test `src/lib/access-control/__tests__/VendorRetryClassification.test.ts` (model the fetch mocking on `VftAccessControlProvider.test.ts`).
- **Change:** in `isRetryable`, first line inside the `VendorRequestError` branch: `if (error.status === 429 || error.status === 408) return true`. Update the function's doc comment: "429 (rate limited) and 408 (timeout) clear by waiting; dead-lettering them is how a vendor throttle once killed a queue (remote day, F-02)."
- **Tests:** a command (e.g. `grantAccess`) whose fetch answers: 429 → `failed`, `retryable: true`, `needsAttention: false`; 408 → same; 400 → `retryable: false`, `needsAttention: true`; 500 `{"message":"Data too long for column 'EmpId'"}` → `retryable: false`; bare 500 → `retryable: true`; 502 → `retryable: true`.
- **Mutation:** remove the new line → 429/408 tests fail.
- **Commit:**
  ```
  fix(access-control): retry when the door system is busy instead of giving up

  Release-Note: none
  ```

### T-12 — Rejected sign-in needs attention and marks the account; sign-in 5xx retries (F-03)

- **Files:** `src/lib/access-control/IAccessControlProvider.ts`, `src/lib/access-control/VftAccessControlProvider.ts`, `src/features/access-control/services/SyncMemberAccess.ts`, `src/features/access-control/services/DrainAccessSyncQueue.ts`, new tests `src/lib/access-control/__tests__/SignInRejection.test.ts` and `src/features/access-control/tests/CredentialRejection.test.ts`.
- **Change:**
  1. `CommandOutcome` failed variant gains `credentialsRejected?: boolean` (doc: "The vendor refused our sign-in: a person must re-enter the account. Never retried.").
  2. `signIn`: when `!response.ok`: status 400/401/403 → `throw new VendorAuthError(\`Sign-in rejected with status ${status}\`)` (unchanged message); any other status → `throw new VendorRequestError(\`Sign-in failed with status ${status}\`, status, (await response.text()).slice(0, 300))`.
  3. `command()` catch for `VendorAuthError` returns `{ status: 'failed', error: error.message, retryable: false, needsAttention: true, credentialsRejected: true }`.
  4. `SyncFailure` gains `credentialsRejected?: boolean`; `SyncMemberAccess` copies `outcome.credentialsRejected ?? false` into the failure it pushes.
  5. `DrainAccessSyncQueue.settleFailure`: first statement `if (failure.credentialsRejected) await this.repo.markAccountVerificationFailed(gymId)`.
- **Tests:**
  1. Provider: sign-in answering 401 → a command's outcome has `credentialsRejected: true`, `needsAttention: true`, `retryable: false`.
  2. Provider: sign-in answering 503 → `retryable: true`, no `credentialsRejected`.
  3. Drain (fake repo + a provider stub whose commands return the test-1 outcome): the job is dead, `needingAttention` 1, `markAccountVerificationFailed` called once with the job's gym.
- **Mutation:** drop `needsAttention: true` from the auth branch → test 1 fails; remove the `markAccountVerificationFailed` line → test 3 fails.
- **Commit:**
  ```
  fix(access-control): flag a rejected VFT sign-in for the gym owner

  Release-Note: If the door system rejects your VFT login, the Access Control settings now say so.
  ```

### T-13 — Unparseable dates refuse access (F-04)

- **Files:** `src/features/access-control/domain/AccessDecision.ts`, `src/features/access-control/tests/AccessDecision.test.ts` (new cases only).
- **Change:** in `resolveAccessDecision`, after the Suspended branch and before the QR branch:
  ```ts
  // A date we cannot read must never open a door: NaN compares false both
  // ways, which made `today > dueDate` false and admitted the member
  // (remote day, F-04). Fails closed.
  if ([today, startDate, dueDate].some((d) => Number.isNaN(d.getTime()))) {
    return denied(AccessDenialReason.Expired)
  }
  ```
- **Tests:** active member with `nextDueDate: new Date('garbage')` → `allowed` false, reason `expired`; same with an invalid `membershipStartDate`; cancelled member with an invalid due date → `removeFromDevice` true.
- **Mutation:** remove the guard → first test fails.
- **Commit:**
  ```
  fix(access-control): refuse access when a membership date cannot be read

  Release-Note: none
  ```

### T-14 — Shifted re-delivery is a duplicate; skew only from fresh scans (F-01)

- **Files:** `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/services/RecordAccessEvents.ts`, `src/features/access-control/tests/fakes.ts`, new test `src/features/access-control/tests/ShiftedRedelivery.test.ts`.
- **Change:**
  1. Port: `findExistingEvents(gymId: string, deviceSerial: string, from: Date, to: Date): Promise<Array<{ subjectId: number; occurredAt: Date; eventCode: string | null }>>` — Supabase: `access_events` `.select('subject_id, occurred_at, event_code').eq('gym_id', gymId).eq('device_serial', deviceSerial).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString())` through `pageAll`. Fake: filter its stored events (its `recordEvents` must store them).
  2. `RecordAccessEvents.execute`, per device, after building `normalised` and before `recordEvents`:
     - `const offsetMs = device.timezone_offset_minutes * 60_000`.
     - If `offsetMs !== 0` and `normalised.length > 0`: shifted instants `s = e.occurredAt + offsetMs`; query `findExistingEvents(gym, deviceSerial, min(s), max(s))`; build a set of keys `${subjectId}|${eventCode ?? ''}|${instant ISO}`; an event whose shifted key is in the set is a **shifted duplicate**: remove it from `normalised`, add 1 to `summary.duplicates` and to a new `summary.redeliveredShifted`.
     - `newestScan` is computed from the remaining `normalised` only (move its computation after this filter).
     - Record skew only when the delivery stored something new: declare `let inserted = 0` before the `if (normalised.length > 0)` block, set `inserted = result.inserted` inside it, and change the skew block's condition from `if (newestScan)` to `if (newestScan && inserted > 0)`. A delivery with nothing new carries no fresh timing.
  3. Summary gains `redeliveredShifted: number` (initialise 0), doc: "Scans the vendor re-delivered in UTC (events pull) whose original we already hold — remote day F-01. Counted as duplicates too."
- **Tests (`ShiftedRedelivery.test.ts`, device offset 330):**
  1. Stored event (subject 1, code `'3'`, occurred `2026-10-09T07:04:07Z`); delivery `AttTime '2026-10-09 07:04:07'`, `EmpId '1'`, `Event '3'` → `stored` 0, `duplicates` 1, `redeliveredShifted` 1, `recordDeviceClockSkew` **not** called.
  2. Same delivery plus one fresh scan dated now (local) → `stored` 1, skew recorded once from the fresh scan (|skew| < 60).
  3. An exact re-delivery of an already-stored live scan (same AttTime as stored) → `stored` 0 and skew not recorded.
  4. Same subject/code exactly 5 h 30 min apart but a **different** event code → both stored (not a duplicate).
  5. Device offset 0 → no `findExistingEvents` call.
- **Mutation:** remove the `inserted > 0` condition → test 1 or 3 fails; remove the shifted filter → test 1 fails.
- **Commit:**
  ```
  fix(access-control): ignore scans the vendor re-sends in UTC

  Release-Note: none
  ```

### T-15 — Webhook resolves members once per delivery (F-09)

- **Files:** `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/services/RecordAccessEvents.ts`, `src/features/access-control/tests/fakes.ts`, new test `src/features/access-control/tests/BatchedMemberResolution.test.ts`.
- **Change:**
  1. Port: `findMemberIdsBySubjectIds(gymId: string, subjectIds: number[]): Promise<Map<number, string>>` — Supabase: chunks of **100** ids (transport limit, trap 15), `.from('member_access_subjects').select('member_id, subject_id').eq('gym_id', gymId).in('subject_id', chunk)`. Empty input → empty map, no query. Fake: same over stored subjects.
  2. `RecordAccessEvents`, per device: collect the distinct finite subject ids of the device's events first, call `findMemberIdsBySubjectIds` once, and read `memberId` from the map (`?? null`) instead of calling `findMemberIdBySubjectId` per event. Leave `findMemberIdBySubjectId` in the port (other callers may exist).
- **Tests:** a 500-event delivery for 3 subjects on one reader → `findMemberIdsBySubjectIds` called once with 3 ids, `findMemberIdBySubjectId` called 0 times (spy on the fake); member ids stored correctly; an unknown subject stores `member_id` null.
- **Mutation:** revert to the per-event call → the call-count assertion fails.
- **Commit:**
  ```
  perf(access-control): look up members once per scan delivery

  Release-Note: none
  ```

### T-16 — Job results guarded by the claimed attempt (F-10)

- **Files:** `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/services/DrainAccessSyncQueue.ts`, `src/features/access-control/tests/fakes.ts`, new test `src/features/access-control/tests/JobCompletionGuard.test.ts`, `src/features/access-control/tests/SupabaseAccessControlRepository.test.ts` (new cases only).
- **Change:**
  1. Port: `completeJob(jobId, status, expectedAttempts?: number): Promise<boolean>` and `failJob(jobId, error, retryable, expectedAttempts?: number): Promise<boolean>` — return true when a row was updated.
  2. Supabase: both updates gain `.select('id')`. When `expectedAttempts` is given: add `.eq('status', AccessSyncStatus.InFlight).eq('attempts', expectedAttempts)`, and `failJob` uses `expectedAttempts` for the backoff instead of reading the row first. Without it, behaviour is as today (still returning the row count).
  3. Drain: summary gains `superseded: number` (doc: "Results dropped because a reclaim gave the job to another run first — remote day F-10."). Every `completeJob`/`failJob` call passes `job.attempts`; `settleFailure` takes the job's attempts as a new parameter. When a call returns false: `summary.superseded += 1` and do **not** count it as succeeded/retrying/dead.
  4. Fake: implements the same guard over its stored job (`status` and `attempts`).
- **Tests:**
  1. Drain where the fake bumps the job's `attempts` and resets it to `pending` during `runJob` (simulated reclaim) → `succeeded` 0, `superseded` 1, job left `pending`.
  2. Normal run → `succeeded` 1, `superseded` 0.
  3. Repository mock: `completeJob(id, Succeeded, 3)` applies `eq('status','in_flight')` and `eq('attempts', 3)`.
- **Mutation:** drop the attempts filter in the fake → test 1 fails.
- **Commit:**
  ```
  fix(access-control): never let a slow worker overwrite a reclaimed job

  Release-Note: none
  ```

### T-17 — Door opens and restarts never repeat after an interruption (F-11)

- **Files:** `src/features/access-control/services/DrainAccessSyncQueue.ts`, `scripts/hw-session.ts` (the `reclaim` function only), new test `src/features/access-control/tests/DeviceOperationsOnce.test.ts`.
- **Change:**
  1. `runJob` receives `attempts` on its `job` parameter type. In the device-operation branch, after the existing `dispatchedInline` check: `if (job.attempts > 1) return [{ message: 'Not repeated: a door open or restart is never sent again after an interruption', retryable: false, needsAttention: false }]`.
  2. `scripts/hw-session.ts` `reclaim()`: select `id, gym_id, member_id, intent, updated_at`, and exclude from `real` any job with `member_id === null` and `intent` `'open_door'` or `'reboot_device'` (they can no longer run twice). Add a one-line comment saying so.
- **Tests:** a queued (non-inline) `reboot_device` job with `attempts: 2` → provider `rebootDevice` not called, job dead, `needingAttention` 0; with `attempts: 1` → dispatched once.
- **Verify the console:** `npx tsx scripts/hw-session.ts help` exits 0 (`npm run type-check` covers the types; `scripts/` is in `tsconfig`).
- **Mutation:** remove the `attempts > 1` line → the attempts-2 test fails.
- **Commit:**
  ```
  fix(access-control): never repeat a door open or restart after a crash

  Release-Note: none
  ```

### T-18 — Undecodable session cookie answers 401 (F-06)

- **Files:** `src/lib/auth/requireAccessControlGym.ts`, `src/lib/middleware/api-auth.ts`, new tests `src/lib/auth/__tests__/requireAccessControlGym.test.ts` and `src/lib/middleware/__tests__/api-auth.test.ts` (create the directories if missing).
- **Change:** in both helpers wrap `await createClient()` and `await supabase.auth.getUser()` in one `try`; on `catch`, return exactly what the "no user" branch returns today (401). Comment: "A corrupted cookie makes the client throw before it can say 'no user'; that is still no user, not a server fault (remote day F-06, AP-02)."
- **Tests:** mock `@/lib/supabase/server` so `auth.getUser` rejects with `new Error('Invalid base64')` → status 401; resolves `{ data: { user: null } }` → 401 (unchanged).
- **Mutation:** remove the `try` → the rejecting test fails with an unhandled error.
- **Commit:**
  ```
  fix(auth): answer 401, not 500, to a corrupted session cookie

  Release-Note: none
  ```

### T-19 — Serial upper-cased; checked against the VFT account (F-07)

- **Files:** `src/features/access-control/schemas/access-control.schemas.ts`, new `src/features/access-control/services/RegisterDevice.ts`, `src/features/access-control/services/factory.ts`, `src/features/access-control/index.ts` (export the factory), `src/app/api/access-control/devices/route.ts`, new test `src/features/access-control/tests/RegisterDevice.test.ts`, `src/app/api/access-control/__tests__/access-control.routes.test.ts` (new cases only).
- **Change:**
  1. Schema: the `deviceSerial` preprocess trims **and upper-cases** (`String(v).trim().toUpperCase()` for strings). Update its comment: "Upper-cased because vendors print and send serials in capitals; a lower-case copy was a second reader that matched no scan (remote day F-07)."
  2. `RegisterDevice` use case (`constructor(repo, provider)`; `execute(gymId, input)` → `Promise<{ device?: AccessDevice; notOnAccount?: boolean }>`):
     ```ts
     try {
       const credentials = await this.repo.getCredentials(gymId)
       if (credentials) {
         const serials = (await this.provider.listDevices(credentials)).map(
           (d) => d.serial.trim().toUpperCase()
         )
         if (serials.length > 0 && !serials.includes(input.deviceSerial))
           return { notOnAccount: true }
       }
     } catch {
       // The check is a typo guard, not a gate: an unreachable vendor must not stop a gym adding its reader.
     }
     return { device: await this.repo.registerDevice(gymId, input) }
     ```
  3. Factory: `createRegisterDevice(supabase)` modelled exactly on `createOperateDevice`; export from the barrel next to it.
  4. Route POST: `const result = await createRegisterDevice(createAdminClient()).execute(caller!.gymId, parsed.data)`; `notOnAccount` → `400` `ResponseBuilder.badRequest('This serial is not on your VFT account. Check the label on the reader, or ask VFT to add the reader to your account.')`; else 201 as today.
- **Tests:** vendor lists `NYU7251900077` → register `' nyu7251900077 '` succeeds stored as `NYU7251900077`; vendor lists only `NYU7254500734` → `notOnAccount`, nothing registered; vendor list empty → registers; `listDevices` throws → registers; no credentials → registers. Route: `notOnAccount` → 400 with that message.
- **Mutation:** drop `.toUpperCase()` in the schema → the lower-case test fails.
- **Commit:**
  ```
  fix(access-control): check a reader's serial against the VFT account

  Release-Note: Reader serial numbers are now checked against your VFT account when you add a reader.
  ```

### T-20 — Vendor address must be https (F-08)

- **Files:** `src/features/access-control/schemas/access-control.schemas.ts`, new test `src/features/access-control/tests/BaseUrlSchema.test.ts`.
- **Change:** `baseUrl: z.string().url('Must be a valid URL').refine((u) => { const { protocol, hostname } = new URL(u); return protocol === 'https:' || (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) }, 'The VFT address must start with https://')`.
- **Tests:** `https://acccloudlk.com` ok; `http://acccloudlk.com` rejected with that message; `http://127.0.0.1:4012` ok; `http://localhost:4012` ok; `ftp://x.com` rejected.
- **Allowed test updates:** none. If an existing test or fixture uses an `http://` non-local URL, stop the task (`blocked`) and name the file.
- **Mutation:** return `true` from the refine → the http test fails.
- **Commit:**
  ```
  fix(access-control): require an encrypted address for the VFT account

  Release-Note: none
  ```

### T-21 — Sign-in rate limit (F-09)

- **Files:** `src/app/api/auth/login/route.ts`, new test `src/app/api/auth/login/__tests__/route.test.ts` (model on `src/app/api/public/registrations/__tests__/route.test.ts`).
- **Change:** at the top of `POST`'s `try`, before parsing the body: `const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'`; if `!checkRateLimit(\`login:ip:${ip}\`, 10, 15 * 60_000)` → `429` `{ success: false, error: 'Too many sign-in attempts. Wait 15 minutes and try again.', errorCode: 'rate_limited' }`. After `loginSchema.parse(body)`: same with key `login:email:${validatedData.email.toLowerCase()}`and limit **5**. Constants named`LOGIN_IP_LIMIT`, `LOGIN_EMAIL_LIMIT`, `LOGIN_WINDOW_MS` at the top of the file.
- **Tests:** call `resetRateLimits()` in `beforeEach`; mock `loginWithPassword` to fail; 5 failed attempts for one email → 6th is 429; 10 attempts from one IP with different emails → 11th is 429; a different IP and email are unaffected.
- **Mutation:** raise the email limit to 50 → the email test fails.
- **Commit:**
  ```
  fix(auth): slow down repeated sign-in attempts

  Release-Note: none
  ```

### T-22 — Re-send debounced; reader count refreshed and relabelled (F-13, PH-16)

- **Files:** `src/features/access-control/components/MemberAccessPanel.tsx`, `src/features/access-control/components/DeviceStatusCard.tsx`, `src/features/access-control/services/RefreshDeviceStatus.ts`, new tests `src/features/access-control/tests/ResendDebounce.test.tsx`, `src/features/access-control/tests/DeviceCount.test.tsx`, `src/features/access-control/tests/RefreshRecount.test.ts`.
- **Change:**
  1. Panel: `const syncInFlight = useRef(false)`; `handleSync` starts with `if (syncInFlight.current) return; syncInFlight.current = true` and wraps its body in `try { … } finally { syncInFlight.current = false }`. (`useRef` from React; keep all hooks above the early returns.)
  2. Card: the label `Fingerprints` becomes `Members on this reader`. Nothing else in the card changes.
  3. `RefreshDeviceStatus.execute`: summary gains `devicesRecounted: number`. For each gym, right after `active` is computed and before the vendor `listDevices` call, for each active device: `try { await this.repo.recountDeviceTemplates(device.id); summary.devicesRecounted += 1 } catch (error) { summary.errors.push(\`Recount ${device.device_serial}: ${message}\`) }`.
- **Tests:**
  1. Two synchronous clicks on "Re-send to readers" (fire both before awaiting) → the sync mutation function is called once (model rendering on `ResendToast.test.tsx`).
  2. Card with `templateCount 4, templateCapacity 100` renders `Members on this reader`, `4 / 100`, and a progress bar; with `templateCount 0, templateCapacity 100` renders `0 / 100` and a progress bar (pins LD-06 behaviour); with capacity `null` renders the "Add this reader's capacity" hint.
  3. Refresh: two active devices → `recountDeviceTemplates` called twice, `devicesRecounted` 2, even when the vendor `listDevices` throws.
- **Allowed test updates:** existing tests asserting the text `Fingerprints` on the card may be changed to `Members on this reader`.
- **Mutation:** remove the ref guard → test 1 fails.
- **Commit:**
  ```
  fix(access-control): keep reader counts current and stop double re-sends

  Release-Note: The Door Access page now shows how many members each reader holds.
  ```

### T-23 — Attempt-limit constant and retention figure pinned (F-14)

- **Files:** `src/features/access-control/config/AccessControlConfig.ts`, `src/features/access-control/tests/SupabaseAccessControlRepository.test.ts` (new cases), `src/features/access-control/tests/AccessEventRetention.test.ts` (new case).
- **Change:** `export const SYNC_MAX_ATTEMPTS = SYNC_RETRY_BACKOFF_SECONDS.length + 1` with doc: "Six. Each of the five backoff steps follows a failure; the sixth failure has no step left and dead-letters (`backoffSecondsFor` returns null). Remote day F-14: the old value 5 described the ladder, not the attempts."
- **Tests:**
  1. Repository mock: `failJob` on a job whose stored `attempts` is 5 → status `failed`, next attempt ≈ now + 7200 s; `attempts` 6 → status `dead`. Assert `SYNC_MAX_ATTEMPTS === 6`.
  2. Retention: read `src/app/privacy/page.tsx` with `fs.readFileSync` and assert it contains `12 months` while `ACCESS_EVENT_RETENTION_DAYS === 365` (comment: "one decision in two places — trap 13").
- **Mutation:** set the constant back to `.length` → test 1's constant assertion fails.
- **Commit:**
  ```
  test(access-control): pin the retry limit and the published retention figure
  ```

### T-24 — Console: stub-log redaction, e2e-account, closed pipe (F-15, F-17)

- **Files:** `scripts/hw-session.ts` only.
- **Change:**
  1. `stubLog()`: the cell `(e.query || e.body).slice(0, 60)` becomes `redact(e.query || e.body).slice(0, 60)` (the file's existing `redact` helper).
  2. `e2eAccount()`: after printing the rows, for every gym in `E2E_GYMS` with no row print `  E2E ${name} gym vendor account: none`.
  3. Near the top of the file's main entry (before dispatching the command): `process.stdout.on('error', (e: NodeJS.ErrnoException) => { if (e.code === 'EPIPE') process.exit(0); throw e })`.
- **Verify:** `npm run type-check`; `npx tsx scripts/hw-session.ts help | head -3` exits without an EPIPE stack trace; `npx tsx scripts/hw-session.ts coverage` — if it prints a coverage report it must pass; if it refuses because of the phase or gate, record its first line in the tracker note (not a failure).
- **No unit tests** (the console has none); the tracker note lists the three verifications.
- **Commit:**
  ```
  chore(scripts): redact stub logs, list every E2E gym, survive a closed pipe
  ```

### T-25 — Docs (D1, D2, D3, D4, F-01)

- **Files:** `docs/architecture/access-control-hardware-session.md`, `docs/integrations/vft/vft-api-reference.md`, `docs/architecture/access-control-master.md`, `.claude/rules/architecture.md`.
- **Change (text to add; keep everything else):**
  1. `access-control-hardware-session.md` line 235: replace `` `≥ 0` success (enrol gives `6`). `` with `` `≥ 0` success — except **Enroll User**: `0` = a finger was taken, `6` = the reader's ~10 s enrolment window timed out with no finger (measured 2026-10-09, PH-07/PH-21). ``
  2. `vft-api-reference.md`, new subsection at the end of §4.1 titled `### Measured 2026-10-09: pulled events arrive in UTC`: three sentences — the pull re-delivers through the webhook; `AttTime` is UTC while live deliveries are reader-local; we treat a copy shifted by exactly the reader's offset as a duplicate (DEC-08) and production does not call this endpoint until VFT explains (O-5).
  3. `vft-api-reference.md` §2, after the "Two conventions…" table: a short paragraph `**Withdrawal uses DeleteEmployee, cancellation uses DeleteFromAllDevice.**` explaining DEC-05 vs trap 5 in four sentences.
  4. `access-control-master.md` §6: a new `### Eleventh audit (2026-10-09) — the first visit with fingers on the readers` with a table of rows **AB1** (D1 restart drops templates → re-seat), **AB2** (D2 withdrawal resurrected by central copy → erase + new subject id), **AB3** (D3 event 23 until Access Grant → grant on hand-over, after enrolment, refusal repair), **AB4** (F-01 pulled events in UTC → shifted duplicates), **AB5** (F-02/F-03 vendor throttle and auth classification), each in the existing table format: `| # | Inverted assumption | The defect |`. Inverted assumptions, in order: "A reader keeps what it was given across a restart"; "Deleting a template from the readers deletes it"; "A member we pushed is a member the reader admits"; "Every delivery speaks reader-local time"; "A 4xx is the request's fault".
  5. `.claude/rules/architecture.md` Pattern Index row 2.20: immediately after the sentence that ends `…never sent a validity period (firmware can reset the block).` insert: ` **Withdrawal is not cancellation:** "Remove fingerprint" deletes the vendor record (\`removeSubject\`) and gives the member a new subject id, because \`fromdev\` keeps a central copy any later sync re-installed without consent (visit 1, D2); the desk "Re-send to readers" and a restart's repair re-seat (\`fromdev\` then push), because a restarted reader keeps users but drops their templates (D1).`Escape no pipes (there are none in this text). Then run`npm run arch:check` — its UI7 rule checks this file.
- **Commit:**
  ```
  docs(access-control): record the visit 1 defects and their fixes
  ```

### T-26 — Final gate, access-control E2E specs, draft PR, hand-off

- **Steps:**
  1. Full gate: `npm run type-check && npm test && npm run arch:check && npm run lint` → green.
  2. `npm run build` with no dev server running (`pkill -f '^next-server'` first) → exits 0. If it fails **only** while fetching `next/font/google` (no network to Google Fonts from this machine), record that line in the hand-off and continue; any other build error stops the task (`blocked`).
  3. Access-control E2E specs per `docs/architecture/access-control-master.md` §8.2 (with `ACCESS_CONTROL_ENABLED=false`, already checked in T-00): `npx playwright test tests/e2e/access-control-setup.spec.ts tests/e2e/access-control-dashboard.spec.ts tests/e2e/access-control-member.spec.ts`. Expected: **14 passed, 1 skipped**. Any other result → record the failing spec names and the first line of each `error-context.md` in the hand-off; do not change specs to pass.
  4. `git push -u origin fix/access-control-visit-1-defects`.
  5. `gh pr create --draft --base master --title "fix(access-control): visit 1 defects (D1–D5, F-01–F-17)" --body-file <file>` where the body lists every task with its commit hash and the tracker URL, states "Visual check not done by the executing session (R-2)", and ends with the attribution lines required by the session.
  6. Tracker: write `log/handoff` (§8) with: branch, PR URL, gate results with counts, E2E result, every `blocked`/`skipped` task with its reason, and "Not verified: rendering (R-2); hardware behaviour (visit 2, R-3)".
- **Commit:** none (push and PR only).

---

## 7. Owner actions (not for the executing session)

| ID  | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-1 | Merge PR #103 (`chore/hw-session-reader-a-serial`) — ideally before the Sonnet session, so the fix branch starts from master. A `chore` merge makes no release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| O-2 | Rotate `ACCESS_CONTROL_WEBHOOK_TOKEN` (Vercel + `.env.local`; 64 hex chars) and register the new callback URL with VFT. The old token was pasted into a session on 2026-10-09.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| O-3 | Rotate the VFT account password, then re-enter it **through the deployed app**, never locally (one ciphertext, one key — 25 days of dead jobs last time).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| O-4 | Decide cleanups. If approved, Opus runs, after a snapshot: `delete from access_events where device_serial='NYU7251900077' and created_at between '2026-10-09 07:55:00+00' and '2026-10-09 07:55:10+00' and subject_id=1;` (the 3 XC-10 rows); the 6 stub dead jobs (`select id, member_id, last_error from access_sync_jobs where status='dead'` first); E2E webhook-test rows on the E2E gyms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| O-5 | Send VFT these questions: (1) Does `DELETE /api/template/{EmpId}` remove the fingerprint templates from your servers permanently? (2) Why does a reader restarted with RebootByDevSN keep its users but lose their fingerprints, and why does syncsometoone not restore them unless the user is first deleted from the device? Does a power cut do the same? (3) On 2026-10-09 ~16:40 SLT reader NYU7251900077, offline, admitted EmpId 100017; that scan never reached our webhook after reconnect. Do you have it? Does the reader buffer offline scans? (4) GetEventsbyDevSN re-delivers through the webhook with AttTime in UTC; live deliveries use reader-local time. Intended? Can a pulled delivery carry a marker? (5) A newly added and enrolled user is refused with "invalid time period" until accessgrant is sent. Is accessgrant required for every new user? (6) Remote door opens never produce event 8 on the webhook. Can they? |
| O-6 | Before the Sonnet session: make sure `.env.local` has `ACCESS_CONTROL_ENABLED=false` (the E2E run needs the mock; trap 26).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| O-7 | After the Opus review passes: mark the PR ready and merge it (deploys production; feat/fix commits cut a release automatically).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| O-8 | Book visit 2 at VFT after O-7 is live and R-3 is written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 8. Tracker protocol (exact calls)

Tracker: `https://claude.ai/artifact/FTKSkGm7B9Gx4ukCoDQgdC`. Use the `ArtifactData` tool (load it with ToolSearch `select:ArtifactData` once).

- **Read before every write** (writes to an existing document need its `version`): `ArtifactData {action:"get", url, collection:"tasks", doc_id:"T-07"}` → note `version`.
- **Start a task:** `ArtifactData {action:"update", url, collection:"tasks", doc_id:"T-07", if_version:<v>, data:{status:"in_progress", updatedAt:"<ISO now>", by:"sonnet"}}`
- **Finish:** `update` with `{status:"done", commit:"<short hash>", note:"tests: …; mutation: … → …; <anything surprising>", updatedAt, by:"sonnet"}`.
- **Block:** `{status:"blocked", note:"<the exact question or failure, file:line>"}`.
- **Log:** `get` `log/entries` (collection `log`, doc `entries`), then `update` it with `if_version` and the full `entries` array with your new entry **prepended**: `{t:"<ISO>", actor:"sonnet", text:"T-07 done (abc1234)"}`. Keep at most 300 entries.
- **Hand-off:** `get` `log/handoff`, then `update` with `{text, updatedAt, by:"sonnet"}`. Write it when the session ends for any reason.
- A write refused with `version_mismatch` → `get` again and redo the write once.
- Status values: `todo`, `in_progress`, `done`, `blocked`, `skipped`. Never touch the `owner` or `review` collections.

## 9. Known environment traps

- **Stale `.next` route types** (TS2307/TS1005/TS1434 inside `.next/`): stop any dev server; `npx next typegen`; if `.next/dev/types/*.ts` is garbled, move that one file aside, start `npx next dev --webpack -p 3999` until "Ready", stop it (`pkill -f '^next-server'`), re-run the gate.
- **Local dev server:** use `next dev --webpack` (Turbopack fails on `next/font/google` locally). Never grep the raw dev log (the webhook token appears in request paths).
- **E2E:** `reuseExistingServer` adopts anything on port 3100 (trap 19); clear leaked servers with `pkill -f '^next-server'` (trap 24). Read `error-context.md` before a stack trace.
- **Prettier drift:** never run `npm run format` on the repo (master §7.4); lint-staged formats only staged files.

## 10. Opus review and follow-ups (after the session)

| ID  | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | Review the branch against this plan: every DEC honoured, tests written first and mutation-checked, no out-of-scope edits, gate evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R-2 | Visual check (Verification Directive 1) of: member panel enrolment copy (awaiting, timed-out), device card label and the 0 / 100 bar, restart dialog text — desktop 1366 and phone 390, dark theme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R-3 | Write runbook v4 for visit 2: PH-24…PH-29 (unrun), re-tests of D1 (restart **and** power cut), D2 (remove → re-send → illegal finger; re-register takes a fresh finger, no "duplicate finger"), D3 (fresh member enrolled on A admitted at first scan; menu enrolment self-repairs within 5 min), D4 (panel copy and confirmation), D5 (offline scans with a later events pull), plus runbook fixes F-12 (scans, not event 8), F-16, F-17 (serial `…077`, real fingers: HW1 left index, HW2 left middle, HW3 left thumb, HW4 left pinky; OB-04 lost reply lands on B; XC-03 step 3; LC-07 no longer needs a re-push), and a fresh-member rule (every current HW member already has a central template). |

## 11. Traceability — every finding to its owner

| Finding                                                                          | Where handled                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------- |
| D1 restart drops templates                                                       | T-03, T-04, T-05, T-06, T-07; verify R-3          |
| D2 withdrawal resurrected                                                        | T-08; O-5 Q1; verify R-3                          |
| D3 event 23 after enrolment                                                      | T-01, T-02, T-09; O-5 Q5; verify R-3              |
| D4 panel timeout                                                                 | T-10; T-25 (brief §7)                             |
| D5 offline scan lost                                                             | O-5 Q3; R-3 (no code fix possible)                |
| F-01 events pull                                                                 | T-14; T-25; O-5 Q4; O-4 cleanup                   |
| F-02 429                                                                         | T-11                                              |
| F-03 401 sign-in                                                                 | T-12                                              |
| F-04 malformed date                                                              | T-13                                              |
| F-05 withdraw leaves member off readers                                          | T-08                                              |
| F-06 tampered cookie 500                                                         | T-18                                              |
| F-07 serial case / vendor check                                                  | T-19                                              |
| F-08 http base URL                                                               | T-20                                              |
| F-09 rate limit / slow webhook                                                   | T-21, T-15                                        |
| F-10 completion by id                                                            | T-16                                              |
| F-11 reclaim / repeated reboot                                                   | T-17                                              |
| F-12 no event 8                                                                  | O-5 Q6; R-3                                       |
| F-13 capacity bar / double re-send                                               | T-22; R-2                                         |
| F-14 constant / privacy figure                                                   | T-23                                              |
| F-15 stub-log password                                                           | T-24                                              |
| F-16 phase gate                                                                  | O-1 (PR #103)                                     |
| F-17 runbook/console gaps                                                        | T-24 (console); R-3 (runbook)                     |
| F-18 unexplained reboot                                                          | none unless it recurs                             |
| PH-04 "Not confirmed yet" until reload                                           | T-10                                              |
| PH-05 toast wording                                                              | R-3 (runbook expectation is wrong; code is right) |
| PH-16 "Fingerprints 0"                                                           | T-22                                              |
| PH-17 event 29 before start, PH-03/09 unknown-finger refusals, PH-23 rapid scans | T-25 / R-3 (documentation only)                   |
| Foreign card users on reader B                                                   | O-5 (mention to VFT)                              |
| Token and password exposure                                                      | O-2, O-3                                          |
| Dead jobs, mis-stamped rows, E2E rows                                            | O-4                                               |
