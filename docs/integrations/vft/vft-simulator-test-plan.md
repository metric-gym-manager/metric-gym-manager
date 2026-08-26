# VFT Simulator Test Plan

> **Purpose.** This is the checklist for the first session against real VFT
> hardware or their simulator. Every item exists because something in our
> implementation currently rests on an assumption, a guess, or a defensive
> choice that has never met a device.
>
> **How to use it.** Work top to bottom. Part A comes first and is not
> optional: those results can change the design, and running the later parts
> against a wrong assumption wastes the session. Record every result in the
> template at the end — a "yes, as expected" is as valuable as a surprise,
> because it upgrades an assumption's evidence grade.
>
> **Before you start**, set `ACCESS_CONTROL_ENABLED=true` and point
> `VFT_API_BASE_URL` at the simulator. With that flag off, every call goes to
> `MockAccessControlProvider` and you will test nothing.

---

## Pre-flight

| #   | Setup step                                                                                                                           | Why                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| P1  | `ACCESS_CONTROL_ENABLED=true`, `VFT_API_BASE_URL` set                                                                                | Otherwise the Mock provider answers and nothing reaches the simulator        |
| P2  | `ACCESS_CONTROL_ENCRYPTION_KEY` set (32 bytes, base64)                                                                               | Credentials cannot be stored without it                                      |
| P3  | `ACCESS_CONTROL_WEBHOOK_TOKEN` set, and the callback URL registered with VFT as `https://<host>/api/webhooks/access-control/<token>` | Without it the webhook returns 401 to every scan                             |
| P4  | A test gym on the **Enterprise** tier                                                                                                | Every route 403s otherwise, and the reconciler skips the gym                 |
| P5  | At least **two** readers registered, if the simulator allows it                                                                      | Half the interesting failures only appear with two                           |
| P6  | Have the SQL console open on `access_sync_jobs` and `access_events`                                                                  | Most verification is "what landed in the outbox", not "what the screen said" |

---

## Part A — Assumption verification

**Run these first.** Each one is currently an assumption in
`vft-api-assumptions.md`, and the answer changes what we build.

### A-1 · Does a **refused** scan reach the webhook? ⚠️ HIGHEST PRIORITY

Present a finger for a member whose validity window has expired, and one for a
finger the reader does not know.

| Outcome         | What it means                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Events arrive   | The activity log can show refusals as designed. We already store and classify them — no code change, and `DeviceEventCodes` gets exercised for real.                               |
| Nothing arrives | The log is **entries-only**. The front desk answers "why won't it let me in" from our own member record instead, and the UI plan's refusal rows must be cut before they are built. |

This single answer decides a whole screen. Do it first.

**Also check `POST /api/devicecmd/events`.** The collection exposes it, and it
is the one endpoint that could let us _pull_ the transaction table rather than
wait to be pushed. If refused scans never arrive on the webhook but are
readable here, the answer changes from "cut the refusal rows" to "poll for
them" — a different design, not a smaller one. Record what it returns, whether
it accepts a time range, and whether it drains or repeats on a second call.

**What is already built either way.** The activity log's Refusals filter exists
and runs server-side over the classified code sets, so if events do arrive there
is nothing to build. If they never arrive, the filter simply returns an empty
page — correct, and it costs nothing to leave in place while this is unknown.

### A-2 · Return codes on command execution (assumption A2)

Send a `validperiod` to a device that is **powered off**, then power it on.

- Does the queued command execute on reconnect?
- Does a return code come back anywhere we can read it?
- What does `GET /api/devicecmd/{DevSN}` show while it is queued?

Our whole outbox treats "HTTP 200" as _queued_, not _applied_. If there is a
readable completion signal we should be consuming it.

### A-3 · Is `EndDate` really inclusive? (assumption A5 — marked CONFIRMED, verify anyway)

Push a window ending **today**. Scan. Then set the device clock past midnight
(or wait) and scan again.

- Admitted on the end date itself → inclusive, as designed.
- Refused on the end date → **every member is being locked out a day early.**
  This is the single highest-blast-radius assumption in the system.

### A-4 · Enrolment: who assigns the `EmpId`? (assumption A6)

