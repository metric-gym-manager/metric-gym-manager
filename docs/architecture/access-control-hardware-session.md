# Access Control — Door-Hardware Test Sessions Brief

**The one document the test sessions read.** Everything else is in the task
records. Rewritten 2026-10-07 for two tracks: a short **physical visit** (only
what needs a hand, an eye, a menu or a cable at the readers) and a **remote
day** (everything else, with both readers online at VFT), run by a lead and
six agents at once.

| What                              | Where                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Live status**                   | https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL — collection `results` (newest per task wins)              |
| Task definitions (canonical seed) | `docs/architecture/access-control-hardware-runbook.json` — 87 tasks, 398-case and 86-item simulator map (v3) |
| Campaign tracker (case results)   | https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC — `results/<case id>`                                      |
| How to launch each session        | `docs/architecture/access-control-hardware-session-prompt.md`                                                |
| Session agents                    | `.claude/agents/hw-*.md` (system prompts) · `.claude/hw-session.settings.json` (permissions, hooks off)      |
| Session console                   | `scripts/hw-session.ts` (alias below: `hw`)                                                                  |
| Catalogue / design (do not read)  | `access-control-test-campaign.md`, `access-control-master.md`                                                |

`hw` means `npx tsx scripts/hw-session.ts`, run from the repository root on
`master` (after `git pull`), with `.env.local` present. Every command takes
`--as <agent>`; `hw help` prints the agent/phase table.

---

## 1. The two tracks

|         | Physical visit                                                   | Remote day                                                                         |
| ------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Needs   | the operator at the readers; menu, clock, cable and power access | both readers online at VFT all day; the owner at a browser for ~1 h in the morning |
| Runs    | one session (`hw-physical`)                                      | a lead (`hw-remote-lead`) + four agents at once, then one alone                    |
| Members | HW Test 1–4 (each with a finger)                                 | HW Test 5–10 (never a finger) + the two E2E gyms on a local dev server             |
| Cases   | 101                                                              | 210                                                                                |
| Time    | band 1 ≈ 2 h (must) · band 2 ≈ 1½ h · band 3 ≈ 1½ h (optional)   | ≈ 1¼ h with the owner, then ≈ 4–5 h unattended                                     |

**Order: the remote day first, then the visit.** The remote day proves the
callback (a remote door open sends a real event 8), finds defects the visit
would otherwise trip over, and leaves the visit only what needs a person.
**The two tracks never run at the same time** — the console refuses: the phase
file is shared and each track claims it. That interlock, and every agent's
recorded results, live in `backups/hw-session/` of **one checkout on one
laptop**: run both tracks from it, and never let the lead spawn an agent with
worktree isolation.

**Start the remote day in the morning.** Its parallel and exclusive phases take
4–5 hours and must end before 23:30 Sri Lanka time: at 00:00 the nightly
reconcile acts on every Titan member, the agents' test members included. The
console refuses `phase set parallel` from 15:00 and `phase set exclusive` from
20:30 (Sri Lanka time); only the owner's word justifies `--late`.

**Bands (physical):** 1 = the do-not-ship cases and the core premises (a finger
enrols, the first scan confirms, the end date is inclusive, midnight bites,
cancel/rejoin needs no re-enrolment, an offline reader still admits). 2 =
clocks, withdrawal, interrupted and device-local enrolment, scans under
pressure. 3 = menu deletion, network and power trouble, finger races, a
condensed day, the five-source audit. PH-30 closes **every** visit; PH-31 (the
acceptance gates) only the last.

---

## 2. Owner checklist

**Before the remote day**

- [ ] Ask VFT to bring **Device B online** (it has been offline since ≤ 3 Oct,
      commands NEVER SENT) and to keep both readers powered and networked all
      day with nobody touching them.
- [ ] `git pull` on the laptop: the sessions' console, agents and settings
      live on `master`.
- [ ] Do not schedule a Titan announcement for that day.
- [ ] Merge nothing to `master` during either session: a deploy in the middle
      of a test confuses its results (LD-08's redeploy is the one planned
      exception).
- [ ] HW Test 10 already exists, parked, from the final pre-flight check on
      2026-10-07; LD-04 wakes it with the others.
- [ ] Have a browser signed in to www.metricgymos.com as Titan Fitness (laptop)
      and, for LD-06, a phone signed in too.

**Before the physical visit**

- [ ] Arrange admin access to each reader's menu and permission to change its
      clock, pull its network cable and pull its power.
- [ ] The remote day's results are synced (LD-11) and its findings read.
- [ ] Laptop (this repo, `.env.local`, Claude Code) and a phone signed in as
      Titan Fitness.

**After the campaign**

