# Access Control — Fix Plan, round 2 (after Visit 2, 2026-10-10)

> **Live status is the tracker's database, not this file:** https://claude.ai/artifact/FTKSkGm7B9Gx4ukCoDQgdC
> (same tracker as round 1; round-2 tasks are `R2-00`…`R2-15`, owner actions `O2-*`, follow-ups `F2-*`).
> Written 2026-10-11 by Opus 5.5 from `backups/hw-session/physical-visit-2026-10-09-report.md` §A.8 (the visit-3 work
> list) and `docs/architecture/access-control-remote-day-report-2026-10-09.md`. Executed by a Sonnet 5.5 session one
> task at a time; reviewed by Opus 5.5.
>
> Round 1 is `docs/architecture/access-control-fix-plan-2026-10.md`. **Read its §3 (hard rules), §4 (per-task
> protocol), §8 (tracker calls) and §9 (environment traps): they apply here unchanged**, with the task ids and the
> branch in this file.

---

## 0. Scope: what this round does and what it deliberately does not

The visit-3 work list (report §A.8) has three kinds of item.

| Kind                                | Items                                                                                                   | In this round?                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decidable now (code, console, docs) | CD-1, CD-2, CD-3, CD-4, CD-6, CR-1, A.8.4, a manual stopgap for RB-1                                    | **Yes**: tasks R2-01…R2-14                                                                                                                                                                                                                                                                                                                                                                        |
| Needs a fact we do not have         | RB-1 and RB-2 automatic detection, RB-3 guard for automatic repairs, the panel's "Can get in" certainty | **No.** The detection signal is unknown: readers send nothing at boot, unknown-finger refusals are not reported, and the vendor API has no device user or template list (`docs/integrations/vft/vft-api-reference.md` §2–§4). This round builds the **instruments** the remote session needs to find a signal (R2-07, R2-08, R2-09, R2-13). Opus designs the automatic repair afterwards (F2-04). |
| Needs people or the readers         | RB-4 re-runs, R-1 signal hunt, CD-5 look, CR-2 runbook, visit 3                                         | **No.** Follow-ups F2-01…F2-06 for Opus, the remote session and the owner.                                                                                                                                                                                                                                                                                                                        |

## 1. Decisions (do not reopen)

| #       | Decision                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC2-01 | A **cancelled** member already blocked and held by no reader needs **no** commands (unless forced).                                                                                                                                                                                                                                           | Every reconcile and every trigger re-sent Block + Delete User to parked members (report A.4 observations, "overnight 00:00 reconcile re-blocked and deleted all parked HW members").                                                                                         |
| DEC2-02 | The nightly reconcile does **not** compare the vendor's window for a member who may not enter. A blocked member's dates are irrelevant (the block governs, and trap 4 forbids sending them a window). A cancelled member is settled once it is blocked and held by no reader.                                                                 | CD-4: dry run reported `vendorDrift 6` for parked HW Test 5–10: the vendor keeps their old StartDate/EndDate while we want none. `ReconcileMemberAccess.ts` lines ~209–262.                                                                                                  |
| DEC2-03 | Finger slots follow the ZKTeco standard: `0` left little, `1` left ring, `2` left middle, `3` left index, `4` left thumb, `5` right thumb, `6` right index, `7` right middle, `8` right ring, `9` right little. The desk chooses the finger; the default is **right index (6)**. A member with a fingerprint can register **another** finger. | PH-25: menu-enrolled left thumb came back as Finger 4 and right thumb as Finger 5, matching the standard map. Our Enroll always sent slot 0, so a second finger overwrote the first (V2-4). `fingerId` 0–9 is already accepted end to end (schema, hook, service, provider). |
| DEC2-04 | A dedicated action records consent for a fingerprint that already exists. Same rule as the enrolment dialog: written once, never restamped.                                                                                                                                                                                                   | V2-6 / CD-3.                                                                                                                                                                                                                                                                 |
| DEC2-05 | The activity log states that readers do not report refusals of fingers they do not recognise.                                                                                                                                                                                                                                                 | CD-6, PH-03.                                                                                                                                                                                                                                                                 |
| DEC2-06 | Webhook events **without an `EmpId`** (reader system events, e.g. 107 "Mains power failure", 111 "POE power down", 237 "Reader online") are stored with `subject_id 0` and no member instead of being discarded.                                                                                                                              | R-1 cannot find a power-loss signal if the webhook throws system events away (`EmpId` is currently required).                                                                                                                                                                |
| DEC2-07 | An **events pull** becomes a product operation that records a marker job (`intent 'events_pull'`, `dispatchedInline: true`) before it calls the vendor. The vendor call is a new port method `requestEventsUpload`.                                                                                                                           | CD-2: we must know a delivery may be a pull. `access_sync_jobs.intent` is `text`, so no migration is needed. The same audit pattern as door opens and restarts.                                                                                                              |
| DEC2-08 | While a pull marker for a reader is younger than **30 min** (`EVENTS_PULL_WINDOW_SECONDS = 1800`), an event from that reader whose `AttTime` **read as UTC** is no later than receipt + 120 s is a pulled event: stored at that UTC instant and never used for clock skew. Every other event is reader-local as today.                        | A live scan read as UTC lands about 5 h 30 min in the future, so it can never pass the test. A pulled scan read as UTC is in the past. Known edge, documented: an offline backlog older than 5 h 30 min arriving inside a pull window would be stored 5 h 30 min late.       |
| DEC2-09 | **Manual stopgap for RB-1:** a "Repair fingerprints" action on each reader card queues a re-seat of every member that reader holds, due 60 s later. Its dialog tells the gym to use it only once the reader has been back on for a minute (RB-3).                                                                                             | PH-26: only a re-seat restored fingers after a power cut. PH-25: a re-seat queued while the reader was offline destroyed a finger added there. A per-reader button turns "Re-send every member by hand" into one press.                                                      |
| DEC2-10 | `ReconcileMemberAccess` accepts an optional `memberIds` list. When it is given, members outside the list are not considered and capacity eviction is skipped.                                                                                                                                                                                 | CR-1: PH-24 could not run `reconcile --apply` without touching HW Test 5–10.                                                                                                                                                                                                 |
| DEC2-11 | Console: `resend` re-seats; `withdraw` uses the product's removal, with `removeSubject` allowed **only** for the HW member being withdrawn; `enrol` takes `--finger`; `reconcile` takes `--members`; `vendor events-pull` goes through the product operation; new read-only `vendor device-raw` prints one reader's raw vendor row.           | V2-5 / CR-1. `device-raw` lets the remote session compare `IsReboot`, `LastRequestTime`, `UserCount`, `FpCount` and `*Stamp` before and after a restart (signal hunt).                                                                                                       |
| DEC2-12 | No migration and no production data change in this round.                                                                                                                                                                                                                                                                                     | Safety.                                                                                                                                                                                                                                                                      |

