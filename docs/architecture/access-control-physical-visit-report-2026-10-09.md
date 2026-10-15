# Physical visits report: Titan Fitness door hardware (visit 1 2026-10-09, visit 2 2026-10-10)

Machine-readable. Part A is visit 2 and the current state of the physical track; Part B is the unchanged visit-1 report. Every claim cites a task id (PH-nn), a queue command id (#nnnnn) or a timestamp in Sri Lanka time (SLT, UTC+5:30). Source of truth: `backups/hw-session/results/physical/PH-*.json` (newest result per task, with history) and the two trackers in A.7. Updated 2026-10-10 after visit 2.

# Part A. Visit 2 (2026-10-10) and current state

## A.1 Current state of the physical track (newest result per task)

- Counts (31 tasks): 3 blocked, 2 fail, 6 partial, 20 pass. "blocked" = PH-27, PH-28, PH-29, not run (owner prioritised the power-cut gap; out of time).
- Verdict (PH-31, final-visit gate): **NOT READY for a paying gym yet.** Release blocker: a power cut silently drops most members' fingerprints with no automatic repair (A.4 V2-1).
- Visit-1 defects D1 to D4 are FIXED and verified on hardware (A.3). D5 (lost offline scan) did not recur (2 of 2 offline scans delivered).
- Everything still to do before visit 3, with problem, evidence, action, where and how to verify: section A.8 (release blockers RB-1 to RB-4, code CD-1 to CD-6, console and runbook CR-1/CR-2, documentation, remote R-1 to R-5, owner actions, visit-3 run order, definition of ready).

| Task  | Title                                                        | Status  | Visit of newest result | Cases                                                                                                                                             |
| ----- | ------------------------------------------------------------ | ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-01 | Visit start: phase, deployment, members, a live callback     | pass    | 2                      | -                                                                                                                                                 |
| PH-02 | Reader identity and inventory: label, menu, user list        | pass    | 1                      | P0.5=pass, P0.6=pass                                                                                                                              |
| PH-03 | An unknown finger at Device A — does a refused scan reach us | partial | 1                      | VEND-20=partial                                                                                                                                   |
| PH-04 | Enrol HW Test 1 on Device A through the panel, then the firs | pass    | 2                      | CONSENT-02=pass, UI-04=pass, ENR-01=pass, DATA-01=pass, OBS-01=pass                                                                               |
| PH-05 | HW Test 1 at Device B — first with no help, then after a for | pass    | 1                      | ENR-03=pass                                                                                                                                       |
| PH-06 | Enrol HW Test 2 on Device B, then try Device A               | pass    | 2                      | ENR-02=pass, ENR-12=pass                                                                                                                          |
| PH-07 | Same member on both readers at the same instant              | pass    | 2                      | ENR-04=pass, RACE-01=pass, R1=pass, DATA-07=pass                                                                                                  |
| PH-08 | Enrolment accepted, performed — and we were told it failed   | pass    | 1                      | AMB-01=pass, ENR-09=pass                                                                                                                          |
| PH-09 | Lapse HW Test 1, then renew while they keep trying the door  | pass    | 1                      | RACE-08=pass, R5=pass                                                                                                                             |
| PH-10 | End date = today: a paid-up member must get in on their last | pass    | 1                      | TIME-04=pass, ACCESS-03=pass                                                                                                                      |
| PH-11 | Move Device A's clock past midnight: the window must end     | pass    | 1                      | TIME-05=pass, ACCESS-10=pass, FAIL-17=pass                                                                                                        |
| PH-12 | Unplug Device A's network: the door must keep working        | partial | 1                      | FAIL-13=pass, DEVICE-08=pass, STATUS-05=pass, RACE-16=pass, REAL-03=pass, OBS-07=pass, DATA-06=partial                                            |
| PH-13 | Cancel, then rejoin — without touching the scanner again     | pass    | 1                      | ENR-21=pass, ENR-22=pass, ENR-29=pass, ENR-30=pass, ENR-32=pass, DATA-08=pass                                                                     |
| PH-14 | Enrol on A while the member is being cancelled               | pass    | 1                      | RACE-03=pass, R3=pass                                                                                                                             |
| PH-15 | Restart Device A from the Door Access page, then scan        | pass    | 2                      | -                                                                                                                                                 |
| PH-16 | Clock skew: one minute, one hour, and the drift warning      | pass    | 1                      | STATUS-10=pass, TIME-08=pass, TIME-09=pass, ACCESS-15=pass                                                                                        |
| PH-17 | The midnight boundary scanned on both sides; a future start; | pass    | 1                      | TIME-01=pass, TIME-02=pass, TIME-03=pass, TIME-06=pass, ACCESS-04=pass, ACCESS-05=pass, R17=pass, RACE-18=pass, FAIL-18=pass                      |
| PH-18 | Block, then a validity period behind our back (A-8)          | pass    | 1                      | ACCESS-07=pass                                                                                                                                    |
| PH-19 | Remove a fingerprint: is it really gone?                     | pass    | 2                      | CONSENT-06=pass                                                                                                                                   |
| PH-20 | Consent withdrawn while an enrolment is in progress          | pass    | 1                      | CONSENT-05=pass, RACE-09=pass, R7=pass, DATA-10=pass                                                                                              |
| PH-21 | Enrolment interrupted halfway, and a finger taken after the  | pass    | 2                      | ENR-08=pass, OBS-02=pass, DATA-02=pass                                                                                                            |
| PH-22 | A fingerprint enrolled at the reader's own menu; re-enrollin | partial | 1                      | ENR-07=partial                                                                                                                                    |
| PH-23 | Scans under pressure: rapid, simultaneous, during a sync, du | partial | 1                      | DATA-05=pass, R4=pass, RACE-05=partial, RACE-14=partial, WH-13=partial, WH-14=blocked, WH-15=partial, ENR-19=blocked, R8=blocked, RACE-06=blocked |
| PH-24 | Delete a member at the reader: can the reconcile see it?     | partial | 2                      | CRON-10=fail, CRON-11=pass, ENR-18=pass                                                                                                           |
| PH-25 | Network trouble during enrolment and during changes          | partial | 2                      | ENR-13=partial, ENR-11=pass, STATUS-04=pass, R18=pass, RACE-17=pass                                                                               |
| PH-26 | Power pulled in the middle of a command, and mid-batch       | fail    | 2                      | FAIL-12=fail, STATUS-08=pass, RC-05=na                                                                                                            |
| PH-27 | Enrolment races that need fingers                            | blocked | 2                      | -                                                                                                                                                 |
| PH-28 | A normal day and a morning surge, condensed                  | blocked | 2                      | -                                                                                                                                                 |
| PH-29 | Five-source reconciliation audit                             | blocked | 2                      | -                                                                                                                                                 |
| PH-30 | Visit close-out — run last on EVERY visit                    | pass    | 2                      | -                                                                                                                                                 |
| PH-31 | Acceptance gates and the readiness verdict (last visit only) | fail    | 2                      | ACC-01=fail, ACC-03=fail, ACC-06=fail, ACC-07=fail, ACC-08=fail, ACC-09=fail, ACC-11=partial                                                      |

## A.2 Visit 2 metadata

| Key                     | Value                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| date                    | 2026-10-10, 10:45 to 13:55 SLT (VFT access until 14:00)                                                                                                      |
| production              | `dpl_3bSWTqaht7u1D87bK6aKRvQwXy76`, commit `1cb8fd1` (release v1.4.0) containing the fix merge `b9eb7bb` (PR #104) and `ef1df60`                             |
| console                 | run from branch `fix/access-control-visit-1-defects` at `d54b8e1`, fully merged into origin/master; console and runbook identical to master                  |
| readers                 | A `NYU7251900077` fw ZAM70-NF24HA-Ver3.0.15; B `NYU7254500734` fw Ver3.3.12; both on VFT Wi-Fi (no network cable)                                            |
| operator capabilities   | menu, clock, network (via Wi-Fi switch in the menu), power: all yes; final visit: yes                                                                        |
| members and subject ids | removal now issues a new subject id. End of visit: HW1 100020, HW2 100023, HW3 100024, HW4 100022 (were 100015 to 100018)                                    |
| fingers used            | HW1 left index (+ right ring), HW2 right middle, HW3 left thumb (+ right thumb), HW4 right pinky; operator's own right index = pre-existing reader user ID 2 |

## A.3 Visit-1 defects after the fixes (re-tests on hardware)

| Defect                                | Fix                                                                | Re-test             | Result                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3 first scan refused after enrolment | fix #1/#2: Access Grant on every push and after Enroll             | PH-04, PH-06, PH-07 | FIXED: first scan admitted on A (10:55:04), B (11:01:57), both at once (11:15:58/11:16:01); queue order Enroll -> Access Grant -> Set Valid Time Period |
| D1 restart drops templates            | fix #3/#4: Re-send = re-seat; restart queues a re-seat 180 s later | PH-15               | FIXED for an app-initiated restart: jobs queued 11:19:14 due 11:22:14, drained 11:25, all four admitted 11:26:23-36 with no manual action               |
| D2 removed finger returns             | fix #5: removal deletes the vendor employee, new subject id        | PH-19               | FIXED: after Re-send the removed finger stays "illegal" on A and B; re-add has no Finger command                                                        |
| D4 panel wait 2m10s                   | fix #7: 30 s wait, then auto-confirm on first scan                 | PH-21               | FIXED: panel gives up at ~30 s with accurate copy, flips to Registered without reload                                                                   |
| D5 lost offline scan                  | none (vendor side)                                                 | PH-25               | did not recur: offline scans delivered +101 s and +52 s after reconnect, reader time kept                                                               |

## A.4 New findings from visit 2, most serious first

### V2-1 [RELEASE BLOCKER] A power cut silently drops most members' fingerprints, with no signal and no automatic repair.

- Tasks: PH-26
- Evidence: Reader B (fw 3.3.12) power pulled ~12:21: users stayed listed but every fingerprint our system manages was gone, including a finger enrolled directly on B; local user ID 2 survived. Reader A (fw 3.0.15) power pulled ~13:25: only the finger enrolled on A and never re-seated (HW2) survived; every finger that last arrived via a re-seat/unpark was gone. Members get "illegal fingerprint" while the panel says "Can get in". Neither reader sends any event at boot (no webhook delivery from B 12:21-12:23). The restart repair (fix #4) only follows an app-initiated restart. Only a per-member app Re-send restores the fingers (B 13:13, A 13:30).
- Desk action: Detect unplanned reboots/power loss and queue the same re-seat as an app restart. Candidate signal for the remote session: pull stored events (GetEventsbyDevSN) after 12:21 (B) and 13:25 (A) and look for system codes 107 "Mains power failure", 111 "POE power down", 237 "Reader online". Alternatively a periodic verification. Respect V2-3 when re-seating.

### V2-2 [HIGH] A member deleted at the reader's own menu is invisible.

- Tasks: PH-24
- Evidence: Reader B menu deletion of 100022: finger "illegal" (no event, so the refusal repair of fix #6 cannot fire), panel still "Registered / Can get in". Reconcile dry run did not detect it (would enqueue HW Test 5-10 only, vendorDrift 6; not applied because it would touch the remote track's members). App Re-send restored it (granted 11:41:53).
- Desk action: Device-side user/template loss needs detection (device user list or periodic verification); the reconcile only compares our records with the vendor copy.

### V2-3 [HIGH (design input)] A re-seat queued while a reader is offline deletes fingers enrolled at that reader during the outage.

- Tasks: PH-25
- Evidence: HW3 right ring added at A's menu with Wi-Fi off; app Re-send pressed while A was offline; on reconnect Delete User #71635 ran before the ring uploaded; re-seat restored only Finger 4/5 (thumbs); ring "illegal". Control: right thumb added offline, re-seat pressed AFTER reconnect -> uploaded and restored (Finger 5).
- Desk action: Any automatic repair (restart, power loss) must wait until the reader has reconnected and uploaded, or must not delete fingers it does not know.

### V2-4 [MEDIUM] A second enrolled finger is overwritten: our Enroll always uses finger slot 0.

- Tasks: PH-25, PH-26
- Evidence: HW1 had left index then right ring both enrolled as "Finger 0"; re-seats restored one of them. The vendor copy itself holds several fingers (HW3: Finger 4 and Finger 5 restored together).
- Desk action: Use a distinct finger slot per enrolment (or let the reader choose) so a second finger does not overwrite the first.

### V2-5 [MEDIUM] Console is out of date after the fixes.

- Tasks: PH-04, PH-26
- Evidence: `withdraw` refuses ("hw-session never deletes a vendor subject") because removal now deletes the vendor employee; `resend` is a plain push with no Delete User and did not restore lost templates (the app's Re-send did).
- Desk action: Update the console (withdraw via the product path; resend = re-seat) and the runbook steps that call them.

### V2-6 [LOW] No way to record consent for an existing reader-enrolled finger.

- Tasks: PH-25
- Evidence: Panel for a finger with "No consent recorded" offers only Remove fingerprint and Re-send to readers.
- Desk action: Add a "member confirmed consent" action, or document removal + re-enrol as the path.

### V2-7 [SECURITY HOUSEKEEPING] Webhook token appeared again in a transcript.

- Tasks: PH-26
- Evidence: A Vercel runtime log line was printed with its request path on 2026-10-10.
- Desk action: Rotate ACCESS_CONTROL_WEBHOOK_TOKEN (and the VFT account password) after the campaign; re-register the URL with VFT.

### Visit-2 observations

- Readers show no user ID during enrolment, only on later scans (operator).
- Templates enrolled on a reader survive an app restart; templates that arrived from the vendor copy do not (PH-15).
- Overnight 00:00 reconcile re-blocked and deleted all parked HW members including HW5-10; delivered when the readers came online (PH-01).
- Reader card now reads "Members on this reader"; Re-send toast "Readers updated" (PH-05/PH-19).
- Remote opens still produce no event 8 (VFT behaviour); callback proven with finger scans, latency 2-9 s.

## A.5 PH-31 gate table (both tracks, newest result per task)

| Gate                                                      | Verdict               | Evidence                                                                                                                                                                                                                            |
| --------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACC-01 every operation gives the intended physical result | fail                  | pass PH-04/06/07/09/10/11/13/14/15/17/19/21/25, OB-02/03; refuted by PH-26 (power cut) and PH-24 (menu deletion)                                                                                                                    |
| ACC-03 no duplicate logical state                         | fail (pending re-run) | PH-23 0 duplicate rows, AP-08/09, PH-14, LC-05 hold; XC-10 fixed by F-01, not re-verified                                                                                                                                           |
| ACC-06 temporary failures recover without DB surgery      | fail (pending re-run) | PH-12, PH-25, OB-04, XC-06 hold; XC-05 (F-02) and XC-03 (F-11) not re-verified; PH-26 needed a manual re-seat                                                                                                                       |
| ACC-07 no uncontrolled duplicate command after timeouts   | fail (pending re-run) | PH-08, OB-04 hold; XC-03/XC-04 (F-10/F-11) not re-verified                                                                                                                                                                          |
| ACC-08 restarts lose nothing permanently                  | fail                  | PH-15, XC-02 pass; PH-26 power cut wipes fingers; V2-4 second finger lost                                                                                                                                                           |
| ACC-09 every abnormal state diagnosable                   | fail                  | PH-12/PH-16 alerts hold; PH-24 and PH-26 losses invisible; PH-03 unknown-finger refusals not delivered                                                                                                                              |
| ACC-11 vendor behaviour matches the implementation        | partial               | mismatches: enrol ret 6 = timed out; no event 8 for remote opens; unknown-finger refusals not delivered; events pull re-delivers in UTC; Enroll always slot 0; clock-before-start refused as event 29; no ID shown during enrolment |

Owner decision (PH-31 step 3): HW Test 1-10 stay parked.

## A.6 Final state after visit 2

- Phase idle (released 13:55 SLT).
- HW Test 1-4 parked: cancelled, blocked, held by none, finger YES kept in the vendor copy; subjects HW1 100020, HW2 100023, HW3 100024, HW4 100022; due HW1 2026-11-12, HW2 2026-11-13, HW3 2027-04-28, HW4 2026-11-14.
- Both readers on Wi-Fi with correct clocks (operator, after the power-cut tests).
- Dead jobs 6 (remote-day baseline, unchanged). Real Titan subjects unchanged since 2026-10-03 16:30:23.
- All physical records synced to the runbook tracker; all case verdicts mirrored to the campaign tracker (12 existing rows updated with their earlier text appended as "PREVIOUS ROW"; 5 of today's rows updated after the final PH-25 re-record).

## A.7 Records

- Local results: `backups/hw-session/results/physical/PH-*.json` (gitignored, with history).
- Snapshots: `backups/hw-session/physical/*-snapshot.json`; visit-2 last: `2026-10-10T08-03-44-645Z-snapshot.json`.
- Runbook tracker: https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL (collection `results`, docs `PH-nn~<time>`).
- Campaign tracker: https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC (collection `results`, one row per case id).
- Human-readable visit-1 report: https://claude.ai/artifact/B47xmVRT6ZrrvVdU9ZcZY8 (private; predates visit 2).

## A.8 Before visit 3: everything that still needs work

This section is the complete work list between visit 2 and visit 3. Each item says what is wrong, the evidence, what must be done, where it can be done (desk = code/docs, remote = readers online at VFT but nobody at them, owner, physical = someone at the readers), and how to verify it. Items are grouped by priority. "Ready for a paying gym" (A.8.8) needs every item in A.8.1 done and verified.

### A.8.1 Release blockers (must be fixed and verified before any paying gym)

**RB-1. Power loss silently wipes most members' fingerprints (V2-1, PH-26).**

- What is wrong: when a reader loses power, it keeps its users but drops every fingerprint that reached it from the vendor's central copy (through a re-seat, an unpark or a Re-send). That is most fingers in any gym with more than one reader, because a finger enrolled on one reader only reaches the other through that copy. On reader B (firmware 3.3.12) even a finger enrolled directly on B was lost. Members then get "illegal fingerprint" at the door while the member panel still says "Can get in".
- Why nothing catches it today: neither reader sends any event when it powers back up (no webhook delivery from B between 12:21 and 12:23:28 on 2026-10-10); a refusal of an unknown finger sends no event either, so fix #6 (re-push after a refused scan) cannot fire; the restart repair of fix #4 only runs after a restart started from Door Access; our "Online / Not responding" badge is derived from scans, not a heartbeat.
- Evidence: PH-26 (B at ~12:21, A at ~13:25 on 2026-10-10), and the restart pattern in PH-15.
- What must be built (desk): a way to notice that a reader rebooted or lost its templates, then queue the same re-seat as an app restart. Candidate signals, in the order to investigate: (1) vendor system events 107 "Mains power failure", 111 "POE power down", 237 "Reader online", if the readers store them and the events pull returns them (check in A.8.5 R-1); (2) any vendor command that reads a device's user or template list, so a periodic check can compare what the reader holds with what we expect (search `docs/integrations/vft/vft-gym-api-v2-collection.json`); (3) a scheduled re-seat as a last resort, which is expensive and must respect RB-3. The member panel should also stop asserting "Can get in" as a certainty when a reader has not been verified since a restart or outage.
- Mitigation to tell gyms meanwhile (owner decision): put readers on a UPS; after any power cut, use "Re-send to readers" for affected members.
- Verify: at visit 3, pull power on each reader with several members held (fingers enrolled on that reader and fingers delivered by a re-seat), then confirm every finger works again without any manual action, within a stated time.

**RB-2. A member deleted at the reader's own menu is invisible (V2-2, PH-24).**

- What is wrong: deleting a user at the reader's menu leaves our records, the reconcile and the panel all saying the member can get in; the reader refuses the finger as "illegal" and sends nothing.
- Evidence: PH-24 (reader B, user 100022, 2026-10-10 ~11:38).
- What must be built (desk): the same device-side verification as RB-1 (compare what each reader holds with what we expect) and a gym-visible alert when they differ; the reconcile today only compares our records with the vendor's central copy.
- Verify: visit 3 re-run of PH-24, including the B-14 double-reconcile step (see A.8.3).

**RB-3. A repair queued while a reader is offline deletes fingers enrolled there during the outage (V2-3, PH-25).**

- What is wrong: a re-seat starts with Delete User. If it is queued while the reader is offline, it runs the moment the reader reconnects, before a finger added at the reader's menu during the outage has uploaded, and that finger is lost. Re-seating after the reader has reconnected kept the finger (right thumb, Finger 5).
- Evidence: PH-25 known-edge tests, 2026-10-10 13:40-13:52 (right ring lost, right thumb kept).
- What must be built (desk): any automatic repair (RB-1, the restart repair of fix #4) must not queue a re-seat for a reader until that reader has reconnected and had time to upload, or the re-seat must avoid deleting fingers it does not know.
- Verify: visit 3, repeat the offline-enrolment test with the repair path that RB-1 adds.

**RB-4. The remote-day fixes have never been checked on production (ACC-03, ACC-06, ACC-07 pending).**

- What is wrong: PR #104 fixed the remote day's defects (F-01 to F-17), but the tasks that found them were not re-run. The final gate cannot pass on unverified fixes.
- Re-run (remote, A.8.5): XC-03 and XC-04 (reclaim and crash recovery, F-10/F-11), XC-05 (429 and 408 retry instead of dead-letter, F-02), XC-06 (sign-in failure flagged and needing attention, F-03), XC-10 (events pull not duplicating scans, F-01), AP-02 (bad session cookie 401 not 500, F-06), AP-07 (reader serial upper-cased and checked against the vendor list, F-07), AP-08 and AP-09 (webhook batch speed and login rate limit 5 per email / 10 per IP per 15 min, F-09), EV-02 (unreadable due date refuses, F-04), EV-04 (retry-limit constant, F-14), EV-06 (https-only vendor URL, F-08), LC-03 (stub-log redaction, F-15), LC-07 (withdraw re-adds an active member, now fix #5).

### A.8.2 Code defects (desk)

**CD-1. Our enrolment always uses finger slot 0 (V2-4).** Enrolling a second finger for a member overwrites the first in the vendor's copy, so any later re-seat restores only the most recent finger (HW Test 1's left index and right ring were both "Finger 0"; one was lost). The vendor copy itself holds several fingers (HW Test 3's Finger 4 and Finger 5 were restored together). Fix: give each enrolment its own slot (or let the reader choose) and keep the slot in our records. Verify at visit 3: enrol two fingers, Re-send, both work on both readers (also closes PH-22 ENR-07).

**CD-2. A scan recovered by an events pull is stored 5 h 30 min early (residual of F-01).** The vendor's GetEventsbyDevSN re-delivers events in UTC. F-01 now recognises a re-delivered copy of a scan we already hold, but a genuinely missing scan recovered by the pull is still stored with the wrong time. Fix before A.8.5 R-1 runs an events pull, otherwise the pull will plant wrong-time rows (the physical session has read-only SQL and cannot clean them).

**CD-3. No way to record consent for a reader-enrolled finger (V2-6).** The panel shows "No consent recorded … Ask them to confirm they are happy with it, or remove it below" but offers only Remove fingerprint and Re-send to readers. Add an action that records the member's consent for the existing finger (with the same timestamp rules as the enrolment dialog), or document remove-and-re-enrol as the only path.

**CD-4. Reconcile wants to re-enqueue the six parked remote-track members (PH-24).** A dry run reported vendorDrift 6 and would enqueue HW Test 5-10, all cancelled and parked. Find out what differs between our records and the vendor copy for cancelled members, and make the reconcile of a cancelled member a no-op once it is in the intended state; otherwise the B-14 check ("a reconcile right after a reconcile enqueues nobody") can never pass.

**CD-5. Device card capacity bar missing (remote day LD-06).** With capacity 100 saved for Device A, the Door Access card showed no capacity bar after a hard refresh. Check whether the card relabel in fix #8 ("Members on this reader") changed this; fix and look at it in a browser.

**CD-6. Unknown-finger refusals are never reported (PH-03, vendor behaviour).** The reader sends no event when it refuses a finger it does not know (only known members' refusals arrive, event 23/29). Nothing to fix in code, but the activity log should say so, and RB-1/RB-2 detection must not rely on such refusals.

### A.8.3 Console and runbook (desk, must be done before visit 3)

**CR-1. Console out of date (V2-5).** `withdraw` now refuses ("hw-session never deletes a vendor subject") because removing a fingerprint deletes the vendor employee; `resend` is a plain push with no Delete User and did not restore lost fingerprints (the app's Re-send did). Update `withdraw` to the product's removal path (or replace those steps with the app's Remove fingerprint), make `resend` the re-seat, and give `reconcile` a way to limit itself to the physical session's members so PH-24 can run without touching HW Test 5-10.

**CR-2. Runbook v3 predates both visits.** Rewrite these before visit 3, or the same steps will fail again:

- Reader A serial: tasks still say `NYU7251900066`; it is `NYU7251900077`.
- Fingers: the task text names fingers that do not match the members; record the real map in the runbook (end of visit 2: HW1 left index, HW2 right middle, HW3 left thumb, HW4 right pinky; the operator's own right index is reader user ID 2) and tell the operator to choose unused fingers for new enrolments.
- Reader IDs: removal now gives a member a new subject id (visit 2 ended with HW1 100020, HW2 100023, HW3 100024, HW4 100022); steps must read the id from `snapshot`, never a fixed number.
- Event 8: VFT never reports a remote open; PH-01 and PH-03 must prove the callback with finger scans.
- Network: both readers are on VFT Wi-Fi (no cable). PH-12 and PH-25 must use the menu's Wi-Fi switch, and PH-25 step 1 ("unplug during the 10 s enrolment screen") must be redesigned (switch Wi-Fi off first, then enrol at the menu).
- Withdraw/resend steps (PH-04, PH-08, PH-19, PH-20, PH-22): use the app's Remove fingerprint and Re-send, per CR-1.
- PH-24: its `reconcile --apply` and the B-14 double reconcile would touch HW Test 5-10; rewrite after CR-1.
- Brief section 7: an enrol return code of 6 means the reader's window timed out (no finger taken); 0 means the finger was taken.
- Expected texts: the Re-send toast reads "Readers updated"; the enrolment panel waits 30 s with the new copy; Re-send now issues Delete User first; a restart's repair takes 3-8 min; readers show no user ID during enrolment.
- Time estimates: visit 2 needed about 3 hours for the re-tests plus PH-24 to PH-26; plan visit 3 around a realistic budget.
- New tasks to add: power-loss repair on both readers (RB-1), offline-enrolment versus repair (RB-3), refusal self-repair (fix #6, never triggered on hardware), two fingers surviving a re-seat (CD-1).

### A.8.4 Documentation (desk)

Fold these vendor facts into `docs/architecture/access-control-master.md` (the single source of truth) and the brief: no event at boot or power-up; a restart or power cut keeps users but drops fingerprints (which ones, per firmware, from PH-15 and PH-26); fingers added at the menu while offline upload on reconnect, and a Delete User delivered first destroys them; unknown-finger refusals are never sent; VFT never sends event 8 for remote opens; enrol return code 6 = window timed out; GetEventsbyDevSN re-delivers in UTC; the vendor copy holds several finger slots; a clock set before the window start is refused as event 29 "membership expired"; readers show no user ID during enrolment; these readers run on Wi-Fi. Also record the confirmed "known edge" from the fix notes (RB-3) as confirmed.

### A.8.5 Remote session (readers online at VFT, nobody needed at them)

- **R-1. Find a power-loss signal (input to RB-1).** After CD-2 is fixed, run an events pull on each reader and look for system codes 107, 111 or 237 after the visit-2 power cuts (B ~12:21, A ~13:25 SLT on 2026-10-10). Record whether the readers store them and whether the pull returns them.
- **R-2. Re-run the remote-day tasks listed in RB-4.**
- **R-3. Look at the reader cards in a browser:** confirm the "Members on this reader" label and count (fix #8) and the capacity bar (CD-5).
- **R-4. Investigate CD-4** with the lead (what differs for the parked HW Test 5-10).
- **R-5. E2E test gym has no fake readers (remote day LD-05):** seed them, or the api agent's device tasks stay unrunnable.

### A.8.6 Owner actions

- Rotate the VFT account password (exposed 2026-09-22) and `ACCESS_CONTROL_WEBHOOK_TOKEN` (appeared in transcripts on 2026-10-07 and 2026-10-10), then re-register the webhook URL with VFT.
- Decide the interim guidance for gyms on power cuts (UPS, manual Re-send) until RB-1 ships.
- Arrange visit 3 with VFT: reader menu access, permission to switch Wi-Fi and pull power, about 4 hours, ideally a second person for the simultaneous-enrolment steps; bring the laptop with this checkout on `master` after `git pull`.
- HW Test 1-10 stay parked (decided in PH-31).

### A.8.7 Visit 3 run order (physical)

1. PH-01: phase, deployment check, unpark, callback by finger scan.
2. RB-1 verification: power cut on A and on B with fingers of both kinds held; confirm automatic recovery.
3. RB-3 verification: finger added at the menu while offline, then the automatic repair; the finger must survive.
4. Fix #6 verification: a paid-up member wrongly refused (event 23) repairs within one drain.
5. CD-1 / PH-22 ENR-07: two fingers for one member, Re-send, both work on both readers.
6. PH-24 re-run with RB-2 detection and the B-14 double reconcile.
7. PH-23 remaining cases: WH-14 (scan during a sync, no "ingestion failed"), ENR-19 and R8 (webhook during an open request), RACE-06 (enrolment on one reader while the other admits).
8. PH-27 (enrolment races with fingers), PH-28 (a normal day and a morning surge), PH-29 (five-source audit including both readers' user lists).
9. If time: PH-03 (VEND-20), PH-12 (DATA-06), PH-25 ENR-13 with the new repair.
10. PH-31 final gate, then PH-30 close-out (reserve 25 minutes).

### A.8.8 Definition of "ready for a paying gym"

All PH-31 gates (ACC-01, 03, 06, 07, 08, 09, 11) pass with cited evidence: RB-1 to RB-4 done and verified, CD-1 and CD-2 fixed, the runbook (CR-2) used for visit 3 without workarounds, and every remaining mismatch in ACC-11 either fixed or documented in the master reference.

## A.9 Visit-2 deviations and slips

- Console `withdraw` refused (V2-5); fingerprint removals were done with the app's Remove fingerprint, with the operator's go-ahead.
- PH-24: `reconcile --apply`, the drain and the B-14 double reconcile were not run because applying would enqueue the remote track's HW Test 5-10.
- PH-25: readers are on Wi-Fi, so the cable steps used the menu Wi-Fi switch; the "unplug during the 10 s enrolment screen" step was impossible; the first menu enrolment happened online by mistake; the offline-capture case was then run separately at the end (V2-3).
- PH-26: B's commands landed before the power pull, so no command was caught in flight; the console `resend` was tried first and did not restore (V2-5).
- PH-27/28/29 not run on the owner's call; PH-31 recorded as the verdict.
- Moving the session to the cloud was declined: credentials (.env.local) and session state (gitignored backups) live on this laptop.

## A.10 Visit-2 task records (copied from the records)

### PH-01 Visit start: phase, deployment, members, a live callback

- status: **pass**
- outcome: Visit 2 (2026-10-10). Phase idle -> physical. Production dpl_3bSWTqaht7u1D87bK6aKRvQwXy76 @ 1cb8fd1 (release v1.4.0) contains the fix merge b9eb7bb (PR #104) and ef1df60. Console run from fix/access-control-visit-1-defects d54b8e1, fully merged into origin/master, console and runbook identical to master. HW Test 1-4 unparked: active, due 2027-04-28, held A+B, subjects 100015-18 unchanged; both readers collected Update User, Update User Finger N, Access Grant (new, fix #1), Set Valid Time Period, all DONE ret=0. Callback live: HW1 left index granted at A 10:46:32/10:46:42 (stored +2-3s) and B 10:46:27/10:46:42/10:47:15 (stored +5s); HW3 granted at A and B 10:46:33-39; templates came back from the central copy after unpark (no re-enrolment).
- observation: callback=live latency=2-5s (finger scans; VFT sends no event 8 for remote opens)
- observation: overnight 00:00 reconcile re-blocked and deleted all parked HW members incl. HW5-10 (remote track); delivered when the readers came online this morning; not physical's action
- observation: capabilities today: menu, clock, network pull, power pull all yes; final visit = yes (PH-31 runs)
- observation: dead jobs baseline 6, real Titan subjects unchanged since 2026-10-03; time limit 14:00 SLT

### PH-04 Enrol HW Test 1 on Device A through the panel, then the firs

- status: **pass**
- outcome: Visit 2 re-test of D3 after PR #104. Precondition: HW1 had a finger; console 'withdraw' REFUSED ('hw-session never deletes a vendor subject'), so the operator used the app's Remove fingerprint (toast 'Fingerprint removed. Membership is unchanged.'): HW1 got a NEW subject 100020 (was 100015), consent none, finger no, vendor account 17 -> 16 subjects; Delete User 100015 on A (#71194) and B (#71195); push re-added 100020 with Update User (no finger), Access Grant, Set Valid Time Period on both readers. Enrolment: Register disabled until consent ticked; consent 10:54:20.3 SLT, Enroll User 100020 Finger 0 committed 10:54:21 and DONE ret=0 on A, followed by Access Grant #71203 and Set Valid Time Period #71204 (fix #2). Reader showed ID 100020 and accepted the left index. FIRST SCAN GRANTED: event 3 verify 1 at 10:55:04 (stored +2s) - D3 fixed. Finger flag YES; panel flipped to 'Registered' without a reload (fix #7); Door Access row '10 Oct 2026, 10:55 HW Test 1 In Entry allowed NYU7251900077'.
- cases: CONSENT-02=pass, UI-04=pass, ENR-01=pass, DATA-01=pass, OBS-01=pass
- observation: D3 re-test: first scan after enrolment admitted (was event 23 invalid time period on visit 1)
- observation: fix #2 order on the enrolling reader: Enroll User -> Access Grant -> Set Valid Time Period
- observation: fix #5: removal gives a new subject id (100015 -> 100020) and erases the vendor employee
- observation: fix #7: panel shows Registered without reload after the first scan
- finding: console 'withdraw' refuses since fix #5 ('hw-session never deletes a vendor subject'): fingerprint removal now deletes the vendor employee, so the console can no longer withdraw; the runbook steps that call it need the app's Remove fingerprint instead (or a console update)

### PH-06 Enrol HW Test 2 on Device B, then try Device A

- status: **pass**
- outcome: Visit 2 re-test. HW2 fingerprint removed in the app (toast 'Fingerprint removed. Membership is unchanged.'), new subject 100021 (was 100016), pushed to A+B. Register on Device B with consent, right middle: B queue Enroll User 100021 Finger 0 ret=0 -> Access Grant #71221 -> Set Valid Time Period #71222. First scan at B GRANTED event 3 at 11:01:57 (D3 fixed on B). Reader A without help: 'illegal fingerprint' (no template). Re-send to readers (toast 'Readers updated') = re-seat: Delete User 100021 then Update User + Finger 0, Access Grant, Set Valid Time Period on both readers, all DONE ret=0. About a minute later A GRANTED 11:07:14 and B GRANTED 11:07:15 (event 3 verify 1).
- cases: ENR-02=pass, ENR-12=pass
- observation: templatePropagation=manual: a finger enrolled on B is not on A until Re-send (re-seat), then within ~1 min
- observation: operator: these readers show no ID during enrolment, only on later scans
- observation: fix #3 re-seat order observed: Delete User first, then Update User/Finger/Access Grant/window

### PH-07 Same member on both readers at the same instant

- status: **pass**
- outcome: Visit 2 re-test. HW4 fingerprint removed in the app, new subject 100022 (was 100018), pushed. race enrol-both with consent (10:43:40Z = 11:13:40 SLT, operator confirmed) settled in 3.9s, both dispatched. Operator pressed the RIGHT PINKY on both readers: Enroll User 100022 Finger 0 ret=0 on A (#71254) and B (#71253), each followed by Access Grant and Set Valid Time Period (fix #2). First scans GRANTED on both: B 11:15:58, A 11:16:01 (event 3 verify 1). Final: active, held A+B, finger YES, one consent, no reader stuck, dead jobs 6.
- cases: ENR-04=pass, RACE-01=pass, R1=pass, DATA-07=pass
- observation: both readers completed the simultaneous enrolment this time (visit 1: A timed out)
- observation: HW4 finger is now RIGHT PINKY

### PH-15 Restart Device A from the Door Access page, then scan

- status: **pass**
- outcome: Visit 2 re-test of D1. Door Access > Restart on Device A; dialog 'Restart Device A (test)? The reader will be unusable for about a minute while it restarts. Nobody can scan in during that time. Afterwards, members' fingerprints are sent to the readers again, which takes a few minutes.'; toast 'reader is restarting'. Restart at ~11:19; four reconcile_member jobs (HW1-4) created 11:19:14 due 11:22:14 (fix #4). After the restart, before the repair: HW1 (enrolled on A today) granted 11:20:05, HW4 (enrolled on A today) granted 11:22:05; HW2 (template delivered to A by the re-seat) and HW3 (template from the central copy at unpark) 'illegal fingerprint' at 11:22. Repair drain 11:25:20-26: re-seat on A for each member (Delete User, Update User + Finger 0, Access Grant, Set Valid Time Period, all DONE ret=0). Then all four GRANTED on A: HW2 11:26:23, HW3 11:26:27, HW1 11:26:33, HW4 11:26:36 (event 3 verify 1). No cancel/reactivate or manual resend needed.
- observation: restart drops only templates that reached the reader from the vendor central copy (re-seat/unpark); templates enrolled on that reader survive the restart
- observation: repair latency: restart ~11:19 -> repair drained 11:25 -> fingers back ~11:26 (about 7 min)
- observation: fingers: HW1 left index (100020), HW2 right middle (100021), HW3 left thumb (100017), HW4 right pinky (100022)

### PH-19 Remove a fingerprint: is it really gone?

- status: **pass**
- outcome: Visit 2 re-test of D2. App Remove fingerprint on HW2 (toast 'Fingerprint removed. Membership is unchanged.'): new subject 100023 (was 100021), consent none, finger no, status active; Delete User 100021 on A (#71307) and B (#71306). Right middle at A: 'illegal fingerprint'. KEY: Re-send to readers (toast 'Readers updated') pushed Update User 100023 (NO Finger command), Access Grant, Set Valid Time Period to both readers, all DONE ret=0; about a minute later the removed finger was still 'illegal fingerprint' on A AND B, no event stored, flag stays no. The withdrawal is real: the vendor copy is gone and a resend does not bring it back.
- cases: CONSENT-06=pass
- observation: D2 fixed: removal deletes the vendor employee and assigns a new subject; resend sends no template
- observation: restore done in PH-21 (fresh enrolment of HW2 on A with consent)

### PH-21 Enrolment interrupted halfway, and a finger taken after the

- status: **pass**
- outcome: Visit 2 re-test of D4 (also PH-19's restore). HW2 (subject 100023, no finger, no consent). Walk-away: consent ticked, Register on Device A, reader untouched: Enroll User 100023 #71321 ret=6 (window timed out; Access Grant + window still followed, harmless). Panel at ~30 s without refresh: 'Not confirmed yet. If the reader accepted the finger, ask the member to scan once and this will update by itself for the next few minutes. If the reader gave up, start again.' Right middle at A: 'illegal fingerprint' (no half-template; no old template returned). Flag no, consent 11:34. Then Register again, right middle pressed when prompted: Enroll #71324 ret=0; confirming scan at A 11:36:17 GRANTED (event 3 verify 1); panel flipped to 'Registered' by itself without a refresh (fix #7). HW2 held A+B, finger YES.
- cases: ENR-08=pass, OBS-02=pass, DATA-02=pass
- observation: D4 fixed: panel gives up at ~30 s with accurate wording, then confirms on the first scan without reload
- observation: fix #2 also queues Access Grant + window after a timed-out (ret=6) enrolment request; harmless

### PH-24 Delete a member at the reader: can the reconcile see it?

- status: **partial**
- outcome: Operator deleted user 100022 (HW4) at reader B's own menu; HW4 right pinky at B then 'illegal fingerprint' (no event). The member panel still said 'Registered' and 'Can get in' (operator), contradicting the reader. Reconcile dry run: membersChecked 16, membersEnqueued 6, vendorDrift 6 - would enqueue HW Test 5-10 only; HW4 NOT detected. reconcile --apply, drain and the B-14 double-reconcile were NOT run because applying would enqueue the remote track's HW Test 5-10 (hard rule: never touch them). Recovery: panel Re-send to readers (toast 'Readers updated') re-seated HW4 on B (Delete User, Update User, Update User Finger 0, Access Grant, Set Valid Time Period, all DONE ret=0); right pinky at B GRANTED 11:41:53 (event 3).
- cases: CRON-10=fail, CRON-11=pass, ENR-18=pass
- observation: B-14 (reconcile twice enqueues nothing) not run: apply would touch HW5-10
- observation: a device-side deletion produces no signal: unknown-finger refusals send no event, so fix #6 (door_refused re-push) cannot trigger; only a manual Re-send closes it
- observation: reconcile would enqueue the parked HW Test 5-10 (vendorDrift 6) - drift between our cancelled members and the vendor central copy; for the lead/remote track to look at
- finding: reconcile cannot detect a member deleted at the reader's own menu (it compares our records with the vendor central copy, not the device user list); the panel keeps saying 'Registered' / 'Can get in' while the reader refuses with 'illegal fingerprint', and nothing alerts the gym; only a manual Re-send repairs it

### PH-25 Network trouble during enrolment and during changes

- status: **partial**
- outcome: Readers are on VFT Wi-Fi; network cut by switching Wi-Fi off in the reader menu. ENR-11: B Wi-Fi off; race enrol-both HW1: A Enroll User 100020 ret=0 + Access Grant + window, right ring enrolled; B commands NEVER SENT; B Wi-Fi on 12:06 -> B collected Enroll ret=0 + Grant + window, granted at B 12:07:23. STATUS-04: A Wi-Fi flapped x3 while HW1 due +36/+37/+38 pushed: A collected EndTime 20261115, 16, 17 in order, ret=0. R18/RACE-17: A Wi-Fi off, HW1 +46 and HW2 +47 drained at 12:15:35, Wi-Fi on 12:15: A collected 20261117 (stale), 20261125, 20261126 in order; HW1 granted at A 12:16. ENR-13 (known-edge tests, 13:40-13:52, HW3 subject 100024): (1) Wi-Fi off, right thumb added at A's menu offline, scanned offline (granted 13:41:59, stored +52s after reconnect), Wi-Fi on, then app Re-send: re-seat sent Delete User then Update User Finger 4 (left thumb) AND Finger 5 (right thumb) -> both thumbs granted 13:45:18/22: a finger captured offline IS uploaded on reconnect and survives a later re-seat. (2) Wi-Fi off, right ring added at A's menu offline, app Re-send pressed WHILE A WAS OFFLINE, Wi-Fi on: queued re-seat ran on reconnect (Delete User #71635, then Finger 4 + Finger 5 only); both thumbs granted 13:51:06-12, right ring 'illegal fingerprint' - the offline finger was deleted before it uploaded and is lost. Earlier: HW3 left thumb added at A's menu ONLINE also survived a re-seat (Finger 4), and an offline scan arrived +101 s after reconnect.
- cases: ENR-13=partial, ENR-11=pass, STATUS-04=pass, R18=pass, RACE-17=pass
- observation: the vendor copy holds several fingers per member (re-seat delivered Finger 4 and Finger 5 for 100024); HW1's lost right ring is because our Enroll always uses finger slot 0, so a second enrolment overwrites the first - a code issue, not a vendor limit
- observation: offline scans delivered after reconnect: 2 of 2 this visit (+101 s, +52 s), reader time kept
- finding: a re-seat queued while a reader is offline deletes any fingerprint enrolled at that reader's menu during the outage (Delete User runs on reconnect before the new finger uploads); an automatic power-cut/restart repair must wait until the reader has reconnected and uploaded, or must not delete unknown fingers
- finding: our Enroll command always uses finger slot 0: enrolling a second finger for a member overwrites the first in the vendor copy, so a re-seat restores only the latest finger

### PH-26 Power pulled in the middle of a command, and mid-batch

- status: **fail**
- outcome: Reader B (fw 3.3.12): changes for HW1 (+33), HW2 (+34), HW4 (+35) drained 12:21:05 and collected 12:21:01-04 (ret=0) before the power pull, so no command was caught in flight. Power pulled ~12:21, B idle 12:22: users 100020/100022/100024 still listed in B's menu but ALL fingerprints our system manages gone - HW1 right ring (enrolled on B), HW3 left thumb, HW4 right pinky 'illegal fingerprint', still illegal a minute later; local ID 2 verified (12:23:23). Console 'resend' (plain push, no Delete User) restored none; the app's Re-send (re-seat) restored HW1 left index and HW3 left thumb (granted B 13:13:36/42); HW1's right ring not restored (vendor copy keeps one finger); HW4 tested with the wrong finger. Reader A (fw 3.0.15), extra test 13:24-13:30: all four granted before (13:24); power pulled 30 s; after restart only HW2's right middle (enrolled on A at 11:36 and never re-seated since) verified (13:26:35-51); HW1, HW3, HW4 (templates last delivered to A by a re-seat) 'illegal fingerprint'. App Re-send for HW1/3/4 then restored all three on A (granted 13:30:08/11/16). Neither reader sends any event when it powers up: no webhook delivery from B between 12:21 and 12:23:28 (Vercel log: only the ID 2 scan, received 1 stored 1), nothing stored for either boot.
- cases: FAIL-12=fail, STATUS-08=pass, RC-05=na
- observation: power cut on BOTH firmwares drops fingerprints delivered from the vendor copy (re-seat/unpark); on B even a finger enrolled on B was lost; on A a finger enrolled on A and never re-seated survived
- observation: no power-on signal: readers send no event at boot, so the webhook cannot trigger a repair; detection must come from elsewhere (vendor device status/last contact, or periodic verification)
- observation: the app's Re-send (re-seat) restores one finger per member on both readers within ~1 min; a second enrolled finger is lost
- finding: RELEASE BLOCKER: a power cut on a reader silently drops most members' fingerprints (every finger that reached that reader from the vendor copy, i.e. most fingers in a multi-reader gym; on fw 3.3.12 even fingers enrolled on it); members get 'illegal fingerprint' while the app says 'Can get in'; the reader sends nothing on boot and nothing repairs it automatically; only a per-member manual Re-send restores it
- finding: console 'resend' is not the app's re-seat (no Delete User first) and does not restore lost templates; runbook/console should call the re-seat
- finding: only one fingerprint per member survives a re-seat (vendor copy keeps one finger)
- finding: webhook token exposed in a transcript (Vercel runtime log line printed with its request path on 2026-10-10) - rotate ACCESS_CONTROL_WEBHOOK_TOKEN after the campaign

### PH-27 Enrolment races that need fingers

- status: **blocked**
- outcome: Not run on visit 2: out of time (VFT access ended 14:00 SLT; close-out started 13:20). Needs another physical visit.

### PH-28 A normal day and a morning surge, condensed

- status: **blocked**
- outcome: Not run on visit 2: out of time (VFT access ended 14:00 SLT; close-out started 13:20). Needs another physical visit.

### PH-29 Five-source reconciliation audit

- status: **blocked**
- outcome: Not run on visit 2: out of time (VFT access ended 14:00 SLT; close-out started 13:20). Needs another physical visit.

### PH-30 Visit close-out — run last on EVERY visit

- status: **pass**
- outcome: Visit 2 close-out (2026-10-10 ~13:35 SLT). Operator confirmed both reader clocks correct and both on Wi-Fi after the power-cut tests. HW Test 1-4 parked: cancelled, blocked true, held by none, finger YES kept in the vendor copy (subjects now HW1 100020, HW2 100023, HW3 100024, HW4 100022; due dates HW1 2026-11-12, HW2 2026-11-13, HW3 2027-04-28, HW4 2026-11-14). Dead jobs 6 (unchanged remote-day baseline). Real Titan subjects unchanged since 2026-10-03. Results synced; phase released.
- observation: visit 2 ran: PH-01, re-tests PH-04/06/07/15/19/21 (all pass), PH-24 partial, PH-25 partial, PH-26 fail (power cut, both readers), PH-31 verdict not ready; PH-27/28/29 not run (owner: desk-side items wait; power-cut gap prioritised)
- observation: owner decision: HW Test 1-10 stay parked
- observation: reminders: rotate the VFT account password and ACCESS_CONTROL_WEBHOOK_TOKEN (the token appeared again in a log line on 2026-10-10), re-register the webhook URL with VFT

### PH-31 Acceptance gates and the readiness verdict (last visit only)

- status: **fail**
- outcome: Final visit verdict (2026-10-10): NOT READY for a paying gym yet. Gates (newest result per task, both tracks): ACC-01 fail - pass PH-04/06/07/09/10/11/13/14/15/17/19/21/25, OB-02/03; refuted by PH-26 (power cut drops every managed fingerprint, no auto repair) and PH-24 (menu deletion undetected). ACC-03 fail pending re-run - PH-23 0 dup rows, AP-08/09, PH-14, LC-05 hold; XC-10 events-pull re-inserted scans, fixed by F-01 but not re-verified. ACC-06 fail pending - PH-12, PH-25, OB-04, XC-06 hold; XC-05 429 dead-letter and XC-03 reclaim refusal fixed by F-02/F-11, not re-verified; PH-26 needed a manual re-seat. ACC-07 fail pending - PH-08 (AMB-01), OB-04 hold; XC-03 (reboot maybe twice) and XC-04 fixed by F-10/F-11, not re-verified. ACC-08 fail - PH-15 and XC-02 pass; PH-26 power cut wiped fingerprints and HW1's second finger is lost permanently after re-seat. ACC-09 fail - PH-12/PH-16 alerts hold; PH-24 and PH-26 losses invisible (panel 'Can get in', no event), PH-03 unknown-finger refusals never arrive. ACC-11 partial - mismatches: enrol ret 6 = timed out (brief says success); no event 8 for remote opens; unknown-finger refusals not delivered; GetEventsbyDevSN re-delivers in UTC; vendor copy keeps one finger per member; clock-before-start refused as event 29 'expired'; readers show no user ID during enrolment. Visit-1 defects D1-D4 all re-tested PASS on hardware (PH-04/06/07/15/19/21). Owner decision: keep HW Test 1-10 parked (no deletion, D-15 not applicable). To reach ready: detect unplanned reader reboots/power loss and re-seat automatically; detect device-side template/user loss; re-run remote XC-03/04/05/06/10 and AP-02/07/08/09 on the fixed build; run PH-27/28/29.
- cases: ACC-01=fail, ACC-03=fail, ACC-06=fail, ACC-07=fail, ACC-08=fail, ACC-09=fail, ACC-11=partial
- observation: owner decision: keep HW Test 1-10 parked
- observation: reminder given: rotate the VFT account password (exposed 2026-09-22) and ACCESS_CONTROL_WEBHOOK_TOKEN (appeared in a setup transcript 2026-10-07), re-register the URL with VFT

# Part B. Visit 1 (2026-10-09), unchanged

Superseded where Part A re-tested: D1 to D4 are fixed (A.3); the "one finger per member" reading in Part B is corrected by V2-4 (our Enroll uses slot 0; the vendor copy holds several fingers).

Machine-readable. One section per topic; every claim cites a task id (PH-nn), a queue command id (#nnnnn) or a timestamp (Sri Lanka time, SLT, UTC+5:30). Source of truth: `backups/hw-session/results/physical/PH-*.json` (with history) and the two trackers listed under "Records". Generated 2026-10-09 from those records.

### 1. Metadata

| Key                   | Value                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| session               | hw-physical (agent `physical`, phase `physical`)                                                            |
| date                  | 2026-10-09, 13:36 to 18:50 SLT; re-sync 20:30 SLT                                                           |
| gym                   | Titan Fitness (`481599f6-5134-4152-83b2-6e2dd10e3018`), Enterprise, production                              |
| production deployment | `dpl_GuStfURk4KF8SEfFwwGEapcGfVJo`, commit `b5686e8`, contains fix commit `ef1df60`                         |
| console gate fix used | `4c922da` on the PR #103 branch (phase gate defect found at start)                                          |
| reader A              | serial `NYU7251900077` (replacement for `NYU7251900066`), firmware ZAM70-NF24HA-Ver3.0.15, IP 192.168.1.203 |
| reader B              | serial `NYU7254500734`, firmware ZAM70-NF24HA-Ver3.3.12, IP 192.168.1.33                                    |
| test members          | HW Test 1 to 4 = reader user ids 100015 to 100018, member ids #59 to #62, daily plan, 1 LKR                 |
| operator              | one person at VFT with menu access, clock change, cable pull; power pull not exercised                      |
| tasks                 | 31 in runbook; 24 run; fail 4, partial 7, pass 13; 7 not run (PH-24 to PH-29, PH-31)                        |

### 2. Summary

- Result counts (recorded tasks): 4 fail, 7 partial, 13 pass. Not run: 7.
- Four defects need a desk fix before the next visit (section 3). Two of them admit a member without consent or refuse the right member with no sign in the app.
- Core premises held: inclusive end date at the door, midnight enforced by the reader clock, offline reader still admits, cancel-and-rejoin needs no re-enrolment, lapsed renewal never admitted early (section 4).
- All band-3 tasks need someone at the readers, so a second physical visit is required (section 7).

### 3. Defects, most serious first

#### D1 [SERIOUS] A reader restart drops the fingerprint templates our system pushed.

- Tasks: PH-15
- Evidence: After Door Access > Restart on reader A (Device Reboot #70087, 16:57:08), HW1 (left index) and HW3 (left thumb), admitted at A at 16:50:48 and 16:55:39, were refused with "illegal fingerprint" from 16:58 to ~17:10. No event reached us; the panel still said "Can get in". Reader A user menu: 100015, 100016, 100017 listed with no fingerprint; 100018 (HW4, never on A before) had one. The operator's own pre-existing ID 2 still verified (17:01:48). A forced resend of HW1 to 4 (Update User + Finger N, Access Grant, Set Valid Time Period, all ret=0, 17:04) restored only HW4 (admitted 17:14:16). Cancel then reactivate of HW1 to 3 restored all three (granted 17:17:05, :07, :09).
- Desk action: Reconcile must detect template-less users on a restarted reader (device user list / FpCount) and re-add them with Delete User then add. Cancel+reactivate is a test workaround, not a production fix: it blocks the member at the door and rewrites status history.

#### D2 [HIGH (privacy)] Removing a fingerprint (consent withdrawal) does not remove it.

- Tasks: PH-19
- Evidence: Remove fingerprint on HW2 (toast "Fingerprint removed. Membership is unchanged."): Delete User 100016 ret=0 on A (#70337) and B (#70336); our record consent none, finger no. Scan at A: "illegal fingerprint". Then "Re-send to readers" sent Update User 100016 + Finger 0, Access Grant, Set Valid Time Period to both readers and the finger was admitted at A (event 3, 17:53:04, :06) with consent still none and our finger flag YES. Registering again: the sync before the enrolment restored the old template, Enroll #70374 ret=6, reader said "duplicate finger". The panel does warn "No consent recorded ... Ask them to confirm they are happy with it, or remove it below".
- Desk action: The vendor keeps a central copy; fromdev/Delete User does not delete it. Withdrawal needs a vendor-side template delete, and resend/registration must not re-install a withdrawn template.

#### D3 [SERIOUS] First scan after enrolment is refused ("invalid time period", event 23) in 4 of 5 enrolments.

- Tasks: PH-04, PH-06, PH-07
- Evidence: HW1 at A (15:09:46, :50, :56), HW3 at A (15:21:18, :20), HW2 at B (15:38:33), HW4 at B (15:54:09, :21), each despite Set Valid Time Period ret=0 delivered at 14:10 and a panel reading "Can get in". Each was fixed at once by "Re-send to readers" (HW1 15:13:51, HW3 15:23:28, HW2 15:41:29 at B). The exception, HW3 enrolled after withdraw + resend that included an Access Grant (16:00:20), was admitted at first scan. Hypothesis only: the enrolment resets the member window on the reader; create-members pushes carry no Access Grant.
- Desk action: The enrolment flow should push Access Grant and the window after the finger is taken; the panel must not say "Can get in" while the reader refuses.

#### D4 [MEDIUM] Panel enrolment timeout (~2 min 10 s) is far longer than the reader enrolment window (~10 s).

- Tasks: PH-21
- Evidence: Untouched Register on HW2: reader left enrol mode after ~10 s, Enroll #70441 ret=6, panel spinner ~2 min 10 s then "Not confirmed yet. If the fingerprint was taken, it is confirmed the first time the member uses the door - reopen this member to check. Otherwise start again". Operator asked for the panel timeout to be lowered to match the reader.
- Desk action: Lower the panel timeout; also correct brief section 7: enrol return 6 means window timed out, 0 means the finger was taken.

#### D5 [MEDIUM] One of two offline scans never reached us after reconnect.

- Tasks: PH-12
- Evidence: Reader A network pulled ~16:38. HW3 admitted offline at ~16:40 (step 3) and 16:42:38. The 16:42:38 scan arrived at 16:44:30 (112 s late, real reader time kept); the ~16:40 scan had no event by 16:48. The queued Access Block #70026 was NEVER SENT while offline and DONE ret=0 179 s after commit on reconnect.
- Desk action: Investigate offline event delivery (reader buffer, events-pull) for lost events.

#### Minor observations

- PH-04: member panel kept "Not confirmed yet" after the confirming granted scan until a full page reload.
- PH-16: Door Access card shows "Fingerprints 0" and "Add this reader's capacity in settings to see how full it is" for reader A while it holds enrolled templates; vendor FpCount stays null for A (0 for B).
- PH-05: Re-send toast reads "readers updated"; runbook expects "Queued - the readers will pick this up shortly".
- PH-17: a reader clock set before the window start refuses as event 29 "membership expired" (device wording), not a not-yet-valid code.
- PH-03/PH-09: refusals of unknown fingers never reach us; refusals of known members do (event 23, ~3 s).
- PH-08: fingerprint enrolled after a withdraw + resend that included an Access Grant was not refused (see D3 hypothesis).
- PH-23 (operator note, useful for design): ~29 scans at ~1/s all admitted, each stored once, no "interval too short" refusal, duplicate-row query (reader+subject+instant, 15 min) returned 0 rows.
- Runbook finger names did not match the real fingers: HW1 left index, HW2 left middle, HW3 left thumb (left ring on A menu), HW4 left pinky; the operator's own right index is the pre-existing user ID 2.
- Reader B holds two foreign card users (ids ending 6 and 7) from other testers; reader A holds none.

### 4. What held (premises confirmed against real hardware)

- End date is inclusive at the door: HW1 with EndDate = today admitted 16:16:24 (PH-10, TIME-04, ACCESS-03).
- Midnight enforced by the reader clock: scans at reader time 23:59:45 to 23:59:57 admitted, first scan 00:00:01 refused event 29 (PH-17, TIME-01..03, ACCESS-04/05, R17).
- Clock forward 7.7 h refused (event 29), corrected clock admitted again; cloud did not resync the clock in 2 min (PH-11).
- Offline reader A admitted a valid member; queued block landed on reconnect (PH-12: FAIL-13, DEVICE-08, STATUS-05, RACE-16, REAL-03, OBS-07).
- Lapse and renewal: Access Block with no validity period, refused until Access Grant + Set Valid Time Period transmitted 16:13:50, admitted from 16:13:50 (PH-09).
- Cancel then rejoin without re-enrolling: HW1 granted at A 16:50:48 and B 16:50:47 (PH-13); HW3 likewise (PH-14).
- Cancel racing an enrolment ends cancelled, blocked, Delete User after Enroll (PH-14, PH-20).
- Future start: Access Block only, no validity period pushed; refused even with the reader clock moved to the start day (PH-17). A block survived a directly pushed window (PH-18, A8 = block-survives-window).
- Drift warning in plain words at +3597 s skew; cleared after correction (PH-16: STATUS-10, TIME-08/09, ACCESS-15).
- Consent written before the enrol command (PH-04: HW1 consent 15:04:00, Enroll User 100015 #69883 committed 15:04:01).

### 5. Task-by-task record

Status, outcome, case verdicts, observations and findings are copied from the records.

| Task                | Title                                                        | Status  | Cases                                                                                                                                             |
| ------------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-01               | Visit start: phase, deployment, members, a live callback     | partial | -                                                                                                                                                 |
| PH-02               | Reader identity and inventory: label, menu, user list        | pass    | P0.5=pass, P0.6=pass                                                                                                                              |
| PH-03               | An unknown finger at Device A — does a refused scan reach us | partial | VEND-20=partial                                                                                                                                   |
| PH-04               | Enrol HW Test 1 on Device A through the panel, then the firs | partial | CONSENT-02=pass, UI-04=pass, ENR-01=pass, DATA-01=partial, OBS-01=pass                                                                            |
| PH-05               | HW Test 1 at Device B — first with no help, then after a for | pass    | ENR-03=pass                                                                                                                                       |
| PH-06               | Enrol HW Test 2 on Device B, then try Device A               | fail    | ENR-02=fail, ENR-12=partial                                                                                                                       |
| PH-07               | Same member on both readers at the same instant              | fail    | ENR-04=fail, RACE-01=pass, R1=partial, DATA-07=partial                                                                                            |
| PH-08               | Enrolment accepted, performed — and we were told it failed   | pass    | AMB-01=pass, ENR-09=pass                                                                                                                          |
| PH-09               | Lapse HW Test 1, then renew while they keep trying the door  | pass    | RACE-08=pass, R5=pass                                                                                                                             |
| PH-10               | End date = today: a paid-up member must get in on their last | pass    | TIME-04=pass, ACCESS-03=pass                                                                                                                      |
| PH-11               | Move Device A's clock past midnight: the window must end     | pass    | TIME-05=pass, ACCESS-10=pass, FAIL-17=pass                                                                                                        |
| PH-12               | Unplug Device A's network: the door must keep working        | partial | FAIL-13=pass, DEVICE-08=pass, STATUS-05=pass, RACE-16=pass, REAL-03=pass, OBS-07=pass, DATA-06=partial                                            |
| PH-13               | Cancel, then rejoin — without touching the scanner again     | pass    | ENR-21=pass, ENR-22=pass, ENR-29=pass, ENR-30=pass, ENR-32=pass, DATA-08=pass                                                                     |
| PH-14               | Enrol on A while the member is being cancelled               | pass    | RACE-03=pass, R3=pass                                                                                                                             |
| PH-15               | Restart Device A from the Door Access page, then scan        | fail    | -                                                                                                                                                 |
| PH-16               | Clock skew: one minute, one hour, and the drift warning      | pass    | STATUS-10=pass, TIME-08=pass, TIME-09=pass, ACCESS-15=pass                                                                                        |
| PH-17               | The midnight boundary scanned on both sides; a future start; | pass    | TIME-01=pass, TIME-02=pass, TIME-03=pass, TIME-06=pass, ACCESS-04=pass, ACCESS-05=pass, R17=pass, RACE-18=pass, FAIL-18=pass                      |
| PH-18               | Block, then a validity period behind our back (A-8)          | pass    | ACCESS-07=pass                                                                                                                                    |
| PH-19               | Remove a fingerprint: is it really gone?                     | fail    | CONSENT-06=fail                                                                                                                                   |
| PH-20               | Consent withdrawn while an enrolment is in progress          | pass    | CONSENT-05=pass, RACE-09=pass, R7=pass, DATA-10=pass                                                                                              |
| PH-21               | Enrolment interrupted halfway, and a finger taken after the  | partial | ENR-08=fail, OBS-02=pass, DATA-02=partial                                                                                                         |
| PH-22               | A fingerprint enrolled at the reader's own menu; re-enrollin | partial | ENR-07=partial                                                                                                                                    |
| PH-23               | Scans under pressure: rapid, simultaneous, during a sync, du | partial | DATA-05=pass, R4=pass, RACE-05=partial, RACE-14=partial, WH-13=partial, WH-14=blocked, WH-15=partial, ENR-19=blocked, R8=blocked, RACE-06=blocked |
| PH-30               | Visit close-out — run last on EVERY visit                    | pass    | -                                                                                                                                                 |
| PH-24..PH-29, PH-31 | band 3 and final gate                                        | not run | -                                                                                                                                                 |

#### PH-01 Visit start: phase, deployment, members, a live callback

- status: **partial**
- outcome: Phase physical (after gate fix 4c922da). Prod dpl_GuStfURk4KF8SEfFwwGEapcGfVJo @ b5686e8 contains fix ef1df60. HW Test 1-4 created (subjects 100015-18), active, due 2027-04-27, A+B, all commands DONE ret=0 on both readers. Callback NOT proven: per operator, remote open (event 8) replaced by an unknown-finger scan on each reader (reader said 'failed to verify, illegal fingerprint'); no event stored and no 'Access webhook delivery' log line within 10+ min. Earlier granted scans (13:50 SLT, both readers) did arrive, so callback worked earlier today. Callback proof deferred to the first granted scan (PH-04).
- observation: callback=unproven-refused-scan-sent-nothing latency=n/a
- observation: dead jobs baseline 6 (remote-day stub tests HW5/6/7/8/10, 13:17-13:18 SLT), accepted by operator; any increase is physical's
- observation: readers show Not responding at snapshot (no heartbeat, expected)
- observation: operator disclaimer: VFT sends no event 8 for remote opens; steps 12-14 not run

#### PH-02 Reader identity and inventory: label, menu, user list

- status: **pass**
- outcome: Serials agree label=registered=vendor: A NYU7251900077 (replacement; task text says ...066), B NYU7254500734. Baseline user lists: A 6 users = fingerprint 1,2 + HW subjects 100015-18; B 8 users = fingerprint 1,2 + HW subjects 100015-18 + pre-existing card users ...6 and ...7 (other testers', unknown to our records).
- cases: P0.5=pass, P0.6=pass
- observation: A: serial NYU7251900077 fw ZAM70-NF24HA-Ver3.0.15 ip 192.168.1.203 tz UTC+5:30 clock accurate (operator, to the minute)
- observation: B: serial NYU7254500734 fw ZAM70-NF24HA-Ver3.3.12 ip 192.168.1.33 tz UTC+5:30 clock accurate (operator, to the minute)
- observation: firmware differs between readers (3.0.15 vs 3.3.12); vendor name of A is Dev1 vs our Device A (test)
- observation: B holds two foreign card users (…6, …7), A none; shared test devices

#### PH-03 An unknown finger at Device A — does a refused scan reach us

- status: **partial**
- outcome: Right thumb at A 14:44: reader said 'failed to verify'. No event stored after 300s+ and no 'Access webhook' log line (Vercel, one timeout then clean retry); Door Access Refusals shows 'No activity of this kind'. Same for 3 earlier refused scans (unknown finger A and B; HW Test 2 right middle at A, reader 'failed to verify'). D-5 holds: panel for HW Test 2 shows 'Can get in', 'Access is active' 09 Oct 2026-27 Apr 2027, Fingerprint 'Not registered'. VEND-20 provisional: refusals do not reach us, but PH-01 did not prove the callback live today (last granted scans 13:50 SLT arrived), so not a clean FAIL; re-check against the first granted scan at PH-04.
- cases: VEND-20=partial
- observation: A1=refusals-do-not-arrive (provisional, callback not proven live this visit)
- observation: reader screen text for unknown finger: failed to verify / illegal fingerprint
- observation: Door Access is a section inside the member modal, not a separate button

#### PH-04 Enrol HW Test 1 on Device A through the panel, then the firs

- status: **partial**
- outcome: Run on HW Test 1 (finger added by hand at the reader menu after the enrolment window timed out) and repeated on HW Test 3 (operator's choice, fresh member) for a clean panel-led enrolment. HW3: consent 15:19:57 SLT, then Enroll User 100017 Finger 0 DONE ret=0 at once; operator: reader entered enrolment mode when Register was clicked and took the finger (ENR-01 shown, A-4). Panel text and disabled-until-consent as reported. BUT the first scans after each enrolment were DENIED (event 23, verify 1, reader 'invalid time period') - HW1 x3 at 15:09, HW3 x2 at 15:21 - despite Set Valid Time Period 20261009-20270427 DONE at 14:10 and a panel saying 'Can get in'. After resend (Update User, Access Grant, Set Valid Time Period; ret=0) both were GRANTED event 3 verify 1 (HW1 15:13:51, HW3 15:23:28, stored +3-4s). Finger flag YES for both; HW1 badge 'Registered' after full reload.
- cases: CONSENT-02=pass, UI-04=pass, ENR-01=pass, DATA-01=partial, OBS-01=pass
- observation: callback=live latency=3s
- observation: Enroll return: HW1 ret=6 (timed out, finger entered at menu), HW3 ret=0 (clean); vendor FpCount A=null B=0 after enrolment
- observation: consent before enrol command: HW1 15:04:00 vs commit 15:04:01; HW3 consent 15:19:57
- finding: DEFECT (owner wants it fixed): a fingerprint enrolment (panel-led on HW3, menu-added on HW1) leaves the member refused at the reader with 'invalid time period' (event 23) although our window command was DONE earlier; our panel still says 'Can get in', no repair job is queued, and only a manual Re-send to readers (Update User, Access Grant, Set Valid Time Period) restores entry. Reproduced 2/2. Likely the enrol clears the reader's validity period (A-8 family) - the enrol flow should push the window after the enrolment and the panel must not say Can get in while the reader refuses
- finding: member panel keeps 'Not confirmed yet' after the confirming granted scan until a full page reload
- finding: Door Access Recent activity 'All' showed only the granted row for HW Test 1, check whether denied event-23 rows (15:09) appear (operator did not report the Refusals tab)

#### PH-05 HW Test 1 at Device B — first with no help, then after a for

- status: **pass**
- outcome: HW Test 1 admitted at reader B after re-send: granted event 3 verify 1 at 15:29:51 (after my console resend at 15:11) and again 15:33:19 after the panel 'Re-send to readers' (toast 'readers updated'). The panel re-send put Update User, Update User Finger 6, Access Grant, Set Valid Time Period (all DONE ret=0) on BOTH readers (A #69908-14, B #69910-15). A first operator B-test was actually done on A (subject 2, operator's own pre-existing finger); not counted. The 'no help' baseline at B could not be measured: my console resend at 15:11 had already pushed HW1, Finger 6 included, to B.
- cases: ENR-03=pass
- observation: templatePropagation=unmeasured (HW1 had already been resent to B; use a fresh member enrolled on A and scanned at B before any resend)
- observation: panel toast text 'readers updated', task expects 'Queued - the readers will pick this up shortly'
- observation: reader B delivery latency 7s and 12s (A 3-4s)
- finding: Re-send to readers toast reads 'readers updated' instead of the queued wording: cosmetic or the deployed copy differs from the runbook

#### PH-06 Enrol HW Test 2 on Device B, then try Device A

- status: **fail**
- outcome: HW Test 2 enrolled on B with a real finger (operator: B showed the enrolment screen and accepted it; Enroll User 100016 Finger 0 DONE ret=0 at ~15:35, flag YES). FAIL-if holds: first scan at B 15:38:33 was DENIED event 23 (verify 1, 'invalid time period') - the same defect as HW1/HW3, 3 of 3 enrolments. After the panel 'Re-send to readers' (Update User, Update User Finger 0, Access Grant, Set Valid Time Period, DONE ret=0 on A and B) B admitted event 3 at 15:41:29. ENR-12: before any resend A refused ('illegal fingerprint', no event stored); right after the resend (15:41) A still refused; at 15:43:49 A admitted (event 3, stored +3s). So the fingerprint did NOT reach A on its own in ~5 min; it arrived within ~3 min of the resend (resend vs vendor lag not separable).
- cases: ENR-02=fail, ENR-12=partial
- observation: templatePropagation=manual (not within 5 min unaided; arrived 1-3 min after resend)
- observation: invalid time period after enrolment: 3/3 (HW1 A, HW3 A, HW2 B), cleared each time by Re-send to readers
- observation: B delivery latency 5-9s; A 3s
- finding: HW Test 2 enrolled on B is refused (event 23, invalid time period) until Re-send to readers - same as PH-04; the enrolment flow must push the window after the finger is taken
- finding: template of a finger enrolled on B reaches A only after a re-send plus 1-3 min; no automatic distribution in 5 min

#### PH-07 Same member on both readers at the same instant

- status: **fail**
- outcome: race enrol-both for HW Test 4 (consent confirmed by operator, written once 10:23:03Z) settled in 3.3s, both Enroll User 100018 Finger 0 dispatched. Operator used left pinky (not left middle), pressed B first: B DONE ret=0 and accepted the finger; A DONE ret=6 and timed out (operator cannot press two readers at once, ~same as HW1's timeout). No reader stuck, one consent, held A+B. FAIL-if holds: first scans at B (15:54:09 and 15:54:21, stored +5-6s) DENIED event 23 'invalid time period' - HW4 refused at the reader that enrolled them (4th of 4 enrolments). Scan at A 15:54: 'failed to verify, illegal fingerprint', no event (A has no template; none arrived unaided in ~1 min). Finger flag YES after the B scans. No resend done.
- cases: ENR-04=fail, RACE-01=pass, R1=partial, DATA-07=partial
- observation: Enroll return code: 0 = finger taken, 6 = reader window timed out (HW1 A, HW4 A); runbook says enrol gives 6
- observation: invalid time period after enrolment 4/4
- observation: a human can only finish one enrolment of a simultaneous pair: A timed out, so a true both-readers-at-once finger race was not exercised
- finding: Enroll return code 6 means the enrolment window timed out, not success (HW1 and HW4 on A both returned 6 and took no finger); brief section 7 says 'enrol gives 6' - the success/timeout reading is inverted

#### PH-08 Enrolment accepted, performed — and we were told it failed

- status: **pass**
- outcome: Precondition adapted with operator approval: HW Test 3 already had a finger (PH-04), so withdrawn (Delete User on A+B, flag and consent cleared) and resent (Update User, Finger 0, Access Grant, Set Valid Time Period; ret=0) before the run. ambiguous enrol on A with consent: 'vendor really answered {status:applied}', then 'Use case THREW: Simulated timeout after the vendor accepted the command'. Enroll User 100017 Finger 0 SENT NO REPLY then DONE ret=0 21s later (operator pressed left ring finger). First scan at A 16:00:20: GRANTED event 3 verify 1, stored +2s. Finger flag YES, consent 15:59, panel badge 'Registered' after reload, 'Can get in'. No manual repair.
- cases: AMB-01=pass, ENR-09=pass
- observation: this enrolment did NOT show 'invalid time period' (first scan granted) - unlike the other 4; difference: HW3 had had an Access Grant pushed (via resend) before the enrol, the first-time create-members pushes had none. Hypothesis only
- observation: operator finger: left ring (task says left index)
- observation: withdraw + resend does not return the finger to the reader as far as flagged (flag NO), enrol window still opened and accepted
- finding: hypothesis for the invalid-time-period defect: it appears when a member was created by create-members/registration (Update User + Set Valid Time Period, no Access Grant) and enrolled afterwards; HW3 enrolled after a resend that included Access Grant was granted at first scan

#### PH-09 Lapse HW Test 1, then renew while they keep trying the door

- status: **pass**
- outcome: HW1 due set to yesterday (2026-10-08) and pushed: Access Block User 100015 DONE ret=0 on A (#69958) and B (#69959), NO Set Valid Time Period with it. Operator discovered HW1's finger is LEFT INDEX (right index = pre-existing ID 2); refused at A 3x (16:08:03, 16:08:47, 16:09:59, event 23, reader 'invalid time period'), all reached us stored +3-5s: A1known=arrives. Panel: 'Cannot get in / Membership payment is overdue / Fingerprint Registered', no vendor code. Scanning every ~4s while pay ran (16:13:46-51, due 2026-10-10): Access Grant #69962 + Set Valid Time Period EndTime 20261010 #69964 committed 16:13:49, transmitted 16:13:50 DONE ret=0. Refusals 16:13:38, :41, :46 (event 23), first admission 16:13:50 (event 3 verify 1), none before the transmit. No error, nothing stuck. Operator reports refused then accepted, both at 16:13.
- cases: RACE-08=pass, R5=pass
- observation: A1known=arrives
- observation: HW1 renewed and left at due 2026-10-10 (daily plan +1d), active, unblocked
- observation: only one admission event stored (task asks for two consecutive)

#### PH-10 End date = today: a paid-up member must get in on their last

- status: **pass**
- outcome: HW1 due set to today (2026-10-09), pushed: Set Valid Time Period User 100015 StartTime 20261009 EndTime 20261009 DONE ret=0 on A (#69969). Operator scanned the LEFT INDEX (HW1's actual finger) at A 16:16: 'successfully verified'; event 3 granted verify 1 reader clock 16:16:24, stored 16:16:26. Panel: 'Can get in / Access is active / The readers will let this member in from 09 Oct 2026 until 09 Oct 2026'. EndDate is inclusive at the door and our panel agrees.
- cases: TIME-04=pass, ACCESS-03=pass
- observation: A-3 EndDate inclusive: confirmed at reader A, scan at 16:16 on the end date
- observation: HW1 left at due TODAY for PH-11; finger is left index

#### PH-11 Move Device A's clock past midnight: the window must end

- status: **pass**
- outcome: Reader A clock set to 10 Oct 2026 00:01 (tomorrow). HW1's left-index scans were refused as event 29 'membership expired' (x2, reader clock 2026-10-10 00:01:36 and 00:01:38, stored 16:19:02/04 SLT, reader-stored +27753s) - expiry enforced from the reader's own clock, nothing from us. Operator restored the clock; no cloud resync observed after 2 min; next scan 16:26:44 reader clock correct (skew -3s after delivery) GRANTED event 3 verify 1. Restore: HW1 due +200 (2027-04-27) pushed, Set Valid Time Period EndTime 20270427 DONE ret=0 on A.
- cases: TIME-05=pass, ACCESS-10=pass, FAIL-17=pass
- observation: clock jump forward refused at once (event 29) and reversed when corrected; jumped scan reader time 2026-10-10 00:01:36
- observation: cloud did not resync the clock within 2 min
- observation: operator used left index (HW1's finger), not right index

#### PH-12 Unplug Device A's network: the door must keep working

- status: **partial**
- outcome: Pre-step (operator-approved): resend HW3 to put its fingerprint on B (left thumb verified on B 16:35:13/16:36:26; HW3's finger is LEFT THUMB, not left index/ring). A's cable pulled ~16:38, power on: HW3 left thumb ADMITTED at offline A (FAIL-13 core premise holds). HW3 lapsed (due 2026-10-08) and pushed 16:41: push ok, 2 commands queued; B Access Block #70027 DONE ret=0 in 3s; A #70026 NEVER SENT. Offline A still admitted HW3 (16:42:38); B refused (event 23 invalid time period, 16:42:54). Door Access alert: '1 reader not responding / Device A (test). The doors still let in the members they already know about - but cancellations and renewals will not reach them until they are back.' Cable back 16:44: A Access Block #70026 DONE ret=0, 179s after commit; A then refused HW3 (event 23 16:44:41). Offline scan 16:42:38 arrived LATE (stored 16:44:30, +112s, real reader time kept); the earlier offline scan from step 3 (~16:40, admitted per operator) NEVER arrived (rechecked 16:48). Restore: HW3 due +200, Access Grant + Set Valid Time Period EndTime 20270427 DONE ret=0 on A and B, left thumb granted on A 16:47:20 and B 16:47:22.
- cases: FAIL-13=pass, DEVICE-08=pass, STATUS-05=pass, RACE-16=pass, REAL-03=pass, OBS-07=pass, DATA-06=partial
- observation: offline scans: 1 of 2 delivered after reconnect, with real reader time; the other lost or still unsent
- observation: offline queue time to land after reconnect: 179s after commit (reconnect 16:44, block committed 16:41)
- finding: an offline scan made before the other offline scan never reached us after reconnect (admit at ~16:40, nothing stored by 16:48); one of two offline scans lost, DATA-06 partial

#### PH-13 Cancel, then rejoin — without touching the scanner again

- status: **pass**
- outcome: HW1 cancelled: Access Block #70035/#70039 and Delete User (template revoke) DONE ret=0 on A and B, held by none, blocked. Operator (HW1's real finger = LEFT INDEX, not right index) refused at A and at B ('failed to verify', no event stored since the user was deleted). Reactivated (no text, no payment, no re-enrolment): Update User, Update User Finger 6, Access Grant, Set Valid Time Period EndTime 20270427 DONE ret=0 on A and B (pushed twice, two identical sets per reader). Scans: A event 3 granted 16:50:48, B event 3 granted 16:50:47 (verify 1), without touching the enrol menu. Finger flag YES throughout, held A+B, active, due 2027-04-27, dead jobs still 6.
- cases: ENR-21=pass, ENR-22=pass, ENR-29=pass, ENR-30=pass, ENR-32=pass, DATA-08=pass
- observation: central copy restores the template: cancel/rejoin needs no re-enrolment (Finger 6 sent from vendor)
- observation: reactivate pushed two identical command sets per reader (reactivate + its push)

#### PH-14 Enrol on A while the member is being cancelled

- status: **pass**
- outcome: race enrol-vs-cancel on HW3 (consent written 10:29:29Z, operator confirmed; settled 3.8s): final state cancelled, blocked, held by none. Queue on A: Set Valid Time Period, Access Block #70062 and Enroll User 100017 #70063 SENT NO REPLY, then Delete User #70065/#70070 NEVER SENT; all DONE at +12s with Enroll ret=6 (window timed out, no finger pressed) and both Deletes AFTER the Enroll. B: Delete, Block, Delete DONE ret=0. Operator scans left thumb at A and at B: failed to verify on both (no event). Restore: reactivate HW3 (Update User Finger 0, Access Grant, Set Valid Time Period EndTime 20270427 DONE ret=0 on A and B); left thumb then admitted at A and at B without re-enrolling (second central-copy observation).
- cases: RACE-03=pass, R3=pass
- observation: central copy restores HW3 template after cancel+rejoin too, without re-enrolling (2nd observation after HW1)
- observation: HW3 finger is LEFT THUMB

#### PH-15 Restart Device A from the Door Access page, then scan

- status: **fail**
- outcome: Panel Restart of Device A (back at idle; Device Reboot DONE ret=0 16:57:08; toast not reported). HW Test 3 substituted for HW4. After the restart HW1 (left index) and HW3 (left thumb), admitted at A minutes earlier, were refused 'illegal fingerprint' (16:58, 17:01, 17:06, ~17:10); operator's own pre-existing ID 2 still verified (17:01:48). Reader A user menu: users 100015/16/17 still listed but with NO fingerprint, 100018 (HW4, enrolled on B only) HAS a fingerprint and was admitted at A 17:14:16 (left pinky). Forced resend of HW1-4 (DONE ret=0) restored only HW4. Repair: cancel then reactivate HW1,2,3 (operator-approved) re-delivered the templates: HW1, HW3, HW2 all granted at A 17:17:05/:07/:09 without re-enrolling. Final: HW1-4 active, due 2027-04-27, held A+B, finger YES.
- observation: restart drops templates for users A already held; users stay listed
- observation: HW4 template (never on A) delivered by a plain resend; templates A held before the restart are not re-sent by a resend, only by cancel(Delete User)+reactivate
- observation: operator asked whether cancel+reactivate can be a permanent production fix: no - blocks the member at the door, rewrites status/billing history, invisible symptom; fix belongs in reconcile (detect missing templates, delete-then-add)
- finding: SERIOUS: after Door Access > Restart a reader keeps its users but loses the fingerprint templates our system pushed; members get 'illegal fingerprint' while the panel still says Can get in, no event, no alert. A forced resend (Update User Finger N, Access Grant, Set Valid Time Period) does not restore them; only Delete User then re-add (cancel+reactivate) did. Desk fix: reconcile must detect template-less users on a restarted reader (device-side user list/FpCount) and re-add them with a delete-then-add, and the restart button should warn or queue the repair

#### PH-16 Clock skew: one minute, one hour, and the drift warning

- status: **pass**
- outcome: Clock 1 min fast: reader 17:21:03, HW1 (left index; task says right index) admitted event 3, skew +106s (inside the +-120s band, no alarm). Clock 1 hour fast: reader 18:21:03, admitted, skew +3597s; snapshot Reader A Skew 3597s. Door Access card for Device A: 'This reader's clock is wrong. It decides who gets in from its own clock, so memberships may end on the wrong day. Ask your installer to correct the time.' (no separate top alert-strip text reported). Clock corrected 17:23: admitted event 3, skew -2s, warning gone after reload.
- cases: STATUS-10=pass, TIME-08=pass, TIME-09=pass, ACCESS-15=pass
- observation: skew +106s at nominal 1 min; +3597s at 1 hour; -2s corrected
- observation: Reader A clock restored to correct time (verified by scan 17:23:23)
- observation: Door Access card for Device A shows 'Fingerprints 0' and 'Add this reader's capacity in settings to see how full it is' although 4 members hold fingerprints on A (template count only moves after an eviction run, per brief; operator asked for a note)
- finding: Device card shows Fingerprints 0 while A holds enrolled templates for HW1-4 and the operator's own users; vendor FpCount stays null for A

#### PH-17 The midnight boundary scanned on both sides; a future start;

- status: **pass**
- outcome: Midnight on A (HW1 left index, window EndTime 20261009): six scans admitted at reader 23:59:45-23:59:57, first refusal 00:00:01 event 29 'membership expired' (stored +23557s), none admitted after. End date tomorrow (EndTime 20261010, pushed): admitted at reader 2026-10-10 00:02:01. Future start: HW2 start tomorrow/due +30 pushed to B as Access Block #70268 only, NO Set Valid Time Period; scan refused (reader 'invalid time period', event 23 17:32:02); B clock set to 10 Oct 09:00 still refused (event 23, no window). HW2 made current (start 2026-09-09, due 2027-04-27): Access Grant + Set Valid Time Period DONE ret=0, admitted event 3 at 17:35:48. B clock set back to 1 Aug 2026: refused twice, event 29 'membership expired' at reader 2026-08-01 12:00:08/:11 (device wording, not 'not yet valid'); clock corrected 17:39: admitted again 17:39:09. Both reader clocks restored (A 17:31, B 17:39, verified by scans); HW1 due +200 and pushed.
- cases: TIME-01=pass, TIME-02=pass, TIME-03=pass, TIME-06=pass, ACCESS-04=pass, ACCESS-05=pass, R17=pass, RACE-18=pass, FAIL-18=pass
- observation: reader wording for clock before window start is 'expired user' (event 29), not a not-yet-valid code
- observation: fingers: HW1 left index (not right index), HW2 left middle (not right middle)

#### PH-18 Block, then a validity period behind our back (A-8)

- status: **pass**
- outcome: HW2 suspended (valid dates 2027-04-27): B got Access Block #70316 only, no validity command; scan refused (failed to verify, invalid time period). Direct window via vendor validperiod 20261009-20261108 (guard bypassed, #70325 DONE ret=0): scan 17:43 STILL refused, events 23 at 17:43:12/:16. Restore: reactivate HW2 (Access Grant #70327 + Set Valid Time Period 20260909-20270427 #70329 DONE ret=0): admitted at B 17:44.
- cases: ACCESS-07=pass
- observation: A8=block-survives-window (on this reader/firmware 3.3.12 the block held after a direct validity write)
- observation: operator used left middle for HW2

#### PH-19 Remove a fingerprint: is it really gone?

- status: **fail**
- outcome: Remove fingerprint on HW2 (toast 'Fingerprint removed. Membership is unchanged.', confirm modal explains consent withdrawal): Delete User 100016 DONE ret=0 on A (#70337) and B (#70336); snapshot consent none, finger no, status active. Scan at A with the left middle: 'failed to verify, illegal fingerprint' (no event). Panel Re-send to readers (toast 'readers updated') sent Update User 100016 Finger 0, Access Grant, Set Valid Time Period to BOTH readers, and the removed finger was RECOGNISED again at A (granted event 3 at 17:53:04/:06) with our consent still none and the finger flag YES. KEY FAIL: withdrawal is not real - the vendor's central copy re-installs the template on any later sync, without consent. The panel does show 'No consent recorded / This member has a fingerprint on the reader but no record of them agreeing to it ... Ask them to confirm they are happy with it, or remove it below'. Second removal (Delete User #70369 A, #70367 B). Then Register again on A: the pre-enrol sync restored the old Finger 0 again, so the enrolment of the same finger (Enroll User 100016 #70374) returned ret=6 and the reader said 'duplicate finger'; consent 17:58 recorded; the scan of the left middle at A 18:01:20 was GRANTED and the finger flag went YES, so HW2 ended with a fresh consent over the old restored template; held by A only (B not re-sent).
- cases: CONSENT-06=fail
- observation: operator: confirmation modal on Remove fingerprint resets the consent box; text 'This also withdraws their consent, so they will be asked again before any new fingerprint is recorded. They will need to scan their finger again...' - but the old template returns on resend
- observation: HW2 finger is LEFT MIDDLE; right middle not used
- observation: HW2 now held by A only after the second removal and re-registration; B needs a resend before PH-23
- finding: HIGH (privacy): Remove fingerprint (consent withdrawal) deletes the user from the readers but the vendor's central copy keeps the template; the next Re-send to readers, or any registration sync, puts it back (Update User with Finger N) and the member is admitted without consent; the app only warns 'No consent recorded'. Withdrawal needs a vendor-side template delete, not just Delete User/fromdev
- finding: re-registering a member whose fingerprint was removed fails with 'duplicate finger' on the reader, because the sync before the enrol restores the old template

#### PH-20 Consent withdrawn while an enrolment is in progress

- status: **pass**
- outcome: Run twice. Attempt 1: Register on A, reader timed out (Enroll ret=6) before the operator pressed; withdraw (18:03:52) landed, then a second Register enrolled the right ring (Enroll ret=0, consent 18:04) so the race was not exercised. Attempt 2 (run properly): Register clicked, withdraw at 18:08:53 while the reader waited; queue on A: Enroll #70398 ret=5, #70399 ret=0, #70401 ret=5 (duplicate finger: right ring already stored), then Delete User #70404 ret=0 AFTER the last Enroll; B Delete User #70403. Final snapshot: consent none, Held by none, finger no, status active. Left index scan at A: 'illegal fingerprint', no event. No template survived a withdrawn consent. Restore: Register again (consent 18:11) - the pre-enrol sync put the old left-index template back (Update User Finger 0/6) and Enroll #70413 ret=6 reported duplicate finger; the scan at 18:12:12 was granted event 3 and the flag went YES, panel updated itself.
- cases: CONSENT-05=pass, RACE-09=pass, R7=pass, DATA-10=pass
- observation: in-flight enrolment could not take a new template (duplicate finger), so the withdraw-vs-capture race was only exercised at command level
- observation: Delete User landed after every Enroll; consent null and no template at the end
- observation: HW1 held by A only after the restore (B not re-sent); finger left index; right ring also stored on A

#### PH-21 Enrolment interrupted halfway, and a finger taken after the

- status: **partial**
- outcome: Registration on A: first attempt the reader prompted and a SINGLE right-middle press enrolled it (Enroll ret=0), so no halfway interruption occurred; scan 18:15 granted (not 'not registered'), because the pre-enrol sync restored a template and the enrolment completed. Walk-away attempt: operator did not touch the reader; reader left enrol mode after ~10s, Enroll ret=6 (timed out), consent recorded 18:17, flag no, panel spinner ~2m10s then 'Not confirmed yet. If the fingerprint was taken, it is confirmed the first time the member uses the door - reopen this member to check. Otherwise start again' (not worded as a failure). After that interrupted attempt the member was STILL recognised: right middle admitted/known, left middle 'illegal fingerprint' - the central copy had re-installed the previous template, so ENR-08 'no usable template' does not hold. H-7: Register again, press right middle, then a scan at 18:22 verified and the panel showed 'Registered' (flag set only by that scan).
- cases: ENR-08=fail, OBS-02=pass, DATA-02=partial
- observation: device enrolment window ~10s vs panel timeout ~2m10s: the panel keeps spinning long after the reader gave up
- observation: H-7: first scan confirms the finger after the dialog timed out; panel 'Registered' only after the scan
- finding: the panel's enrolment spinner runs ~2m10s but the reader leaves enrolment mode after ~10s; the timeout should match the reader window (operator request)
- finding: an interrupted enrolment leaves a usable template because the pre-enrol sync restores the central copy: a member who walks away is not 'not registered'; their finger is still admitted

#### PH-22 A fingerprint enrolled at the reader's own menu; re-enrollin

- status: **partial**
- outcome: A-5: HW3 Remove fingerprint + Re-send to readers (toast 'readers updated') brought its old template back; left thumb scan at A 18:25:49 granted event 3, our flag YES with consent none, panel 'Registered' + 'No consent recorded: This member has a fingerprint on the reader but no record of them agreeing to it - so it was most likely registered at the reader itself rather than here. Ask them to confirm they are happy with it, or remove it below.' (menu enrolment skipped as the task allows: template already present). ENR-07: console enrol for HW1 on A (consent on file, 18:11) fired before the operator was ready, reader never prompted, Enroll User 100015 DONE ret=6 (timed out); left index scan 18:27:51 granted: one working template, one logical state, but the overwrite/already-enrolled behaviour was NOT observed. Restore: HW3 Remove fingerprint, tick consent, Register on A: reader said duplicate finger, scan with left thumb verified, panel Registered with consent.
- cases: ENR-07=partial
- observation: A-5 surfaced via the first scan; panel warning present and well worded
- observation: HW1 held by A only; HW3 A+B; HW3 finger LEFT THUMB, HW1 LEFT INDEX
- observation: console enrol sends a 10 s reader window; the operator must be at the reader before it is fired

#### PH-23 Scans under pressure: rapid, simultaneous, during a sync, du

- status: **partial**
- outcome: Compressed run (time). Rapid: HW1 left index scanned ~1/s (29 stored rows 18:32:59-18:33:10 etc.), every scan stored once, NO 'interval too short' refusal, duplicate query (reader+subject+instant, 15 min) returned 0 rows. Simultaneous A+B step (18:37): only the operator's own ID 2 finger appeared on A (4 rows), nothing from B; operator says a scanner hiccup, so RACE-05/RACE-14 NOT evidenced. HW1 re-send during scanning (steps 5-9): one re-send was sent early by me, not in step with scanning; not evaluated, no ingestion-failed log check run. Cancel during scanning (R4): HW3 left thumb admitted at reader 18:40:11/:13/:14/:16, Access Block + Delete User transmitted 18:40:16-:20 (DONE ret=0), then 'illegal fingerprint' with no further event: nothing admitted after the block. Enrolment-vs-access (RACE-06, steps 13-15) not run. Restore: HW3 reactivated.
- cases: DATA-05=pass, R4=pass, RACE-05=partial, RACE-14=partial, WH-13=partial, WH-14=blocked, WH-15=partial, ENR-19=blocked, R8=blocked, RACE-06=blocked
- observation: devices capture rapid fingerprint scans with no delay and no 'interval too short' (operator note for dev decisions)
- observation: operator and its own ID 2 finger appears as 'Not recognised' subject 2

#### PH-30 Visit close-out — run last on EVERY visit

- status: **pass**
- outcome: Visit close-out: HW Test 1-4 parked (cancelled, blocked, held by none, finger YES in the central copy), reader clocks correct and networked (operator 18:42), dead jobs 6 unchanged, real Titan subjects unchanged since 2026-10-03, phase released to idle 18:44 SLT. Runbook tracker synced (PH-01..PH-23 and PH-30). Campaign tracker mirrored by hand: 50 case rows, 43 new, 7 existing rows (P0.5, CONSENT-02, ENR-01, ENR-02, ENR-03, ENR-21, ENR-32) rewritten at version 2 with the old text appended as PREVIOUS ROW; local mark-synced for that batch was refused because the phase was already idle.
- observation: NOT RUN: PH-24..PH-29 (band 3) and PH-31, out of time at 19:00; all need someone at the readers (menu, fingers, cable, power); PH-29 is mostly a reader-menu read plus desk checks; PH-31 is the last-visit gate and owner decision
- observation: next visit should follow a desk fix of: reader restart drops templates; withdrawal does not remove the vendor central copy; enrolment wipes the window (invalid time period) until a resend; panel enrolment timeout 2m10s vs reader window ~10s; offline scan lost; Fingerprints 0 on the card
- observation: operator notes: readers capture rapid scans with no 'interval too short'; panel warns 'No consent recorded' for device-side templates

### 6. Final state

- Phase: idle (released 20:30:07 SLT).
- HW Test 1 to 4 (#59 to #62, subjects 100015 to 100018): cancelled, Blocked true, held by none, finger flag YES (templates kept in the vendor central copy), due 2027-04-27.
- Reader clocks correct and both networked at 18:42 (operator). Both readers offline when this report was written (operator left VFT).
- Dead outbox jobs: 6, the remote day's intentional stub tests (HW5/6/7/8/10), unchanged. Real Titan subjects unchanged since 2026-10-03 16:30:23.
- Console sync: all 31 physical records synced (0 unsynced).

#### Records

- Local results: `backups/hw-session/results/physical/PH-*.json` (gitignored, with history).
- Snapshots: `backups/hw-session/physical/*-snapshot.json`; last: `2026-10-09T13-13-05-626Z-snapshot.json`.
- Sync batches: `backups/hw-session/results/batches/2026-10-09T*` (runbook x4, tracker x1).
- Runbook tracker (live status): https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL, collection `results`, docs `PH-nn~<time>`.
- Campaign tracker: https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC, collection `results`, 50 case rows written 2026-10-09 (43 new; P0.5, CONSENT-02, ENR-01, ENR-02, ENR-03, ENR-21, ENR-32 rewritten at version 2 with the earlier text appended as "PREVIOUS ROW").
- Human-readable version of this report: https://claude.ai/artifact/B47xmVRT6ZrrvVdU9ZcZY8 (private).

### 7. Remaining work

| Task  | Needs                              | Possible from home                                 |
| ----- | ---------------------------------- | -------------------------------------------------- |
| PH-24 | reader menu (delete user) + finger | no; VFT staff could do it with written steps       |
| PH-25 | network-cable pulls + fingers      | no                                                 |
| PH-26 | power plug + finger                | no; VFT staff could do it                          |
| PH-27 | fingers on both readers            | no                                                 |
| PH-28 | people scanning + cable pulls      | no                                                 |
| PH-29 | reader user lists read from menu   | mostly; a person reads the menu, rest is desk work |
| PH-31 | final-visit gate + owner decision  | desk work after the last visit                     |

Recommended order: (1) desk session to fix D1 to D4 and D5; (2) second physical visit for PH-24 to PH-29, with a fresh member or a documented central-copy reset, because every current member already has a vendor-side template; (3) PH-31.

### 8. Deviations and slips

- PH-01/PH-03: remote door open (event 8) replaced by finger scans at the operator's instruction; VFT does not report event 8 for remote opens.
- PH-01: first `phase set physical` refused (console phase-gate defect); fixed in `4c922da`.
- PH-02 onward: reader A serial `...077`, not the `...066` in the task text.
- PH-05: the "no help" propagation baseline at B was not measurable (earlier console resend of HW1 had already pushed it to B). PH-06 measured it for HW2: not unaided in ~5 min, arrived within 3 min of the panel resend.
- PH-08: HW3 already had a finger, so it was withdrawn and resent (operator approved) before the run.
- PH-12: HW3 resent to B first (operator approved) so B held its fingerprint.
- PH-15: HW3 used in place of HW4 (HW4 window never repaired).
- PH-20: first attempt did not exercise the race (reader timed out); second attempt did, but the enrolment could not take a new template (duplicate finger).
- PH-22: console enrol for HW1 fired before the operator was at the reader; Enroll ret=6, overwrite behaviour not observed.
- PH-23: compressed for time; steps 5-9 and 13-15 not run; the simultaneous A+B step produced no usable evidence (operator reported a scanner hiccup).
- Slips by the session: first HW1 re-send in PH-23 sent before scanning began; one probe `record` briefly replaced PH-30 with an empty entry (restored; history keeps every version).
- Resends, cancels and reactivations outside the runbook were run only after the operator agreed. No text message was sent at any point.