Call `POST /api/access-control/members/{id}/enrol`, watch the reader.

- Does a prompt appear on the device?
- Does it target the `EmpId` we sent, or does it ask an operator to key one in?
- After enrolment, does `GET /api/template` show the template against **our**
  id?

If an operator can key in their own id, our global sequence stops being the
identity authority and §6 of the design doc needs rework.

### A-5 · Does a device-local enrolment reach the platform? (assumption A4)

Enrol a finger **at the terminal**, using the device's own admin menu, without
calling our API at all.

- Does it appear in `GET /api/template`?
- Under what id?

This is how gyms actually work today. If device-local enrolments never surface,
we can only detect enrolments we triggered.

### A-6 · Field limits (`EmpId` 15 chars, `EmpName` 24 chars)

Send a name longer than 24 characters and one with spaces, and a subject id at
the top of the range (`79999999`).

- Truncated, rejected, or accepted?
- Do spaces survive, or do they need the underscores we substitute?

Our `formatSubjectName` cuts on a word boundary and `assertValidSubjectId`
throws rather than truncating. Confirm both are the right call.

### A-7 · `AreaID` is not a security boundary (assumption A9)

With credentials for area 1, try to read and command a device in area 2.

- Allowed → confirms our position that tenant isolation is ours alone.
- Blocked → we could add area as defence in depth, though we still would not
  rely on it.

### A-8 · Does a later write disturb an existing block? (assumption A10)

Block a subject, then push a `validperiod` for the same subject, then scan.

- Still refused → the firmware keeps the block, and our "never send a window to
  a blocked subject" guard is belt-and-braces.
- **Admitted** → the guard is load-bearing and A10 is confirmed at grade A.
  This is the assumption that shaped `AccessCommands` most.

### A-9 · Device poll interval (assumption A3)

Time the gap between issuing a command and it taking effect, on an idle device.

Feeds the enrolment dialog's countdown and the 5-minute drain interval.

### A-10 · Timezone handling

Check what the device reports in `AttTime` and what `TimeZone` value it holds.

- Is `AttTime` device-local with no offset, as we assume?
- Does `330` mean UTC+5:30 as we read it?

Our `parseDeviceTime` subtracts the stored offset. If the device already sends
UTC, **every timestamp is 5½ hours wrong** and clock-drift alarms fire
constantly.

---

## Part B — Use-case walkthroughs

Each is a full path through real code. Verify **both** the vendor side and our
database.

| #    | Flow                          | Steps                                        | Verify                                                                                                                                                                            |
| ---- | ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-1  | **Connect a gym**             | Save credentials → verify connection         | `last_verified_at` set; wrong password returns `verified: false`, not a 500                                                                                                       |
| B-2  | **Register a reader**         | `POST /devices` with the simulator's serial  | Row created; a second gym registering the same serial gets **409**                                                                                                                |
| B-3  | **First member sync**         | Create an active member → wait for the drain | `provision` → `sync_to_device` → `set_valid_period` in that order; subject id allocated from the sequence                                                                         |
| B-4  | **Enrol a fingerprint**       | Enrol → present finger → check               | Prompt appears; template visible in `GET /api/template`; see A-4/A-5                                                                                                              |
| B-5  | **Successful entry**          | Scan an active member                        | Event stored with the **member id resolved** (not just in `raw`); appears in `GET /api/access-control/events`                                                                     |
| B-6  | **Renewal extends access**    | Collect a payment                            | New window pushed; `last_synced_valid_to` moves; member admitted past the old date                                                                                                |
| B-7  | **Expiry at the boundary**    | Let a member's date pass, or move the clock  | Refused **from the next local midnight**, not before, not a day late                                                                                                              |
| B-8  | **Suspension**                | Suspend a member                             | `block` sent; **no `validperiod` accompanies it**; scan refused immediately                                                                                                       |
| B-9  | **Cancellation**              | Cancel a member                              | `block` then `revoke_biometric` (`fromdev`); **never `removeSubject`**; template gone from the reader, still present centrally                                                    |
| B-10 | **Rejoin after cancellation** | Reactivate the cancelled member              | Restored by re-sync alone — **the member does not touch the scanner again**. If they must re-enrol, our central-copy assumption is wrong and eviction policy must be reconsidered |
| B-11 | **Remove a fingerprint**      | `DELETE /members/{id}/biometric`             | Template cleared, **membership untouched**, member still listed as active                                                                                                         |
| B-12 | **Remote unlock**             | `POST /devices/{id}/open`                    | Door opens; job row records the actor; **device event 8 comes back on the webhook** as independent confirmation                                                                   |
| B-13 | **Reboot**                    | `POST /devices/{id}/reboot`                  | Device restarts and **still admits members afterwards** — templates and windows survive                                                                                           |
| B-14 | **Nightly reconcile**         | Trigger `/api/cron/reconcile-access`         | Only changed members enqueued; running it twice in a row enqueues **nothing** the second time                                                                                     |