---

## 2. To-do list

Branch: **`fix/access-control-visit-2-findings`**, from `origin/master`.

| ID    | Item         | Title                                                                              | Depends on   |
| ----- | ------------ | ---------------------------------------------------------------------------------- | ------------ |
| R2-00 | —            | Branch, baseline gate, commit this plan and the visit report                       | —            |
| R2-01 | CD-4         | A settled cancelled member gets no commands                                        | R2-00        |
| R2-02 | CD-4         | Reconcile ignores the vendor window of a member who may not enter                  | R2-01        |
| R2-03 | CD-1         | Finger slot map and labels                                                         | R2-00        |
| R2-04 | CD-1         | Panel: choose the finger; register another finger                                  | R2-03        |
| R2-05 | CD-3         | Record consent for an existing fingerprint                                         | R2-00        |
| R2-06 | CD-6         | Activity log explains unreported refusals                                          | R2-00        |
| R2-07 | RB-1 input   | Store reader system events that carry no member                                    | R2-00        |
| R2-08 | CD-2         | Events pull as a product operation with a marker                                   | R2-00        |
| R2-09 | CD-2         | Pulled events stored at their real time, never used for skew                       | R2-07, R2-08 |
| R2-10 | RB-1 stopgap | "Repair fingerprints" on the reader card                                           | R2-00        |
| R2-11 | CR-1         | Reconcile limited to chosen members                                                | R2-02        |
| R2-12 | CR-1         | Console: resend re-seats, enrol `--finger`, reconcile `--members`                  | R2-03, R2-11 |
| R2-13 | CR-1         | Console: withdraw via the product, events pull via the product, `device-raw` probe | R2-08        |
| R2-14 | A.8.4        | Vendor facts into the master reference and the brief                               | R2-01…R2-13  |
| R2-15 | —            | Final gate, E2E specs, draft PR, hand-off                                          | R2-14        |

---

## 3. Task specifications

Shared facts: as round 1 §6 (fakes must model real behaviour; `jest.spyOn` on `MockAccessControlProvider` to make a call fail; import enums from the config, never the barrel in client code). **Feature suites** (the "Run" command): `npx jest src/features/access-control src/lib/access-control src/app/api/access-control src/app/api/cron/__tests__/access-control-crons.test.ts src/features/members/tests/BiometricConsentPersistence.test.ts`.

**E2E specs (allowed change, learned in round 1):** if a task changes UI text that a spec under `tests/e2e/access-control-*.spec.ts` asserts, update that spec line to the new text in the same commit and name it in the tracker note. No other spec edits.

### R2-00 — Branch, baseline, commit the plan

1. `git fetch origin && git switch -c fix/access-control-visit-2-findings origin/master`.
2. `cp backups/hw-session/physical-visit-2026-10-09-report.md docs/architecture/access-control-physical-visit-report-2026-10-09.md` (overwrites the round-1 copy with the visit-2 version).
3. `grep -c '^ACCESS_CONTROL_ENABLED=false$' .env.local` → `1`, else stop (round 1 §3).
4. Baseline: `npm run type-check && npm test && npm run arch:check && npm run lint` → green. If `npm test` times out in suites that pass alone, re-run once; record both runs.
5. `git add docs/architecture/access-control-fix-plan-2026-10b.md docs/architecture/access-control-fix-plan-2026-10b-prompt.md docs/architecture/access-control-physical-visit-report-2026-10-09.md` only.