- [ ] Rotate the VFT account password (exposed 2026-09-22).
- [ ] Rotate `ACCESS_CONTROL_WEBHOOK_TOKEN` in Vercel and `.env.local` and
      re-register the URL with VFT: the token appeared in the setup session's
      transcript on 2026-10-07 (a raw dev-server log line). Do it after the
      campaign, so the sessions keep one URL.

---

## 3. The rig

|             | Reader A        | Reader B        |
| ----------- | --------------- | --------------- |
| Serial      | `NYU7251900066` | `NYU7254500734` |
| Our name    | Device A (test) | Device B (test) |
| Vendor name | Device1         | Device B (test) |

- **Gym:** Titan Fitness (`481599f6-5134-4152-83b2-6e2dd10e3018`), Enterprise.
  It is the owner's **real gym**: real members exist; the console touches only
  members named `HW Test N`.
- **Test members** are created by the console (`create-members`) on the
  **daily plan**, 1 LKR, synthetic phone numbers `+947000001NN`, due +200 days,
  and pushed to both readers at once. `HW Test 1` = right index finger ·
  `2` = right middle · `3` = left index · `4` = left middle · unknown finger =
  right thumb. HW Test 5–10 belong to the remote track.
- **E2E gyms** (desk only, through the local dev server): enterprise
  `e0d0a7f9-…` (two fake readers) and lite `3133db6c-…`. Their vendor accounts
  **must stay inactive** — `hw e2e-account` shows it.
- **App paths** (signed in as Titan Fitness): _Member panel_ — Members → the
  member → **Door Access**: badge, explanation, Fingerprint badge, consent box,
  reader drop-down, **Register fingerprint**, **Remove fingerprint**, **Re-send
  to readers**. _Door Access_ — sidebar: alert strip, a card per reader (**Open
  door**, **Free up space**, **Restart**), Recent activity (All / Entries /
  Refusals / Alerts); reload to see new scans. _Reader settings_ — Settings →
  Access Control: name, capacity (100–100,000), **In use**, **Forget**.

---

## 4. Who may touch what — the conflict model

Several agents run against the same two readers at once, so the console, not
their good behaviour, keeps them apart. The phase is in
`backups/hw-session/phase.json`; only `hw phase set` moves it (the lead for the
remote track, the physical session for its own).

| Agent       | Members it owns (phase)                  | Reader-wide + outbox work        | Vendor pace |
| ----------- | ---------------------------------------- | -------------------------------- | ----------- |
| `physical`  | HW Test 1–4 (physical)                   | yes (physical)                   | 4/s         |
| `lead`      | HW Test 5–10 (idle), 9–10 (parallel)     | idle; door opens + soak parallel | 1/s         |
| `outbox`    | HW Test 5–6 (parallel)                   | no                               | 1.5/s       |
| `lifecycle` | HW Test 7–8 (parallel)                   | no                               | 1.5/s       |
| `api`       | none — E2E gyms via the local dev server | no                               | none        |
| `evidence`  | none — read-only (code, tests, docs)     | no                               | none        |
| `exclusive` | HW Test 5–10 (exclusive)                 | yes (exclusive)                  | 4/s         |

- **Reader-wide** = acts on a whole reader or on the shared outbox: `drain`,
  `reconcile --apply`, `open`, `reboot`, `free-space`, `capacity --set`,
  `vendor events-pull`, an `enrol` on a real reader (it holds the reader until a
  finger or the timeout), `reclaim`, `forget`/`register`, `burst sync`, `soak`.
  An `enrol --vendor-url` to the local stub is member-scoped.
- **Members** are refused by number before any lookup: an agent can never
  write to another agent's member, and nothing can address a real member.
- **Paces** sum to 4/s in the parallel phase, under the 5/s production's own
  drain assumes; the vendor documents no limit (a 429 is itself a finding).
- **Desk agents never call the vendor**; the api agent reaches only
  `http://localhost:3100` and refuses Titan's reader serials in any webhook.
- **Production's own drain** runs every 5 minutes and processes every
  agent's jobs — the system working, not interference. Where a task queues a
  job and then processes it itself (a crash, a lost reply, a reader restart
  with a command in flight), both happen in one step, and `set-dates` and
  `--no-push` changes first wait until production's next drain is at least
  75 s away, so it cannot take the job in between.
- **The drain takes one job per member per run** (the claim is `DISTINCT ON
member_id`), and every member change enqueues one. A test member with several
  queued changes therefore clears one job every 5 minutes. That is harmless —
  any processed job syncs the member's current state, so the rest are no-ops —
  and it is why `jobs --wait` waits for **a sync to complete for each member
  since the wait began**, never for an empty queue.
- **`hw coverage`** proves it offline: every step's command, member and scope is
  one the console grants its agent in its phase; every case and simulator item
  has exactly one task.

---

## 5. Hard rules (both tracks)

