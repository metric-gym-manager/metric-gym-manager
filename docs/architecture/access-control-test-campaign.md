# Access Control — Two-Device Test Campaign

**Compiled 2026-09-22** · branch `claude/access-control-integration-test-sr8t48`

The canonical case list. Status is **not** kept here — it lives in the tracker's
database (see _Tracker_), because a checkbox in a merged markdown file is a
status report that is wrong by the next commit.

|                                     |                                                                  |
| ----------------------------------- | ---------------------------------------------------------------- |
| **Cases**                           | 398 across 30 groups                                             |
| **Tier A** (no hardware)            | 173                                                              |
| **Tier B** (readers online, remote) | 111                                                              |
| **Tier C** (person at the reader)   | 114                                                              |
| **Assessment**                      | `docs/architecture/access-control-integration-test-readiness.md` |
| **Design**                          | `docs/architecture/access-control-master.md`                     |
| **Vendor fact**                     | `docs/integrations/vft/`                                         |

---

## 0. Standing rules

**Treat this as a production simulation, not a happy-path QA pass.** The
software has shipped three defect classes that a passing suite could not see:
an RLS-refused write reported as success, a silent empty device list, and a
webhook batch discarded whole. Every one produced a plausible number rather
than an error.

**Credentials are exposed and must be rotated.** The vendor account password
was pasted into a chat transcript on 2026-09-22. It must not appear in a test
case, a ticket, a screenshot, a log, Git, or shell history, and it is to be
**rotated at the end of the campaign**. It currently lives in `.env.local`
(gitignored) and, encrypted, in `access_control_secrets`. Nowhere else.

**A green result is evidence, not proof.** Before trusting a test you wrote,
mutate the source to reintroduce the defect it guards and watch it fail.

---

## 1. Topology

Two real readers on one vendor account, both on the seeded **E2E Enterprise
Gym** (`e0d0a7f9-…`, 351 members, enterprise/active).

|                      | Device A               | Device B                    |
| -------------------- | ---------------------- | --------------------------- |
| Role                 | Primary test reader    | Concurrent/secondary reader |
| Serial               | `NYU7251900066`        | `NYU7254500734`             |
| Vendor name          | Device1                | Device2                     |
| Registered as        | Device A (test)        | Device B (test)             |
| Firmware             | ZAM70-NF24HA-Ver3.0.15 | ZAM70-NF24HA-Ver3.3.12      |
| LAN IP               | 192.168.8.127          | 192.168.8.186               |
| Vendor area          | 1 (Default Area)       | 1 (Default Area)            |
| Our timezone offset  | 330 (Colombo)          | 330 (Colombo)               |
| Created on vendor    | 2026-09-14             | 2026-09-14                  |
| **Registered state** | **INACTIVE**           | **INACTIVE**                |

Account base URL `https://acccloudlk.com`; account expires 2027-09-14.

### Why both readers are parked

The test gym has **351 members**. `reconcile-access` runs nightly at 18:30 UTC
and enqueues a job per member needing sync. An active reader plus working
credentials is therefore an overnight push of 351 subjects onto physical
hardware whose template capacity nobody has measured — and removing them again
is manual cleanup on the vendor console. Nothing targets an inactive reader:
`listActiveDeviceSerials` filters them out, so `SyncMemberAccess` returns idle.

Enable one deliberately, as the first act of a session:

```bash
npx tsx scripts/provision-access-control-test-gym.ts --enable A
npx tsx scripts/provision-access-control-test-gym.ts --disable A   # park it again
```

**Bound the blast radius before enabling** (P0.7): decide which members the
campaign may touch. 351 is not that set.

### Not yet captured

The preflight asks for vendor device id, model, supported commands, supported
event codes and supported return codes per reader. The device list carries
none of them — they are account-level facts from the collection, not per-device
fields. `LastRequestTime` is null on both, so **online status is unknown**; the
decisive test is whether a queued command gets collected (Tier B, below).

---

## 2. The three tiers — what actually needs hardware

The campaign's blocker is not 'hardware' as a whole. It is three different
things, and only the third needs a person standing at a reader.

### Tier A — no hardware at all (173 cases)

Our own surface, plus the vendor's **server-side** endpoints. VFT confirmed
`AddEmployee` writes to their servers, not to a terminal, so the whole subject
lifecycle — `template/add`, list, `template/edit/{EmpId}`,
`template/fromdev/{EmpId}`, `template/{EmpId}` — is exercisable from a desk and
is reversible by delete. This tier answers the widest-blast-radius vendor
questions: real return codes, who assigns `EmpId` (A-4), true field limits, and
whether our three-valued `applied`/`queued`/`failed` mapping matches reality.

Our webhook ingestion can also be driven end to end here by posting a synthetic
batch to the production URL with a registered serial — that proves serial
routing, member resolution, dedupe, and clock-skew inference. It does **not**
prove VFT calls us, or what they send.

### Tier B — readers must be online, but you need not be present (111 cases)

Everything through the command queue: `syncsometoone`, `validperiod`,
`accessgrant`, `accessblock`, `enrollfinger`, `dooropen`, `reboot`. These
enqueue; the terminal collects on its next poll. **Whether the readers are
online is currently unknown** — `LastRequestTime` is null on both, though
`LastUpdateTime` moved today at different times per reader on an account with
no employees and no commands, which suggests the devices themselves.

Settle it first: enqueue one command, watch `GET /api/devicecmd/{DevSN}`.
Collected → online, and this whole tier runs remotely. Still sitting at `-725`
(~2 min) → they are not talking to the vendor, which is an installer question,
not a code one.

### Tier C — a person at the reader (114 cases)

A finger on the sensor. A real scan, to learn whether refused scans reach the
webhook at all (**A-1** — it decides whether a whole screen has data). The
offline-enforcement premise (pull the network; does a valid member still get
in). `EndDate` inclusivity at the midnight boundary. The door physically
opening.

---

## 3. Execution order

**Phase 1 — Infrastructure** — P0, AUTH, DEVICE, VAL

**Phase 2 — Single-device correctness (Device A)** — STATUS, ACCESS, CONSENT, WH, TIME

**Phase 3 — Second-device correctness (Device B)** — ENR, CANCEL

**Phase 4 — Two-device concurrency** — OUT, RACE, CONC, R

**Phase 5 — Failure injection** — FAIL, REC

**Phase 6 — Ambiguous distributed outcomes** — RC, VEND, AMB

**Phase 7 — Tenant and security** — DB, TENANT, SEC

**Phase 8 — Soak and real-world** — OBS, REAL, SOAK, UI

**Phase 9 — Reconciliation and acceptance** — DATA, CRON, ACC

---

## 4. Minimum 'do not ship without it' subset

If the first physical session is short, spend it here. These target exactly the
areas the readiness assessment calls structurally dangerous.

1. **P0.5** — Serial preflight _(C — person at the reader)_
2. **ENR-01** — Enrol member on Device A _(C — person at the reader)_
3. **ENR-02** — Enrol member on Device B _(C — person at the reader)_
4. **ENR-04** — Same member on both devices, simultaneously _(C — person at the reader)_
5. **RACE-03** — A enrol ‖ B cancel _(C — person at the reader)_
6. **RACE-08** — Renew membership ‖ access M1 _(C — person at the reader)_
7. **CONSENT-04** — Consent created simultaneously with the enrolment request _(B — readers online)_
8. **WH-08** — Duplicate webhook _(A — no hardware)_
9. **WH-12** — Out-of-order events _(A — no hardware)_
10. **AMB-01** — Enrolment: accepted, performed, connection dropped, we saw a timeout _(C — person at the reader)_
11. **DEVICE-08** — Device disappears while work is pending _(B — readers online)_
12. **OUT-10** — Worker crashes after claiming _(B — readers online)_
13. **OUT-11** — Stale `in_flight` record _(B — readers online)_
14. **OUT-07** — Two workers claim the same row _(A — no hardware)_
15. **TENANT-04** — Gym A commands Device B _(A — no hardware)_
16. **DB-06** — Route performs a legitimate INSERT _(A — no hardware)_
17. **TIME-04** — `EndDate` exactly today _(C — person at the reader)_
18. **TIME-07** — Server timezone ≠ device timezone _(C — person at the reader)_
19. **STATUS-09** — Device reboots with a command in flight _(C — person at the reader)_
20. **REC-07** — Restart while both readers are processing _(C — person at the reader)_
21. **DATA-01** — Single successful enrolment _(C — person at the reader)_

---

## 5. The cases

Tier is the constraint, not the priority: **A** runs anywhere, **B** needs the
readers reachable, **C** needs someone at them.

### P0 — Environment and configuration

_Phase 1 — Infrastructure · default tier A_

These must pass before any behavioural result is trusted. A green suite on a misconfigured environment is the most expensive kind of green.

