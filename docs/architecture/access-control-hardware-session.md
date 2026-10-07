# Access Control — On-Site Hardware Session Brief

**The one document the test session reads.** Everything else it needs is in the
task records. Written 2026-10-07 for the rounds run at VFT with real readers.

| What                              | Where                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| **Live task list (status)**       | https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL — database collections listed in §6       |
| Task definitions (canonical seed) | `docs/architecture/access-control-hardware-runbook.json` — 67 tasks, 3 rounds, 398-case map |
| Campaign tracker (case results)   | https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC — `results/<case id>`                     |
| Session prompt                    | `docs/architecture/access-control-hardware-session-prompt.md`                               |
| Session console                   | `scripts/hw-session.ts` (alias below: `hw`)                                                 |
| Catalogue / design (do not read)  | `access-control-test-campaign.md`, `access-control-master.md`                               |

`hw` means `npx tsx scripts/hw-session.ts`, run from the repository root on
`master` (after `git pull`), with `.env.local` present.

---

## 1. Owner checklist — before and around each round

- [ ] **Before travelling:** ask VFT to confirm the attendance callback URL is
      registered on account `admin@capitalistone.co` and to fire their
      WebhookCheck at it. Give them the URL privately — never through a chat.
- [ ] **Before travelling:** arrange admin access to each reader's menu and
      permission to pull power, pull the network and change the clock.
- [ ] **Before Round 1:** merge branch `claude/access-control-hardware-runbook`
      and let production deploy (R1-01 checks). Merging cuts a release.
- [ ] Bring the laptop (this repo, `.env.local`, Claude Code) and a phone
      signed in to www.metricgymos.com as Titan Fitness.
- [ ] **After the campaign:** rotate the VFT account password (exposed
      2026-09-22). If the webhook token ever appeared in a transcript, rotate
      `ACCESS_CONTROL_WEBHOOK_TOKEN` in Vercel and `.env.local` and re-register
      the URL with VFT.

---

## 2. The rig

|                     | Reader A                                                                   | Reader B                                                            |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Serial              | `NYU7251900066`                                                            | `NYU7254500734`                                                     |
| Our name            | Device A (test)                                                            | Device B (test)                                                     |
| Vendor name         | Device1                                                                    | Device B (test)                                                     |
| State on 2026-10-07 | Collected a backlog on 5 Oct; 2 validity commands sent, never acknowledged | Offline since ≤3 Oct; 4 commands NEVER SENT; vendor reports 0 users |

- **Gym:** Titan Fitness (`481599f6-5134-4152-83b2-6e2dd10e3018`), Enterprise.
  It is the owner's real gym: **real members are on these readers.** The
  session touches only the four test members.
- **Test members (created in R1-06):** `HW Test 1` = right index finger ·
  `HW Test 2` = right middle · `HW Test 3` = left index · `HW Test 4` = left
  middle · unknown finger = right thumb (never enrolled anywhere).
- **App paths** (www.metricgymos.com, signed in as Titan Fitness):
  - _Member panel_ — Members → click the member → scroll to **Door Access**:
    badge, explanation, window line, Fingerprint badge, consent box, reader
    drop-down, **Register fingerprint**, **Remove fingerprint**, **Re-send to
    readers**. Status actions (**Suspend Member**, **Activate Member**,
    **Cancel Member** — only from suspended/expired) are higher in the modal;
    **Mark Paid** / **Re-activate** sit in the footer.
  - _Door Access_ — sidebar → Door Access: alert strip, a card per reader
    (**Open door**, **Free up space**, **Restart**), Recent activity with
    All / Entries / Refusals / Alerts / Device filters. It does not refresh by
    itself: reload the page to see new scans.
  - _Reader settings_ — Settings → Access Control: account card; readers with
    name, capacity, **In use** switch and **Forget** (bin icon).

---

## 3. Hard rules

1. **Never print a secret.** Not the webhook token or URL, the VFT password,
   the service-role key or `CRON_SECRET`. Never `cat .env.local` and never
   echo a variable from it. Vercel log entries can include the request path,
   which contains the webhook token: quote only message text. If a token
   appears in any tool output, open finding "webhook token exposed in a
   transcript — rotate after the campaign" and carry on.