1. **Never print a secret.** Not the webhook token or URL, the VFT password,
   the service-role key or `CRON_SECRET`. Never open `.env.local` (the session
   settings deny it). Vercel log entries can include the request path, which
   holds the webhook token: quote only message text.
2. **Writes only through the console** (`--apply`, your own `--as`) or the
   operator's clicks in the app. Read-only SQL only. A REFUSED answer is the
   fence working: never get around it.
3. **Never text anyone.** The app's **Mark Paid**, **Add member**,
   **Re-activate** and **Day pass** send real texts to a member's number — the
   test members' numbers are synthetic and might belong to someone. Use the
   console's `pay`, `create-members`, `reactivate`/`unpark` (texts suppressed,
   nothing logged). Test members are on the daily plan, which the 09:00 SLT
   reminder run never texts (`REMINDER_RULES[Daily]` is empty), and every
   session ends with its members **parked** (cancelled).
4. **Never** run `provision-access-control-test-gym.ts` with
   `ALLOW_CREDENTIAL_OVERWRITE`, never delete a vendor subject or queue (the
   console cannot), never write vendor credentials (it cannot), never deploy.
5. **No code changes during a session.** A defect is a `--finding`.
6. **Run every task's Restore**, even when the task failed.
7. **Measure the thing.** The reader's screen, the vendor queue
   (`watch-queue`) and our records (`snapshot`, `jobs`, `watch-events`) are
   evidence. A toast, an HTTP 200 or a ✓ is not. Pending is not failure; a
   queued command is not an applied one.

---

## 6. The console (`hw`, every command `--as <agent>`)

| Group       | Commands                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runbook     | `task <ID>` · `tasks [--agent A]` · `record --task ID --status S --outcome "…" --case ID=verdict… [--obs …] [--finding …]` · `results [--emit-batch [--tracker]] [--mark-synced FILE]` · `phase [set P]` · `coverage`                                                                                                                                                                                                 |
| Read        | `snapshot` (shared-phase agents see only their own members) · `watch-events [--since 3m --timeout 120 --all --member M --code C]` · `watch-queue --reader A\|B [--since 5m --timeout 180 --member M]` · `jobs [--member M] [--wait S]`                                                                                                                                                                                |
| Members     | `create-members --from N --to N` · `park`/`unpark --member M \| --mine` · `pay`/`suspend`/`cancel`/`reactivate --member M [--no-push]` · `push`/`resend --member M [--vendor-url U]` · `rename --member M --to "HW Test N …"` · `set-dates --member M [--due D] [--start D]` · `withdraw --member M`                                                                                                                  |
| Vendor      | `vendor validperiod\|block\|grant\|sync --member M --reader A\|B` (bypasses our records on purpose; restore with `resend`) · `vendor events-pull --reader A\|B` · `enrol --member M --reader A\|B [--consent] [--vendor-url U [--fail-consent-write]]` · `race <scenario>` · `ambiguous enrol \| push --lose <method>`                                                                                                |
| Reader-wide | `drain [--crash-after N \| --crash-on-complete] [--vendor-url U]` · `reconcile [--apply]` · `reclaim --older-than S` · `open`/`reboot --reader A\|B` · `free-space` (refuses if a real member would be evicted) · `capacity --reader A\|B [--set N \| --clear]` · `forget`/`register --reader B` · `burst sync … --approved` · `soak --member M --minutes 60`                                                         |
| Stub        | `stub --port P --mode M` (127.0.0.1 only; modes ok, validation, 500, 500bare, 502, 429, slow, hang, garbage, bizfail, auth) · `stub-mode --port P --mode M` · `stub-log --port P [--since 5m]` · `stub-stop --port P`                                                                                                                                                                                                 |
| Desk        | `devserver start\|stop\|status\|log [--grep X]` · `api <METHOD> <path> --user enterprise\|lite\|anon\|tampered [--body JSON \| --body-gen K] [--find TEXT]` · `webhook --serial S \| --unknown […] [--token good\|wrong\|empty\|short] [--events N \| --same N \| --body-gen K] [--repeat K]` · `burst webhook\|api … --count K` · `tier --gym enterprise\|lite [--to T \| --restore]` · `e2e-account [--deactivate]` |

Without `--apply` every write prints what it would do and stops. `D` in dates
= `YYYY-MM-DD`, `today`, `yesterday`, `tomorrow`, `+N`, `-N` (gym-local days).
Placeholders in a step (`<TODAY>`, `<E2E_DEVICE_1>`, `<HW3 subject id>`) are
filled from earlier output; vendor dates are `YYYYMMDD`.