| ID     | Case                      | Tier | Notes                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P0.1` | Environment parity        | A    | `.env.local` and Vercel production agree on: database project, encryption key, webhook token, VFT base URL, and the feature flag. Credentials present only where intended. **Known open:** the stored credentials were re-encrypted with the _local_ key on 2026-09-22; if Vercel's `ACCESS_CONTROL_ENCRYPTION_KEY` differs, production still cannot read them. Prove it, do not assume it. |
| `P0.2` | Secret leakage            | A    | VFT credentials absent from: client-side JS, API responses, logs, error messages, Git, Vercel build output. Present in the database **only** as AES-256-GCM ciphertext in `access_control_secrets`.                                                                                                                                                                                         |
| `P0.3` | Deployment verification   | A    | All 16 gym-facing routes, the webhook route, and the 3 crons answer as expected — not 404, not old-deployment behaviour, not a generic 500, not feature-disabled. The webhook was verified this way on 2026-09-22 (405 on GET, 200 on a correct token, 401 on a wrong one).                                                                                                                 |
| `P0.4` | Test-run integrity        | A    | Test count non-zero; env-gated specs actually execute; skips visible and distinguished from passes; no stale `next-server`; nothing else on port 3100. The E2E suite can report green while skipping every spec (trap 17).                                                                                                                                                                  |
| `P0.5` | Serial preflight          | C    | API serial == physical label serial == registered serial, for both readers. Do not assume the API and the label agree — check the label by eye.                                                                                                                                                                                                                                             |
| `P0.6` | Reader inventory captured | B    | For each reader record: serial, vendor device id, model, firmware, online status, last seen, IP/hostname, timezone, supported commands, supported event codes, supported return codes. Partially captured 2026-09-22 (see Topology).                                                                                                                                                        |
| `P0.7` | Blast radius bounded      | A    | The test gym has 351 members. Before enabling a reader, decide and record which members the campaign may touch — an active reader plus the nightly reconciler is a 351-subject push to physical hardware.                                                                                                                                                                                   |

### AUTH — Authentication and authorization

_Phase 1 — Infrastructure · default tier A_

The entitlement and tenant boundaries. `requireAccessControlGym` must fail closed, and a gym must reach only its own hardware.

| ID        | Case                                              | Tier | Notes                                                                                  |
| --------- | ------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `AUTH-01` | Valid Enterprise gym login                        | A    | Login succeeds; correct gym context established.                                       |
| `AUTH-02` | Invalid password                                  | A    | Rejected; no partial session created.                                                  |
| `AUTH-03` | Nonexistent user                                  | A    | Rejected without revealing whether the account exists.                                 |
| `AUTH-04` | Expired/invalid session                           | A    | Protected API returns unauthorized; no data exposed.                                   |
| `AUTH-05` | Logged-out session calls protected route          | A    | 401 or the appropriate auth response.                                                  |
| `AUTH-06` | Gym A session reaches Gym B device                | A    | Rejected, with no existence leak — the same response whether or not the device exists. |
| `AUTH-07` | Enterprise gym accesses access-control features   | A    | Allowed.                                                                               |
| `AUTH-08` | Non-Enterprise gym accesses access-control routes | A    | 403 across all 16 gym-facing routes. Enumerate them; do not sample.                    |
| `AUTH-09` | Enterprise → Lite while a session is open         | A    | The next protected action is re-evaluated; privilege is not carried by the session.    |
| `AUTH-10` | Lite → Enterprise after being denied              | A    | Access becomes available only once the entitlement state is actually valid.            |

### DEVICE — Device registration and identity

_Phase 1 — Infrastructure · default tier A_

Serial handling is the routing key for every inbound scan. A serial that does not match is silent, total, permanent loss.

| ID          | Case                                                | Tier | Notes                                                                                                                                                                      |
| ----------- | --------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEVICE-01` | Register Device A with correct serial               | A    | Registered; `NYU7251900066`.                                                                                                                                               |
| `DEVICE-02` | Register Device B with correct serial               | A    | Registered; `NYU7254500734`.                                                                                                                                               |
| `DEVICE-03` | Register duplicate Device A serial                  | A    | Deterministic handling, no duplicate rows. Serial is globally unique; expect 409.                                                                                          |
| `DEVICE-04` | Register a fake serial                              | A    | Handled correctly. Note the app does **not** currently validate a serial against the vendor's device list — the provisioning script does. Decide whether the route should. |
| `DEVICE-05` | Gym B attempts to reach Gym A's device              | A    | Denied via `findDeviceById(gymId, id)`.                                                                                                                                    |
| `DEVICE-06` | Change device-to-gym association                    | A    | Both the legitimate administrative reassignment and the unauthorized attempt.                                                                                              |
| `DEVICE-07` | Delete Device A                                     | A    | Record removed/deactivated; pending commands behave correctly; webhook events for the old serial handled, not misattributed.                                               |
| `DEVICE-08` | Device disappears while work is pending             | B    | Queue loses nothing; retry/dead-letter classification correct.                                                                                                             |
| `DEVICE-09` | Same serial registered by two simultaneous requests | A    | Exactly one logical device, one owner. Race test — drive it with concurrent requests, not two browser tabs.                                                                |
| `DEVICE-10` | Serial case/whitespace mismatch                     | A    | A serial registered in the wrong case still resolves an inbound scan; two readers differing only in case are refused rather than guessed between (fixed 2026-09-22, W2).   |

### STATUS — Device status and connectivity

_Phase 2 — Single-device correctness (Device A) · default tier B_

Run for both readers. Presence is inferred, not reported: the vendor sends none of `IsOnline`, `LastSeen` or `LastActivity` (answered live 2026-09-22).

| ID          | Case                                                        | Tier | Notes                                                                                                            |
| ----------- | ----------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `STATUS-01` | Device online                                               | B    | State reported correctly.                                                                                        |
| `STATUS-02` | Device offline                                              | B    | Reported as offline — and distinguished from 'we cannot tell'.                                                   |
| `STATUS-03` | Device reconnects                                           | B    | State returns coherently.                                                                                        |
| `STATUS-04` | Intermittent connection                                     | B    | online → offline → online → offline → online. Transitions stay coherent; reconnects cause no duplicate commands. |
| `STATUS-05` | Network outage during command submission                    | B    | Command recoverable; no false success.                                                                           |
| `STATUS-06` | Outage after vendor accepted but before we saw the response | B    | The classic ambiguous delivery. No blind unsafe duplicate; retry classification follows documented semantics.    |
| `STATUS-07` | Slow device response                                        | B    | 1s, 5s, 15s, and beyond the 15s client timeout (`VENDOR_REQUEST_TIMEOUT_MS`).                                    |
| `STATUS-08` | Device stops responding mid-batch                           | B    | Remaining batch members unaffected.                                                                              |
| `STATUS-09` | Device reboots with a command in flight                     | C    | Command resolves or retries correctly.                                                                           |
| `STATUS-10` | Device clock differs significantly from server              | C    | Skew is detected and surfaced; the expiry cutover runs on the reader's clock, so this moves who gets in.         |

### ACCESS — Access-decision engine

_Phase 2 — Single-device correctness (Device A) · default tier A_

`domain/AccessDecision.ts` is the sole authority, and verdicts derive from `next_due_date`, never `members.status`. Build the truth table around that rule.

| ID          | Case                                        | Tier | Notes                                                                                                                   |
| ----------- | ------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `ACCESS-01` | Clearly inside the valid period             | A    | Allow.                                                                                                                  |
| `ACCESS-02` | Clearly outside the valid period            | A    | Deny.                                                                                                                   |
| `ACCESS-03` | `next_due_date` exactly today               | A    | The boundary case; decides a real member at a real door.                                                                |
| `ACCESS-04` | One second/minute/day before the boundary   | A    | —                                                                                                                       |
| `ACCESS-05` | One second/minute/day after the boundary    | A    | —                                                                                                                       |
| `ACCESS-06` | status=active but `next_due_date` says deny | A    | The rule's whole point: the date wins.                                                                                  |
| `ACCESS-07` | status=inactive but the dates say allow     | A    | Document and pin the intended outcome.                                                                                  |
| `ACCESS-08` | Missing `next_due_date`                     | A    | Defined, safe behaviour — not a crash, not an accidental allow.                                                         |
| `ACCESS-09` | Malformed `next_due_date`                   | A    | —                                                                                                                       |
| `ACCESS-10` | Midnight timezone boundary                  | C    | Gym-local midnight (UTC+5:30), enforced on the reader's own clock.                                                      |
| `ACCESS-11` | DST transition where relevant               | A    | Sri Lanka has no DST; the code uses `Intl` rather than a fixed offset so the rule survives a change. Verify that claim. |
| `ACCESS-12` | Month boundary                              | A    | —                                                                                                                       |
| `ACCESS-13` | Year boundary                               | A    | —                                                                                                                       |
| `ACCESS-14` | Leap day                                    | A    | —                                                                                                                       |
| `ACCESS-15` | Clock skew between application and terminal | C    | The decisive one: we compute the window, the reader enforces it.                                                        |

### CONSENT — Biometric consent

_Phase 2 — Single-device correctness (Device A) · default tier B_

A hard gate: no enrolment command reaches a reader without `members.biometric_consent_at`, and the consent write happens FIRST.