---

## Part C — Failure modes

### C-1 · Device offline

Power the reader off, then:

1. Change a member's status. Does the drain queue the command without error?
2. Power on. Does the queued command apply?
3. **Does an existing member still get in while it is offline?**

Item 3 is the core promise of the whole design. If a powered, network-isolated
reader stops admitting valid members, the device-as-authority premise is wrong
and the architecture needs revisiting.

### C-2 · Vendor API down

Point the base URL at an unreachable host mid-drain.

- Jobs go to `failed` with a retry, not `dead`
- Backoff follows `SYNC_RETRY_BACKOFF_SECONDS`
- Gym managers see "pending", never a connection error (rule 2.8/2.9)

### C-3 · Wrong credentials

Change the stored password to something invalid.

- Verify returns `verified: false`
- Drain fails **without** dead-lettering everything on the first 401
- No vendor error string reaches a gym-facing response

### C-4 · Device storage full (`-18`)

If the simulator can fake a full reader: enrol past capacity.

- Return code classified as `needsAttention`
- Job **dead-lettered immediately**, not retried until the budget burns
- Cron logs the run as a failure so it surfaces on `/system-health`

### C-5 · Malformed webhook

POST junk, an empty array, an array with a missing `AttTime`, and a valid batch
with one bad row.

- All return **200** except a genuine database fault
- The good rows in a mixed batch still store
- Bad rows counted in `errors`, not dropped silently

### C-6 · Unknown device serial

POST a webhook event for a serial we have not registered.

- Counted in `unknownDevice`, stored nowhere
- **No guess at which gym it belongs to** — this is what protects other tenants
  on a shared account

### C-7 · Worker killed mid-drain

Kill the drain process while jobs are `in_flight` (or set some rows to
`in_flight` with an old `updated_at`).

- Next run reclaims them (`reclaimed > 0`)
- They eventually succeed rather than sitting stranded

### C-8 · Partial command failure

Fail the second command of a three-command sequence.

- **Nothing is recorded as synced** — `last_synced_*` unchanged
- The retry re-sends the whole sequence and it is idempotent
- The member is not left with a window on a reader that never got their
  template

---

## Part D — Edge cases

| #    | Case                                         | Expected                                                                                           |
| ---- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| D-1  | Member expiring **today at local midnight**  | Admitted all day, refused from 00:00 next day, on the device's own clock                           |
| D-2  | Membership starting **in the future**        | Refused until the start date, no window pushed early                                               |
| D-3  | Unverified QR self-registration              | Refused even with a valid-looking payment                                                          |
| D-4  | Due date corrected **backwards** (refund)    | Window tightens; if the new date is past, block **with no window**                                 |
| D-5  | Member with **no fingerprint** but active    | Subject provisioned, no template, door does not open — and the UI says why                         |
| D-6  | Two readers, member enrolled on one          | Both get the template and the window; check the reader that was added **second**                   |
| D-7  | Reader added **after** members were synced   | Every existing member reaches it (this was defect D1)                                              |
| D-8  | Reader unlinked, then re-registered          | Serial free after unlink; **templates still physically on the hardware** — confirm and document    |
| D-9  | Subject id at the range ceiling (`79999999`) | Accepted; `79999999+1` refused by us before it ever reaches the vendor                             |
| D-10 | Name with spaces / non-Latin characters      | Underscored and truncated on a word boundary; confirm the device displays something sensible       |
| D-11 | Duplicate webhook delivery                   | Second delivery counted as `duplicates`, one row stored                                            |
| D-12 | Event with an `EmpId` we do not know         | Stored with `member_id` NULL — visible in the log, not dropped                                     |
| D-13 | Gym downgraded from Enterprise mid-life      | Routes 403; reconciler skips as `gymsSkippedNotEntitled`; **members keep working from the reader** |
| D-14 | Gym subscription suspended                   | Same: sync stops, existing access survives                                                         |
| D-15 | Member deleted from our database             | Cascade removes the subject row; confirm what happens to the template on the reader                |

