# Physical visit report: Titan Fitness door hardware, 2026-10-09

Machine-readable. One section per topic; every claim cites a task id (PH-nn), a queue command id (#nnnnn) or a timestamp (Sri Lanka time, SLT, UTC+5:30). Source of truth: `backups/hw-session/results/physical/PH-*.json` (with history) and the two trackers listed under "Records". Generated 2026-10-09 from those records.

## 1. Metadata

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

## 2. Summary

- Result counts (recorded tasks): 4 fail, 7 partial, 13 pass. Not run: 7.
- Four defects need a desk fix before the next visit (section 3). Two of them admit a member without consent or refuse the right member with no sign in the app.
- Core premises held: inclusive end date at the door, midnight enforced by the reader clock, offline reader still admits, cancel-and-rejoin needs no re-enrolment, lapsed renewal never admitted early (section 4).
- All band-3 tasks need someone at the readers, so a second physical visit is required (section 7).

## 3. Defects, most serious first

### D1 [SERIOUS] A reader restart drops the fingerprint templates our system pushed.

- Tasks: PH-15
- Evidence: After Door Access > Restart on reader A (Device Reboot #70087, 16:57:08), HW1 (left index) and HW3 (left thumb), admitted at A at 16:50:48 and 16:55:39, were refused with "illegal fingerprint" from 16:58 to ~17:10. No event reached us; the panel still said "Can get in". Reader A user menu: 100015, 100016, 100017 listed with no fingerprint; 100018 (HW4, never on A before) had one. The operator's own pre-existing ID 2 still verified (17:01:48). A forced resend of HW1 to 4 (Update User + Finger N, Access Grant, Set Valid Time Period, all ret=0, 17:04) restored only HW4 (admitted 17:14:16). Cancel then reactivate of HW1 to 3 restored all three (granted 17:17:05, :07, :09).
- Desk action: Reconcile must detect template-less users on a restarted reader (device user list / FpCount) and re-add them with Delete User then add. Cancel+reactivate is a test workaround, not a production fix: it blocks the member at the door and rewrites status history.

### D2 [HIGH (privacy)] Removing a fingerprint (consent withdrawal) does not remove it.

- Tasks: PH-19
- Evidence: Remove fingerprint on HW2 (toast "Fingerprint removed. Membership is unchanged."): Delete User 100016 ret=0 on A (#70337) and B (#70336); our record consent none, finger no. Scan at A: "illegal fingerprint". Then "Re-send to readers" sent Update User 100016 + Finger 0, Access Grant, Set Valid Time Period to both readers and the finger was admitted at A (event 3, 17:53:04, :06) with consent still none and our finger flag YES. Registering again: the sync before the enrolment restored the old template, Enroll #70374 ret=6, reader said "duplicate finger". The panel does warn "No consent recorded ... Ask them to confirm they are happy with it, or remove it below".
- Desk action: The vendor keeps a central copy; fromdev/Delete User does not delete it. Withdrawal needs a vendor-side template delete, and resend/registration must not re-install a withdrawn template.

### D3 [SERIOUS] First scan after enrolment is refused ("invalid time period", event 23) in 4 of 5 enrolments.

- Tasks: PH-04, PH-06, PH-07
- Evidence: HW1 at A (15:09:46, :50, :56), HW3 at A (15:21:18, :20), HW2 at B (15:38:33), HW4 at B (15:54:09, :21), each despite Set Valid Time Period ret=0 delivered at 14:10 and a panel reading "Can get in". Each was fixed at once by "Re-send to readers" (HW1 15:13:51, HW3 15:23:28, HW2 15:41:29 at B). The exception, HW3 enrolled after withdraw + resend that included an Access Grant (16:00:20), was admitted at first scan. Hypothesis only: the enrolment resets the member window on the reader; create-members pushes carry no Access Grant.
- Desk action: The enrolment flow should push Access Grant and the window after the finger is taken; the panel must not say "Can get in" while the reader refuses.

### D4 [MEDIUM] Panel enrolment timeout (~2 min 10 s) is far longer than the reader enrolment window (~10 s).

- Tasks: PH-21
- Evidence: Untouched Register on HW2: reader left enrol mode after ~10 s, Enroll #70441 ret=6, panel spinner ~2 min 10 s then "Not confirmed yet. If the fingerprint was taken, it is confirmed the first time the member uses the door - reopen this member to check. Otherwise start again". Operator asked for the panel timeout to be lowered to match the reader.
- Desk action: Lower the panel timeout; also correct brief section 7: enrol return 6 means window timed out, 0 means the finger was taken.

### D5 [MEDIUM] One of two offline scans never reached us after reconnect.

- Tasks: PH-12
- Evidence: Reader A network pulled ~16:38. HW3 admitted offline at ~16:40 (step 3) and 16:42:38. The 16:42:38 scan arrived at 16:44:30 (112 s late, real reader time kept); the ~16:40 scan had no event by 16:48. The queued Access Block #70026 was NEVER SENT while offline and DONE ret=0 179 s after commit on reconnect.
- Desk action: Investigate offline event delivery (reader buffer, events-pull) for lost events.

### Minor observations

- PH-04: member panel kept "Not confirmed yet" after the confirming granted scan until a full page reload.
- PH-16: Door Access card shows "Fingerprints 0" and "Add this reader's capacity in settings to see how full it is" for reader A while it holds enrolled templates; vendor FpCount stays null for A (0 for B).
- PH-05: Re-send toast reads "readers updated"; runbook expects "Queued - the readers will pick this up shortly".
- PH-17: a reader clock set before the window start refuses as event 29 "membership expired" (device wording), not a not-yet-valid code.
- PH-03/PH-09: refusals of unknown fingers never reach us; refusals of known members do (event 23, ~3 s).
- PH-08: fingerprint enrolled after a withdraw + resend that included an Access Grant was not refused (see D3 hypothesis).
- PH-23 (operator note, useful for design): ~29 scans at ~1/s all admitted, each stored once, no "interval too short" refusal, duplicate-row query (reader+subject+instant, 15 min) returned 0 rows.
- Runbook finger names did not match the real fingers: HW1 left index, HW2 left middle, HW3 left thumb (left ring on A menu), HW4 left pinky; the operator's own right index is the pre-existing user ID 2.
- Reader B holds two foreign card users (ids ending 6 and 7) from other testers; reader A holds none.

## 4. What held (premises confirmed against real hardware)

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

## 5. Task-by-task record

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

### PH-01 Visit start: phase, deployment, members, a live callback

- status: **partial**
- outcome: Phase physical (after gate fix 4c922da). Prod dpl_GuStfURk4KF8SEfFwwGEapcGfVJo @ b5686e8 contains fix ef1df60. HW Test 1-4 created (subjects 100015-18), active, due 2027-04-27, A+B, all commands DONE ret=0 on both readers. Callback NOT proven: per operator, remote open (event 8) replaced by an unknown-finger scan on each reader (reader said 'failed to verify, illegal fingerprint'); no event stored and no 'Access webhook delivery' log line within 10+ min. Earlier granted scans (13:50 SLT, both readers) did arrive, so callback worked earlier today. Callback proof deferred to the first granted scan (PH-04).
- observation: callback=unproven-refused-scan-sent-nothing latency=n/a
- observation: dead jobs baseline 6 (remote-day stub tests HW5/6/7/8/10, 13:17-13:18 SLT), accepted by operator; any increase is physical's
- observation: readers show Not responding at snapshot (no heartbeat, expected)
- observation: operator disclaimer: VFT sends no event 8 for remote opens; steps 12-14 not run

### PH-02 Reader identity and inventory: label, menu, user list

- status: **pass**
- outcome: Serials agree label=registered=vendor: A NYU7251900077 (replacement; task text says ...066), B NYU7254500734. Baseline user lists: A 6 users = fingerprint 1,2 + HW subjects 100015-18; B 8 users = fingerprint 1,2 + HW subjects 100015-18 + pre-existing card users ...6 and ...7 (other testers', unknown to our records).
- cases: P0.5=pass, P0.6=pass
- observation: A: serial NYU7251900077 fw ZAM70-NF24HA-Ver3.0.15 ip 192.168.1.203 tz UTC+5:30 clock accurate (operator, to the minute)
- observation: B: serial NYU7254500734 fw ZAM70-NF24HA-Ver3.3.12 ip 192.168.1.33 tz UTC+5:30 clock accurate (operator, to the minute)
- observation: firmware differs between readers (3.0.15 vs 3.3.12); vendor name of A is Dev1 vs our Device A (test)
- observation: B holds two foreign card users (…6, …7), A none; shared test devices

### PH-03 An unknown finger at Device A — does a refused scan reach us

- status: **partial**
- outcome: Right thumb at A 14:44: reader said 'failed to verify'. No event stored after 300s+ and no 'Access webhook' log line (Vercel, one timeout then clean retry); Door Access Refusals shows 'No activity of this kind'. Same for 3 earlier refused scans (unknown finger A and B; HW Test 2 right middle at A, reader 'failed to verify'). D-5 holds: panel for HW Test 2 shows 'Can get in', 'Access is active' 09 Oct 2026-27 Apr 2027, Fingerprint 'Not registered'. VEND-20 provisional: refusals do not reach us, but PH-01 did not prove the callback live today (last granted scans 13:50 SLT arrived), so not a clean FAIL; re-check against the first granted scan at PH-04.
- cases: VEND-20=partial
- observation: A1=refusals-do-not-arrive (provisional, callback not proven live this visit)
- observation: reader screen text for unknown finger: failed to verify / illegal fingerprint
- observation: Door Access is a section inside the member modal, not a separate button

### PH-04 Enrol HW Test 1 on Device A through the panel, then the firs

- status: **partial**
- outcome: Run on HW Test 1 (finger added by hand at the reader menu after the enrolment window timed out) and repeated on HW Test 3 (operator's choice, fresh member) for a clean panel-led enrolment. HW3: consent 15:19:57 SLT, then Enroll User 100017 Finger 0 DONE ret=0 at once; operator: reader entered enrolment mode when Register was clicked and took the finger (ENR-01 shown, A-4). Panel text and disabled-until-consent as reported. BUT the first scans after each enrolment were DENIED (event 23, verify 1, reader 'invalid time period') - HW1 x3 at 15:09, HW3 x2 at 15:21 - despite Set Valid Time Period 20261009-20270427 DONE at 14:10 and a panel saying 'Can get in'. After resend (Update User, Access Grant, Set Valid Time Period; ret=0) both were GRANTED event 3 verify 1 (HW1 15:13:51, HW3 15:23:28, stored +3-4s). Finger flag YES for both; HW1 badge 'Registered' after full reload.
- cases: CONSENT-02=pass, UI-04=pass, ENR-01=pass, DATA-01=partial, OBS-01=pass
- observation: callback=live latency=3s
- observation: Enroll return: HW1 ret=6 (timed out, finger entered at menu), HW3 ret=0 (clean); vendor FpCount A=null B=0 after enrolment
- observation: consent before enrol command: HW1 15:04:00 vs commit 15:04:01; HW3 consent 15:19:57
- finding: DEFECT (owner wants it fixed): a fingerprint enrolment (panel-led on HW3, menu-added on HW1) leaves the member refused at the reader with 'invalid time period' (event 23) although our window command was DONE earlier; our panel still says 'Can get in', no repair job is queued, and only a manual Re-send to readers (Update User, Access Grant, Set Valid Time Period) restores entry. Reproduced 2/2. Likely the enrol clears the reader's validity period (A-8 family) - the enrol flow should push the window after the enrolment and the panel must not say Can get in while the reader refuses
- finding: member panel keeps 'Not confirmed yet' after the confirming granted scan until a full page reload
- finding: Door Access Recent activity 'All' showed only the granted row for HW Test 1, check whether denied event-23 rows (15:09) appear (operator did not report the Refusals tab)

### PH-05 HW Test 1 at Device B — first with no help, then after a for

- status: **pass**
- outcome: HW Test 1 admitted at reader B after re-send: granted event 3 verify 1 at 15:29:51 (after my console resend at 15:11) and again 15:33:19 after the panel 'Re-send to readers' (toast 'readers updated'). The panel re-send put Update User, Update User Finger 6, Access Grant, Set Valid Time Period (all DONE ret=0) on BOTH readers (A #69908-14, B #69910-15). A first operator B-test was actually done on A (subject 2, operator's own pre-existing finger); not counted. The 'no help' baseline at B could not be measured: my console resend at 15:11 had already pushed HW1, Finger 6 included, to B.
- cases: ENR-03=pass
- observation: templatePropagation=unmeasured (HW1 had already been resent to B; use a fresh member enrolled on A and scanned at B before any resend)
- observation: panel toast text 'readers updated', task expects 'Queued - the readers will pick this up shortly'
- observation: reader B delivery latency 7s and 12s (A 3-4s)
- finding: Re-send to readers toast reads 'readers updated' instead of the queued wording: cosmetic or the deployed copy differs from the runbook

### PH-06 Enrol HW Test 2 on Device B, then try Device A

- status: **fail**
- outcome: HW Test 2 enrolled on B with a real finger (operator: B showed the enrolment screen and accepted it; Enroll User 100016 Finger 0 DONE ret=0 at ~15:35, flag YES). FAIL-if holds: first scan at B 15:38:33 was DENIED event 23 (verify 1, 'invalid time period') - the same defect as HW1/HW3, 3 of 3 enrolments. After the panel 'Re-send to readers' (Update User, Update User Finger 0, Access Grant, Set Valid Time Period, DONE ret=0 on A and B) B admitted event 3 at 15:41:29. ENR-12: before any resend A refused ('illegal fingerprint', no event stored); right after the resend (15:41) A still refused; at 15:43:49 A admitted (event 3, stored +3s). So the fingerprint did NOT reach A on its own in ~5 min; it arrived within ~3 min of the resend (resend vs vendor lag not separable).
- cases: ENR-02=fail, ENR-12=partial
- observation: templatePropagation=manual (not within 5 min unaided; arrived 1-3 min after resend)
- observation: invalid time period after enrolment: 3/3 (HW1 A, HW3 A, HW2 B), cleared each time by Re-send to readers
- observation: B delivery latency 5-9s; A 3s
- finding: HW Test 2 enrolled on B is refused (event 23, invalid time period) until Re-send to readers - same as PH-04; the enrolment flow must push the window after the finger is taken
- finding: template of a finger enrolled on B reaches A only after a re-send plus 1-3 min; no automatic distribution in 5 min

### PH-07 Same member on both readers at the same instant

- status: **fail**
- outcome: race enrol-both for HW Test 4 (consent confirmed by operator, written once 10:23:03Z) settled in 3.3s, both Enroll User 100018 Finger 0 dispatched. Operator used left pinky (not left middle), pressed B first: B DONE ret=0 and accepted the finger; A DONE ret=6 and timed out (operator cannot press two readers at once, ~same as HW1's timeout). No reader stuck, one consent, held A+B. FAIL-if holds: first scans at B (15:54:09 and 15:54:21, stored +5-6s) DENIED event 23 'invalid time period' - HW4 refused at the reader that enrolled them (4th of 4 enrolments). Scan at A 15:54: 'failed to verify, illegal fingerprint', no event (A has no template; none arrived unaided in ~1 min). Finger flag YES after the B scans. No resend done.
- cases: ENR-04=fail, RACE-01=pass, R1=partial, DATA-07=partial
- observation: Enroll return code: 0 = finger taken, 6 = reader window timed out (HW1 A, HW4 A); runbook says enrol gives 6
- observation: invalid time period after enrolment 4/4
- observation: a human can only finish one enrolment of a simultaneous pair: A timed out, so a true both-readers-at-once finger race was not exercised
- finding: Enroll return code 6 means the enrolment window timed out, not success (HW1 and HW4 on A both returned 6 and took no finger); brief section 7 says 'enrol gives 6' - the success/timeout reading is inverted

### PH-08 Enrolment accepted, performed — and we were told it failed

- status: **pass**
- outcome: Precondition adapted with operator approval: HW Test 3 already had a finger (PH-04), so withdrawn (Delete User on A+B, flag and consent cleared) and resent (Update User, Finger 0, Access Grant, Set Valid Time Period; ret=0) before the run. ambiguous enrol on A with consent: 'vendor really answered {status:applied}', then 'Use case THREW: Simulated timeout after the vendor accepted the command'. Enroll User 100017 Finger 0 SENT NO REPLY then DONE ret=0 21s later (operator pressed left ring finger). First scan at A 16:00:20: GRANTED event 3 verify 1, stored +2s. Finger flag YES, consent 15:59, panel badge 'Registered' after reload, 'Can get in'. No manual repair.
- cases: AMB-01=pass, ENR-09=pass
- observation: this enrolment did NOT show 'invalid time period' (first scan granted) - unlike the other 4; difference: HW3 had had an Access Grant pushed (via resend) before the enrol, the first-time create-members pushes had none. Hypothesis only
- observation: operator finger: left ring (task says left index)
- observation: withdraw + resend does not return the finger to the reader as far as flagged (flag NO), enrol window still opened and accepted
- finding: hypothesis for the invalid-time-period defect: it appears when a member was created by create-members/registration (Update User + Set Valid Time Period, no Access Grant) and enrolled afterwards; HW3 enrolled after a resend that included Access Grant was granted at first scan

### PH-09 Lapse HW Test 1, then renew while they keep trying the door

- status: **pass**
- outcome: HW1 due set to yesterday (2026-10-08) and pushed: Access Block User 100015 DONE ret=0 on A (#69958) and B (#69959), NO Set Valid Time Period with it. Operator discovered HW1's finger is LEFT INDEX (right index = pre-existing ID 2); refused at A 3x (16:08:03, 16:08:47, 16:09:59, event 23, reader 'invalid time period'), all reached us stored +3-5s: A1known=arrives. Panel: 'Cannot get in / Membership payment is overdue / Fingerprint Registered', no vendor code. Scanning every ~4s while pay ran (16:13:46-51, due 2026-10-10): Access Grant #69962 + Set Valid Time Period EndTime 20261010 #69964 committed 16:13:49, transmitted 16:13:50 DONE ret=0. Refusals 16:13:38, :41, :46 (event 23), first admission 16:13:50 (event 3 verify 1), none before the transmit. No error, nothing stuck. Operator reports refused then accepted, both at 16:13.
- cases: RACE-08=pass, R5=pass
- observation: A1known=arrives
- observation: HW1 renewed and left at due 2026-10-10 (daily plan +1d), active, unblocked
- observation: only one admission event stored (task asks for two consecutive)

### PH-10 End date = today: a paid-up member must get in on their last

- status: **pass**
- outcome: HW1 due set to today (2026-10-09), pushed: Set Valid Time Period User 100015 StartTime 20261009 EndTime 20261009 DONE ret=0 on A (#69969). Operator scanned the LEFT INDEX (HW1's actual finger) at A 16:16: 'successfully verified'; event 3 granted verify 1 reader clock 16:16:24, stored 16:16:26. Panel: 'Can get in / Access is active / The readers will let this member in from 09 Oct 2026 until 09 Oct 2026'. EndDate is inclusive at the door and our panel agrees.
- cases: TIME-04=pass, ACCESS-03=pass
- observation: A-3 EndDate inclusive: confirmed at reader A, scan at 16:16 on the end date
- observation: HW1 left at due TODAY for PH-11; finger is left index

### PH-11 Move Device A's clock past midnight: the window must end

- status: **pass**
- outcome: Reader A clock set to 10 Oct 2026 00:01 (tomorrow). HW1's left-index scans were refused as event 29 'membership expired' (x2, reader clock 2026-10-10 00:01:36 and 00:01:38, stored 16:19:02/04 SLT, reader-stored +27753s) - expiry enforced from the reader's own clock, nothing from us. Operator restored the clock; no cloud resync observed after 2 min; next scan 16:26:44 reader clock correct (skew -3s after delivery) GRANTED event 3 verify 1. Restore: HW1 due +200 (2027-04-27) pushed, Set Valid Time Period EndTime 20270427 DONE ret=0 on A.
- cases: TIME-05=pass, ACCESS-10=pass, FAIL-17=pass
- observation: clock jump forward refused at once (event 29) and reversed when corrected; jumped scan reader time 2026-10-10 00:01:36
- observation: cloud did not resync the clock within 2 min
- observation: operator used left index (HW1's finger), not right index

### PH-12 Unplug Device A's network: the door must keep working

- status: **partial**
- outcome: Pre-step (operator-approved): resend HW3 to put its fingerprint on B (left thumb verified on B 16:35:13/16:36:26; HW3's finger is LEFT THUMB, not left index/ring). A's cable pulled ~16:38, power on: HW3 left thumb ADMITTED at offline A (FAIL-13 core premise holds). HW3 lapsed (due 2026-10-08) and pushed 16:41: push ok, 2 commands queued; B Access Block #70027 DONE ret=0 in 3s; A #70026 NEVER SENT. Offline A still admitted HW3 (16:42:38); B refused (event 23 invalid time period, 16:42:54). Door Access alert: '1 reader not responding / Device A (test). The doors still let in the members they already know about - but cancellations and renewals will not reach them until they are back.' Cable back 16:44: A Access Block #70026 DONE ret=0, 179s after commit; A then refused HW3 (event 23 16:44:41). Offline scan 16:42:38 arrived LATE (stored 16:44:30, +112s, real reader time kept); the earlier offline scan from step 3 (~16:40, admitted per operator) NEVER arrived (rechecked 16:48). Restore: HW3 due +200, Access Grant + Set Valid Time Period EndTime 20270427 DONE ret=0 on A and B, left thumb granted on A 16:47:20 and B 16:47:22.
- cases: FAIL-13=pass, DEVICE-08=pass, STATUS-05=pass, RACE-16=pass, REAL-03=pass, OBS-07=pass, DATA-06=partial
- observation: offline scans: 1 of 2 delivered after reconnect, with real reader time; the other lost or still unsent
- observation: offline queue time to land after reconnect: 179s after commit (reconnect 16:44, block committed 16:41)
- finding: an offline scan made before the other offline scan never reached us after reconnect (admit at ~16:40, nothing stored by 16:48); one of two offline scans lost, DATA-06 partial

### PH-13 Cancel, then rejoin — without touching the scanner again

- status: **pass**
- outcome: HW1 cancelled: Access Block #70035/#70039 and Delete User (template revoke) DONE ret=0 on A and B, held by none, blocked. Operator (HW1's real finger = LEFT INDEX, not right index) refused at A and at B ('failed to verify', no event stored since the user was deleted). Reactivated (no text, no payment, no re-enrolment): Update User, Update User Finger 6, Access Grant, Set Valid Time Period EndTime 20270427 DONE ret=0 on A and B (pushed twice, two identical sets per reader). Scans: A event 3 granted 16:50:48, B event 3 granted 16:50:47 (verify 1), without touching the enrol menu. Finger flag YES throughout, held A+B, active, due 2027-04-27, dead jobs still 6.
- cases: ENR-21=pass, ENR-22=pass, ENR-29=pass, ENR-30=pass, ENR-32=pass, DATA-08=pass
- observation: central copy restores the template: cancel/rejoin needs no re-enrolment (Finger 6 sent from vendor)
- observation: reactivate pushed two identical command sets per reader (reactivate + its push)

### PH-14 Enrol on A while the member is being cancelled

- status: **pass**
- outcome: race enrol-vs-cancel on HW3 (consent written 10:29:29Z, operator confirmed; settled 3.8s): final state cancelled, blocked, held by none. Queue on A: Set Valid Time Period, Access Block #70062 and Enroll User 100017 #70063 SENT NO REPLY, then Delete User #70065/#70070 NEVER SENT; all DONE at +12s with Enroll ret=6 (window timed out, no finger pressed) and both Deletes AFTER the Enroll. B: Delete, Block, Delete DONE ret=0. Operator scans left thumb at A and at B: failed to verify on both (no event). Restore: reactivate HW3 (Update User Finger 0, Access Grant, Set Valid Time Period EndTime 20270427 DONE ret=0 on A and B); left thumb then admitted at A and at B without re-enrolling (second central-copy observation).
- cases: RACE-03=pass, R3=pass
- observation: central copy restores HW3 template after cancel+rejoin too, without re-enrolling (2nd observation after HW1)
- observation: HW3 finger is LEFT THUMB

### PH-15 Restart Device A from the Door Access page, then scan

- status: **fail**
- outcome: Panel Restart of Device A (back at idle; Device Reboot DONE ret=0 16:57:08; toast not reported). HW Test 3 substituted for HW4. After the restart HW1 (left index) and HW3 (left thumb), admitted at A minutes earlier, were refused 'illegal fingerprint' (16:58, 17:01, 17:06, ~17:10); operator's own pre-existing ID 2 still verified (17:01:48). Reader A user menu: users 100015/16/17 still listed but with NO fingerprint, 100018 (HW4, enrolled on B only) HAS a fingerprint and was admitted at A 17:14:16 (left pinky). Forced resend of HW1-4 (DONE ret=0) restored only HW4. Repair: cancel then reactivate HW1,2,3 (operator-approved) re-delivered the templates: HW1, HW3, HW2 all granted at A 17:17:05/:07/:09 without re-enrolling. Final: HW1-4 active, due 2027-04-27, held A+B, finger YES.
- observation: restart drops templates for users A already held; users stay listed
- observation: HW4 template (never on A) delivered by a plain resend; templates A held before the restart are not re-sent by a resend, only by cancel(Delete User)+reactivate
- observation: operator asked whether cancel+reactivate can be a permanent production fix: no - blocks the member at the door, rewrites status/billing history, invisible symptom; fix belongs in reconcile (detect missing templates, delete-then-add)
- finding: SERIOUS: after Door Access > Restart a reader keeps its users but loses the fingerprint templates our system pushed; members get 'illegal fingerprint' while the panel still says Can get in, no event, no alert. A forced resend (Update User Finger N, Access Grant, Set Valid Time Period) does not restore them; only Delete User then re-add (cancel+reactivate) did. Desk fix: reconcile must detect template-less users on a restarted reader (device-side user list/FpCount) and re-add them with a delete-then-add, and the restart button should warn or queue the repair

### PH-16 Clock skew: one minute, one hour, and the drift warning

- status: **pass**
- outcome: Clock 1 min fast: reader 17:21:03, HW1 (left index; task says right index) admitted event 3, skew +106s (inside the +-120s band, no alarm). Clock 1 hour fast: reader 18:21:03, admitted, skew +3597s; snapshot Reader A Skew 3597s. Door Access card for Device A: 'This reader's clock is wrong. It decides who gets in from its own clock, so memberships may end on the wrong day. Ask your installer to correct the time.' (no separate top alert-strip text reported). Clock corrected 17:23: admitted event 3, skew -2s, warning gone after reload.
- cases: STATUS-10=pass, TIME-08=pass, TIME-09=pass, ACCESS-15=pass
- observation: skew +106s at nominal 1 min; +3597s at 1 hour; -2s corrected
- observation: Reader A clock restored to correct time (verified by scan 17:23:23)
- observation: Door Access card for Device A shows 'Fingerprints 0' and 'Add this reader's capacity in settings to see how full it is' although 4 members hold fingerprints on A (template count only moves after an eviction run, per brief; operator asked for a note)
- finding: Device card shows Fingerprints 0 while A holds enrolled templates for HW1-4 and the operator's own users; vendor FpCount stays null for A

### PH-17 The midnight boundary scanned on both sides; a future start;

- status: **pass**
- outcome: Midnight on A (HW1 left index, window EndTime 20261009): six scans admitted at reader 23:59:45-23:59:57, first refusal 00:00:01 event 29 'membership expired' (stored +23557s), none admitted after. End date tomorrow (EndTime 20261010, pushed): admitted at reader 2026-10-10 00:02:01. Future start: HW2 start tomorrow/due +30 pushed to B as Access Block #70268 only, NO Set Valid Time Period; scan refused (reader 'invalid time period', event 23 17:32:02); B clock set to 10 Oct 09:00 still refused (event 23, no window). HW2 made current (start 2026-09-09, due 2027-04-27): Access Grant + Set Valid Time Period DONE ret=0, admitted event 3 at 17:35:48. B clock set back to 1 Aug 2026: refused twice, event 29 'membership expired' at reader 2026-08-01 12:00:08/:11 (device wording, not 'not yet valid'); clock corrected 17:39: admitted again 17:39:09. Both reader clocks restored (A 17:31, B 17:39, verified by scans); HW1 due +200 and pushed.
- cases: TIME-01=pass, TIME-02=pass, TIME-03=pass, TIME-06=pass, ACCESS-04=pass, ACCESS-05=pass, R17=pass, RACE-18=pass, FAIL-18=pass
- observation: reader wording for clock before window start is 'expired user' (event 29), not a not-yet-valid code
- observation: fingers: HW1 left index (not right index), HW2 left middle (not right middle)

### PH-18 Block, then a validity period behind our back (A-8)

- status: **pass**
- outcome: HW2 suspended (valid dates 2027-04-27): B got Access Block #70316 only, no validity command; scan refused (failed to verify, invalid time period). Direct window via vendor validperiod 20261009-20261108 (guard bypassed, #70325 DONE ret=0): scan 17:43 STILL refused, events 23 at 17:43:12/:16. Restore: reactivate HW2 (Access Grant #70327 + Set Valid Time Period 20260909-20270427 #70329 DONE ret=0): admitted at B 17:44.
- cases: ACCESS-07=pass
- observation: A8=block-survives-window (on this reader/firmware 3.3.12 the block held after a direct validity write)
- observation: operator used left middle for HW2

### PH-19 Remove a fingerprint: is it really gone?

- status: **fail**
- outcome: Remove fingerprint on HW2 (toast 'Fingerprint removed. Membership is unchanged.', confirm modal explains consent withdrawal): Delete User 100016 DONE ret=0 on A (#70337) and B (#70336); snapshot consent none, finger no, status active. Scan at A with the left middle: 'failed to verify, illegal fingerprint' (no event). Panel Re-send to readers (toast 'readers updated') sent Update User 100016 Finger 0, Access Grant, Set Valid Time Period to BOTH readers, and the removed finger was RECOGNISED again at A (granted event 3 at 17:53:04/:06) with our consent still none and the finger flag YES. KEY FAIL: withdrawal is not real - the vendor's central copy re-installs the template on any later sync, without consent. The panel does show 'No consent recorded / This member has a fingerprint on the reader but no record of them agreeing to it ... Ask them to confirm they are happy with it, or remove it below'. Second removal (Delete User #70369 A, #70367 B). Then Register again on A: the pre-enrol sync restored the old Finger 0 again, so the enrolment of the same finger (Enroll User 100016 #70374) returned ret=6 and the reader said 'duplicate finger'; consent 17:58 recorded; the scan of the left middle at A 18:01:20 was GRANTED and the finger flag went YES, so HW2 ended with a fresh consent over the old restored template; held by A only (B not re-sent).
- cases: CONSENT-06=fail
- observation: operator: confirmation modal on Remove fingerprint resets the consent box; text 'This also withdraws their consent, so they will be asked again before any new fingerprint is recorded. They will need to scan their finger again...' - but the old template returns on resend
- observation: HW2 finger is LEFT MIDDLE; right middle not used
- observation: HW2 now held by A only after the second removal and re-registration; B needs a resend before PH-23
- finding: HIGH (privacy): Remove fingerprint (consent withdrawal) deletes the user from the readers but the vendor's central copy keeps the template; the next Re-send to readers, or any registration sync, puts it back (Update User with Finger N) and the member is admitted without consent; the app only warns 'No consent recorded'. Withdrawal needs a vendor-side template delete, not just Delete User/fromdev
- finding: re-registering a member whose fingerprint was removed fails with 'duplicate finger' on the reader, because the sync before the enrol restores the old template

### PH-20 Consent withdrawn while an enrolment is in progress

- status: **pass**
- outcome: Run twice. Attempt 1: Register on A, reader timed out (Enroll ret=6) before the operator pressed; withdraw (18:03:52) landed, then a second Register enrolled the right ring (Enroll ret=0, consent 18:04) so the race was not exercised. Attempt 2 (run properly): Register clicked, withdraw at 18:08:53 while the reader waited; queue on A: Enroll #70398 ret=5, #70399 ret=0, #70401 ret=5 (duplicate finger: right ring already stored), then Delete User #70404 ret=0 AFTER the last Enroll; B Delete User #70403. Final snapshot: consent none, Held by none, finger no, status active. Left index scan at A: 'illegal fingerprint', no event. No template survived a withdrawn consent. Restore: Register again (consent 18:11) - the pre-enrol sync put the old left-index template back (Update User Finger 0/6) and Enroll #70413 ret=6 reported duplicate finger; the scan at 18:12:12 was granted event 3 and the flag went YES, panel updated itself.
- cases: CONSENT-05=pass, RACE-09=pass, R7=pass, DATA-10=pass
- observation: in-flight enrolment could not take a new template (duplicate finger), so the withdraw-vs-capture race was only exercised at command level
- observation: Delete User landed after every Enroll; consent null and no template at the end
- observation: HW1 held by A only after the restore (B not re-sent); finger left index; right ring also stored on A

### PH-21 Enrolment interrupted halfway, and a finger taken after the

- status: **partial**
- outcome: Registration on A: first attempt the reader prompted and a SINGLE right-middle press enrolled it (Enroll ret=0), so no halfway interruption occurred; scan 18:15 granted (not 'not registered'), because the pre-enrol sync restored a template and the enrolment completed. Walk-away attempt: operator did not touch the reader; reader left enrol mode after ~10s, Enroll ret=6 (timed out), consent recorded 18:17, flag no, panel spinner ~2m10s then 'Not confirmed yet. If the fingerprint was taken, it is confirmed the first time the member uses the door - reopen this member to check. Otherwise start again' (not worded as a failure). After that interrupted attempt the member was STILL recognised: right middle admitted/known, left middle 'illegal fingerprint' - the central copy had re-installed the previous template, so ENR-08 'no usable template' does not hold. H-7: Register again, press right middle, then a scan at 18:22 verified and the panel showed 'Registered' (flag set only by that scan).
- cases: ENR-08=fail, OBS-02=pass, DATA-02=partial
- observation: device enrolment window ~10s vs panel timeout ~2m10s: the panel keeps spinning long after the reader gave up
- observation: H-7: first scan confirms the finger after the dialog timed out; panel 'Registered' only after the scan
- finding: the panel's enrolment spinner runs ~2m10s but the reader leaves enrolment mode after ~10s; the timeout should match the reader window (operator request)
- finding: an interrupted enrolment leaves a usable template because the pre-enrol sync restores the central copy: a member who walks away is not 'not registered'; their finger is still admitted

### PH-22 A fingerprint enrolled at the reader's own menu; re-enrollin

- status: **partial**
- outcome: A-5: HW3 Remove fingerprint + Re-send to readers (toast 'readers updated') brought its old template back; left thumb scan at A 18:25:49 granted event 3, our flag YES with consent none, panel 'Registered' + 'No consent recorded: This member has a fingerprint on the reader but no record of them agreeing to it - so it was most likely registered at the reader itself rather than here. Ask them to confirm they are happy with it, or remove it below.' (menu enrolment skipped as the task allows: template already present). ENR-07: console enrol for HW1 on A (consent on file, 18:11) fired before the operator was ready, reader never prompted, Enroll User 100015 DONE ret=6 (timed out); left index scan 18:27:51 granted: one working template, one logical state, but the overwrite/already-enrolled behaviour was NOT observed. Restore: HW3 Remove fingerprint, tick consent, Register on A: reader said duplicate finger, scan with left thumb verified, panel Registered with consent.
- cases: ENR-07=partial
- observation: A-5 surfaced via the first scan; panel warning present and well worded
- observation: HW1 held by A only; HW3 A+B; HW3 finger LEFT THUMB, HW1 LEFT INDEX
- observation: console enrol sends a 10 s reader window; the operator must be at the reader before it is fired

### PH-23 Scans under pressure: rapid, simultaneous, during a sync, du

- status: **partial**
- outcome: Compressed run (time). Rapid: HW1 left index scanned ~1/s (29 stored rows 18:32:59-18:33:10 etc.), every scan stored once, NO 'interval too short' refusal, duplicate query (reader+subject+instant, 15 min) returned 0 rows. Simultaneous A+B step (18:37): only the operator's own ID 2 finger appeared on A (4 rows), nothing from B; operator says a scanner hiccup, so RACE-05/RACE-14 NOT evidenced. HW1 re-send during scanning (steps 5-9): one re-send was sent early by me, not in step with scanning; not evaluated, no ingestion-failed log check run. Cancel during scanning (R4): HW3 left thumb admitted at reader 18:40:11/:13/:14/:16, Access Block + Delete User transmitted 18:40:16-:20 (DONE ret=0), then 'illegal fingerprint' with no further event: nothing admitted after the block. Enrolment-vs-access (RACE-06, steps 13-15) not run. Restore: HW3 reactivated.
- cases: DATA-05=pass, R4=pass, RACE-05=partial, RACE-14=partial, WH-13=partial, WH-14=blocked, WH-15=partial, ENR-19=blocked, R8=blocked, RACE-06=blocked
- observation: devices capture rapid fingerprint scans with no delay and no 'interval too short' (operator note for dev decisions)
- observation: operator and its own ID 2 finger appears as 'Not recognised' subject 2

### PH-30 Visit close-out — run last on EVERY visit

- status: **pass**
- outcome: Visit close-out: HW Test 1-4 parked (cancelled, blocked, held by none, finger YES in the central copy), reader clocks correct and networked (operator 18:42), dead jobs 6 unchanged, real Titan subjects unchanged since 2026-10-03, phase released to idle 18:44 SLT. Runbook tracker synced (PH-01..PH-23 and PH-30). Campaign tracker mirrored by hand: 50 case rows, 43 new, 7 existing rows (P0.5, CONSENT-02, ENR-01, ENR-02, ENR-03, ENR-21, ENR-32) rewritten at version 2 with the old text appended as PREVIOUS ROW; local mark-synced for that batch was refused because the phase was already idle.
- observation: NOT RUN: PH-24..PH-29 (band 3) and PH-31, out of time at 19:00; all need someone at the readers (menu, fingers, cable, power); PH-29 is mostly a reader-menu read plus desk checks; PH-31 is the last-visit gate and owner decision
- observation: next visit should follow a desk fix of: reader restart drops templates; withdrawal does not remove the vendor central copy; enrolment wipes the window (invalid time period) until a resend; panel enrolment timeout 2m10s vs reader window ~10s; offline scan lost; Fingerprints 0 on the card
- observation: operator notes: readers capture rapid scans with no 'interval too short'; panel warns 'No consent recorded' for device-side templates

## 6. Final state

- Phase: idle (released 20:30:07 SLT).
- HW Test 1 to 4 (#59 to #62, subjects 100015 to 100018): cancelled, Blocked true, held by none, finger flag YES (templates kept in the vendor central copy), due 2027-04-27.
- Reader clocks correct and both networked at 18:42 (operator). Both readers offline when this report was written (operator left VFT).
- Dead outbox jobs: 6, the remote day's intentional stub tests (HW5/6/7/8/10), unchanged. Real Titan subjects unchanged since 2026-10-03 16:30:23.
- Console sync: all 31 physical records synced (0 unsynced).

### Records

- Local results: `backups/hw-session/results/physical/PH-*.json` (gitignored, with history).
- Snapshots: `backups/hw-session/physical/*-snapshot.json`; last: `2026-10-09T13-13-05-626Z-snapshot.json`.
- Sync batches: `backups/hw-session/results/batches/2026-10-09T*` (runbook x4, tracker x1).
- Runbook tracker (live status): https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL, collection `results`, docs `PH-nn~<time>`.
- Campaign tracker: https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC, collection `results`, 50 case rows written 2026-10-09 (43 new; P0.5, CONSENT-02, ENR-01, ENR-02, ENR-03, ENR-21, ENR-32 rewritten at version 2 with the earlier text appended as "PREVIOUS ROW").
- Human-readable version of this report: https://claude.ai/artifact/B47xmVRT6ZrrvVdU9ZcZY8 (private).

## 7. Remaining work

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

## 8. Deviations and slips

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