- **Commit:** `docs(access-control): visit 2 report and the round-2 fix plan`

### R2-01 — A settled cancelled member gets no commands (CD-4)

- **Files:** `src/features/access-control/domain/AccessCommands.ts`, `src/features/access-control/tests/AccessCommands.test.ts`.
- **Change:** at the top of the `decision.removeFromDevice` branch: `if (!force && subject.lastSyncedBlocked === true && subject.syncedDeviceSerials.length === 0) return []`. Comment: "Already blocked and on no reader: re-sending Block + Delete User every night changed nothing and churned the queues (visit 2, CD-4)."
- **Tests (new describe `settled cancellation (visit 2, CD-4)`):** cancelled, `lastSyncedBlocked: true`, held `[]` → `[]`; same with `force: true` → the block + revoke sequence; cancelled, `lastSyncedBlocked: true`, held `['A']` → block + revoke (unchanged); cancelled, `lastSyncedBlocked: false`, held `[]` → block + revoke (a fresh cancellation).
- **Allowed test updates:** an existing test expecting commands for a cancelled member that is already blocked **and** held by no reader may be changed to expect `[]`. List it.
- **Mutation:** remove the new line → the first test fails.
- **Commit:** `fix(access-control): stop re-cancelling members who are already off the readers` / `Release-Note: none`

### R2-02 — Reconcile ignores the vendor window of a member who may not enter (CD-4)

- **Files:** `src/features/access-control/services/ReconcileMemberAccess.ts`, `src/features/access-control/tests/ReconcileMemberAccess.test.ts`.
- **Change:** replace the `windowMatches` assignment with:
  ```ts
  // A member who may not enter has no window to compare: the block governs,
  // and trap 4 forbids sending one. The vendor keeps the old dates, so
  // comparing them reported every parked member as drift each night (CD-4).
  const windowMatches = !decision.allowed
    ? !decision.removeFromDevice ||
      (current.synced_device_serials ?? []).length === 0
    : vendorSubjects
      ? this.vendorAgrees(vendorRecord, current, desiredFrom, desiredTo)
      : localWindowMatches
  ```
- **Tests:** with the fake vendor holding an old window for each: (1) cancelled, blocked, held by none, provisioned → not enqueued, `vendorDrift` 0; (2) suspended, blocked → not enqueued; (3) cancelled, blocked, still held by A → enqueued; (4) an allowed member whose vendor window differs → still enqueued with `vendorDrift` 1 (unchanged); (5) running the reconcile twice over a mixed set → the second run enqueues 0 (B-14).
- **Mutation:** restore the old assignment → test 1 fails.
- **Commit:** `fix(access-control): do not report parked members as drift every night` / `Release-Note: none`

### R2-03 — Finger slot map and labels (CD-1)

- **Files:** `src/features/access-control/config/AccessControlConfig.ts`, new test `src/features/access-control/tests/FingerSlots.test.ts`.
- **Change:** add
  ```ts
  /**
   * ZKTeco finger slots. A member's fingers live in separate slots in the
   * vendor's copy; enrolling into a used slot replaces that finger. The map is
   * the ZKTeco standard, confirmed on visit 2: a left thumb enrolled at the
   * reader came back as slot 4 and a right thumb as slot 5 (PH-25). Every
   * enrolment used slot 0 before this, so a second finger replaced the first
   * (V2-4).
   */
  export const FINGER_SLOTS = [
    { id: 0, key: 'left-little', label: 'Left little finger' },
    { id: 1, key: 'left-ring', label: 'Left ring finger' },
    { id: 2, key: 'left-middle', label: 'Left middle finger' },
    { id: 3, key: 'left-index', label: 'Left index finger' },
    { id: 4, key: 'left-thumb', label: 'Left thumb' },
    { id: 5, key: 'right-thumb', label: 'Right thumb' },
    { id: 6, key: 'right-index', label: 'Right index finger' },
    { id: 7, key: 'right-middle', label: 'Right middle finger' },
    { id: 8, key: 'right-ring', label: 'Right ring finger' },
    { id: 9, key: 'right-little', label: 'Right little finger' },
  ] as const
  export const DEFAULT_FINGER_SLOT = 6
  ```
- **Tests:** ids are exactly 0–9 in order; keys unique; slot 4 is `left-thumb` and slot 5 `right-thumb`; `DEFAULT_FINGER_SLOT` is the `right-index` slot.
- **Mutation:** swap the ids of slots 4 and 5 → the thumb test fails.
- **Commit:** `feat(access-control): name the reader's finger slots` / `Release-Note: none`

### R2-04 — Panel: choose the finger; register another finger (CD-1)