| ID           | Case                                                      | Tier | Notes                                                                                                                                          |
| ------------ | --------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSENT-01` | No consent → attempt enrolment                            | B    | Refused; **no vendor command dispatched**. Verify at the wire, not the UI.                                                                     |
| `CONSENT-02` | Consent written → enrolment                               | C    | Succeeds.                                                                                                                                      |
| `CONSENT-03` | Consent write fails                                       | A    | No enrolment command dispatched.                                                                                                               |
| `CONSENT-04` | Consent created simultaneously with the enrolment request | B    | One deterministic outcome.                                                                                                                     |
| `CONSENT-05` | Consent revoked while enrolment is processing             | B    | —                                                                                                                                              |
| `CONSENT-06` | Consent revoked after successful enrolment                | C    | Clearing consent IS the withdrawal record; the template is removed via `fromdev`.                                                              |
| `CONSENT-07` | Member rename after consent                               | A    | Consent survives. `update()` writes the whole row, so dropping the field from the READ side silently erases consent on every rename (trap 12). |
| `CONSENT-08` | Concurrent member updates                                 | A    | Enrolment + rename + membership update at once; consent survives all orderings.                                                                |

### ENR — Enrolment

_Phase 3 — Second-device correctness (Device B) · default tier C_

Run independently against A and B. `enrollfinger` only puts the reader into enrol mode — completing it needs a finger on the sensor.

**How completion is observed (VFT, 2026-09-23):** _"in the next update, the finger count will be displayed. Now it is considered with the attendance record."_ There is no field to poll, so the member's **first fingerprint scan** is the confirmation — which makes every case below that says "enrolled" a case that needs a scan as well as a finger, and makes `ENR-18` (vendor accepts, webhook never arrives) considerably more interesting: with the webhook down, a real enrolment is now invisible until the next delivery.

| ID       | Case                                        | Tier | Notes                                                                                  |
| -------- | ------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `ENR-01` | Enrol member on Device A                    | C    | —                                                                                      |
| `ENR-02` | Enrol member on Device B                    | C    | —                                                                                      |
| `ENR-03` | Same member on both devices, sequentially   | C    | —                                                                                      |
| `ENR-04` | Same member on both devices, simultaneously | C    | Mandatory. The per-member serialization in the outbox is exactly what this tests.      |
| `ENR-05` | Two members simultaneously on Device A      | C    | —                                                                                      |
| `ENR-06` | Two members simultaneously on Device B      | C    | —                                                                                      |
| `ENR-07` | Already enrolled → enrol again              | C    | Idempotent or correctly reconciled.                                                    |
| `ENR-08` | Enrolment interrupted halfway               | C    | —                                                                                      |
| `ENR-09` | Succeeds on device, application times out   | C    | Ambiguous success — see AMB.                                                           |
| `ENR-10` | Enrolment command sent twice by retry       | B    | Idempotent or correctly reconciled.                                                    |
| `ENR-11` | Succeeds on A, fails on B                   | C    | Partial success must be visible and recoverable, not averaged into 'done'.             |
| `ENR-12` | Fails on A, succeeds on B                   | C    | —                                                                                      |
| `ENR-13` | Device disconnects during enrolment         | C    | —                                                                                      |
| `ENR-14` | Application restarts during enrolment       | B    | —                                                                                      |
| `ENR-15` | Vendor returns an unknown return code       | A    | Safe failure. 248 codes are transcribed in `docs/integrations/vft/vft-code-tables.md`. |
| `ENR-16` | Vendor returns a malformed response         | A    | Safe failure; parsed from `unknown`, never cast.                                       |
| `ENR-17` | Vendor returns success but no identifier    | A    | —                                                                                      |
| `ENR-18` | Vendor accepts, webhook never arrives       | C    | Reconciliation must close the gap.                                                     |
| `ENR-19` | Webhook arrives before the HTTP response    | C    | The ordering nobody designs for.                                                       |
| `ENR-20` | Webhook arrives multiple times              | A    | Idempotent on the unique constraint.                                                   |

### CANCEL — Cancellation, withdrawal, re-enrolment

_Phase 3 — Second-device correctness (Device B) · default tier C_

Cancellation blocks and revokes the template (`fromdev`) — never `RemoveSubject`. The vendor keeps the central copy, so eviction and return are reversible without re-enrolment. Cancel-then-rejoin is the high-value case.

| ID       | Case                                               | Tier | Notes                                                                                                                                        |
| -------- | -------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENR-21` | Cancel enrolment on A                              | C    | —                                                                                                                                            |
| `ENR-22` | Cancel enrolment on B                              | C    | —                                                                                                                                            |
| `ENR-23` | Cancel when not enrolled                           | A    | No-op, not an error cascade.                                                                                                                 |
| `ENR-24` | Cancel simultaneously on A and B                   | C    | —                                                                                                                                            |
| `ENR-25` | Cancel during an in-flight enrolment               | C    | **Source text truncated ('Cancel follent') — intent to be confirmed.** Read here as cancel racing an enrolment; correct it if that is wrong. |
| `ENR-26` | Cancel succeeds on terminal, application times out | C    | —                                                                                                                                            |
| `ENR-27` | Cancel request duplicated                          | B    | —                                                                                                                                            |
| `ENR-28` | Cancellation webhook duplicated                    | A    | —                                                                                                                                            |
| `ENR-29` | Cancel A, immediately attempt access on A          | C    | The reader enforces from its own RTC — this is where 'blocked' becomes real.                                                                 |
| `ENR-30` | Cancel A, attempt access on B                      | C    | Per-device state must not leak across readers.                                                                                               |
| `ENR-31` | Cancel while another enrolment is in flight        | C    | —                                                                                                                                            |
| `ENR-32` | Cancel followed by membership renewal              | C    | Rejoin without re-enrolling — B-9/B-10 in the simulator plan.                                                                                |

### WH — Webhook

_Phase 2 — Single-device correctness (Device A) · default tier A_

The path token is the ONLY credential (no signature scheme exists). Always-200 for business outcomes; idempotent on the unique constraint; gym resolved from `device_serial`, never from the body.

| ID      | Case                                                   | Tier | Notes                                                                                                                                     |
| ------- | ------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `WH-01` | Valid token + valid event                              | A    | Accepted and stored.                                                                                                                      |
| `WH-02` | Invalid token                                          | A    | 401.                                                                                                                                      |
| `WH-03` | Empty token                                            | A    | 401 — and distinguishable in logs from 'not configured'.                                                                                  |
| `WH-04` | Wrong-length token                                     | A    | 401.                                                                                                                                      |
| `WH-05` | Token differing by one character                       | A    | 401, compared in constant time.                                                                                                           |
| `WH-06` | Unknown serial                                         | A    | Counted and dropped; never attributed to a gym on a hunch. The callback is account-wide, so another company's traffic is legitimate here. |
| `WH-07` | Payload claims a different gym                         | A    | Ignored. Ownership comes from our `access_devices` lookup only.                                                                           |
| `WH-08` | Duplicate webhook                                      | A    | Idempotent.                                                                                                                               |
| `WH-09` | Same webhook ×2                                        | A    | —                                                                                                                                         |
| `WH-10` | Same webhook ×10                                       | A    | —                                                                                                                                         |
| `WH-11` | Same webhook ×100                                      | A    | —                                                                                                                                         |
| `WH-12` | Out-of-order events                                    | A    | enrol → cancel → enrol, then the reverse. Terminal states must not regress.                                                               |
| `WH-13` | Webhook arrives before the originating request returns | B    | —                                                                                                                                         |
| `WH-14` | Webhook arrives before the local transaction commits   | B    | The hardest one: we may not yet know the thing it refers to.                                                                              |
| `WH-15` | Webhook arrives after commit                           | B    | —                                                                                                                                         |
| `WH-16` | Malformed JSON                                         | A    | 200, nothing stored, reason logged.                                                                                                       |
| `WH-17` | Missing required field                                 | A    | That event dropped; **the rest of the batch still stored** (fixed 2026-09-22, W1).                                                        |
| `WH-18` | Null serial                                            | A    | —                                                                                                                                         |
| `WH-19` | Empty serial                                           | A    | —                                                                                                                                         |
| `WH-20` | Serial with whitespace/case difference                 | A    | Resolves to the right reader (W2).                                                                                                        |
| `WH-21` | Unknown event code                                     | A    | Stored raw; the code tables are not exhaustive.                                                                                           |
| `WH-22` | Unknown return code                                    | A    | —                                                                                                                                         |
| `WH-23` | Oversized payload                                      | A    | Bounded, not fatal.                                                                                                                       |
| `WH-24` | Repeated hostile requests                              | A    | No amplification, no information leak.                                                                                                    |
| `WH-25` | High concurrency from many connections                 | A    | —                                                                                                                                         |

### OUT — Outbox and asynchronous processing

_Phase 4 — Two-device concurrency · default tier B_

DB-trigger enqueue → `FOR UPDATE SKIP LOCKED` claim → per-member serialization → stale-`in_flight` reclaim → return-code classification. Highest-risk area after the vendor boundary.