---

## Part E — Race conditions and concurrency

These are the ones that will not show up in casual testing and will absolutely
show up in production.

### E-1 · Two drain runs overlapping

Trigger `/api/cron/drain-access-sync` twice simultaneously.

- No command sent twice (`FOR UPDATE SKIP LOCKED`)
- No member has two jobs in flight (`DISTINCT ON member_id`)

### E-2 · Payment collected during a drain

Collect a payment for a member whose job is mid-flight.

- The new state wins; the member ends with the **correct** window
- No lost update where the older window overwrites the newer

### E-3 · Enrolment during a sync

Start enrolment while a `reconcile_member` job for the same member is running.

- Commands do not interleave destructively
- The template survives the window push

### E-4 · Reconcile and trigger enqueue together

Change a member at 18:30 exactly, while the reconciler sweeps.

- Two jobs may be created; only one is claimed per batch
- Both eventually settle; the final state is correct either way

### E-5 · Eviction during a renewal

Start eviction while an eviction candidate pays and becomes active.

- The now-active member is **not** evicted, or is immediately restored
- Worst case is one wasted round trip, never a paying member locked out

### E-6 · Clock skew across midnight

Set the device clock 10 minutes slow, with a member expiring tonight.

- Confirm exactly when the member stops being admitted
- Confirm we detect and report the drift

### E-7 · Webhook arriving during a sync

Scan a member while their sync job runs.

- Event stored; sync unaffected
- No deadlock between the webhook write and the outbox update

---

## Part F — Scale and load

| #   | Test                           | Watch for                                                                         |
| --- | ------------------------------ | --------------------------------------------------------------------------------- |
| F-1 | Sync 100+ members in one drain | Pacing holds at 5 req/s; no vendor throttling; run completes inside `maxDuration` |
| F-2 | Reconcile a 500-member gym     | Only changed members enqueue; runtime stays sane                                  |
| F-3 | Webhook batch of 100 events    | All stored; single round trip; no timeout                                         |
| F-4 | Reader at 90%+ capacity        | Eviction frees to target; **no active member selected**                           |
| F-5 | 1000+ rows in `access_events`  | Log pagination stays fast; ordering correct                                       |

---

## Part G — Security

| #   | Test                                                              | Expected                                            |
| --- | ----------------------------------------------------------------- | --------------------------------------------------- |
| G-1 | Webhook with a wrong path token                                   | 401, nothing stored                                 |
| G-2 | Webhook with no token configured server-side                      | 401 — fails closed, never accepts anonymous writes  |
| G-3 | Gym A operating gym B's device by id                              | 404 before anything reaches the vendor              |
| G-4 | Lite/Pro gym calling any access-control route                     | 403 from the guard                                  |
| G-5 | `GET /account` after saving credentials                           | Password and email **never** in the response        |
| G-6 | Signed-in user calling `claim_access_sync_jobs` via PostgREST RPC | Permission denied (locked down in `20260813000001`) |
| G-7 | Gym owner selecting `access_control_secrets` directly             | Zero rows — RLS enabled, no policies                |
| G-8 | Webhook payload claiming a different gym id                       | Ignored; gym resolved from `device_serial` only     |

---

## Part H — The screens

The UI is built, so the simulator session is the first chance to see whether
what it says matches what the hardware does. These are not cosmetic checks:
each one pins a place where the screen could confidently state something false.