- **Files:** `src/features/access-control/components/MemberAccessPanel.tsx`, new test `src/features/access-control/tests/FingerChoice.test.tsx` (render setup modelled on `ResendToast.test.tsx`).
- **Change:**
  1. State `const [fingerId, setFingerId] = useState<number>(DEFAULT_FINGER_SLOT)` (with the other hooks, above the early returns).
  2. In the enrolment block, before the reader `Select`, add a `Select` with `aria-label="Finger to register"`, one `<option>` per `FINGER_SLOTS` entry (`value={slot.id}`, text `slot.label`), `value={fingerId}`, `onChange` → `setFingerId(Number(event.target.value))`.
  3. `handleEnrol` passes `fingerId` to `enrolment.start`.
  4. When `status.fingerEnrolled` is true, render **both** the existing "Remove fingerprint" button **and** the enrolment block (consent checkbox logic unchanged), with the register button text `Register another finger` instead of `Register fingerprint`. Above it, the caption: `Each finger is kept separately. Registering the same finger again replaces it.`
- **Tests:** default selection is "Right index finger"; choosing "Left thumb" and pressing Register calls the enrol API with `fingerId: 4`; a member with a fingerprint sees both "Remove fingerprint" and "Register another finger"; without a fingerprint the button reads "Register fingerprint".
- **Mutation:** pass no `fingerId` → the "Left thumb" test fails.
- **Commit:** `feat(access-control): register more than one finger per member` / `Release-Note: Members can now register a second fingerprint, and each finger is kept.`

### R2-05 — Record consent for an existing fingerprint (CD-3)

- **Files:** `src/features/access-control/services/ManageMemberBiometric.ts`, new route `src/app/api/access-control/members/[id]/consent/route.ts`, `src/features/access-control/services/access-control.service.ts`, `src/features/access-control/hooks/useAccessControl.ts`, `src/features/access-control/components/MemberAccessPanel.tsx`, new tests `src/features/access-control/tests/RecordConsent.test.ts`, `src/features/access-control/tests/RecordConsentPanel.test.tsx`, `src/app/api/access-control/__tests__/access-control.routes.test.ts` (new cases).
- **Change:**
  1. `ManageMemberBiometric.recordConsent(gymId, memberId): Promise<BiometricOperationResult>`: credentials null → `{ applicable: false, dispatched: false }`; context missing or other gym → `{ applicable: true, dispatched: false, error: 'Member not found' }`; else `await this.repo.recordBiometricConsent(memberId, new Date())` (it already never restamps) → `{ applicable: true, dispatched: true }`. No vendor call.
  2. Route `POST` modelled exactly on `members/[id]/biometric/route.ts` (guard, session-client ownership check, `createManageMemberBiometric(createAdminClient()).recordConsent(...)`, same response mapping). Header comment: "Records consent for a fingerprint that already exists, e.g. one registered at the reader's own menu (visit 2, V2-6). Rule 2.5: a dedicated operation."
  3. Client service `recordMemberBiometricConsent(memberId)` and hook `useRecordMemberBiometricConsent()` modelled on `clearMemberBiometric` / `useClearMemberBiometric` (same invalidations).
  4. Panel: inside the existing "No consent recorded" alert, below its text, a `Checkbox` with label `The member confirms they agree to this fingerprint being used to open the gym's doors.` and a `Button size="sm"` `Record consent`, disabled until ticked; on success `toast.success('Consent recorded.')`; on error the server's message as `toast.error`.
- **Tests:** use case writes consent once and returns dispatched; a second call does not change the timestamp (fake honours "only when null"); another gym's member → error; route 404 for another gym's member; panel button disabled until the box is ticked and calls the API once.
- **Mutation:** drop the context gym check → the other-gym test fails.
- **Commit:** `feat(access-control): record consent for a fingerprint added at the reader` / `Release-Note: You can now record a member's consent for a fingerprint that was added at the reader.`

### R2-06 — Activity log explains unreported refusals (CD-6)

- **Files:** `src/features/access-control/components/AccessActivityLog.tsx`, its existing render test (find it with `grep -l AccessActivityLog src/features/access-control/tests`).
- **Change:** render, directly under the log's filter control, `<p className="text-caption text-ink-muted">Readers report refusals only for fingers they recognise. An unknown finger is turned away without a record.</p>` (match the caption classes already used in the file; if none, use exactly these).
- **Test:** the sentence is present.
- **Commit:** `fix(access-control): say which refusals readers never report` / `Release-Note: none`

### R2-07 — Store reader system events that carry no member (RB-1 input)

- **Files:** `src/features/access-control/schemas/access-control.schemas.ts`, `src/features/access-control/services/RecordAccessEvents.ts` (only if needed for the test to pass), new test `src/features/access-control/tests/SystemEvents.test.ts`.
- **Change:** in `accessWebhookEventSchema`, `EmpId: requiredVendorString` → `EmpId: optionalVendorString`. Comment: "Reader system events (power failure 107, POE down 111, reader online 237) may carry no person. They are stored with subject 0 so a power-loss signal can be found (visit 2, RB-1)." `RecordAccessEvents` already maps a non-numeric id to `subjectId 0` and `memberId null`; confirm with the test, change nothing else.
- **Tests:** a delivery `[{ AttTime, DeviceID, Event: '107' }]` for a known reader stores one row with `subject_id 0`, `member_id null`, `event_code '107'`; an event missing `DeviceID` is still `malformed`; an event with `EmpId: ''` is stored with subject 0.
- **Mutation:** restore `requiredVendorString` → the first test fails.
- **Commit:** `fix(access-control): keep reader system events instead of discarding them` / `Release-Note: none`