| ID       | Case                                            | Tier | Notes                                                                                                           |
| -------- | ----------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| `OUT-01` | One command queued                              | B    | —                                                                                                               |
| `OUT-02` | Two commands queued                             | B    | —                                                                                                               |
| `OUT-03` | 100 commands queued                             | B    | —                                                                                                               |
| `OUT-04` | 1000 commands queued                            | B    | Watch `DRAIN_BATCH_SIZE` and the 5-minute cadence: does the backlog drain or grow?                              |
| `OUT-05` | One member generates several commands           | B    | Serialization preserves ordering.                                                                               |
| `OUT-06` | Different members concurrently                  | B    | Parallelism where allowed.                                                                                      |
| `OUT-07` | Two workers claim the same row                  | A    | Exactly one wins (`SKIP LOCKED`).                                                                               |
| `OUT-08` | Two workers process the same member             | B    | No conflicting simultaneous device mutation.                                                                    |
| `OUT-09` | `SKIP LOCKED` under contention                  | A    | —                                                                                                               |
| `OUT-10` | Worker crashes after claiming                   | B    | Command becomes recoverable via stale reclaim.                                                                  |
| `OUT-11` | Stale `in_flight` record                        | B    | Reclaimed per `STALE_JOB_RECLAIM_SECONDS`.                                                                      |
| `OUT-12` | Worker crashes after the vendor accepted        | C    | Ambiguous delivery. The state on the reader is the arbiter.                                                     |
| `OUT-13` | Worker crashes after the DB update, before exit | B    | —                                                                                                               |
| `OUT-14` | Worker receives a duplicate retry               | B    | —                                                                                                               |
| `OUT-15` | Dead-letter threshold reached                   | A    | 6 attempts (`SYNC_MAX_ATTEMPTS`).                                                                               |
| `OUT-16` | Dead-letter replayed                            | A    | There is currently **no replay path**. Decide whether one is needed before go-live.                             |
| `OUT-17` | Vendor returns retryable errors                 | A    | Retries with backoff.                                                                                           |
| `OUT-18` | Vendor returns a permanent rejection            | A    | No infinite retry.                                                                                              |
| `OUT-19` | Queue survives a poison message                 | B    | —                                                                                                               |
| `OUT-20` | Ordering across devices                         | B    | —                                                                                                               |
| `OUT-21` | Undecryptable credentials                       | A    | Dead-lettered on the first attempt, flagged needing attention, message names the remedy (fixed 2026-09-22, W3). |

### RACE — Two-device race matrix

_Phase 4 — Two-device concurrency · default tier C_

Where two physical readers earn their keep. One member M1, both readers, operations issued simultaneously.

| ID        | Case                                   | Tier | Notes                               |
| --------- | -------------------------------------- | ---- | ----------------------------------- |
| `RACE-01` | A enrol M1 ‖ B enrol M1                | C    | Duplicate enrolment.                |
| `RACE-02` | A cancel M1 ‖ B cancel M1              | C    | Double cancellation.                |
| `RACE-03` | A enrol ‖ B cancel                     | C    | Ordering.                           |
| `RACE-04` | A cancel ‖ B enrol                     | C    | Ordering, reversed.                 |
| `RACE-05` | A access ‖ B access                    | C    | Duplicate access events.            |
| `RACE-06` | A enrol ‖ B access                     | C    | Read/write race.                    |
| `RACE-07` | Update member ‖ enrol M1               | C    | Consent/data race.                  |
| `RACE-08` | Renew membership ‖ access M1           | C    | Decision race.                      |
| `RACE-09` | Revoke consent ‖ enrol M1              | C    | Consent race.                       |
| `RACE-10` | Delete device ‖ command to that device | B    | Device lifecycle race.              |
| `RACE-11` | Change gym ownership ‖ webhook         | A    | Tenant race.                        |
| `RACE-12` | Retry ‖ original still running         | B    | Duplicate delivery.                 |
| `RACE-13` | Same webhook ‖ same webhook            | A    | Idempotency under true concurrency. |
| `RACE-14` | Different members on each reader       | C    | Cross-member isolation.             |
| `RACE-15` | Same member ‖ different member         | C    | Correct serialization.              |
| `RACE-16` | A offline ‖ B online                   | C    | Partial availability.               |
| `RACE-17` | A reconnects ‖ B processing            | C    | Recovery race.                      |
| `RACE-18` | Access state changes ‖ member scans    | C    | Stale-state race.                   |

### CONC — High-frequency concurrency

_Phase 4 — Two-device concurrency · default tier B_

Generate controlled bursts; do not test concurrency with two clicked browser windows. For each level vary: same/different member, same/different device, same/different command, same/different webhook event.