| #    | Test                                                                 | Expected                                                                                                                                |
| ---- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| H-1  | Register a reader, then look at `/access-control` before any scan    | Presence reads **"No contact yet"**, not "Not responding". A brand-new reader must never look broken.                                   |
| H-2  | Let a registered reader sit idle past `DEVICE_OFFLINE_AFTER_SECONDS` | Still **online** if it is scanning or answering. A healthy reader flickering offline is the failure this threshold exists to prevent.   |
| H-3  | Unplug a reader and wait out the threshold                           | "Not responding", with the copy saying the door still works. Confirm the door **does** still admit a valid member.                      |
| H-4  | Enter a capacity in settings, then fill the reader past 85%          | Capacity bar turns warning; the near-full alert appears on the dashboard.                                                               |
| H-5  | Leave capacity blank                                                 | No bar, no false "0%" — the panel says capacity is unknown. A reader at "0% full" would be a lie.                                       |
| H-6  | Press **Register fingerprint**, then never touch the sensor          | Reaches `timed-out` after two minutes, worded as still-waiting rather than failed.                                                      |
| H-7  | Press **Register fingerprint**, present a finger _after_ the timeout | The member still shows as registered on the next open. Detection is additive — this is the whole reason H-6 is not an error.            |
| H-8  | Close the member modal mid-enrolment                                 | Polling stops. Watch the network tab: no requests after the modal closes.                                                               |
| H-9  | Rename a member, then check the vendor console                       | The new name is on their subject record. Then break the vendor connection and rename again — the rename must still succeed for the gym. |
| H-10 | Rename a reader, then check the vendor console                       | Same: name lands, and a vendor failure does not fail the rename.                                                                        |
| H-11 | Register a new member while a reader is reachable                    | They are pushed immediately — walk them straight to the reader without waiting for the drain.                                           |
| H-12 | Register a new member with the vendor unreachable                    | Registration **succeeds anyway**. The member exists, the job is queued, and the drain lands it later.                                   |
| H-13 | Set a member past due, open their record                             | "Cannot get in" with a plain-language reason, and no vendor code anywhere in the panel or the page source.                              |
| H-14 | Force a job to dead-letter, open the member                          | `syncFailed` shows as "a change did not reach the readers" — not as a green tick with nothing queued.                                   |
| H-15 | Filter the activity log to Refusals with 60+ events present          | Page count and total describe the _filtered_ set. Page 2 of refusals must not be page 2 of everything.                                  |
| H-16 | Present an unenrolled finger, then read the log                      | Shows as "Not recognised" rather than being hidden. Depends on A-1.                                                                     |
| H-17 | Skew a reader's clock past the alert threshold                       | Drift warning on the card and the dashboard, worded as "memberships may end on the wrong day".                                          |
| H-18 | Open `/access-control` as a Lite gym                                 | Upgrade panel; no sidebar entry; the settings row is still visible and explains the feature.                                            |
| H-19 | Press **Free up space** on a reader holding only current members     | Warning about the shortfall, not an error toast. This is a buy-another-reader conversation.                                             |

---

## Recording template

Copy this per item. The grade change is the point — the assumptions document
should be updated from these results.

```
Item:            A-3
Date / tester:
Simulator or real hardware:
What we did:
What happened:
Matches our assumption?   yes / no / partly
Evidence grade change:    B -> A
Code change needed:       none / <describe>
Follow-up question for VFT:
```

---

## Priority order if the session is short

If you only get an hour, do these eight:

1. **A-1** — do refusals reach the webhook? (decides a whole screen)
2. **A-3** — is `EndDate` inclusive? (highest blast radius)
3. **A-8** — does a later write disturb a block? (shaped the command derivation)
4. **C-1.3** — does an **offline** reader still admit valid members? (the core premise)
5. **B-9 + B-10** — cancel then rejoin without re-enrolling (decides whether eviction is safe)
6. **A-4** — who assigns the `EmpId`? (decides whether our identity model holds)
7. **A-10** — timezone handling (a wrong reading makes every timestamp 5½ hours out)
8. **G-1** — webhook rejects a bad token

Everything else can wait for a second session. These eight are the ones where a
surprise means rework rather than a tweak.