### R2-08 — Events pull as a product operation with a marker (CD-2)

- **Files:** `src/lib/access-control/IAccessControlProvider.ts`, `src/lib/access-control/VftAccessControlProvider.ts`, `src/lib/access-control/MockAccessControlProvider.ts`, `src/features/access-control/config/AccessControlConfig.ts`, `src/features/access-control/services/OperateDevice.ts`, `src/features/access-control/services/DrainAccessSyncQueue.ts`, `src/features/access-control/services/IAccessControlRepository.ts`, `src/features/access-control/services/SupabaseAccessControlRepository.ts`, `src/features/access-control/tests/fakes.ts`, new tests `src/features/access-control/tests/EventsPull.test.ts`, `src/lib/access-control/__tests__/EventsUpload.test.ts`.
- **Change:**
  1. Port: `requestEventsUpload(credentials: AccessCredentials, deviceSerial: string): Promise<CommandOutcome>` (doc: "Asks the reader to upload its stored attendance log (`GetEventsbyDevSN`). The re-delivered events arrive on the webhook with `AttTime` in UTC."). Vft: `return this.command(credentials, { method: 'POST', path: '/api/devicecmd/events', query: { DevSN: deviceSerial } })`. Mock: record `{ operation: 'requestEventsUpload', deviceSerial }`, return `{ status: 'applied' }`.
  2. Config: `AccessIntent.EventsPull = 'events_pull'` (doc: "A record, not work: written before an events pull so ingestion knows a delivery may be a pull") and `export const EVENTS_PULL_WINDOW_SECONDS = 1800`.
  3. `OperateDevice.requestEventsUpload(input: OperateDeviceInput)` → `this.operate(input, AccessIntent.EventsPull)`; in `operate`, dispatch `this.provider.requestEventsUpload(credentials, device.device_serial)` for that intent (the marker job is already written before the dispatch, with `dispatchedInline: true`).
  4. Drain `runJob`: add `job.intent === AccessIntent.EventsPull` to the device-operation branch. For it: `dispatchedInline` → `[]`; otherwise `[{ message: 'An events pull job is a record only', retryable: false, needsAttention: false }]`. It must never reach the "no member" branch.
  5. Port + Supabase + fake: `hasRecentEventsPull(gymId: string, deviceSerial: string, sinceSeconds: number): Promise<boolean>` — `access_sync_jobs` `.select('id').eq('gym_id', gymId).eq('intent', AccessIntent.EventsPull).eq('payload->>deviceSerial', deviceSerial).gte('created_at', <now − since>).limit(1)`.
- **Tests:** OperateDevice writes the marker (intent `events_pull`, payload `deviceSerial`, `dispatchedInline: true`) **before** the provider call (assert call order); the provider receives the serial; the drain completes an inline marker job as succeeded with no provider call; `hasRecentEventsPull` true for a 10-min-old marker and false for a 31-min-old one (fake); Vft: the request is `POST /api/devicecmd/events?DevSN=<serial>`.
- **Mutation:** remove `EventsPull` from the drain's device branch → the drain test fails (job dead, no member).
- **Commit:** `feat(access-control): make an events pull a recorded operation` / `Release-Note: none`

### R2-09 — Pulled events stored at their real time, never used for skew (CD-2)

- **Files:** `src/features/access-control/services/RecordAccessEvents.ts`, new test `src/features/access-control/tests/PulledEventTime.test.ts`.
- **Change:** per device, before normalising: `const pullOpen = await this.repo.hasRecentEventsPull(device.gym_id, deviceSerial, EVENTS_PULL_WINDOW_SECONDS)`. For each event: if `pullOpen`, `const asUtc = parseDeviceTime(event.AttTime, 0)`; when `asUtc && asUtc.getTime() <= receivedAt.getTime() + 120_000`, use `asUtc` as `occurredAt` and mark the event pulled (keep a `Set` of pulled events, or a parallel boolean array). Otherwise parse with the device offset as today. `newestScan` is computed only from events **not** marked pulled. Summary gains `pulledScans: number` (doc: "Events read as UTC because a pull for this reader was recorded in the last 30 min (DEC2-08)."). The F-01 shifted-duplicate check stays as it is.
- **Tests (device offset 330, receivedAt fixed):** (1) marker present; `AttTime '2026-10-09 07:04:07'`, original stored at `07:04:07Z` → no new row (exact duplicate), skew not recorded; (2) marker present; a scan with no stored original, `AttTime` = UTC 2 hours ago → stored at that UTC instant, `pulledScans` 1, skew not recorded; (3) marker present; a live scan with `AttTime` = local now → stored at now, skew recorded; (4) no marker; `AttTime` = UTC 2 h ago → stored as local (5 h 30 min earlier), unchanged behaviour; (5) a pulled event and a live event in one delivery → skew from the live one only.
- **Mutation:** compute `newestScan` from all events → test 2 or 5 fails; drop the `pullOpen` condition → test 4 fails.
- **Commit:** `fix(access-control): store scans recovered by an events pull at their real time` / `Release-Note: none`