| ID        | Case                      | Tier | Notes                                                                                                                                                                    |
| --------- | ------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CONC-01` | 2 simultaneous requests   | B    | —                                                                                                                                                                        |
| `CONC-02` | 5 simultaneous requests   | B    | —                                                                                                                                                                        |
| `CONC-03` | 10 simultaneous requests  | B    | —                                                                                                                                                                        |
| `CONC-04` | 50 simultaneous requests  | B    | —                                                                                                                                                                        |
| `CONC-05` | 100 simultaneous requests | B    | Measure: duplicate rows, duplicate/lost commands, out-of-order execution, wrong final state, 500s, lock waits, transaction failures, webhook duplication, queue latency. |

### DB — Database and RLS

_Phase 7 — Tenant and security · default tier A_

Every access-control table is SELECT-only for gym owners; writes go through `createAdminClient()`. Five routes once shipped writing through the session client and RLS refused every row — unit tests mock the repository, so only a live stack catches this.

| ID      | Case                                             | Tier | Notes                                                                                |
| ------- | ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------ |
| `DB-01` | Gym user reads own device                        | A    | Allowed.                                                                             |
| `DB-02` | Gym user reads another gym's device              | A    | Denied.                                                                              |
| `DB-03` | Gym user direct device INSERT                    | A    | Refused by RLS.                                                                      |
| `DB-04` | Gym user direct device UPDATE                    | A    | Refused.                                                                             |
| `DB-05` | Gym user direct device DELETE                    | A    | Refused — and an RLS-denied DELETE reports success having removed nothing (trap 21). |
| `DB-06` | Route performs a legitimate INSERT               | A    | Service-role path succeeds.                                                          |
| `DB-07` | Route performs a legitimate UPDATE               | A    | —                                                                                    |
| `DB-08` | Route performs a legitimate DELETE               | A    | —                                                                                    |
| `DB-09` | RLS denies an unauthorized mutation              | A    | —                                                                                    |
| `DB-10` | RLS denial not reported as success               | A    | Assert rows-affected, never the absence of an error.                                 |
| `DB-11` | Two transactions update the same member          | A    | —                                                                                    |
| `DB-12` | Two transactions update the same device          | A    | —                                                                                    |
| `DB-13` | Rollback halfway through a multi-table operation | A    | —                                                                                    |
| `DB-14` | Trigger failure                                  | A    | —                                                                                    |
| `DB-15` | Trigger enqueue happens exactly once             | A    | —                                                                                    |
| `DB-16` | Commit succeeds but the downstream worker fails  | B    | —                                                                                    |

### TENANT — Tenant isolation

_Phase 7 — Tenant and security · default tier A_

Needs a second gym (Gym B) with its own member and device. Run every route against every cross-tenant combination — this is an attack matrix, not a sample.

| ID          | Case                                 | Tier | Notes                                                                  |
| ----------- | ------------------------------------ | ---- | ---------------------------------------------------------------------- |
| `TENANT-01` | Gym A reads Device A                 | A    | Allowed.                                                               |
| `TENANT-02` | Gym A reads Device B                 | A    | Denied.                                                                |
| `TENANT-03` | Gym B reads Device A                 | A    | Denied.                                                                |
| `TENANT-04` | Gym A commands Device B              | A    | Denied.                                                                |
| `TENANT-05` | Gym B commands Device A              | A    | Denied.                                                                |
| `TENANT-06` | Gym A accesses Member B1             | A    | Denied.                                                                |
| `TENANT-07` | Gym A enrols Member B1               | A    | Denied.                                                                |
| `TENANT-08` | Webhook for Device A claims Gym B    | A    | Payload never decides ownership.                                       |
| `TENANT-09` | Serial moved between gyms            | A    | Defined, deliberate behaviour.                                         |
| `TENANT-10` | Deleted serial reused by another gym | A    | The sharpest one: yesterday's events must not attach to today's owner. |
| `TENANT-11` | Sequential device-id guessing        | A    | No enumeration.                                                        |
| `TENANT-12` | Substituting another tenant's UUIDs  | A    | —                                                                      |
| `TENANT-13` | Manipulated body `gymId`             | A    | Ignored; gym comes from the guard.                                     |
| `TENANT-14` | Manipulated URL `gymId`              | A    | —                                                                      |
| `TENANT-15` | Manipulated query `gymId`            | A    | —                                                                      |
| `TENANT-16` | Manipulated client-side state        | A    | —                                                                      |

### VAL — API validation

_Phase 1 — Infrastructure · default tier A_

For every access-control route. Expected everywhere: deterministic 4xx, no 500, no DB corruption, and — the one that matters — NO vendor command created.

| ID       | Case                        | Tier | Notes                                                                                                              |
| -------- | --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `VAL-01` | Missing field               | A    | —                                                                                                                  |
| `VAL-02` | Null field                  | A    | —                                                                                                                  |
| `VAL-03` | Empty string                | A    | —                                                                                                                  |
| `VAL-04` | Whitespace-only             | A    | —                                                                                                                  |
| `VAL-05` | Wrong type                  | A    | —                                                                                                                  |
| `VAL-06` | Negative number             | A    | —                                                                                                                  |
| `VAL-07` | Zero                        | A    | —                                                                                                                  |
| `VAL-08` | Huge number                 | A    | —                                                                                                                  |
| `VAL-09` | Oversized string            | A    | —                                                                                                                  |
| `VAL-10` | Malformed UUID              | A    | —                                                                                                                  |
| `VAL-11` | Malformed serial            | A    | —                                                                                                                  |
| `VAL-12` | Unicode                     | A    | Including a member name entirely in Sinhala or Tamil — it must reach the reader as something, not as nothing (W6). |
| `VAL-13` | Control characters          | A    | —                                                                                                                  |
| `VAL-14` | Duplicate value             | A    | —                                                                                                                  |
| `VAL-15` | Unknown value               | A    | —                                                                                                                  |
| `VAL-16` | Stale id                    | A    | —                                                                                                                  |
| `VAL-17` | Deleted id                  | A    | —                                                                                                                  |
| `VAL-18` | Cross-tenant id             | A    | —                                                                                                                  |
| `VAL-19` | Wrong HTTP method           | A    | 405, as the webhook GET probe showed.                                                                              |
| `VAL-20` | Missing content type        | A    | —                                                                                                                  |
| `VAL-21` | Invalid content type        | A    | —                                                                                                                  |
| `VAL-22` | Malformed JSON              | A    | —                                                                                                                  |
| `VAL-23` | Oversized request           | A    | —                                                                                                                  |
| `VAL-24` | Unexpected query parameters | A    | —                                                                                                                  |

### RC — Vendor return-code matrix

_Phase 6 — Ambiguous distributed outcomes · default tier B_

Return-code classification decides retry vs dead-letter. 248 codes are transcribed in `docs/integrations/vft/vft-code-tables.md`. Never narrow a transcription to make a coverage test pass (trap 25).

| ID      | Case                        | Tier | Notes                                                                     |
| ------- | --------------------------- | ---- | ------------------------------------------------------------------------- |
| `RC-01` | Success codes               | B    | `>= 0` — command completes.                                               |
| `RC-02` | Temporary failures          | B    | Retry with backoff.                                                       |
| `RC-03` | Permanent failures          | B    | Dead-letter, no retry.                                                    |
| `RC-04` | Authentication failures     | A    | Stop and reject; do not spin.                                             |
| `RC-05` | Device unavailable          | B    | Retry / reconcile. `-725` is the collection timeout (~2 min).             |
| `RC-06` | Benign codes                | B    | `-7` already queued, `-28` door already open — re-sending is the mistake. |
| `RC-07` | Unknown code                | A    | Safe failure.                                                             |
| `RC-08` | Malformed response          | A    | Safe failure.                                                             |
| `RC-09` | Timeout                     | B    | Defined ambiguity handling.                                               |
| `RC-10` | Device storage full (`-18`) | C    | Capacity learned from the refusing reader only; eviction reclaims slots.  |

### VEND — Vendor field and protocol truth

_Phase 6 — Ambiguous distributed outcomes · default tier B_

Validate rather than assume. Endpoint paths, casing, limits and codes are vendor FACT, held in `docs/integrations/vft/`. Partially answered live on 2026-09-22 — see the Answered column.

| ID        | Case                   | Tier | Notes                                                                                                                                   |
| --------- | ---------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `VEND-01` | Field names            | B    | Device list answered: 27 fields, `Area` nested, no flat `AreaID`.                                                                       |
| `VEND-02` | Casing                 | B    | `enrollfinger`/`enrollface` take `employeeId`; `validperiod`/`accessgrant`/`accessblock` take `EmployeeId`. Reproduce, never normalise. |
| `VEND-03` | Maximum lengths        | B    | `EmpId` 15, `EmpName` 24 — platform limits per VFT; firmware limits still unknown.                                                      |
| `VEND-04` | Minimum lengths        | B    | —                                                                                                                                       |
| `VEND-05` | Required vs optional   | B    | Answered for the device list: the wrapper sends explicit `null`, not absence.                                                           |
| `VEND-06` | Unicode support        | B    | Undocumented; we strip to a conservative set.                                                                                           |
| `VEND-07` | Numeric formats        | B    | Numbers and strings are interchangeable in their JSON.                                                                                  |
| `VEND-08` | Timestamps             | B    | Three formats seen: `MM/DD/YYYY, HH:mm:ss` (device list), `YYYY-MM-DD HH:mm:ss` (webhook), `YYYYMMDD` (validity).                       |
| `VEND-09` | Date formats           | B    | `StartDate`/`EndDate` are `YYYYMMDD`, end date inclusive on the terminal's clock (A-3).                                                 |
| `VEND-10` | Boolean encoding       | B    | —                                                                                                                                       |
| `VEND-11` | Null behaviour         | B    | **Answered:** 13 of 27 device fields arrive null.                                                                                       |
| `VEND-12` | Endpoint paths         | B    | All 17 verified against the collection; sign-in and 3 GETs verified live.                                                               |
| `VEND-13` | HTTP methods           | B    | —                                                                                                                                       |
| `VEND-14` | Authentication         | A    | **Answered:** `POST /api/user/` (trailing slash), `ApiToken` header, 160-char JWT.                                                      |
| `VEND-15` | Token lifetime         | B    | **Still open** — the last genuine unknown. `TOKEN_CACHE_TTL_SECONDS` is a 30-minute guess.                                              |
| `VEND-16` | Timeout behaviour      | B    | —                                                                                                                                       |
| `VEND-17` | Retry behaviour        | B    | —                                                                                                                                       |
| `VEND-18` | TLS requirements       | A    | —                                                                                                                                       |
| `VEND-19` | HTTP status handling   | B    | —                                                                                                                                       |
| `VEND-20` | Event codes            | C    | 128 codes; which actually fire is A-1's question.                                                                                       |
| `VEND-21` | Webhook payload format | C    | Array of string-valued objects, `DeviceID` not `DevSN`. Unverified against a real reader.                                               |
| `VEND-22` | Who assigns `EmpId`    | B    | A-4. Unanswered — the vendor account holds zero employees today.                                                                        |

### TIME — Time and date

_Phase 2 — Single-device correctness (Device A) · default tier C_

The reader enforces expiry from its own RTC, so every one of these is ultimately a hardware question.

| ID        | Case                              | Tier | Notes                                                                                                       |
| --------- | --------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| `TIME-01` | Exactly midnight                  | C    | —                                                                                                           |
| `TIME-02` | One second before midnight        | C    | —                                                                                                           |
| `TIME-03` | One second after midnight         | C    | —                                                                                                           |
| `TIME-04` | `EndDate` exactly today           | C    | Highest blast radius in the whole plan (A-3): inclusive or not decides whether a paid-up member is refused. |
| `TIME-05` | `EndDate` yesterday               | C    | —                                                                                                           |
| `TIME-06` | `EndDate` tomorrow                | C    | —                                                                                                           |
| `TIME-07` | Server timezone ≠ device timezone | C    | We are UTC on Vercel; the readers are Colombo.                                                              |
| `TIME-08` | Clocks differ by one minute       | C    | —                                                                                                           |
| `TIME-09` | Clocks differ by one hour         | C    | —                                                                                                           |
| `TIME-10` | Clock drifts during testing       | C    | —                                                                                                           |
| `TIME-11` | DST transition                    | A    | Not applicable to Sri Lanka today; verify the code does not assume a fixed offset.                          |
| `TIME-12` | Leap day                          | A    | —                                                                                                           |
| `TIME-13` | Month rollover                    | A    | —                                                                                                           |
| `TIME-14` | Year rollover                     | A    | —                                                                                                           |

### FAIL — Failure injection

_Phase 5 — Failure injection · default tier B_

Break each dependency deliberately. For every one answer: what state was persisted; what state is actually on the reader; does it retry; does retry duplicate; can it reconcile itself; is operator intervention needed; is the UI truthful?

| ID        | Case                                   | Tier | Notes                                                                                                    |
| --------- | -------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `FAIL-01` | VFT API unavailable                    | B    | —                                                                                                        |
| `FAIL-02` | VFT returns 500                        | B    | —                                                                                                        |
| `FAIL-03` | VFT returns 502                        | B    | —                                                                                                        |
| `FAIL-04` | VFT returns 429                        | B    | No documented rate limit; `RequestPacer` is our own guess.                                               |
| `FAIL-05` | VFT responds very slowly               | B    | —                                                                                                        |
| `FAIL-06` | Database unavailable                   | A    | —                                                                                                        |
| `FAIL-07` | DB connection drops mid-transaction    | A    | —                                                                                                        |
| `FAIL-08` | Worker crashes                         | B    | —                                                                                                        |
| `FAIL-09` | Web server restarts                    | B    | —                                                                                                        |
| `FAIL-10` | Vercel function terminates mid-request | B    | Serverless: the process can vanish holding a token and a claimed job.                                    |
| `FAIL-11` | Webhook delivery fails                 | C    | Scans are lost permanently — the pull endpoint `GetEventsbyDevSN` is the only recovery and is not built. |
| `FAIL-12` | Device powers off during a command     | C    | —                                                                                                        |
| `FAIL-13` | Device network disappears              | C    | —                                                                                                        |
| `FAIL-14` | Device reboots during a command        | C    | —                                                                                                        |
| `FAIL-15` | Malformed vendor response              | A    | —                                                                                                        |
| `FAIL-16` | Valid HTTP, invalid business payload   | A    | —                                                                                                        |
| `FAIL-17` | Clock jumps forward                    | C    | —                                                                                                        |
| `FAIL-18` | Clock jumps backward                   | C    | —                                                                                                        |

### AMB — Ambiguous success

_Phase 6 — Ambiguous distributed outcomes · default tier C_

The highest-value distributed-systems scenarios: the vendor did the thing, and we do not know it.

| ID       | Case                                                                 | Tier | Notes                                                                                                                             |
| -------- | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `AMB-01` | Enrolment: accepted, performed, connection dropped, we saw a timeout | C    | Does it retry? Does retry duplicate? Does reconciliation find the truth? Does the user see 'failed' for something that succeeded? |
| `AMB-02` | Cancellation: same shape                                             | C    | —                                                                                                                                 |
| `AMB-03` | Update: same shape                                                   | C    | —                                                                                                                                 |
| `AMB-04` | Access-control change: same shape                                    | C    | —                                                                                                                                 |
| `AMB-05` | Command succeeded, webhook lost, application retries the original    | C    | Behaviour must be deterministic and documented.                                                                                   |

### REC — Crash and restart recovery

_Phase 5 — Failure injection · default tier B_

| ID       | Case                                          | Tier | Notes |
| -------- | --------------------------------------------- | ---- | ----- |
| `REC-01` | Restart with an empty queue                   | B    | —     |
| `REC-02` | Restart with a pending queue                  | B    | —     |
| `REC-03` | Restart during `in_flight`                    | B    | —     |
| `REC-04` | Restart immediately after vendor success      | C    | —     |
| `REC-05` | Restart immediately before DB acknowledgement | B    | —     |
| `REC-06` | Restart with stale queue entries              | B    | —     |
| `REC-07` | Restart while both readers are processing     | C    | —     |
| `REC-08` | Restart during simultaneous A/B enrolment     | C    | —     |
| `REC-09` | Restart the worker only                       | B    | —     |
| `REC-10` | Restart the web process only                  | B    | —     |

### OBS — Observability

_Phase 8 — Soak and real-world · default tier A_

Logs must carry request/gym/device/serial/member/command/queue/event ids, vendor lifecycle, retry count and final outcome — and must NOT carry passwords, API keys, tokens, biometric data or full payloads.

| ID       | Case                                  | Tier | Notes                                                                            |
| -------- | ------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `OBS-01` | Successful enrolment trace            | C    | —                                                                                |
| `OBS-02` | Failed enrolment trace                | C    | —                                                                                |
| `OBS-03` | Duplicate webhook trace               | A    | —                                                                                |
| `OBS-04` | Dead-letter trace                     | A    | Now names the remedy for credential failures (W3).                               |
| `OBS-05` | Cross-tenant rejection trace          | A    | —                                                                                |
| `OBS-06` | VFT timeout trace                     | B    | —                                                                                |
| `OBS-07` | Device offline trace                  | B    | —                                                                                |
| `OBS-08` | Recovered stale `in_flight` trace     | B    | —                                                                                |
| `OBS-09` | Unreadable webhook events are visible | A    | `malformed` count logged at the boundary — the only trace lost scans leave (W1). |

### SEC — Security abuse

_Phase 7 — Tenant and security · default tier A_

| ID       | Case                                            | Tier | Notes                                                            |
| -------- | ----------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `SEC-01` | Brute-force login                               | A    | —                                                                |
| `SEC-02` | Brute-force webhook token                       | A    | 64 hex chars; constant-time compare.                             |
| `SEC-03` | Replay a valid webhook                          | A    | Idempotent.                                                      |
| `SEC-04` | Modify an old webhook payload                   | A    | No signature exists — the path token is the entire credential.   |
| `SEC-05` | Replay an old valid command request             | A    | —                                                                |
| `SEC-06` | Id enumeration                                  | A    | —                                                                |
| `SEC-07` | Cross-tenant id substitution                    | A    | —                                                                |
| `SEC-08` | Parameter pollution                             | A    | —                                                                |
| `SEC-09` | Malformed JSON                                  | A    | —                                                                |
| `SEC-10` | Oversized payload                               | A    | —                                                                |
| `SEC-11` | Unexpected content type                         | A    | —                                                                |
| `SEC-12` | Request flooding                                | A    | —                                                                |
| `SEC-13` | Concurrent duplicate submissions                | A    | —                                                                |
| `SEC-14` | Unauthorized admin action                       | A    | `/system-health` requires a Supabase session plus `saas_admins`. |
| `SEC-15` | Reading vendor credentials back through the API | A    | Write-only by design; must never be readable.                    |

### DATA — Data integrity reconciliation

_Phase 9 — Reconciliation and acceptance · default tier C_

After every destructive or concurrent scenario, reconcile five sources: DB state · Device A · Device B · queue · webhook record. Record them in one table per case.

| ID        | Case                            | Tier | Notes |
| --------- | ------------------------------- | ---- | ----- |
| `DATA-01` | Single successful enrolment     | C    | —     |
| `DATA-02` | Failed enrolment                | C    | —     |
| `DATA-03` | Timeout after success           | C    | —     |
| `DATA-04` | Duplicate request               | C    | —     |
| `DATA-05` | Webhook duplication             | C    | —     |
| `DATA-06` | Out-of-order webhook            | C    | —     |
| `DATA-07` | Concurrent A/B enrolment        | C    | —     |
| `DATA-08` | Cancel and rejoin               | C    | —     |
| `DATA-09` | Member update during enrolment  | C    | —     |
| `DATA-10` | Consent update during enrolment | C    | —     |

### REAL — End-to-end real-world scenarios

_Phase 8 — Soak and real-world · default tier C_

Combinations isolated tests miss.

| ID        | Case                       | Tier | Notes                                                                                                                                          |
| --------- | -------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `REAL-01` | Normal day                 | C    | Enter on A, exit, another enters on B, staff enrols, a member renews, B goes offline, A keeps working, B reconnects, pending state reconciles. |
| `REAL-02` | Morning surge              | C    | 10 members, 20 access events, 5 membership changes, 2 enrolments, in a short interval, across both readers.                                    |
| `REAL-03` | Network outage             | C    | Disconnect B, operate A, issue work targeting B, restore B, reconcile.                                                                         |
| `REAL-04` | Vendor degradation         | B    | Normal latency → gradual latency → intermittent errors → recovery. Watch the queue.                                                            |
| `REAL-05` | Deployment during activity | C    | Deploy while A is processing, B has pending work, and webhooks are arriving. No loss, no duplication.                                          |
| `REAL-06` | Database pressure          | B    | Burst of events, commands and deliveries at once.                                                                                              |
| `REAL-07` | Worker crash               | B    | Crash with `in_flight` work; restart; verify recovery.                                                                                         |
| `REAL-08` | Stale data                 | B    | Leave idle long enough to create stale queue state, then resume.                                                                               |

### R — Do-not-skip races (first physical session)

_Phase 4 — Two-device concurrency · default tier C_

If the first hardware session is short, these are the ones to spend it on.

| ID    | Case                                                     | Tier | Notes                                                                                                           |
| ----- | -------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| `R1`  | A enrols M1 while B enrols M1                            | C    | —                                                                                                               |
| `R2`  | A cancels while B enrols the same member                 | C    | —                                                                                                               |
| `R3`  | A enrols while B cancels                                 | C    | —                                                                                                               |
| `R4`  | A accesses while B cancels                               | C    | —                                                                                                               |
| `R5`  | A accesses while membership is renewed                   | C    | —                                                                                                               |
| `R6`  | A enrols while consent is being written                  | C    | —                                                                                                               |
| `R7`  | A enrols while consent is revoked                        | C    | —                                                                                                               |
| `R8`  | Webhook arrives while the API request is still open      | C    | —                                                                                                               |
| `R9`  | Duplicate webhook delivery under concurrency             | A    | **Source text truncated ('dupl') — intent to be confirmed.** Read here as duplicate delivery; correct if wrong. |
| `R10` | Retry occurs while the original is still executing       | B    | —                                                                                                               |
| `R11` | Two workers claim the same workload                      | A    | —                                                                                                               |
| `R12` | Stale reclaim while the original worker is alive         | B    | The nastiest: two live workers on one job.                                                                      |
| `R13` | Device deleted while a command is queued                 | B    | —                                                                                                               |
| `R14` | Device reassigned while a webhook arrives                | A    | —                                                                                                               |
| `R15` | Member updated during enrolment                          | C    | —                                                                                                               |
| `R16` | Two identical POSTs arrive simultaneously                | A    | —                                                                                                               |
| `R17` | Access decision changes at midnight while a scan happens | C    | —                                                                                                               |
| `R18` | Device reconnects while the retry worker runs            | C    | —                                                                                                               |
| `R19` | Application restarts while both readers are active       | C    | —                                                                                                               |
| `R20` | Deployment while both readers are active                 | C    | —                                                                                                               |

### SOAK — Soak and endurance

_Phase 8 — Soak and real-world · default tier C_

Introduce throughout: repeated scans, duplicate commands, network interruptions, a device reboot, webhook duplication, member updates, enrolment/cancellation. Measure queue growth, memory, CPU, response time, DB connections, worker throughput, retry rate, dead-letter count, duplicate count, event backlog, device-state divergence.

| ID        | Case    | Tier | Notes |
| --------- | ------- | ---- | ----- |
| `SOAK-01` | 1 hour  | C    | —     |
| `SOAK-02` | 4 hours | C    | —     |
| `SOAK-03` | 8 hours | C    | —     |

### UI — Browser and UI

_Phase 8 — Soak and real-world · default tier B_

Three E2E specs exist (setup, dashboard, member). jsdom computes no geometry — render the screens and look at them.

| ID      | Case                                         | Tier | Notes                                                               |
| ------- | -------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `UI-01` | Dashboard loads                              | B    | Now reachable from the sidebar (Operations → Door Access).          |
| `UI-02` | Device list loads                            | B    | —                                                                   |
| `UI-03` | Device status updates                        | B    | —                                                                   |
| `UI-04` | Enrolment flow                               | C    | —                                                                   |
| `UI-05` | Consent flow                                 | B    | —                                                                   |
| `UI-06` | Error shown when the vendor is unavailable   | B    | Sanitized; pending ≠ error.                                         |
| `UI-07` | Retry shown correctly                        | B    | —                                                                   |
| `UI-08` | Concurrent actions from two browser sessions | B    | —                                                                   |
| `UI-09` | Session expires mid-operation                | B    | —                                                                   |
| `UI-10` | Browser refresh mid-operation                | B    | —                                                                   |
| `UI-11` | Double-click / double-submit                 | B    | —                                                                   |
| `UI-12` | Back button during enrolment                 | B    | —                                                                   |
| `UI-13` | Two staff acting simultaneously              | B    | —                                                                   |
| `UI-14` | Non-Enterprise gym sees the upgrade panel    | A    | The nav entry is shown to every gym; the page must gate, not error. |

### CRON — Cron and reconciliation

_Phase 9 — Reconciliation and acceptance · default tier B_

Three jobs: `drain-access-sync` (*/5), `reconcile-access` (18:30 UTC = 00:00 SLT, the real lockout boundary), `purge-access-events` (02:00).

| ID        | Case                                          | Tier | Notes                                                                                           |
| --------- | --------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `CRON-01` | Normal scheduled execution                    | B    | —                                                                                               |
| `CRON-02` | Execution delayed                             | B    | —                                                                                               |
| `CRON-03` | Execution overlaps itself                     | B    | —                                                                                               |
| `CRON-04` | Two instances run simultaneously              | B    | —                                                                                               |
| `CRON-05` | Cron fails halfway                            | B    | —                                                                                               |
| `CRON-06` | Cron restarts after failure                   | B    | —                                                                                               |
| `CRON-07` | Cron processes stale records                  | B    | —                                                                                               |
| `CRON-08` | Cron processes records another worker changed | B    | —                                                                                               |
| `CRON-09` | Reconciliation finds a DB/device mismatch     | C    | —                                                                                               |
| `CRON-10` | Reconciliation fixes the mismatch             | C    | —                                                                                               |
| `CRON-11` | Reconciliation cannot fix it                  | C    | Clear operator-visible state; no silent corruption.                                             |
| `CRON-12` | Retention purge honours the published figure  | A    | `ACCESS_EVENT_RETENTION_DAYS` (365) is the number in the privacy policy; the two move together. |

### ACC — Acceptance criteria

_Phase 9 — Reconciliation and acceptance · default tier C_

Do not declare success because 'both readers worked'. Each of these is a release gate, judged across the whole campaign rather than by a single case.

| ID       | Case                 | Tier | Notes                                                                               |
| -------- | -------------------- | ---- | ----------------------------------------------------------------------------------- |
| `ACC-01` | Functional integrity | C    | Every supported operation produces the intended physical result.                    |
| `ACC-02` | Consistency          | C    | DB, queue, webhook and reader state eventually converge.                            |
| `ACC-03` | Idempotency          | C    | Repeated commands and duplicate events create no duplicate logical state.           |
| `ACC-04` | Ordering             | C    | Per-member operations execute in order.                                             |
| `ACC-05` | Isolation            | A    | No gym can affect another gym's devices or members.                                 |
| `ACC-06` | Reliability          | B    | Temporary failures recover without manual database surgery.                         |
| `ACC-07` | Ambiguous outcomes   | C    | A vendor timeout causes no uncontrolled duplicate command.                          |
| `ACC-08` | Recovery             | B    | Restarts lose no operation permanently.                                             |
| `ACC-09` | Observability        | A    | Every abnormal state is diagnosable from logs and records.                          |
| `ACC-10` | Security             | A    | Secrets, tokens, tenant boundaries and privileged write paths hold.                 |
| `ACC-11` | Vendor compatibility | C    | Paths, fields, codes, date semantics and device behaviour match the implementation. |

---

## 7. P0.1 — resolved 2026-09-22, and the trap it left behind

**Production could not decrypt its own vendor credentials.** Measured, not
inferred: `POST /api/access-control/account/verify` answered **500**, and the
Vercel runtime log named it —

```
API error: Error: Unsupported state or unable to authenticate data
    at ev.getCredentials (…)