**Read-only SQL** (lead and physical only, Supabase MCP): `access_events
(occurred_at, created_at, device_serial, subject_id, member_id, event_code,
verify_type, raw)`, `access_sync_jobs(intent, status, attempts, last_error,
payload)`, `cron_logs(job_name, status, started_at, summary)`. **Vercel MCP:**
project `prj_A65dZtjDSUp0qVs1SKNDxaAe2AAy`, team `team_Fl7rQYbRLMhzxU8bhXeMOE94`;
`list_deployments`, `get_runtime_logs` with `query` = message text (one retry,
then ask the owner to read the dashboard message aloud — never the path).

---

## 7. Reading what comes back

**Event kinds.** _Granted_: `0`/`14` fingerprint entry, `1`/`16` normal-open
period, `8` opened remotely. _Denied_: `20`/`31` too soon, `21`/`35`/`22`
outside the valid period, `23` unauthorised, `27`/`30`/`34` not registered,
`29`/`33` expired. _System_ = reader or door state; _Alarm_ = needs a person.
**Verify type:** `1` fingerprint (the only one that confirms an enrolment),
`0` password, `2` card, `15` face.

**Return codes in the queue:** `≥ 0` success — except **Enroll User**: `0` = a finger was taken, `6` = the reader's ~10 s enrolment window timed out with no finger (measured 2026-10-09, PH-07/PH-21). `-7` repeated
command and `-28` door already open are benign. `-725` = no answer in ~2 min
(retryable). `-18` = reader full. The vendor's `500 {"message":"Validation
error"}` means "already true or already queued" — benign.

**Our retry rule** (what the stub tasks check): network errors, timeouts,
502/503/504 and a **bare** 500 are retried with backoff; a 500 whose body names
a reason is a permanent rejection flagged for attention; **any status below 500
— including 429 — is permanent** (a known gap, XC-05 records it); an unfamiliar
200 body reads as "queued" and the reconcile settles it.

**Clock:** `watch-events` prints reader clock − stored time. Within ±120 s is
normal. ≈ ±19,800 s is a timezone error. **Delivery delay is unknown until the
first event of a session arrives** — wait up to 9 minutes (`--timeout 540`)
before concluding nothing came, then use at least twice the measured delay.

**Expected, not defects:** a reader shows _Not responding_ 15 min after its
last event (no heartbeat); _Fingerprints_ on a card counts only after an
eviction run; an enrolment is confirmed only by the first fingerprint scan;
Door Access needs a reload to show new scans.

---

## 8. Recording and syncing

Every session records its own tasks locally, one command per task:

```
hw record --task OB-02 --status pass --outcome "Block reached both readers (Return 0) with no window; grant then window after the payment." \
  --case ACCESS-02=pass --case OUT-01=pass --case OUT-02=pass --obs "blockLatencyA=9s" --as outbox
```

- Status: `pass` (every PASS holds), `fail` (a FAIL-if holds), `partial`,
  `blocked` (could not run — say why), `skipped` (only where a task says so).
- Every case of the task gets a verdict when the status is pass/fail/partial:
  `pass`, `fail`, `partial`, `blocked`, `na`, and for evidence `pinned` (a
  passing test asserts exactly this, cited file:line) or `gap`.
- Records live in `backups/hw-session/results/<agent>/` (gitignored) and keep
  their history. An agent can record only its own tasks.

**Only the lead (remote) or the physical session syncs**, so two writers never
collide: `hw results --emit-batch` writes a batch of NEW documents
(`results/<task>~<time>`, so no versions are needed) → `ArtifactData batch` on
the runbook artifact with that `writes.json` → `hw results --mark-synced
<mark.json>`. At the end of a track, `--emit-batch --tracker` does the same for
the campaign tracker's `results/<case id>` (pinned → pass with a "PINNED" note;
gap/partial/blocked → blocked); a case that already has a row there is refused
and is updated by hand with its version.

---

## 9. When something looks wrong

| Symptom                                        | Check, in order                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No event stored                                | Log line `Access webhook delivery`: `unknownSerials` = the serial differs; `unreadableFieldNames` = the payload shape differs; no line = nothing sent. |
| Command stays `NEVER SENT`                     | The reader is not reaching the vendor: power, cable, Wi-Fi. VFT territory.                                                                             |
| `DONE` but nothing happened on the reader      | Record the Return value and the exact screen: a finding, not a retry.                                                                                  |
| `REFUSED (…, phase …)`                         | The fence. Wrong agent, wrong phase or another agent's member. Record blocked; never work around it.                                                   |
| `drain` refuses                                | Another gym's jobs are due, or (with `--vendor-url`) a real member's: wait ≤ 5 min for the cron and retry once.                                        |
| A real member changed (snapshot newest change) | Stop and tell the owner/operator.                                                                                                                      |
| A dead job appears you did not cause           | Stop. `jobs` shows it; record a finding.                                                                                                               |
| The dev server stops answering                 | `hw devserver status`; the lead restarts it (`devserver start`).                                                                                       |