### R2-10 — "Repair fingerprints" on the reader card (RB-1 stopgap)

- **Files:** `src/features/access-control/config/AccessControlConfig.ts`, `src/features/access-control/services/OperateDevice.ts`, new route `src/app/api/access-control/devices/[id]/repair/route.ts`, `src/features/access-control/services/access-control.service.ts`, `src/features/access-control/hooks/useAccessControl.ts`, `src/features/access-control/components/DeviceStatusCard.tsx`, new tests `src/features/access-control/tests/RepairReader.test.ts`, `src/features/access-control/tests/RepairReaderCard.test.tsx`, `src/app/api/access-control/__tests__/access-control.routes.test.ts` (new cases).
- **Change:**
  1. Config: `export const MANUAL_REPAIR_DELAY_SECONDS = 60` (doc: "Gives a reader that has just come back time to upload fingers added while it was offline before Delete User reaches it (visit 2, RB-3/PH-25).").
  2. `OperateDevice.repairReader(input: OperateDeviceInput): Promise<{ applicable: boolean; membersQueued: number; error?: string }>`: credentials null → `{ applicable: false, membersQueued: 0 }`; device not found for the gym → `{ applicable: false, membersQueued: 0, error: 'Device not found for this gym' }`; else `listMemberIdsOnDevice(gymId, serial)` → `enqueueMany` with payload `{ reason: 'reader_repair_requested', reseat: true, deviceSerial, actorId }` and `notBefore = now + MANUAL_REPAIR_DELAY_SECONDS`; return `{ applicable: true, membersQueued: <count> }`. No vendor call.
  3. Route `POST /devices/[id]/repair` modelled exactly on `devices/[id]/reboot/route.ts` (guard, session-client ownership, `createOperateDevice(createAdminClient()).repairReader(...)`); success body `{ membersQueued }`.
  4. Client `repairAccessDevice(id)` + hook `useRepairAccessDevice()` modelled on the reboot pair.
  5. Card: a `Button size="sm" variant="secondary"` `Repair fingerprints` next to Restart. Confirm dialog: title `` `Repair fingerprints on ${device.deviceName}?` ``; description `'Use this after a power cut, once the reader has been back on for at least a minute. Every member this reader holds is removed from the readers and sent again from VFT’s copy, which takes a few minutes. A fingerprint added at this reader while it was offline is lost if the reader has not reconnected yet.'`; confirm text `Repair fingerprints`. Success toast: `membersQueued === 0` → `'No members are on this reader.'`, else `` `Repair queued for ${n} members. Their fingerprints return within about 10 minutes.` ``.
- **Tests:** use case enqueues one re-seat job per member held by that reader with the payload and a `notBefore` ≥ now + 59 s, none for members only on the other reader; unknown device → `applicable: false`; route 404 for another gym's reader; card: the dialog shows the description and confirming calls the API once; toasts for 0 and for 3 members.
- **Mutation:** drop `reseat: true` from the payload → the use-case test fails.
- **Commit:** `feat(access-control): repair every fingerprint on a reader after a power cut` / `Release-Note: After a power cut, use Repair fingerprints on the Door Access page to bring every member's fingerprint back.`

### R2-11 — Reconcile limited to chosen members (CR-1)

- **Files:** `src/features/access-control/services/ReconcileMemberAccess.ts`, `src/features/access-control/tests/ReconcileMemberAccess.test.ts` (new cases).
- **Change:** the `execute` input gains `memberIds?: string[]` (doc: "Limit the run to these members; for supervised tests that must not touch anyone else. Capacity eviction is skipped when set."). When present: skip every member context whose `memberId` is not in the list **before** any counting or comparison, and do not run the capacity eviction step.
- **Tests:** with three drifting members, `memberIds: [m1]` enqueues only m1, counts `membersChecked` 1, and eviction is not called (spy); without `memberIds` behaviour is unchanged.
- **Mutation:** apply the filter after counting → the `membersChecked` assertion fails.
- **Commit:** `feat(access-control): let a reconcile run for chosen members only` / `Release-Note: none`

### R2-12 — Console: resend re-seats, enrol `--finger`, reconcile `--members` (CR-1)

- **Files:** `scripts/hw-session.ts` only.
- **Change:**
  1. `pushMember(memberId, force)` (line ~2203): when called by `resend` (the `force` path), pass `reseat: true` to `execute` together with `force: true`. Update the `resend` help line: "re-seat: Delete User on every reader, then re-add from VFT's copy (same as the app's Re-send)".
  2. `enrol`: new option `--finger <key>` where key is a `FINGER_SLOTS` key (import it from the config); default `right-index`. Unknown key → `fail('--finger must be one of: <keys>')`. Pass `fingerId: slot.id` to `ManageMemberBiometric.enrol`, and name the finger in the printed plan line.
  3. `reconcile`: new option `--members <n,n,…>` (HW member numbers, resolved with the existing `hwMember` helper). When given, pass `memberIds` to `execute`. Print the resolved member names in the plan line. Without it, behaviour is unchanged.
  4. Update the file's usage block (top comment) for the three commands.