```

— the same sentence sitting in all 660 dead `reconcile_member` jobs. The
credentials had been written with a **local** `ACCESS_CONTROL_ENCRYPTION_KEY`;
production holds a different one.

Repaired through the deployed app itself (`PUT /api/access-control/account`),
so production encrypted them with the key it actually has. `verify` then
answered `{"verified": true}` — production now decrypts the credentials **and**
authenticates against the vendor from Vercel's network.

### The trap: one ciphertext, two keys

There is a single ciphertext in `access_control_secrets`, readable only by the
environment whose key wrote it. **Running the local provisioning script with
`--apply` re-encrypts it with the laptop's key and leaves production unable to
read its own account** — silently, because a Supabase write that succeeds says
nothing about who can decrypt it afterwards. That is exactly how the 25-day
outage began.

`scripts/provision-access-control-test-gym.ts` now refuses to write credentials
unless `ALLOW_CREDENTIAL_OVERWRITE=1` is set, and says why.

### Two findings from the same hour

- **The gym was told everything was fine for a month.** `GET
/api/access-control/account` returned `verified: true` with
  `lastVerifiedAt: 2026-08-27` throughout — a badge left over from the last
  successful check, with no notion of "we can no longer even read these". A
  verification timestamp is evidence about a moment, not a current state.
- **`VerifyAccessAccount` swallows the cause.** It catches everything and
  returns `verified: false`, which is right for the gym — a transport failure
  and a wrong password mean the same thing to them — but it leaves _us_ with
  nothing either, and this path is not covered by `/system-health`. During this
  repair, "wrong password" and "vendor unreachable from Vercel" were
  indistinguishable until timing separated them.

### A tooling defect worth recording

The first repair attempt stored a **wrong** password and the route answered
`200`. The value had been read with `export $(grep … .env.local)`, which keeps
the quotes that are part of `.env` syntax: a 12-character password arrived as
14 characters beginning with `'`. `dotenv` strips them; the shell does not.
The vendor rejected it in 1.2 s, and only checking the _outcome_ rather than
the status code caught it.