2. **Touch only HW Test 1–4.** Write to production only through `hw … --apply`
   or the app UI as the operator. Never run SQL `UPDATE`/`DELETE`/`INSERT`
   against production tables. Read-only SQL is fine.
3. **Never** run `provision-access-control-test-gym.ts` with
   `ALLOW_CREDENTIAL_OVERWRITE`, never delete vendor subjects or queues, never
   call `DELETE /api/devicecmd`, never run the E2E suite with the real provider.
4. **No code changes during a session.** A defect is recorded as a finding;
   fixing it is a separate desk session.
5. **Run every task's `restore` before moving on**, even when the task failed.
6. **Measure the thing.** The reader's screen, the vendor queue (`watch-queue`)
   and the database (`snapshot`, `watch-events`) are evidence. A toast, an HTTP
   200 or a green summary is not. Pending is not failure. A queued command is
   not an applied one.
7. **Stop and ask the operator** before anything a task does not list, and
   whenever a `stop_if` condition holds.

---

## 4. The console (`hw`)

| Command                                                                                                                                 | What it does                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hw snapshot`                                                                                                                           | Read-only. Our readers (presence, skew), HW members (status, dates, consent, subject, held by, finger, window sent), the newest real-member change (a stop condition), latest scans, latest jobs + dead count, vendor counters (FpCount/UserCount), vendor subject records, each reader's queue tail. Saves JSON evidence under `backups/hw-session/`. |
| `hw watch-events --since 3m --timeout 120 [--all]`                                                                                      | Read-only. Prints each stored scan: reader, subject, member, event code + kind, verify type, reader clock vs stored time. Looks back from `--since`, so run it **after** the operator scans. Stops 15 s after the first scan unless `--all`.                                                                                                           |
| `hw watch-queue --reader A\|B --since 5m --timeout 180`                                                                                 | Read-only. Follows that reader's vendor queue until our recent commands are DONE. States: `NEVER SENT` (reader not polling), `SENT, NOT DONE`, `SENT, NO REPLY`, `DONE` with the Return code.                                                                                                                                                          |
| `hw set-dates --member "HW Test 1" --due D --start D --apply`                                                                           | D = `YYYY-MM-DD`, `today`, `yesterday`, `tomorrow`, `+N`, `-N` (gym-local days). The trigger enqueues an outbox job.                                                                                                                                                                                                                                   |
| `hw drain --apply`                                                                                                                      | Runs the real outbox drain now, from the laptop, so a change need not wait up to 5 min for the cron. Refuses if another gym has jobs due. `--crash-after N` exits after the Nth vendor command is accepted, leaving jobs in_flight on purpose.                                                                                                         |
| `hw reconcile [--apply]`                                                                                                                | Runs the real nightly reconcile for Titan. Without `--apply` it reports whom it would enqueue.                                                                                                                                                                                                                                                         |
| `hw vendor <validperiod\|block\|grant\|sync> --member M --reader A\|B [--start YYYYMMDD --end YYYYMMDD] --apply`                        | One direct vendor call that bypasses our records on purpose (A-8). Restore with the panel's Re-send.                                                                                                                                                                                                                                                   |
| `hw vendor events-pull --reader A\|B --apply`                                                                                           | Asks the reader to upload its stored attendance log.                                                                                                                                                                                                                                                                                                   |
| `hw enrol --member M --reader A\|B [--consent] --apply`                                                                                 | One real enrolment outside the panel (the panel hides Register once a finger is registered).                                                                                                                                                                                                                                                           |
| `hw withdraw --member M --apply`                                                                                                        | The same use case as Remove fingerprint, usable mid-enrolment.                                                                                                                                                                                                                                                                                         |
| `hw race <consent\|enrol-both\|enrol-two\|enrol-vs-cancel\|double-cancel> --member M [--member2 M] [--reader A\|B] [--consent] --apply` | Real use cases fired at the same instant. Cancellation follows the app's path (suspend → cancel).                                                                                                                                                                                                                                                      |
| `hw ambiguous <enrol\|sync> --member M [--reader A\|B] [--consent] --apply`                                                             | The vendor really receives the command; our side is told it timed out.                                                                                                                                                                                                                                                                                 |
| `hw coverage`                                                                                                                           | Offline: every catalogue case has exactly one disposition in the runbook.                                                                                                                                                                                                                                                                              |

Without `--apply` every write command prints what it would do and stops.
**Placeholders** in a task's command (`<TODAY>`, `<TODAY+30>`, `<HW3 subject
id>`) are filled from the latest snapshot: its header gives gym-today, and the
members table gives subject ids. Write `<TODAY>` as `YYYYMMDD` for vendor
commands.

**Read-only SQL** (Supabase MCP `execute_sql`) is for what the console does not
print. Columns worth knowing: `access_events(occurred_at, created_at,
device_serial, subject_id, member_id, event_code, verify_type, raw)`,
`access_sync_jobs(intent, status, attempts, last_error, payload, created_at,
updated_at)`, `cron_logs(job_name, status, started_at, summary)`.

**Vercel MCP:** project `prj_A65dZtjDSUp0qVs1SKNDxaAe2AAy`, team
`team_Fl7rQYbRLMhzxU8bhXeMOE94`. Use `list_deployments` (target production)
and `get_runtime_logs` with `query` = a message text such as
`Access webhook`. The tool can time out; one retry, then ask the operator to
read the Vercel dashboard log message aloud (never the path).

---

## 5. Reading what comes back

**Event kinds** (printed by `watch-events`). _Granted_ = the door opened:
`0`/`14` normal fingerprint entry, `1`/`16` inside a normal-open period,
`8` opened remotely. _Denied_ = refused: `20`/`31` scanned again too soon,
`21`/`35`/`22` outside the valid time period, `23` unauthorised, `27`/`30`/`34`
not registered, `29`/`33` privilege expired. _System_ = reader or door state.
_Alarm_ = needs a person. An unknown code is stored as-is; record it.

**Verify type:** `1` fingerprint, `0` password, `2` card, `15` face. Only a
`1` confirms an enrolment.

**Return codes in the queue:** `≥ 0` success (enrol gives `6`; a data query
returns a count). `-7` repeated command and `-28` door already open are
benign. `-725` means the reader did not answer within ~2 min, which is
retryable. `-18` means the reader is full. The vendor's
`500 {"message":"Validation error"}` means "already true or already queued"
and is benign.

**Clock:** `watch-events` prints reader clock − stored time. Within ±120 s is
normal (delivery lag). About ±19,800 s means a timezone error. After a
deliberate clock change, a large value is expected.

**Delivery delay is unknown until R1-07 measures it.** VFT may batch webhook
deliveries, so "no scan within 2 minutes" is not "no scan". Until
`state/rig.answers.deliveryLatencySeconds` is set, wait up to **10 minutes**
(`--timeout 600`) before concluding a scan never arrived. After that, use a
`--timeout` of at least twice the measured delay, and never less than 120 s.
A task's own `--timeout` is a floor, not a ceiling.

**Expected screen behaviour, not defects:**

- A reader shows _Not responding_ 15 min after its last scan: the vendor sends
  no heartbeat.
- _Fingerprints_ on a reader card counts only after an eviction run.
- An enrolment is confirmed only by the member's first fingerprint scan.
- Door Access needs a page reload to show new scans.

---

## 6. Recording — after every task, one write

Read one task: `ArtifactData get` url = the runbook artifact,
`collection: "tasks"`, `doc_id: "R1-08"`. Its `version` is needed to write.

**Update the task** (`ArtifactData update` with `if_version`):

```json
{
  "status": "pass | fail | partial | blocked | skipped",
  "outcome": "1–3 sentences: what happened against what was expected.",
  "observations": {
    "A1": "refusals-arrive",
    "enrolReturn": "6",
    "readerScreen": "Verified"
  },
  "caseResults": { "ENR-01": "pass", "CONSENT-02": "pass" },
  "findings": ["H06"],
  "artifacts": ["backups/hw-session/2026-…-snapshot.json"],
  "at": "<ISO time>",
  "by": "hardware session"
}
```

- `caseResults` gives one verdict per case in the task's `cases`. A pass
  criterion tagged `[CASE-ID]` decides that case. Untagged criteria apply to
  the task as a whole.
- **Never** write a field named `evidence`, `steps`, `pass` or `cases`: those
  are the definition.

**Mirror into the campaign tracker** (one `ArtifactData batch`, url
`https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC`, collection `results`,
`op: "set"`, no `if_version` for a new case; for a case that already has a row,
`get` it first and pass its version):

```json
{
  "status": "pass",
  "note": "Hardware runbook R1-08 (2026-10-08): <outcome>",
  "at": "<ISO>",
  "by": "hardware-runbook"
}
```

Status mapping: pass → `pass`, fail → `fail`, partial or blocked →
`blocked` (say why in the note), skipped → write nothing.

**Also keep these current on the runbook artifact:**

- `state/rig.currentTask` — set it to the next task id when moving on (`update`).
- `state/rig.callback`, `.capabilities.*` and `.answers.*` — when a task
  settles them.
- `log/entries` — prepend `{t, actor: "hardware session", text}` to `entries`,
  one line per task. `update` replaces the whole array, so keep the existing
  entries.
- `findings/H<n>` — a new finding is `set` with `{title, severity:
low|medium|high|critical, status: open, task, detail}`. Continue from the
  highest existing id (H01–H05 exist).
- `rounds/<n>` — at close-out, `update` with `{status, date, summary}`.

---

## 7. Rounds

| Round | Theme                                                                                          | Tasks       | ≈ hours |
| ----- | ---------------------------------------------------------------------------------------------- | ----------- | ------- |
| 1     | A finger, a scan, a door — every remaining do-not-ship case and the simulator plan's top eight | R1-01…R1-27 | 5–6     |
| 2     | Time, failure and the honest screen                                                            | R2-01…R2-19 | 4–5     |
| 3     | Concurrency, ambiguity, recovery, acceptance                                                   | R3-01…R3-21 | 6       |

Run tasks in order. A task whose `requires` capability is missing (see
`state/rig.capabilities`), or whose `depends_on` did not pass, is `blocked`
with the reason. Move on. A round can stop part-way: write the close-out
anyway, and the next session starts from `state/rig.currentTask`.

**The simulator plan's 86 items** (`vft-simulator-test-plan.md`) are mapped
too, in the runbook's `simulatorPlan` section: 51 are covered by tasks (each
task's `sim` lists them), 17 were done earlier, 14 are desk work, 1 is deferred
(C-4, a full reader), and 3 are excluded on purpose (A-7 needs a second vendor
area; D-13/D-14 would mean downgrading or suspending the owner's real gym).

**Not in these rounds:** 146 catalogue cases need no one at the reader (listed
in `meta/coverage.desk`). They belong to a later remote session using the same
tools. Three are deferred: SOAK-02/03 need a pilot gym, and RC-10 needs a full
reader.

---

## 8. When something looks wrong

| Symptom                                                | Check, in order                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No scan stored                                         | Callback live (`state/rig.callback`)? Log line `Access webhook delivery`: `unknownSerials` means the serial differs; `unreadableFieldNames` means the payload shape differs. No line at all means nothing was sent. |
| Command stays `NEVER SENT`                             | The reader is not reaching the vendor: power, cable or Wi-Fi, reader network settings. VFT territory.                                                                                                               |
| `DONE` but nothing happened on the reader              | Record the Return value and the exact screen. It is a finding, not a retry.                                                                                                                                         |
| `drain` refuses                                        | Another gym has jobs due: wait for the cron (≤5 min) and run `drain` again.                                                                                                                                         |
| `set-dates` refuses a member                           | The name must be exactly `HW Test N` in Titan Fitness.                                                                                                                                                              |
| A real member changed (snapshot "newest change" moved) | Stop the round and tell the operator.                                                                                                                                                                               |
| Dead job appears                                       | Stop. `snapshot` shows it; read its `last_error` with SQL; record a finding.                                                                                                                                        |