- **Verify:** `npm run type-check`; `npx tsx scripts/hw-session.ts help` exits 0 and shows the new options; `npx tsx scripts/hw-session.ts coverage` passes (or, if it refuses on phase/gate, record its first line).
- **Commit:** `chore(scripts): resend re-seats, enrol names the finger, reconcile can be scoped`

### R2-13 — Console: withdraw via the product, events pull via the product, `device-raw` probe (CR-1)

- **Files:** `scripts/hw-session.ts` only.
- **Change:**
  1. Provider proxy (line ~660): keep refusing `removeSubject`, **except** when its `subjectId` argument is in a module-level `const allowedRemovals = new Set<string>()`. `withdraw()` reads the member's current subject id (`sessionRepository().getMemberAccessContext(member.id)` → `subject?.subject_id`), adds it to `allowedRemovals` immediately before `clear(...)`, and removes it in a `finally`. Fail with `'withdraw: this member has no subject'` when there is none. Update `withdraw`'s doc comment and plan line: "removes the vendor employee (fingerprints erased), issues a new subject id, clears consent; a still-active member is re-added with no finger".
  2. `vendor events-pull`: replace the direct `vendorPost` call with `new OperateDevice(sessionRepository(), provider).requestEventsUpload({ gymId: TITAN_GYM_ID, deviceId: await deviceIdFor(serial), actorId: 'hw-session' })`, and add `'requestEventsUpload'` to `VENDOR_METHODS` so it is paced. Print the result.
  3. New read-only op `vendor device-raw --reader A|B`: `vendorGet('/api/device')`, find the row whose `DevSN` equals the reader's serial, print it with `console.log(redact(JSON.stringify(row, null, 2)))`; `fail('reader not in the vendor list')` if absent. No `--apply` needed (it writes nothing). In the scope function (line ~492) make `device-raw` use the same scope as `events-pull`.
  4. Usage block updated for all three.
- **Verify:** as R2-12.
- **Commit:** `chore(scripts): withdraw and pull through the product, add a raw device probe`

### R2-14 — Vendor facts into the master reference and the brief (A.8.4)

- **Files:** `docs/architecture/access-control-master.md`, `docs/architecture/access-control-hardware-session.md`.
- **Change:**
  1. Master: a new subsection at the end of §3 titled `### 3.12 Measured on the readers (visits 1 and 2, 2026-10-09/10)` with these bullets, verbatim:
     - A reader sends **no event when it boots or powers up**.
     - A restart **started from our app** keeps users and drops every fingerprint that reached the reader from VFT's central copy (re-seat, unpark, Re-send); fingers enrolled on that reader survive (PH-15). A **power cut** does the same, and on firmware 3.3.12 also drops fingers enrolled on that reader (PH-26).
     - A finger added at the reader's menu while it is offline uploads on reconnect; a Delete User delivered before that upload destroys it (PH-25).
     - Readers **never report a refusal of a finger they do not recognise**; refusals of known members arrive as event 23 or 29 (PH-03, PH-24).
     - VFT never sends event **8** for a remote door open.
     - `Enroll User` returns **0** when a finger was taken and **6** when the reader's ~10 s window timed out.
     - `GetEventsbyDevSN` re-delivers stored events through the webhook with `AttTime` in **UTC** (live deliveries are reader-local); handled by DEC2-08.
     - VFT's copy holds **several finger slots** per member; slots follow the ZKTeco standard map (`FINGER_SLOTS`).
     - A reader clock set before a member's window start refuses with event **29** "membership expired", not a not-yet-valid code.
     - Readers show **no user ID** during enrolment, only on later scans.
     - The test readers run on **Wi-Fi**; "unplugging the network" means the menu's Wi-Fi switch.
     - **Confirmed known edge (RB-3):** a re-seat queued while a reader is offline deletes fingers added there during the outage.
  2. Brief (`access-control-hardware-session.md`) §7, append: `Readers show no user ID during enrolment. "Re-send to readers" is a re-seat: Delete User on every reader first, then the re-add. A restart's repair lands 3–8 min after the restart. "Repair fingerprints" on a reader card queues the same re-seat for every member that reader holds, 60 s later.`
- **Commit:** `docs(access-control): record what the readers did on visits 1 and 2`

### R2-15 — Final gate, E2E specs, draft PR, hand-off

As round 1 T-26, with branch `fix/access-control-visit-2-findings`, PR title `fix(access-control): visit 2 findings — finger slots, consent, events pull, repair button (round 2)`, expected E2E result **14 passed, 1 skipped** (if a spec fails only on text this round changed, it should already have been updated in that task; any other failure is recorded, not fixed). The PR body lists every task with its commit, the tracker URL, "Visual check not done by the executing session (F2-02)", and "RB-1/RB-2/RB-3 automatic detection is not in this round (F2-04)".

---