---

## 8. First hardware session (2026-09-23)

Both readers live on the Titan Fitness account. **Roughly 100 of 398 cases
run.** What follows is the state a later session needs; the case-by-case
results are in the tracker.

### The rig, as it now stands

|              | Device A                               | Device B                                      |
| ------------ | -------------------------------------- | --------------------------------------------- |
| Serial       | `NYU7251900066`                        | `NYU7254500734`                               |
| Gym          | Titan Fitness                          | Titan Fitness                                 |
| State        | **ACTIVE**                             | **ACTIVE**                                    |
| Reachability | Online since 13:15:30; answers in ~2s  | Online all session; answers in 0–3s           |
| Vendor name  | `Device1`                              | `Device B (test)` — our rename pushed through |
| Location     | **VFT HQ** — nobody can press a finger | **VFT HQ**                                    |

Member `100001` (Kasun Bandara) is provisioned on both, unblocked, valid to
`2027-03-09`. Member `100004` (Tony) went through a full cancel/rejoin and is
back to normal. Both are real members of a real gym: **their data was restored
each time, and that matters more than the test result.**

### What only real hardware could tell us

- A duplicate command comes back as a **500 that looks like a failure** and is
  not. Two real flows left members correct on the reader and blocked in our
  records before this was understood (master §6 Y1).
- **Enrolment was dispatching to readers that had never received the subject.**
  The reader acknowledges it identically either way (Y2).
- **Fingerprint capture is unobservable** through this API. No field, no
  endpoint, nothing moves (Y3).
- The command queue exposes `IsProcessed`, `TransTime` and `ReturnValue` —
  "sent" versus "done", which is exactly what the three-valued `CommandOutcome`
  exists to express, and which we were not reading.

### Still blocked, and on whom

| Blocked on             | What it blocks                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **A person at VFT HQ** | Every fingerprint, every scan, and **A-1 — whether a refused scan reaches the callback**, still the single most valuable unanswered question |
| **VFT answering**      | How we learn a fingerprint was captured (Y3); whether our callback URL is registered                                                         |
| Nothing else           | The outbox, tenancy, RLS, the access decision and the vendor command surface are all exercised                                               |

`access_events` has **never** received a row. Until a real scan arrives, the
inbound half is proven only by synthetic deliveries against production.

---

## 9. Second session — the vendor's answer (2026-09-23)

No hardware was touched. What changed is that the two questions the first
session left with VFT came back with one usable answer, and the two items that
were ours to finish got finished.

### VFT on fingerprint capture

> "In the next update, the finger count will be displayed. Now it is
> considered with the attendance record."

That closes F26/F29 as far as they can be closed: the template count we were
reading **does not exist yet**, and the signal that a fingerprint was captured
is the member's own scan. Built accordingly — a `VerifyType: 1` scan that
resolves to one of our members sets `finger_enrolled`, a refused scan counts
(the reader recognised the finger, then applied the window), and the enrolment
dialog now tells the desk to ask for one scan to confirm.

It also means **A-1 is now worth more, not less**: whether refused scans reach
the callback decides whether a lapsed member's enrolment is confirmable at all.

### F28 closed — the reconcile compares against the vendor

`GET /api/template` is read once per gym and its `StartDate`/`EndDate`/`IsSync`
compared against what the access decision wants, instead of against our own
last write. Measured first: those dates arrive as `YYYYMMDD`, so they compare
directly; there is no block field, so blocked state stays ours; an empty or
failed answer falls back to the local diff rather than enqueueing every member
of every gym.

Verified against production and the live account with `enqueue` intercepted —
the three live subjects matched the vendor and were left alone.

### The 660 dead jobs are cleared

One signature (`reconcile_member`, E2E gym, the pre-W3 AES-GCM text, nightly
2026-08-28 → 2026-09-22, 351 members), snapshotted and then deleted by that
signature. 17 jobs remain and the dead count is **0**, so the next one on
`/system-health` is a real one.

### The first production run, and what watching it found

Triggered early with the operator's permission. `cron_logs`: success in 2,948 ms,
`gymsConsidered 1`, `membersChecked 4`, `membersEnqueued 1`, **`vendorDrift 0`,
`gymsVendorUnreadable 0`** — that last zero being the evidence that production
reached `GET /api/template` and compared against it rather than falling back.
It is also the first successful `reconcile-access` in 25 days.

Following the job through the drain rather than stopping at the summary found
**F35**: it was claimed two minutes later and marked **succeeded** having
changed nothing at all, and a second trigger enqueued the same member again. A
member no command could change was being re-queued by every run, forever.
Fixed the same session, verified against production (`membersEnqueued` 1 → 0,
`membersNothingToDo` 1), and the lesson is the campaign's own: **a green
summary is a claim about a run, not about the state it left behind.**

### Still blocked on a person at VFT HQ

Everything involving a finger or a scan — which now includes confirming any
enrolment. Nothing has changed about that.

---

## 10. Door-hardware sessions: a physical visit and a remote day (prepared 2026-10-07)

The remaining cases became a **runbook of 87 tasks in two tracks**, each task
written to be executed one at a time by a Sonnet session. It replaced a first
version of three on-site rounds (67 tasks, 5–6 hours each), because most of
those hours did not need anyone at the readers:

- **Physical visit** (`hw-physical`, HW Test 1–4): only what needs a hand, an
  eye, a menu or a cable — 101 cases in bands: 1 must (≈ 2 h, the do-not-ship
  cases and the core premises), 2 should, 3 optional. PH-30 closes every visit.
- **Remote day** (`hw-remote-lead` + six agents, HW Test 5–10 and the E2E gyms):
  everything else with both readers online at VFT — 210 cases, including all
  146 that were "desk". Four agents run **at once** (outbox, lifecycle, api,
  evidence), then one **alone** (exclusive: reboots, crashes, reclaims, a
  stubbed vendor, forgetting a reader). The remote day runs first: a remote
  door open proves the callback with a real event 8, before anyone travels.

Running agents in parallel against production is made safe by the console,
not by the agents: every command names its agent (`--as`), a shared phase file
says which track and phase hold the readers, each agent owns disjoint test
members, reader-wide work is refused outside its phase, desk agents never call
the vendor, and `hw-session.ts coverage` proves offline that no runbook step
asks an agent for anything the console would refuse it.

| What                                                         | Where                                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Task definitions + the 398-case and 86-item disposition maps | `docs/architecture/access-control-hardware-runbook.json` (v3)                                  |
| Live status (newest result per task)                         | https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL                                              |
| The brief every session reads                                | `docs/architecture/access-control-hardware-session.md`                                         |
| How to launch each session, and its effort level             | `docs/architecture/access-control-hardware-session-prompt.md`                                  |
| The sessions' system prompts and settings                    | `.claude/agents/hw-*.md`, `.claude/hw-session.settings.json`                                   |
| The console every task drives                                | `scripts/hw-session.ts` (Titan, `HW Test N`, the two readers, the E2E gyms, `--as`, `--apply`) |

**Disposition of all 398 cases** (`npx tsx scripts/hw-session.ts coverage`
asserts it): 84 already recorded, **101 physical**, **210 remote**, 3 deferred
(SOAK-02/03 need a pilot gym; RC-10 needs a reader filled to capacity). Agents
record locally; only the lead or the visit syncs, as new documents, so two
writers never collide; case verdicts are mirrored into this campaign's
`results/<case>` at the end of each track.

**What preparing it found**, before any travel:

- Device B had been offline since at least 3 October with four commands never
  transmitted while our record called it current, and the vendor now reports
  `FpCount`/`UserCount` 0 on it (null on 23 September) — R1-03/R1-04 read both
  readers' own user lists before anything is trusted.
- "Re-send to readers" diffed against our own record, so it could not repair
  exactly that state. Fixed: the desk route forces (master §6, tenth audit).
- The webhook dropped a delivery for an unknown serial with no trace at all.
  Fixed: one log line per delivery, naming dropped serials.
- "Free up space" on a reader with no capacity entered told the desk it was
  "still 25 short" and to buy a second reader. Fixed: a shortfall is reported
  only against a known capacity.
- The E2E enrolment spec opened "the first member", who had since expired, so
  it went red for a refusal the product is right to make. It now opens the
  first member who can get in. 14 passed, 1 honest skip.
- Both readers still carried the synthetic presence and a −20 h clock skew
  from the 23 September webhook tests; cleared so the first real scan is
  unambiguous.

**What splitting it into two tracks found:**

- The app's **Mark Paid**, **Add member** and **Re-activate** text the
  member's number, and the test members cannot share the owner's (duplicate
  phones are refused). Test members are now created by the console on the
  daily plan — which the reminder run never texts — with texts suppressed, and
  parked at every session's end.
- Driving the real VFT client against a local fake vendor: **a 429 is
  dead-lettered on its first attempt** (every status below 500 is treated as
  permanent), and an unfamiliar 200 body reads as "queued". XC-05/XC-06 record
  both.
- An **undecodable session cookie** makes the API answer 500 instead of 401
  (an expired but well-formed one answers 401). AP-02 records it.
- The E2E enterprise gym had **no readers** left (the Playwright specs forget
  what they register), so the desk agent registers two and forgets them.
- Reader capacity is validated to 100–100,000, so the first version's
  "capacity 5" step would have been refused.
- The repository's `npm test` Stop hook would run after every reply of a field
  session; the sessions load `.claude/hw-session.settings.json`, which turns
  hooks off and allows only the console and `jest` without a prompt.

---

## 6. Tracker

**https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC**

### How it is kept

Status lives in the tracker artifact's database, one row per case, written as
it is run. The markdown above is the catalogue; the tracker is the state.

Collections:

- `results/<case id>` — `{status, note, tier, group, at, by}` where status is
  `not_run | pass | fail | blocked | na`
- `log/entries` — `{entries: [{t, actor, text}]}`, newest first
- `findings/<id>` — `{title, severity, status, detail}` for anything the
  campaign discovers that needs its own life

A case with no row has not been run. That is deliberate: absence is the honest
default, and it keeps the database small enough to read.