## 4. Owner actions

| ID   | Action                                                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O2-1 | Rotate the VFT account password (exposed 2026-09-22); re-enter it through the deployed app only.                                                                                                                      |
| O2-2 | Rotate `ACCESS_CONTROL_WEBHOOK_TOKEN` (appeared in transcripts 2026-10-07 and 2026-10-10) in Vercel and `.env.local`; re-register the URL with VFT.                                                                   |
| O2-3 | Tell gyms the interim power-cut guidance: readers on a UPS; after a cut, wait a minute, then press **Repair fingerprints** on each affected reader (available once round 2 is live; until then, Re-send each member). |
| O2-4 | Confirm `.env.local` has `ACCESS_CONTROL_ENABLED=false` before the Sonnet session.                                                                                                                                    |
| O2-5 | After the Opus review: merge the round-2 PR (production deploy + release).                                                                                                                                            |
| O2-6 | Arrange visit 3 with VFT: menu access, Wi-Fi switch and power pulls allowed, ~4 hours, ideally a second person; only after F2-04 ships and F2-05 is written. HW Test 1–10 stay parked.                                |

## 5. Follow-ups after the Sonnet session (not Sonnet's)

| ID    | Who                                    | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2-01 | Opus                                   | Review the branch (decisions, test-first, mutation evidence, scope, gate); run the new Supabase queries read-only against production (`hasRecentEventsPull`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F2-02 | Opus                                   | Visual check: finger selector and "Register another finger", "Record consent" in the alert, activity-log caption, "Repair fingerprints" button and dialog, **and CD-5** (capacity bar at `0 / 100` and `40 / 100` on the reader card).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F2-03 | Remote session (after round 2 is live) | **R-1 signal hunt:** `vendor device-raw` on A and B; Door Access → Restart **reader A only** (reader B holds real members); `device-raw` again at +1, +3 and +10 min; then `vendor events-pull --reader A`; query `access_events` for event codes 107, 111, 237 and any subject-0 rows after the restart and after the visit-2 power cuts (B ~12:21, A ~13:25 SLT 2026-10-10). Record which fields or events changed. **RB-4 re-runs:** XC-03, XC-04, XC-05, XC-06, XC-10, AP-02, AP-07, AP-08, AP-09, EV-02, EV-04, EV-06, LC-03, LC-07 (expected results in `backups/hw-session/fixes-live-remote-2026-10-10.md`). **CD-4 check:** `reconcile` dry run enqueues 0 for the parked members. **CD-5 look** with the owner at a browser. |
| F2-04 | Opus                                   | From F2-03's findings, design **RB-1/RB-2 automatic detection** and the **RB-3 guard** for automatic repairs, plus the panel's certainty wording; write it as round 3 (same format) for Sonnet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F2-05 | Opus                                   | Rewrite the runbook (CR-2) for visit 3: Reader A serial `…077`; the real finger map with `--finger` keys; ids read from `snapshot`; callbacks proven by scans; Wi-Fi steps (PH-12, PH-25 redesigned); withdraw/resend steps on the updated console; PH-24 with `reconcile --members` and the B-14 double reconcile; expected texts; new tasks for RB-1 power-loss repair, RB-3 offline enrolment versus repair, fix #6 refusal self-repair, CD-1 two fingers, the Repair button; E2E readers registered by the api agent itself (R-5); visit-3 run order per report §A.8.7.                                                                                                                                                            |
| F2-06 | Owner + physical session               | Visit 3 per the new runbook; PH-31 gate (report §A.8.8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## 6. Traceability (report §A.8)

| Item                             | Handled by                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| RB-1 power loss                  | R2-10 (manual stopgap), R2-07/R2-08/R2-09/R2-13 (instruments), F2-03 (signal hunt), F2-04 (automatic repair) |
| RB-2 menu deletion               | F2-03, F2-04 (needs a device-side signal; none exists in the API today)                                      |
| RB-3 offline repair              | R2-10 (60 s delay + warning), F2-04 (guard for automatic repairs)                                            |
| RB-4 remote re-runs              | F2-03                                                                                                        |
| CD-1 finger slot                 | R2-03, R2-04, R2-12                                                                                          |
| CD-2 pulled-event time           | R2-08, R2-09, R2-13                                                                                          |
| CD-3 consent for existing finger | R2-05                                                                                                        |
| CD-4 parked members re-enqueued  | R2-01, R2-02; verified in F2-03                                                                              |
| CD-5 capacity bar                | F2-02, F2-03                                                                                                 |
| CD-6 unreported refusals         | R2-06                                                                                                        |
| CR-1 console                     | R2-11, R2-12, R2-13                                                                                          |
| CR-2 runbook                     | F2-05                                                                                                        |
| A.8.4 docs                       | R2-14                                                                                                        |
| A.8.5 remote R-1…R-5             | F2-03 (R-1, R-2, R-3, R-4), F2-05 (R-5)                                                                      |
| A.8.6 owner                      | O2-1…O2-6                                                                                                    |
| A.8.7 / A.8.8 visit 3            | F2-05, F2-06                                                                                                 |
