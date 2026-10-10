---
title: Remote Day Report, 2026-10-09
doc_type: test-campaign-report
track: remote
campaign: access-control hardware (VFT / ZKTeco readers), 398-case campaign v3
date: 2026-10-09
timezone: Asia/Colombo (SLT, UTC+05:30)
gym: Titan Fitness (481599f6-5134-4152-83b2-6e2dd10e3018), production
readers:
  [NYU7251900077 (Device A, replaced 2026-10-09), NYU7254500734 (Device B)]
deployment_tested: dpl_5ReihV3YTh2ERsGeGRFsGHD3WdwV, then dpl_GuStfURk4KF8SEfFwwGEapcGfVJo (same commit b5686e8, redeployed 12:06 SLT)
tasks_total: 56
tasks_pass: 43
tasks_partial: 10
tasks_fail: 3
scope_note: remote track only; the physical session is recorded separately
source_of_truth: runbook tracker https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL and campaign tracker https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC
generated_from: backups/hw-session/results/<agent>/<TASK>.json
---

# Remote Day Report, 2026-10-09

How to read this file: IDs are stable. `LD-*` lead, `OB-*` outbox, `LC-*` lifecycle, `AP-*` API, `EV-*` evidence, `XC-*` exclusive are task IDs (definitions: `docs/architecture/access-control-hardware-runbook.json`, one task via `npx tsx scripts/hw-session.ts task <ID> --as <agent>`). Names like `VEND-21` or `TIME-07` are case IDs from the 398-case catalogue. `F-nn` are findings in section 2. Verdicts: pass, partial, fail, na; evidence-agent cases use pinned (a test covers it), gap (no test), partial, fail, na.

## 0. Summary

- The remote track ran all 56 tasks against production: 43 pass, 10 partial, 3 fail.
- All 210 remote cases have a verdict: 156 decided by running something (140 pass, 12 partial, 3 fail, 1 na), 54 by reading code (13 pinned, 36 gap, 3 partial, 1 fail, 1 na).
- The 3 failed tasks and most partials are defects or limits of the setup, not tests left unrun. They cannot be re-run to a different answer.
- No real Titan member changed (newest real subject change stayed 2026-10-03 16:30:23). No SMS was sent or logged for any HW test member. Six dead jobs remain by design (section 6).
- The VFT webhook callback delivers real scans from both readers (3 to 10 s). It never delivers a remote door open as event 8, and a reader sends nothing until someone does a local action on it.

## 1. Results by agent

| agent     | tasks  | pass   | partial | fail  |
| --------- | ------ | ------ | ------- | ----- |
| lead      | 11     | 7      | 4       | 0     |
| outbox    | 5      | 5      | 0       | 0     |
| lifecycle | 7      | 6      | 1       | 0     |
| api       | 10     | 6      | 3       | 1     |
| evidence  | 10     | 10     | 0       | 0     |
| exclusive | 13     | 9      | 2       | 2     |
| **total** | **56** | **43** | **10**  | **3** |

## 2. Findings register

Severity is the remote session's judgement. "Where" gives code locations the evidence agent cited, or the task that observed it. Status is as of 2026-10-09 14:00 SLT: nothing in this table was fixed during the day, except F-16.

| id   | severity | title                                                                                                                                                                                                                                                    | evidence                                                                                                                                                                                                                                                                                                                                                                                                                                  | where                                                                                                                 | tasks                             | suggested action                                                                                                                              |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | high     | Events pull is not idempotent and shifts times by 5 h 30 min; it also raises a false "reader's clock is wrong" alert                                                                                                                                     | `vendor events-pull --reader A` (Get Events By Device, return 39) re-delivered 3 stored scans; stored count 11 to 14; copies stamped 07:04:07/13/19 instead of 12:34:07/13/19 (stored UTC value read as local); device A skew became -22844 s and the dashboard showed the alert                                                                                                                                                          | ingestion of pulled events (RecordAccessEvents path) and device skew update                                           | XC-10, LD-11, ENR-20              | dedupe on reader + subject + instant; parse reader time as gym-local on the pull path; do not let historical events set the device clock skew |
| F-02 | high     | A vendor 429 is dead-lettered on the first attempt; a drain against a 429 also kills earlier retryable jobs it re-claims                                                                                                                                 | stub mode 429; job dead with `needingAttention`; HW6's earlier retryable 500 job went dead when re-claimed by a 429 drain                                                                                                                                                                                                                                                                                                                 | return-code classification in the sync outbox                                                                         | XC-05, FAIL-04, VEND-17           | treat 429 as retryable with backoff (honour Retry-After); never re-classify an earlier job's failure from a later drain                       |
| F-03 | high     | A vendor sign-in rejection (401) goes dead on the first attempt and raises no operator alert                                                                                                                                                             | `needingAttention` 0 after a 401 sign-in rejection                                                                                                                                                                                                                                                                                                                                                                                        | outbox failure handling                                                                                               | XC-05, XC-06                      | flag for attention; surface as "re-enter your VFT credentials" to the gym owner                                                               |
| F-04 | high     | A malformed `next_due_date` becomes an Invalid Date and `resolveAccessDecision` allows an Active member (fails open); a missing value throws in `parseCalendarDate`                                                                                      | code reading; column is NOT NULL in production (EV-10 SQL) so exposure is malformed text only                                                                                                                                                                                                                                                                                                                                             | `SupabaseAccessControlRepository.ts:1247`, `resolveAccessDecision`                                                    | EV-02, ACCESS-09                  | fail closed on an unparseable date                                                                                                            |
| F-05 | high     | Withdrawing consent on an active member deletes them from both readers and enqueues no reconcile job; they stay active and cannot get in                                                                                                                 | HW7 `Delete User 100012` DONE on A; snapshot "Held by none"; no job queued                                                                                                                                                                                                                                                                                                                                                                | consent withdrawal path (`withdraw`)                                                                                  | LC-07                             | enqueue a reconcile (or re-push) after withdrawal if the member is still entitled                                                             |
| F-06 | medium   | An undecodable session cookie gives HTTP 500 with an empty body instead of 401                                                                                                                                                                           | `api GET /api/access-control/devices --user tampered`                                                                                                                                                                                                                                                                                                                                                                                     | session decoding in route auth                                                                                        | AP-02, AUTH-04                    | catch decode errors and answer 401                                                                                                            |
| F-07 | medium   | Reader serial case is not normalised, and registration does not check the serial against the vendor                                                                                                                                                      | `hwcase0001` and `HWCASE0001` both registered (201) in one gym; fake serial `HWFAKE0001` accepted; a lower-case serial would not match vendor-case inbound scans                                                                                                                                                                                                                                                                          | `POST /api/access-control/devices`                                                                                    | AP-07, DEVICE-04, DEVICE-10       | upper-case on write; verify against the vendor device list                                                                                    |
| F-08 | medium   | A vendor base URL starting `http://` is accepted, so credentials could be sent unencrypted                                                                                                                                                               | `baseUrl` is `z.string().url()`; no TLS check or test                                                                                                                                                                                                                                                                                                                                                                                     | vendor account schema                                                                                                 | EV-06                             | require `https:`                                                                                                                              |
| F-09 | medium   | No rate limiting on login or API floods; a 5,000-event webhook delivery takes about 60 s with no event cap                                                                                                                                               | 20 bad logins all 401, no 429; 200 concurrent GETs all 200; 5000-event delivery returned 200 at about 60 s (client timed out twice)                                                                                                                                                                                                                                                                                                       | `/api/auth/login`, webhook route                                                                                      | AP-08, AP-09, SEC-02, WH-23       | rate-limit login; cap events per delivery                                                                                                     |
| F-10 | medium   | `completeJob` and `failJob` update by id only, so a reclaimed job can be overwritten by the slow worker that lost it                                                                                                                                     | code reading; XC-04 saw no harm in practice                                                                                                                                                                                                                                                                                                                                                                                               | `SupabaseAccessControlRepository` job completion                                                                      | EV-04, XC-04                      | guard on current status and claim token                                                                                                       |
| F-11 | medium   | `reclaim --older-than` is refused while any stranded device-operation job is in flight, so the XC-03 manual reclaim cannot run; the stranded `reboot_device` then ran twice                                                                              | reclaim REFUSED four times ("a real job is in flight", 3 in flight); production's own 600 s reclaim at 13:05:18 recovered the member jobs; reboot_device tries=2                                                                                                                                                                                                                                                                          | console `reclaim`, outbox reclaim                                                                                     | XC-03, OBS-08                     | let reclaim ignore or handle device-op jobs; decide whether a reader restart may repeat                                                       |
| F-12 | medium   | VFT never reports a remote door open as event 8, and a reader sends no events until someone does a local action on it                                                                                                                                    | remote opens of A and B at 11:03, 11:22, 12:17, 12:34 SLT all DONE return 0 and produced no event 8 in 120 to 540 s each; both readers started calling back only after a menu enrolment and a scan                                                                                                                                                                                                                                        | VFT behaviour, not our code                                                                                           | LD-03, LD-08, SOAK-01, R20, UI-03 | do not use event 8 from remote opens as proof of the callback; use finger scans                                                               |
| F-13 | low      | The Door Access card shows no capacity bar after capacity 100 was saved; double-clicking Re-send sends two full command sets with one toast                                                                                                              | `access_devices.template_capacity` = 100 for NYU7251900077; card text stayed "0" after a hard refresh; queues showed two sets per reader                                                                                                                                                                                                                                                                                                  | `src/features/access-control/components/DeviceStatusCard.tsx` (renders `N / cap` and a Progress when capacity is set) | LD-06                             | find why the capacity does not reach the card; debounce Re-send                                                                               |
| F-14 | low      | The retry limit constant reads 5 but a job dies on the 6th failure; the privacy page says 12 months while the code keeps 365 days, with no test tying them                                                                                               | code reading                                                                                                                                                                                                                                                                                                                                                                                                                              | `SupabaseAccessControlRepository.ts:909-917`; `privacy/page.tsx:484`                                                  | EV-03, EV-04                      | align constant and test; add a test linking the retention figure to the page                                                                  |
| F-15 | low      | `stub-log` prints the vendor sign-in request body, password included, in clear text                                                                                                                                                                      | seen by the lifecycle agent                                                                                                                                                                                                                                                                                                                                                                                                               | `scripts/hw-session.ts` `stub-log`                                                                                    | LC-03                             | redact credentials                                                                                                                            |
| F-16 | process  | The console refused the physical session its first move (`phase set physical`): the gate judged the phase being left. Fixed in commit `4c922da` (pull request 103). `hw coverage` now checks every runbook phase move from the phase it really starts in | mutation test: reintroducing the old gate makes coverage fail with "PH-01: phase set physical is refused at its start"                                                                                                                                                                                                                                                                                                                    | `scripts/hw-session.ts` (`phaseMoveRefusal`, scope `phase`)                                                           | LD-11                             | merge pull request 103                                                                                                                        |
| F-17 | process  | Runbook and console gaps found during the day                                                                                                                                                                                                            | PH-01 steps 12 and 13 and PH-03 prove the callback with event 8 (never sent); LC-07 has no step to re-push the member; OB-04 steps expect the lost reply on reader A but it always lands on B; XC-03 step 3 cannot run after a crash; case and task text still names the old Reader A serial; `e2e-account` prints only the enterprise gym; `snapshot` crashes with EPIPE when piped to `head`; E2E enterprise gym starts with no readers | runbook JSON, `scripts/hw-session.ts`                                                                                 | LD-03, LC-07, OB-04, XC-03, LD-05 | update the runbook before the next campaign                                                                                                   |
| F-18 | low      | Unexplained Device Reboot on reader B at about 10:19 SLT, minutes after reader A was re-registered; cause not established                                                                                                                                | queue entries `#68744` (B) and `#68745` (A) not issued by the lead                                                                                                                                                                                                                                                                                                                                                                        | unknown                                                                                                               | LD-02                             | none unless it recurs                                                                                                                         |

## 3. Tasks (all 56)

Outcome text is the first 320 characters of the recorded outcome; the full text is in the task document in the runbook tracker.

| task  | agent     | title                                                                              | status  | outcome                                                                                                                                                                                                                                                                                                                            |
| ----- | --------- | ---------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LD-01 | lead      | Remote day start: phase, deployment, the scheduled drain, the screen               | pass    | Phase idle. Prod dpl_5ReihV3YTh2ERsGeGRFsGHD3WdwV @ b5686e8 contains fix commit ef1df60. drain-access-sync success at 04:25/04:30/04:35 UTC (newest <5 min old). Door Access (owner report, 2026-10-09 ~10:20 SLT) lists exactly two readers: Device B (test) NYU7254500734 and Device A (test) NYU7251900077, both badge 'No co … |
| LD-02 | lead      | Both readers awake: Device B collects its backlog                                  | pass    | VFT confirmed both readers up all day, untouched (owner, 2026-10-09). Reader B NYU7254500734: whole queue DONE ret=0, incl. commands delivered 57,000s+ after commit (3 Oct backlog collected 2026-10-08, re-read today); fresh Device Reboot #68744 delivered 0s after commit. Reader A NYU7251900077 (replacement, registered …  |
| LD-03 | lead      | The callback, proven with a remote door open                                       | partial | Callback proven with real payloads from BOTH readers. B: 8 scans stored from ~12:15 SLT (owner reported B badge 'Online'; snapshot Online, last contact 12:16:28, skew -6s). A (NYU7251900077): silent until the owner enrolled a user directly on the device menu, then 3 scans at 12:34:07-12:34:19 SLT stored 3-4 s later; sa … |
| LD-04 | lead      | Create HW Test 5–10 for the remote agents                                          | pass    | HW Test 5-9 created (members #54-58, subjects 100010-100014, daily plan, texts suppressed x5), HW Test 10 (#53, existed cancelled) unparked; all six active, due 2027-04-27, Held by A+B, window sent, Blocked false. Reader A and B each collected the Set Valid Time Period commands for 100010-100014 within 1-2s of commit, …  |
| LD-05 | lead      | Desk preflight: the local dev server and the E2E gyms                              | partial | Dev server answers on :3100 (next dev --webpack, ACCESS_CONTROL_ENABLED=false). e2e-account: enterprise gym vendor account is_active false (output lists only the enterprise gym; no lite row). api GET /api/access-control/devices: enterprise -> 200 {success:true,data:[]}; lite -> 403 FORBIDDEN 'Access control hardware is … |
| LD-06 | lead      | Screens with the owner: the enrolment dialog, double presses, two sessions, capa … | partial | Owner at browser. Step1: enrol on Device A for HW Test 9, after ~2 min panel read 'Not confirmed yet. If the fingerprint was taken, it is confirmed the first time the member uses the door — reopen this member to check. Otherwise start again.' (waiting wording, no failure); Enroll User 100014 #68866 DONE ret=6 on A (>=0 … |
| LD-07 | lead      | Launch the parallel phase: four agents at once, and the soak                       | pass    | Approvals (owner, 2026-10-09 ~11:45 SLT): (a) approved: redeploy; (b) approved: load (OUT-03). Time 11:45 SLT, before 15:00. Phase idle -> parallel. Spawned in one message, no isolation: hw-remote-outbox, hw-remote-lifecycle, hw-remote-api, hw-remote-evidence (all launched). Soak started in background on HW Test 10, 60 … |
| LD-08 | lead      | The soak, and the optional redeploy during it                                      | partial | Soak 60 min on HW Test 10 finished 12:45 SLT: cycles 21, pushes 21, commandsSent 126, collected 143, notCollected 0, opens 7, opensSeen 0, errors 0, maxLatencyS 36, deadAtStart 0, deadAtEnd 0. Owner redeployed production at ~12:06 SLT (dpl_GuStfURk4KF8SEfFwwGEapcGfVJo, same commit b5686e8, READY by 12:14); soak cycles …  |
| LD-09 | lead      | Watch the parallel agents and sync their results                                   | pass    | All four parallel agents finished and reported (evidence EV-01..10, api AP-01..10, outbox OB-01..05, lifecycle LC-01..07); results synced in batches of 30, 9 and 1 documents. Safety checks at 11:51, 12:06, 12:14 and 12:38: dead jobs 0, 'Other (real) Titan subjects' newest change unchanged (2026-10-03). Evidence agent's … |
| LD-10 | lead      | The exclusive phase: one agent, both readers and the outbox                        | pass    | Phase set to exclusive 12:50 SLT, hw-remote-exclusive spawned once (OUT-03 load approved: yes), finished 13:3x with all 13 XC tasks recorded: 9 pass, 2 partial (XC-03, XC-04), 2 fail (XC-05, XC-10). Results synced. Dead jobs left at 6 by design (HW5, HW6, HW7, HW8 x2, HW10) from stubbed 429/500/502 tests; members put r … |
| LD-11 | lead      | Close the remote day                                                               | pass    | Remote day closed 2026-10-09 ~14:00 SLT. All 56 remote tasks run, recorded and synced to both trackers (non-pass: LD-03/05/06/08 partial, LC-07, AP-02/08/09 partial, AP-07 fail, XC-03/04 partial, XC-05/10 fail, all explained in their records). TIME-10: live webhook skew B -6..-10 s, A -3..-4 s; only the XC-10 events-pu … |
| OB-01 | outbox    | Start: your phase, your members                                                    | pass    | Phase parallel; HW Test 5 and 6 active, due 2027-04-27, held by A+B, Blocked false; no dead jobs, queues all DONE.                                                                                                                                                                                                                 |
| OB-02 | outbox    | One queued change, then two: a lapse and a renewal reach both readers              | pass    | Lapse: push allowed false, commandsSent 2; both readers got Access Block 100010 DONE ret 0 with no Set Valid Time Period in the window; snapshot Blocked true. Renewal (pay): A and B each got Access Grant then Set Valid Time Period DONE ret 0 in order (A #69013/#69015, B #69012/#69014); jobs wait completed a sync, 0 dea … |
| OB-03 | outbox    | Ordering across readers                                                            | pass    | Both readers applied window(+50) -> block -> grant -> window(+51) in ascending queue ID order, all DONE ret 0; snapshot HW6 Blocked false, window to 2026-11-29. Restored to +200 and pushed.                                                                                                                                      |
| OB-04 | outbox    | Lost replies: the vendor did it, we were told it failed                            | pass    | Lost reply (injected on reader B) after vendor applied: record not updated (HW5 window stayed 2027-04-27 / Blocked false / HW6 not yet cancelled-held-none), B applied it anyway (#69083 window +45; blocks #69087/#69113), retry repeated it with ret 0 (#69085 on B, #69086 on A), production's drain re-sent blocks (A #69096 … |
| OB-05 | outbox    | Close: your members back as you found them                                         | pass    | HW Test 5 and 6 active, due 2027-04-27, held A+B, Blocked false, window 2026-10-09 to 2027-04-27; drain synced both after last change (12:05:19); 0 dead jobs.                                                                                                                                                                     |
| LC-01 | lifecycle | Start: your phase, your members, your stub                                         | pass    | Phase parallel; HW Test 7 and 8 active, held by A+B, consent none; stub answering on 4012 with 0 requests.                                                                                                                                                                                                                         |
| LC-02 | lifecycle | A Sinhala or Tamil name reaches the readers as something                           | pass    | Sinhala and Tamil renames both pushed (applicable, pushed true, no error); vendor EmpName stayed non-empty and stable as HW_Test_7 (non-ASCII stripped, same as plain name, so no new reader command was queued in 120s - expected by D-10). Plain name restored.                                                                  |
| LC-03 | lifecycle | Consent survives a rename, and three updates at once                               | pass    | Consent (06:19:10Z) unchanged after rename and after enrol+rename+payment race (1062ms); stub got 1 enrolfinger command. Final name HW Test 7 Trio and due 2027-04-28 both survived (no lost update); name restored to HW Test 7.                                                                                                  |
| LC-04 | lifecycle | A consent write that fails dispatches nothing                                      | pass    | Enrol with failing consent write threw 'Simulated consent write failure'; stub command count stayed at 2 (both earlier HW7 enrols, none for employee 100013); HW8 consent still none.                                                                                                                                              |
| LC-05 | lifecycle | Cancel the same member twice at once                                               | pass    | Double cancel: one branch cancelled (4 commands sent), the other threw 'Cannot transition from suspended to suspended' cleanly. HW8 cancelled, blocked true, held by none; readers A and B each DONE ret=0 for Access Block + 2x Delete User 100013; no dead jobs.                                                                 |
| LC-06 | lifecycle | One change, one job; two concurrent changes, one consistent row                    | pass    | set-dates enqueued exactly 1 job. Race pay-vs-dates: payment threw the optimistic-lock error 'updated by another request', dates write won (due 2026-11-08), one job (622013ce) for the committed change. Reader A ended on window 20261009-20261108 (#69130 DONE ret=0), snapshot Window sent matches; no dead jobs.              |
| LC-07 | lifecycle | Close: members back, stub stopped                                                  | partial | Consent cleared on HW7 (withdraw: Delete User 100012 DONE ret=0 on A), stub stopped, jobs wait completed (no dead jobs), both members active and plainly named. But HW7 is Held by none (withdraw deletes the subject from both readers and nothing re-pushed it); the task expected A+B and offers no step to re-push HW7, so I … |
| AP-01 | api       | Start: the dev server, the E2E gyms, the ids you will need                         | pass    | Server answering, e2e-account inactive (console printed only the enterprise line, false), no readers existed so registered two; ids collected.                                                                                                                                                                                     |
| AP-02 | api       | Authentication: wrong password, unknown user, a broken session                     | partial | Wrong password and unknown user both 401 'Invalid username or password'; expired and anon 401; tampered cookie GET /api/access-control/devices answered 500 with empty body (no data leaked).                                                                                                                                      |
| AP-03 | api       | Entitlement: Lite sees the upgrade, and a tier change bites on the next request    | pass    | Lite page 200; lite API 403 naming Enterprise plan; enterprise downgraded -> next request 403, restored -> 200; lite upgraded -> 200 empty list only after change.                                                                                                                                                                 |
| AP-04 | api       | Cross-tenant reads: one gym reaching another gym's readers                         | pass    | Own reader PATCH 200; cross-gym and nonexistent id both 404 identical body 'Reader not found'; 5 random ids all 404; gymId query ignored (empty list); route folders take only [id] of device/member, no gym id.                                                                                                                   |
| AP-05 | api       | Cross-tenant writes: members, enrolment, body-supplied ids                         | pass    | All cross-tenant read/enrol/sync from lite returned 404 Member not found; member A consent unchanged (fingerEnrolled false); body gymId ignored, only own reader renamed, lite list empty; name and lite tier restored.                                                                                                            |
| AP-06 | api       | Input validation: every bad input answered 4xx, never 500                          | pass    | All bad inputs 4xx, no 500: null/negative/zero/long/control-char 400, duplicate 409, bad enum 400, forgotten id 404, text/plain 400, malformed JSON 400, 2MB body 400 (bounded), extra query ignored 200, polluted kind 200. No-content-type POST was accepted (201, parsed as JSON, valid body) - handled, cleaned up. HWVAL* r … |
| AP-07 | api       | Readers: a fake serial, the same serial twice at once, case and whitespace         | fail    | Fake serial HWFAKE0001 accepted 201 (known, no vendor check). 5 simultaneous registrations: 1x201, 4x409 (one owner). ' hwcase0001 ' stored trimmed but lower-case as 'hwcase0001' and 'HWCASE0001' was then ALSO accepted 201 as a second reader; scan for HWCASE0001 stored 1 on the upper-case reader. Test readers unlinked.   |
| AP-08 | api       | The webhook boundary: tokens, duplicates, bad payloads, paging                     | partial | Tokens: empty 404 (Next HTML, route never reached), short 401, 20 wrong all 401 in 0.8s with no limit; safeCompare uses crypto.timingSafeEqual (src/lib/access-control/crypto.ts:180-190, route.ts:70). x10 -> 1 stored 9 dup; x100 in one delivery stored 1 dup 99; 20 concurrent identical -> exactly 1 stored; bad event malf … |
| AP-09 | api       | Load, replay and brute force                                                       | partial | No 500s anywhere. Renames x50 and x100 all 200, final name 'Pressure' (a value sent). 200 GETs all 200 (no rate limit). Webhook x100 + PATCH x100 overlapped: all 200, trace totals received 100 = stored 4 + duplicates 96 (events share seconds), no loss. 20 bad logins all 401, no 429. Sync/enrol bursts (2,5,5) all answer … |
| AP-10 | api       | Close: the E2E gyms as you found them                                              | pass    | All test readers unlinked (enterprise list empty as AP-01 found it); enterprise tier enterprise/active, lite tier lite/trialing; vendor account inactive.                                                                                                                                                                          |
| EV-01 | evidence  | Start: the method, and a test run that works                                       | pass    | Phase parallel; AccessCommands.test.ts ran, 24/24 passed.                                                                                                                                                                                                                                                                          |
| EV-02 | evidence  | Dates and calendars: missing, malformed, boundaries, leap days                     | pass    | Ran AccessDecision+AccessCommands tests (47/47 pass). Only YYYYMMDD basic format and midnight boundary are pinned; no tests for missing/malformed due date, Intl zone, month/year/leap. Malformed date is an unsafe allow in code.                                                                                                 |
| EV-03 | evidence  | Database integrity: concurrent writes, rollback, triggers, retention               | pass    | Ran Drain/SaveCredentialsAtomicity/AccessEventRetention (27/27). Only DB-16 (app-level retry) and the 365 constant are pinned; concurrency, rollback and trigger-failure rest on SQL semantics with no test.                                                                                                                       |
| EV-04 | evidence  | Outbox semantics: thresholds, replay, poison, credentials                          | pass    | Ran crypto, Repository, Drain tests (48/48). Credential dead-letter is pinned; thresholds and throughput are not; no replay path exists.                                                                                                                                                                                           |
| EV-05 | evidence  | The scheduled jobs: late, overlapping, failing, stale                              | pass    | DrainAccessSyncQueue tests pass (part of 48/48 run). Batch isolation, reclaim ordering, remedy text pinned; delay, overlap, two-instance and cross-worker changes rest on SQL with no test.                                                                                                                                        |
| EV-06 | evidence  | The vendor contract: lengths, formats, encodings, methods, TLS                     | pass    | Ran src/lib/access-control, access-control-crons and RecordAccessEvents tests (170/170). Null and numeric tolerance pinned; methods match the collection by reading but are untested; TLS is not enforced.                                                                                                                         |
| EV-07 | evidence  | Restarts on a serverless platform                                                  | pass    | Drain tests pass (48/48 earlier run). Only reclaim-before-claim ordering is pinned; the rest rests on state living in Postgres, with no kill/restart test.                                                                                                                                                                         |
| EV-08 | evidence  | Tenancy edges and the security gate                                                | pass    | Webhook, access-control route and RecordAccessEvents tests pass (78/78). Serial uniqueness and cross-gym device refusal pinned; reassignment races and event-ownership history are not.                                                                                                                                            |
| EV-09 | evidence  | What the screen says when things go wrong                                          | pass    | ResendToast and accessControlClient tests pass (9/9). Pending shows as queued, not error (pinned); the failed branch, retry and session expiry have no test.                                                                                                                                                                       |
| EV-10 | evidence  | Close: the questions only the lead can answer                                      | pass    | Five SQL-FOR-LEAD queries recorded across EV-02,03,05,07,08, each a single read-only select.                                                                                                                                                                                                                                       |
| XC-01 | exclusive | Start: the exclusive phase, six members, a stub                                    | pass    | Phase exclusive; HW Test 5-10 active held A+B (HW9 consent, HW10 none); stub answering on 4013 with 0 requests.                                                                                                                                                                                                                    |
| XC-02 | exclusive | Restart Device A with a command in flight                                          | pass    | HW5 window (#69320, EndTime 20261123) and Device Reboot (#69321) both DONE ret=0 within seconds; a command pushed after the reboot (#69323, restore to 20270427) also collected and DONE in 4s. Reader A UserCount is not reported (null), so unchanged-count could not be measured.                                               |
| XC-03 | exclusive | The worker dies: mid-batch, after the vendor accepted, after marking done          | partial | Crash after 2 accepted commands (exit 137) left HW5 and HW6 jobs in_flight; the manual 'reclaim --older-than 30' was REFUSED 4 times ('a real job is in flight', 3 in flight, 1 not an HW member's - the device-op reboot_device from XC-02 that the crash drain also took), so the console reclaim+drain did not run. Productio … |
| XC-04 | exclusive | Two workers on one workload, and a reclaim while the original is still alive       | partial | Reclaim at 13:07:07 took 3 in_flight jobs (HW8-10) from live worker 1 (slow stub, 12s/command); worker 2 drain succeeded 3 and put 20261112/13/14 windows on A and B (each command once per reader, ret=0); worker 1 kept sending to the stub (6 commands, none reached readers) and finished, jobs end succeeded tries=2; final … |
| XC-05 | exclusive | The vendor down or erroring: retries, backoff, recovery                            | fail    | Unreachable vendor (4999): retrying 1, job failed tries 1 next +30s 'fetch failed'. Bare 500: failed retryable tries 1 next +30s. 500 with reason: dead, needingAttention 1 on first attempt. 502: failed retryable, retrying, later succeeded (tries 2) via production drain. 429: dead-lettered on first attempt (needingAtten … |
| XC-06 | exclusive | Timeouts and bad answers: hangs, garbage, business failures, auth                  | pass    | Hang: gave up with 'The operation was aborted due to timeout', failed retryable tries 1 next +30s. Garbage HTML: drain continued, job succeeded tries 1 (unfamiliar 200 read as queued). Bizfail: 'failed: invalid subject' dead on first attempt, needingAttention flagged, no retry (also dead-lettered the HW5 retry on re-cl … |
| XC-07 | exclusive | Consent written at the same instant as the enrolment request                       | pass    | Race settled in 3677ms, both enrolments dispatched; HW10 consent set once (2026-10-09 13:21). Reader A got two 'Enroll User 100009, Finger 0' (#69394, #69395), both DONE ret=6 (timed out, no finger); no enroll command without consent; reader returned to idle (later commands none stuck).                                    |
| XC-08 | exclusive | Edit the member while their enrolment is pending                                   | pass    | With enrol pending on B (#69400 Enroll 100014 ret=6), rename and a 1 LKR payment left HW9 consent 2026-10-09 10:47 intact; vendor EmpName became HW_Test_9_Renamed and was restored to HW_Test_9; our record, queue (Set Valid Time Period to 20270428 on A and B, ret=0) and vendor agree.                                        |
| XC-09 | exclusive | Cancel one member while another's enrolment is in flight                           | pass    | Enrol mode on A for HW9 (#69403 Enroll 100014, ret=6) did not disturb HW9 (still active, consent 10:47, held A+B); HW8 cancelled and blocked, readers got Delete/Access Block/Delete User 100013 (#69405, #69408, #69410) on A. Reactivated HW8 (active, A+B).                                                                     |
| XC-10 | exclusive | Pull the readers' attendance logs (GetEventsbyDevSN)                               | fail    | events-pull on A (#69418 Get Events By Device, ret=39) re-delivered A's 3 stored scans through the webhook: stored count rose 11 -> 14, as 3 new rows stamped reader clock 07:04:07/13/19 (the same events as 12:34:07/13/19, shifted -5h30 as if read as UTC) so they were inserted a second time instead of deduplicated.        |
| XC-11 | exclusive | Forget Device B with work queued, then link it again                               | pass    | HW6 change queued, B forgotten, drain succeeded 2: B got no command naming 100011, A got #69428 (EndTime 20261126) ret=0. B re-linked (new id 95d7b6b9-2dad-4409-bf5c-e9cb84518585); forced resend for HW6 sent 6 commands and B queue shows #69430 Update, #69432 Access Grant, #69434 Set Valid Time Period, all DONE ret=0. R … |
| XC-12 | exclusive | One hundred commands queued on reader A (only if the owner approved)               | pass    | Burst of 34 forced HW7 pushes (9.6s, console reports 204 commands sent, 0 failures) was fully collected: 100 commands on A (#69439-#69626) and 100 on B (#69462-#69640), all DONE ret=0, last transmitted 13:32:37 about 37s after commit at 13:32:00; none stuck (early NEVER SENT rows were transient and cleared).              |
| XC-13 | exclusive | Close: everything as the lead expects it                                           | pass    | HW Test 5-10 active, held A+B (HW10 re-pushed after the XC-07 withdraw removed it), a sync completed for every member after my last change, stub stopped. Both readers linked; B shows 'No contact yet' (new record after re-link) though its queue is collecting. Six deliberately dead jobs from XC-05/06 remain; the members …  |

## 4. Case verdicts (210)

Source task is the task that decided the case. `evidence` rows come from code reading (EV-*); the others from running the thing.

| case       | verdict | task  |
| ---------- | ------- | ----- |
| ACC-04     | pass    | OB-03 |
| ACC-05     | pass    | AP-05 |
| ACC-10     | partial | EV-08 |
| ACCESS-02  | pass    | OB-02 |
| ACCESS-08  | gap     | EV-02 |
| ACCESS-09  | fail    | EV-02 |
| ACCESS-11  | gap     | EV-02 |
| ACCESS-12  | gap     | EV-02 |
| ACCESS-13  | gap     | EV-02 |
| ACCESS-14  | gap     | EV-02 |
| AMB-02     | pass    | OB-04 |
| AMB-03     | pass    | OB-04 |
| AMB-04     | pass    | OB-04 |
| AMB-05     | pass    | OB-04 |
| AUTH-02    | pass    | AP-02 |
| AUTH-03    | pass    | AP-02 |
| AUTH-04    | partial | AP-02 |
| AUTH-06    | pass    | AP-04 |
| AUTH-09    | pass    | AP-03 |
| AUTH-10    | pass    | AP-03 |
| CONC-01    | partial | AP-09 |
| CONC-02    | partial | AP-09 |
| CONC-04    | pass    | AP-09 |
| CONC-05    | pass    | AP-09 |
| CONSENT-03 | pass    | LC-04 |
| CONSENT-04 | pass    | XC-07 |
| CONSENT-07 | pass    | LC-03 |
| CONSENT-08 | pass    | LC-03 |
| CRON-01    | pass    | LD-01 |
| CRON-02    | gap     | EV-05 |
| CRON-03    | gap     | EV-05 |
| CRON-04    | gap     | EV-05 |
| CRON-05    | pinned  | EV-05 |
| CRON-06    | pinned  | EV-05 |
| CRON-07    | partial | EV-05 |
| CRON-08    | gap     | EV-05 |
| CRON-12    | gap     | EV-03 |
| DATA-03    | pass    | OB-04 |
| DATA-04    | pass    | LD-06 |
| DATA-09    | pass    | XC-08 |
| DB-11      | pass    | LC-06 |
| DB-12      | gap     | EV-03 |
| DB-13      | gap     | EV-03 |
| DB-14      | gap     | EV-03 |
| DB-15      | pass    | LC-06 |
| DB-16      | pinned  | EV-03 |
| DEVICE-01  | pass    | LD-02 |
| DEVICE-02  | pass    | LD-02 |
| DEVICE-04  | pass    | AP-07 |
| DEVICE-06  | pinned  | EV-08 |
| DEVICE-07  | pass    | XC-11 |
| DEVICE-09  | pass    | AP-07 |
| DEVICE-10  | fail    | AP-07 |
| ENR-10     | pass    | XC-07 |
| ENR-14     | pass    | LD-06 |
| ENR-17     | pinned  | EV-06 |
| ENR-20     | fail    | XC-10 |
| ENR-24     | pass    | LC-05 |
| ENR-26     | pass    | OB-04 |
| ENR-27     | pass    | LC-05 |
| ENR-28     | na      | EV-06 |
| ENR-31     | pass    | XC-09 |
| FAIL-01    | pass    | XC-05 |
| FAIL-02    | pass    | XC-05 |
| FAIL-03    | pass    | XC-05 |
| FAIL-04    | fail    | XC-05 |
| FAIL-05    | pass    | XC-05 |
| FAIL-06    | pinned  | EV-06 |
| FAIL-07    | gap     | EV-06 |
| FAIL-08    | pass    | XC-03 |
| FAIL-09    | gap     | EV-07 |
| FAIL-10    | pinned  | EV-07 |
| FAIL-11    | pass    | XC-10 |
| FAIL-14    | pass    | XC-02 |
| FAIL-15    | pass    | XC-06 |
| FAIL-16    | pass    | XC-06 |
| OBS-03     | pass    | AP-08 |
| OBS-04     | pinned  | EV-04 |
| OBS-05     | pass    | AP-04 |
| OBS-06     | pass    | XC-06 |
| OBS-08     | partial | XC-03 |
| OBS-09     | pass    | AP-08 |
| OUT-01     | pass    | OB-02 |
| OUT-02     | pass    | OB-02 |
| OUT-03     | pass    | XC-12 |
| OUT-04     | gap     | EV-04 |
| OUT-06     | pass    | XC-04 |
| OUT-08     | pass    | XC-04 |
| OUT-09     | partial | XC-04 |
| OUT-12     | pass    | XC-03 |
| OUT-13     | pass    | XC-03 |
| OUT-14     | pass    | OB-04 |
| OUT-15     | gap     | EV-04 |
| OUT-16     | gap     | EV-04 |
| OUT-17     | pass    | XC-05 |
| OUT-18     | pass    | XC-06 |
| OUT-19     | pass    | XC-06 |
| OUT-20     | pass    | OB-03 |
| OUT-21     | pinned  | EV-04 |
| P0.7       | pass    | LD-04 |
| R6         | pass    | XC-07 |
| R9         | pass    | AP-08 |
| R10        | pass    | XC-04 |
| R11        | partial | XC-04 |
| R12        | pass    | XC-04 |
| R13        | pass    | XC-11 |
| R14        | gap     | EV-08 |
| R15        | pass    | XC-08 |
| R16        | pass    | AP-08 |
| R20        | partial | LD-08 |
| RACE-02    | pass    | LC-05 |
| RACE-07    | pass    | XC-08 |
| RACE-10    | pass    | XC-11 |
| RACE-11    | gap     | EV-08 |
| RACE-12    | pass    | XC-04 |
| RACE-13    | pass    | AP-08 |
| RC-02      | pass    | XC-05 |
| RC-03      | pass    | XC-06 |
| RC-04      | pass    | XC-06 |
| RC-06      | pass    | LD-03 |
| RC-09      | pass    | OB-04 |
| REAL-04    | pass    | XC-05 |
| REAL-05    | pass    | LD-08 |
| REAL-06    | pass    | AP-09 |
| REAL-07    | pass    | XC-03 |
| REAL-08    | pass    | LD-02 |
| REC-01     | gap     | EV-07 |
| REC-02     | gap     | EV-07 |
| REC-03     | pass    | XC-03 |
| REC-04     | pass    | XC-03 |
| REC-05     | gap     | EV-07 |
| REC-06     | pinned  | EV-07 |
| REC-07     | pass    | XC-03 |
| REC-09     | gap     | EV-07 |
| REC-10     | gap     | EV-07 |
| SEC-01     | pass    | AP-09 |
| SEC-02     | pass    | AP-08 |
| SEC-04     | pass    | AP-08 |
| SEC-05     | partial | AP-09 |
| SEC-06     | pass    | AP-04 |
| SEC-07     | pass    | AP-05 |
| SEC-08     | pass    | AP-06 |
| SEC-09     | pass    | AP-06 |
| SEC-10     | pass    | AP-06 |
| SEC-11     | pass    | AP-06 |
| SEC-12     | pass    | AP-09 |
| SEC-13     | partial | AP-09 |
| SOAK-01    | partial | LD-08 |
| STATUS-03  | pass    | LD-02 |
| STATUS-06  | pass    | OB-04 |
| STATUS-07  | pass    | XC-06 |
| STATUS-09  | pass    | XC-02 |
| TENANT-01  | pass    | AP-04 |
| TENANT-03  | pass    | AP-04 |
| TENANT-06  | pass    | AP-05 |
| TENANT-07  | pass    | AP-05 |
| TENANT-08  | pass    | AP-08 |
| TENANT-09  | pinned  | EV-08 |
| TENANT-10  | gap     | EV-08 |
| TENANT-14  | na      | AP-04 |
| TENANT-15  | pass    | AP-04 |
| TENANT-16  | pass    | AP-05 |
| TIME-07    | pass    | LD-03 |
| TIME-10    | pass    | LD-11 |
| TIME-11    | gap     | EV-02 |
| TIME-12    | gap     | EV-02 |
| TIME-13    | gap     | EV-02 |
| TIME-14    | gap     | EV-02 |
| UI-02      | pass    | LD-01 |
| UI-03      | pass    | LD-03 |
| UI-06      | partial | EV-09 |
| UI-07      | gap     | EV-09 |
| UI-08      | pass    | LD-06 |
| UI-09      | gap     | EV-09 |
| UI-10      | pass    | LD-06 |
| UI-11      | pass    | LD-06 |
| UI-12      | pass    | LD-06 |
| UI-13      | pass    | LD-06 |
| UI-14      | pass    | AP-03 |
| VAL-02     | pass    | AP-06 |
| VAL-06     | pass    | AP-06 |
| VAL-07     | pass    | AP-06 |
| VAL-09     | pass    | AP-06 |
| VAL-12     | pass    | LC-02 |
| VAL-13     | pass    | AP-06 |
| VAL-14     | pass    | AP-06 |
| VAL-15     | pass    | AP-06 |
| VAL-16     | pass    | AP-06 |
| VAL-17     | pass    | AP-06 |
| VAL-18     | pass    | AP-05 |
| VAL-20     | pass    | AP-06 |
| VAL-21     | pass    | AP-06 |
| VAL-23     | pass    | AP-06 |
| VAL-24     | pass    | AP-06 |
| VEND-04    | gap     | EV-06 |
| VEND-07    | pinned  | EV-06 |
| VEND-08    | pass    | LD-03 |
| VEND-10    | gap     | EV-06 |
| VEND-11    | pinned  | EV-06 |
| VEND-13    | gap     | EV-06 |
| VEND-16    | pass    | XC-06 |
| VEND-17    | partial | XC-05 |
| VEND-18    | gap     | EV-06 |
| VEND-21    | pass    | LD-03 |
| WH-03      | pass    | AP-08 |
| WH-04      | pass    | AP-08 |
| WH-10      | pass    | AP-08 |
| WH-11      | pass    | AP-08 |
| WH-23      | partial | AP-08 |
| WH-25      | pass    | AP-08 |

## 5. Environment facts established

- Reader A was replaced before the day: serial `NYU7251900066` became `NYU7251900077`. The owner registered it in the app; the console constant `READERS.A` was changed (pull request 103). Reader B is `NYU7254500734`, unchanged but forgotten and re-linked in XC-11 (new id in our records).
- Production: `dpl_5ReihV3YTh2ERsGeGRFsGHD3WdwV` at commit `b5686e8` contained fix commit `ef1df60`. The owner redeployed at 12:06 SLT to `dpl_GuStfURk4KF8SEfFwwGEapcGfVJo` (same commit, READY by 12:14). Soak cycles 8 and 9 spanned it and lost nothing.
- Webhook payload from real readers is an array of objects with string values: `EmpId`, `Event`, `AttTime`, `DeviceID`, `VerifyType`, `CheckingStatus`. `AttTime` is local Sri Lanka time `YYYY-MM-DD HH:mm:ss` with no zone; stored as UTC (5 h 30 min earlier). Observed `Event` 3, `VerifyType` 1. Delivery delay (reader time minus stored time): reader B -6 to -10 s, reader A -3 to -4 s.
- The endpoint answers 200 for a valid token (an unknown serial is counted and dropped, logged as `Access webhook delivery` with `unknownDevice`), 401 for a wrong token, and 404 for an empty token (the route is never reached). A 401 writes no log line, so "VFT never called" and "VFT called with a wrong token" look the same in the runtime log.
- VFT began delivering only after (a) its callback was registered for the account and (b) a local action on each reader. Remote opens never produce event 8.
- `Enroll User` returned 6 on every attempt that timed out and 0 on the one attempt (#69128) where the owner's finger was taken. The reader leaves enrolment mode quickly; the panel spinner runs about 2 min 10 s.
- Command delivery: 1 to 3 s after commit in normal operation; maximum 36 s in the soak; 100 commands per reader in the load test, last sent about 37 s after commit. Console pace was 1 to 4 requests per second, under the 5 per second production's drain assumes; no 429 came from the real vendor.
- Presence: the vendor sends no heartbeat, so a reader shows "Not responding" after a quiet spell and "No contact yet" after a re-link. A fresh scan restores "Online" and the real clock offset.
- The E2E enterprise gym had no readers at the start; the API agent registered `HWE2E0001` and `HWE2E0002` and removed them. Its vendor account must stay inactive, so sync and enrol bursts get a clean 400 ("Access control is not set up for this gym yet").

## 6. State left behind at the remote close (about 14:00 SLT)

| item                    | state                                                                                                                                                                  | restored                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| phase                   | idle                                                                                                                                                                   | yes                       |
| HW Test 5 to 10         | cancelled, blocked, held by no reader; HW Test 7 and 9 due 2027-04-28 (others 2027-04-27)                                                                              | yes, except the due dates |
| dead jobs               | 6, from deliberate stub failures (HW Test 5, 6, 7, 8 twice, 10); error texts: 429, 500, 502, "invalid subject", sign-in 401                                            | left on purpose           |
| reader A                | serial `NYU7251900077`; capacity cleared through the console; 3 extra mis-stamped scan rows from XC-10                                                                 | partly                    |
| reader B                | new id `95d7b6b9-2dad-4409-bf5c-e9cb84518585` in our records                                                                                                           | left on purpose           |
| both readers            | hold device-local users (EmpId 1 and 2) from the owner's menu enrolments                                                                                               | left on purpose           |
| dev server and E2E gyms | dev server stopped; E2E vendor account inactive; tiers enterprise/active and lite/trialing                                                                             | yes                       |
| E2E event rows          | webhook-test rows remain (no console step deletes them)                                                                                                                | left                      |
| real Titan members      | untouched; newest change 2026-10-03 16:30:23                                                                                                                           | yes                       |
| code                    | `scripts/hw-session.ts`: Reader A serial and the phase-gate fix, both on pull request 103 (branch `chore/hw-session-reader-a-serial`, commits `a78efce` and `4c922da`) | not merged                |

## 7. Open actions

- [ ] Merge pull request 103. The merge triggers a production build; the release job makes no release for a `chore`.
- [ ] Rotate `ACCESS_CONTROL_WEBHOOK_TOKEN` in Vercel and `.env.local` and register the new URL with VFT (the token was pasted into the working session on 2026-10-09).
- [ ] Rotate the VFT account password.
- [ ] Fix F-01 to F-05 first, then F-06 to F-12.
- [ ] Update the runbook for F-12, F-16 and F-17, including the new Reader A serial.
- [ ] Decide whether the 6 dead jobs, the 3 mis-stamped scan rows and the E2E event rows should be cleaned up.

## 8. Records

- Runbook tracker (one document per task: outcome, case verdicts, observations, findings): https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL, collection `results`.
- Campaign tracker (one row per case): https://claude.ai/artifact/EgC9mSfKccoq29nGH9rRNC, collection `results`.
- Local: `backups/hw-session/results/<agent>/<TASK>.json`; soak summary `backups/hw-session/lead/2026-10-09T07-15-57-704Z-soak.json`; final exclusive snapshot `backups/hw-session/exclusive/2026-10-09T08-05-36-189Z-snapshot.json`.
- Readable version: https://claude.ai/artifact/CcLzneTJNxrE2AKSQBB86B.
- Code: https://github.com/metric-gym-manager/metric-gym-manager/pull/103.
- This report covers the remote track only. The physical session records its own results.

## 9. Appendix: findings and observations as recorded, per task

Verbatim from the task records, remote tasks only. Entries starting `SQL-FOR-LEAD` were run by the lead and answered in LD-09.

### LD-01

- finding: Reader A hardware replaced before the day: serial NYU7251900066 -> NYU7251900077. Owner re-registered it in the app and authorised a LOCAL, uncommitted one-line edit of READERS.A at scripts/hw-session.ts:188 (an exception to the no-code-changes rule). Runbook/tracker/case text still names ...066; the committed console must be updated after the campaign.
- observation: Snapshot evidence backups/hw-session/lead/2026-10-09T04-47-57-197Z-snapshot.json. Vendor records both updated within seconds of 10:17 SLT (A 'Dev1', B 'Device B (test)'). Our presence column says 'No contact yet' for both even though the vendor sees them.

### LD-02

- finding: DEVICE-01 verified against replacement serial NYU7251900077, not NYU7251900066 (hardware replaced). Cause of the reboot on Reader B at ~10:19 SLT not established.
- observation: Backlog landing was observed 2026-10-08 (see earlier LD-02 record), not live today; today's read shows it all DONE. A-9 latency: 0-3s for fresh commands on both readers. Some vendor 'committed' times are in the future (e.g. 2026-10-10 00:05 SLT) giving negative latencies on B: vendor timestamp/clock quirk, delivery unaffected. Unexpected Device Reboots #68744 (B) and #68745 (A) appeared at ~10:19 SLT, not issued by lead; likely from re-registering A.

### LD-03

- finding: A reader only starts calling back after a device-local interaction (owner's observation; B then A). Remote door open is never reported as event 8 through VFT, so 'remote open proves the callback' (LD-03 premise) does not hold; soak/open-event checks must use scans.
- observation: UI-03 judged on owner's B badge reading (Online after first events); A badge not read by the owner after its first events. Soak opensSeen will read 0 because VFT does not forward remote-open event 8. Callback only began after VFT fix + a local interaction on each reader.

### LD-04

- observation: Step 8 expected wording was 'REFUSED: not an HW test member'; the console answered with the no-match error instead. Same effect (real member not addressable, no write), different message. Snapshot also shows HW Test 10 window start 2026-10-07 (parked earlier), others 2026-10-09.

### LD-05

- finding: E2E enterprise gym has no fake readers (access_devices empty): api-agent tasks that name E2E devices may block or be unrunnable; lead cannot seed them (no console command).
- observation: Runbook expects 'enterprise 200 with the E2E readers' (two fake readers); none exist, so any api task that needs <E2E_DEVICE_1>/<E2E_DEVICE_2> has no device to use.

### LD-06

- finding: UI DEFECT (owner-directed): with capacity 100 saved for Device A, the Door Access card shows no capacity bar after a hard refresh; owner did not report whether the line read '0 / 100'. Code in DeviceStatusCard.tsx renders 'N / cap' + Progress when templateCapacity is set, so the page is not receiving it or the 0% bar is invisible. Needs a look after the campaign.
- observation: Double-click Re-send sends two full command sets per reader though only one toast shows; harmless (idempotent) but the button is not debounced. sim H-4 (warning threshold) not reachable on near-empty reader. Free-space gave a benign message with 0 candidates (H-19).

### LD-07

- observation: Known before launch: webhook delivers no reader events (soak opensSeen will read 0); E2E enterprise gym has no fake readers (api agent tasks naming E2E devices may block).

### LD-08

- finding: Soak open-event check unmeasurable through VFT (no event 8 for remote opens); the other soak criteria all clean.
- observation: opensSeen 0 of 7 opens: VFT does not report remote-open as event 8, so 'every open's event 8 arrived' and 'no lost event across the redeploy' cannot be measured; commands lost across the redeploy: none. Evidence: backups/hw-session/lead/2026-10-09T07-15-57-704Z-soak.json

### LD-09

- observation: Agent findings to read at the close: API: tampered cookie 500; serial case not normalised; no vendor check on register; no rate limits; 5000-event delivery about 60 s. Lifecycle: stub-log prints the vendor sign-in body incl. password in clear. Evidence: five code gaps listed in EV-02..09 (fail-open on malformed next_due_date, 5-vs-6 attempt boundary, http baseUrl accepted, job completion by id only, privacy 12 months vs 365 days).

### LD-10

- observation: Agent reports: FAIL-04 429 dead-letters on first attempt and a drain kills earlier retryable jobs it re-claims; 401 sign-in rejection dead on first attempt, needingAttention 0; reclaim --older-than refuses while a stranded reboot_device job is in flight (XC-03 manual reclaim unrunnable, production's 600 s reclaim recovers); events-pull re-delivery not idempotent (+3 rows) and shifts timestamps 5.5 h (reader A skew -22844 s).

### LD-11

- observation: Open items for the physical session: (1) PH-01 steps 12-13 / PH-03 prove the callback with a remote open and event 8: VFT never sends event 8 for remote opens, so use a finger scan for liveness (callback is live for scans on both readers, 3-10 s). (2) Both readers now hold device-local users (EmpId 1 and 2) from the owner's menu enrolments. (3) HW Test 1-4 not yet created. (4) scripts/hw-session.ts:188 local uncommitted edit (READERS.A = NYU7251900077). (5) Rotate ACCESS_CONTROL_WEBHOOK_TOKEN and the VFT password after the campaign. (6) Reader B has a new id (95d7b6b9-...) from XC-11.

### OB-01

- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/outbox/2026-10-09T06-15-53-900Z-snapshot.json

### OB-02

- observation: blockA=68987
- observation: blockB=68985
- observation: grantA=69013 windowA=69015 grantB=69012 windowB=69014
- observation: restore=due 2027-04-27 pushed, commandsSent 2

### OB-03

- observation: A ids=69041,69066,69068,69070
- observation: B ids=69040,69065,69067,69069

### OB-04

- observation: lost reply hit reader B (NYU7254500734) every time; push aborted before A, so A got the command only on the retry/drain
- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/outbox/2026-10-09T06-30-41-789Z-snapshot.json
- observation: vendor record HW5 end 20261123 while blocked (no window sent after block), HW6 IsDelete 0 at snapshot
- observation: restore: HW5 due 2027-04-27 push sent 4; HW6 reactivated push sent 6

### OB-05

- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/outbox/2026-10-09T06-35-37-993Z-snapshot.json

### LC-01

- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/lifecycle/2026-10-09T06-15-54-590Z-snapshot.json
- observation: subjects=100012,100013

### LC-02

- observation: vendor_EmpName_after_sinhala=HW_Test_7
- observation: vendor_EmpName_after_tamil=HW_Test_7
- observation: queue_A=no matching command committed for subject 100012 in 120s after Sinhala rename (name unchanged after ASCII strip)

### LC-03

- finding: stub-log prints the vendor sign-in request body including the account password in clear text (hw-session stub-log redaction gap)
- observation: consent_T=2026-10-09T06:19:10.273Z
- observation: race_final_name=HW Test 7 Trio
- observation: race_final_due=2027-04-28 (was 2027-04-27; payment recorded)
- observation: window_sent_still=2026-10-09->2027-04-27 at snapshot time

### LC-04

- observation: stub_commands_before=2
- observation: stub_commands_after=2
- observation: note=stub-log --since 2m still listed the 11:49 entries (window not filtering or they were within 2m); verdict from total count and employeeId

### LC-05

- observation: race_ms=3700
- observation: readerA=#69033 Delete, #69034 Access Block, #69038 Delete all DONE ret=0
- observation: readerB=#69030 Access Block, #69031 Delete, #69036 Delete all DONE ret=0
- observation: dead_jobs=0

### LC-06

- observation: set_dates_job=82149698 (1 new)
- observation: race_job=622013ce
- observation: race_ms=411
- observation: winning_due=2026-11-08 (+30 date write); pay lost cleanly
- observation: readerA_final=#69130 Set Valid Time Period 20261009-20261108 DONE ret=0
- observation: note=first window 20261208 never sent to reader; drain coalesced to final state

### LC-07

- finding: withdraw leaves an active member removed from both readers (Held by none) with no reconcile job enqueued; LC-07 expects HW7 back on A+B
- observation: HW7=active, due 2027-04-28, consent none, held none, window sent 20261009-20270428
- observation: HW8=active, due 2027-04-27, consent none, held A+B
- observation: stub=stopped pid 229533 (background task exit 143 is the stop)
- observation: jobs_wait=complete; HW7 not in wait list since withdraw enqueued no job

### AP-01

- observation: baseline enterprise gym tier=enterprise active; lite gym tier=lite trialing; initial reader list empty

### AP-02

- finding: an undecodable session cookie gives 500 instead of 401 (GET /api/access-control/devices --user tampered)
- observation: tampered=500 empty body, content-type none

### AP-03

- observation: enterprise gym restored; lite gym left on enterprise until AP-05

### AP-04

- observation: log: bare '<METHOD> <path> 404 in Nms' lines, no reason or gym id
- observation: TENANT-14 na: no route has a gym id in its path (checked with find, since Glob not available to me)

### AP-06

- observation: big body rejected 400 on deviceName length after 4.8s

### AP-07

- finding: serial case not normalised: hwcase0001 and HWCASE0001 coexist as two readers in one gym; a lower-case serial would not match vendor-case inbound scans
- observation: DEVICE-04: accepted without vendor validation (decision for the lead)
- observation: log: stored 1 unknownDevice 0 for HWCASE0001 scan

### AP-08

- finding: 5000-event webhook delivery takes ~60s to process (200 at 60s) - no event cap, ties up a request
- observation: WH-03 empty token = 404 (not 401); no route log line, so distinct from not-configured console.error
- observation: WH-23 huge: 200 in 60s server-side, no delivery trace line seen; client timed out
- observation: SEC-04 modified payload accepted as new scan (documented)

### AP-09

- finding: no rate limiting on /api/auth/login (20 failed attempts all 401, no 429) or on API floods (200 concurrent GETs all 200)
- observation: no rate limit on API flood (200 ok) or login brute force (20x401, no 429)

### AP-10

- observation: final enterprise devices=[]

### EV-02

- finding: Malformed next_due_date yields Invalid Date and resolveAccessDecision allows an Active member (fails open); missing value throws in parseCalendarDate
- observation: ACCESS-08: input type nextDueDate is non-null Date (AccessDecision.ts:40); repo parseCalendarDate(null) throws TypeError at SupabaseAccessControlRepository.ts:1247-1249 (crash, not allow); no test. SQL-FOR-LEAD: select is_nullable from information_schema.columns where table_name='members' and column_name='next_due_date'
- observation: ACCESS-09: parseCalendarDate('garbage') -> Invalid Date; resolveAccessDecision AccessDecision.ts:~128 'today > dueDate' is false for NaN so an Active member is ALLOWED with Invalid validTo; no guard (no isNaN in domain); no test
- observation: ACCESS-11/TIME-11: code uses Intl.DateTimeFormat with GYM_TIMEZONE at utils/getGymToday.ts:46 (claim verified by reading), no test asserts it
- observation: ACCESS-12/13/14, TIME-12/13/14: addDays/formatDeviceDate use UTC Date arithmetic (getGymToday.ts addDays, formatDeviceDate) which handles rollover natively; only test is AccessCommands.test.ts:127-136 (20251215/20260115) and midnight boundary AccessDecision.test.ts:64; no month/year/leap fixtures anywhere

### EV-03

- observation: DB-12: recount_device_templates (migration 20260810000002:124-150) recomputes from truth then plain UPDATE access_devices, no row lock; last-writer-wins on a derived count; no test
- observation: DB-13: no test of register_member_guarded or claim RPC rollback; claim uses FOR UPDATE SKIP LOCKED (20260810000002:103). Only app-level analogue SaveCredentialsAtomicity.test.ts:56-70 (no account row on bad key, mocked client)
- observation: DB-14: trg_enqueue_access_sync is AFTER INSERT/UPDATE FOR EACH ROW, same txn (20260810000001:246-290), so a raise rolls back the member write by Postgres semantics; no test asserts it; SQL-FOR-LEAD: select tgname, tgenabled from pg_trigger where tgname='trg_enqueue_access_sync'
- observation: DB-16: DrainAccessSyncQueue.test.ts:168-171 and :253-257 failed+retryable settle reschedules, job not dropped (mock repo, not real DB)
- observation: CRON-12: constant 365 pinned at AccessEventRetention.test.ts:93; privacy page says '12 months' at src/app/privacy/page.tsx:484-485; marketing pages render the constant (MarketingPages.test.tsx:320); no test ties privacy page to constant; 12 months vs 365 days differ by up to a day
- observation: E-2: no definition found in repo docs; same method, see DB cases

### EV-04

- finding: SYNC_MAX_ATTEMPTS is 5 (backoff length) though the job dies on the 6th failure; constant misleading, boundary untested
- observation: OUT-04: DRAIN_BATCH_SIZE=25 (AccessControlConfig.ts:183) per */5 cron (vercel.json:42-43) = 300 jobs/h; 1000 queued drains in ~3.3h only if arrivals <300/h, else grows; claim is one-in-flight per member (DISTINCT ON) so a single member's burst drains 1 per run; no test
- observation: OUT-15: SYNC_MAX_ATTEMPTS = SYNC_RETRY_BACKOFF_SECONDS.length = 5 (AccessControlConfig.ts:149-152), NOT 6; but failJob (SupabaseAccessControlRepository.ts:909-917) dead-letters when backoff[attempts-1] is undefined, i.e. when attempts=6 (6th failure). Tests only use attempts 1 and 99 (SupabaseAccessControlRepository.test.ts:323-355); boundary 5 vs 6 unasserted; SYNC_MAX_ATTEMPTS is exported but unused in logic
- observation: OUT-16: confirmed no code moves dead -> pending (only Dead writes at Repository.ts:916; health route reads them). Gym workaround: edit the member (trigger enqueues new reconcile_member job), POST /api/access-control/members/[id]/sync force re-assert, or wait for daily reconcile 18:30 UTC (vercel.json:38); old dead row stays. No test of that
- observation: OUT-21: DrainAccessSyncQueue.test.ts:176-198 CredentialDecryptionError -> deadLettered 1, retrying 0, retryable false, needingAttention 1; absent-key stays retryable crypto.test.ts:88-89, wrong key false :103,:112
- observation: OBS-04: message ends 'Re-enter the account credentials' (crypto.ts:104-105), asserted crypto.test.ts:55; Drain passes message to failJob -> last_error (Drain.ts:152-160, Repository.ts:928); no single test asserts last_error contains the remedy end to end
- observation: E-5, F-1: no definitions found in repo; same method, see cases

### EV-05

- observation: CRON-02: due-ness is next_attempt_at <= NOW() in claim (20260810000002:92), so a late run simply picks up overdue jobs; batch cap 25 means catch-up is slow; no test
- observation: CRON-03/04: claim_access_sync_jobs uses DISTINCT ON member + FOR UPDATE SKIP LOCKED with re-check under lock (20260810000002:84-110), design is sound but only SQL, tests use FakeAccessControlRepository (no concurrency); no test; live proof needs two concurrent drains
- observation: CRON-05: DrainAccessSyncQueue.test.ts:110-153 'finishes the batch when one member throws'; per-job try/catch Drain.ts:~128-170
- observation: CRON-06: DrainAccessSyncQueue.test.ts:312-329 reclaim runs before claim and summary.reclaimed=3; throw -> failJob retryable test :155-171
- observation: CRON-07: reclaim function 20260810000003 resets in_flight older than 600s (STALE_JOB_RECLAIM_SECONDS, Config:~175) to pending; only the call order is tested with a mock, the SQL threshold itself is untested. Note maxDuration=60 (cron route) << 600s. SQL-FOR-LEAD: select count(*) from access_sync_jobs where status='in_flight' and updated_at < now() - interval '600 seconds'
- observation: CRON-08: completeJob/failJob update by id only, no status or attempt guard (Repository.ts:877-890, 892-935); a worker whose job was reclaimed and re-claimed could overwrite the other's result; mitigated because SyncMemberAccess re-derives from current state and 600s >> 60s maxDuration; no test
- observation: E-4, F-2: no definitions found in repo; same method, see cases

### EV-06

- finding: baseUrl accepts http:// so vendor credentials could be sent unencrypted; TLS not enforced or tested
- observation: VEND-04: vendor docs give only maxima (EmpId 15, EmpName 24: vft-api-reference.md:331-332); code enforces max/numeric at fieldLimits.ts (tested returnCodes.test.ts:90+); no documented minimum, none enforced beyond length>0
- observation: VEND-07: vendorScalar number->string (access-control.schemas.ts:100-106) asserted RecordAccessEvents.test.ts:69-85 (EmpId 100001 numeric stored)
- observation: VEND-10: only boolean seen is IsReboot:false in fixture (VftAccessControlProvider.test.ts:74); no test for 1/0 or 'true' strings; vendor doc defines none
- observation: VEND-11: optionalVendorString folds null (schemas:117-120); fixture with null fields parses all devices VftAccessControlProvider.test.ts:52-56,108-119; vendor ref vft-api-reference.md:130-135
- observation: VEND-13: read every provider call (VftAccessControlProvider.ts:278-545) against vft-gym-api-v2-collection.json: signin POST /api/user/, device GET/PUT, template add POST, edit PUT, delete DELETE, fromdev DELETE, syncsometoone POST, validperiod/accessgrant/accessblock/enrollfinger/dooropen/reboot POST, list GET all match; only test asserting a method is signin POST VftAccessControlProvider.test.ts:227
- observation: VEND-18: baseUrl only z.string().url() (access-control.schemas.ts:18) so http:// is accepted and password posted in clear; no cert override anywhere (grep rejectUnauthorized none); no test; fixtures use https
- observation: ENR-17: vendor 200 with no id/return/message -> status queued, VftAccessControlProvider.test.ts:347-357 (upsertSubject); not failed, commandId undefined
- observation: ENR-28: no cancellation webhook exists; the only webhook is /api/webhooks/access-control/[token] for attendance events (collection WebhookCheck). na
- observation: FAIL-06: cron route catches thrown error, logs failure, returns 500: access-control-crons.test.ts:246-255 (generic throw, not DB-specific); repo wraps errors in DatabaseError
- observation: FAIL-07: Supabase REST statement-level; multi-statement ops use RPC (atomic) but no test simulates connection drop; failJob/completeJob are separate statements; unfinished in_flight job healed by reclaim (Drain.test.ts:312)
- observation: D-9: no definition found; same method

### EV-07

- observation: REC-01: drain returns early when no jobs (DrainAccessSyncQueue.ts:114); only empty-claim test is the ordering test Drain.test.ts:312-329, no assertion on restart
- observation: REC-02: pending state is in access_sync_jobs (Postgres), picked up by claim (20260810000002:84-93); tests use FakeAccessControlRepository, no restart
- observation: REC-05: worker dying after vendor accepted but before completeJob leaves in_flight, reclaimed after 600s and re-run; safe because SyncMemberAccess re-derives from current state and skips matching windows (AccessCommands.test.ts:138-150 'pushes nothing when window already matches'); no kill test; some commands may repeat once
- observation: REC-06/FAIL-10: Drain.test.ts:312-329 asserts reclaim then claim order and summary.reclaimed=3 (mock); SQL reclaim 20260810000003 (600s) untested; bound: maxDuration 60 (drain route:29). SQL-FOR-LEAD: select count(*) from access_sync_jobs where status='in_flight'
- observation: REC-09/10/FAIL-09: process state is the token cache (VftAccessControlProvider.ts:263) and RequestPacer, both in-memory and rebuilt (re-signin) on cold start; cache behaviour tested VftAccessControlProvider.test.ts:164-218; no restart test; the vendor-held command queue survives either restart

### EV-08

- observation: TENANT-09: no move path; access_devices.device_serial TEXT UNIQUE globally (20260810000001:82); second claim -> ConflictError -> 409, access-control.routes.test.ts:205-216; deliberate: unlink first (devices/[id]/unlink/route.ts:1-14)
- observation: TENANT-10: events insert with gym_id taken from the device row at receipt (RecordAccessEvents.ts:218,239); access_events.gym_id NOT NULL, device_serial is plain text so old events keep the old gym_id (migration :207-210); unknown serial is dropped RecordAccessEvents.test.ts:267-276; no test asserts that a reused serial keeps history with the former owner. SQL-FOR-LEAD: select device_serial, count(distinct gym_id) from access_events group by 1 having count(distinct gym_id)>1
- observation: DEVICE-06: unauthorised: another gym's device id returns 404 and no write, access-control.routes.test.ts:221-243 (rename, enable) plus gym-scoped lookup; legitimate change = unlink then register by the new gym, unlink route untested (mock only at :28)
- observation: R14/RACE-11: webhook resolves device then writes with that gym_id in separate statements (RecordAccessEvents.ts:176-239), no transaction or lock; an event arriving in the window lands under the former gym; no test
- observation: ACC-10: lock-down migration 20260813000001 revokes EXECUTE on 5 functions from public and grants service_role only (:35-56); RLS policies on four tables (20260810000001:310-325); scripts/probe-access-rls.ts exists (not run by me); webhook token strength tests webhookToken.test.ts:28-114; webhook route test passes; AP-04/05 and P0.2 not found in docs by grep so not cited

### EV-09

- observation: UI-06: pending is not an error: ResendToast.test.tsx:81-100 asserts 'Queued — the readers will pick this up shortly' via toast.success and no info; nothing-sent ResendToast.test.tsx:62-79; MemberAccessPanel.tsx:133-145 maps failed -> toast.warning 'Some readers did not respond. We will keep trying.' but no test covers failed:true. Sanitising: toErrorResponse default branch returns one plain sentence, logs detail (apiErrors.ts:113-120) but no test of that branch; client surfaces server wording and survives non-JSON 502 (accessControlClient.test.ts:89-124); the panel's catch toasts error.message …
- observation: UI-07: retry display = the 'We will keep trying' warning; no test and no per-job retry count shown
- observation: UI-09: 401 maps to unauthorized via apiErrors (:108-111) and client throws AccessApiError with the server message; no test or redirect handling for session expiry in the panel
- observation: H-12, H-14, D-3: no definitions found; same method

### EV-10

- observation: SQL-FOR-LEAD (EV-02): select is_nullable from information_schema.columns where table_name='members' and column_name='next_due_date'
- observation: SQL-FOR-LEAD (EV-03): select tgname, tgenabled from pg_trigger where tgname='trg_enqueue_access_sync'
- observation: SQL-FOR-LEAD (EV-05): select count(*) from access_sync_jobs where status='in_flight' and updated_at < now() - interval '600 seconds'
- observation: SQL-FOR-LEAD (EV-07): select count(*) from access_sync_jobs where status='in_flight'
- observation: SQL-FOR-LEAD (EV-08): select device_serial, count(distinct gym_id) from access_events group by 1 having count(distinct gym_id)>1

### XC-01

- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/exclusive/2026-10-09T07-18-59-807Z-snapshot.json
- observation: readerB presence Not responding 32m ago at start

### XC-02

- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/exclusive/2026-10-09T07-20-48-074Z-snapshot.json
- observation: reader A vendor counters null; presence still Not responding by last scan 12:34
- observation: outbox reboot_device and reconcile_member rows showed pending/0 tries after push (queue DONE)

### XC-03

- finding: reclaim --older-than refuses when a stranded device-op job (reboot_device, not a member job) is in flight, so the XC-03 step 3 reclaim cannot run after a crash that also took a device op; only production's 600s reclaim recovers it
- finding: reboot_device job ran with tries=2 after the crash (reader may have been rebooted twice)
- observation: reclaim REFUSED text: In flight now: 3 (not HW test members': 1) - REFUSED a real job is in flight
- observation: stranded in_flight jobs 11c3f327 (HW5) e49bd504 (HW6) recovered by production drain 13:05:18 tries=2; reboot_device job tries=2 succeeded
- observation: re-sent setValidPeriod returned ret=0 on both readers (e.g. A #69329/#69331/#69334)
- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/exclusive/2026-10-09T07-36-15-997Z-snapshot.json

### XC-04

- observation: worker1 stub commands: 6 validperiod (HW8,9,10 x A,B) 13:07:01-13:08:03; reader A queue #69347/#69349/#69351 and B #69346/#69348/#69350 from worker 2 only
- observation: jobs 716c7672 34e639bb 6f928075 succeeded tries 2; later 43a53d98 (HW8) f50c869d (HW9) succeeded tries 1
- observation: simultaneous drains: drain1 claimed 2, drain2 due 0 (tool calls ran sequentially)

### XC-05

- finding: 429 is treated as permanent: dead-lettered on first attempt (and a re-claimed retryable 500 job was dead-lettered by a 429 drain)
- observation: FAIL-02 bare500 job a5515189 failed tries1 next 13:11:41 'Vendor returned status 500'
- observation: FAIL-02 500-with-reason job ea849e5c dead tries1 needingAttention=1: Vendor returned status 500: {message:Internal Server Error}
- observation: FAIL-03 502 job 39ec1a3e failed tries1 next +30s; succeeded tries 2 at 13:15:19
- observation: FAIL-04 429 job e98cacff dead tries1 needingAttention
- observation: FAIL-05 slow job 81bffda0 succeeded tries 1 (30s)
- observation: 3 dead jobs remain by design: HW6 a5515189, HW8 e98cacff, HW10 ea849e5c; members fixed by newer succeeded jobs and pushes

### XC-06

- finding: auth failure (401 sign-in) is dead-lettered on first attempt and not flagged needing attention (needingAttention 0), so no operator alert
- observation: hang job 9efcb656 failed->dead on tries 2 via later bizfail drain
- observation: garbage job 06c1b388 succeeded tries 1
- observation: bizfail job 4d8b9a94 dead permanent needingAttention=1
- observation: auth job 60cd0331 dead, needingAttention=0, error Sign-in rejected with status 401
- observation: dead jobs left on purpose: HW5 9efcb656, HW7 4d8b9a94, HW8 60cd0331 (plus earlier HW6 a5515189, HW8 e98cacff, HW10 ea849e5c)

### XC-07

- observation: enroll ret=6 on both #69394 #69395
- observation: snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/exclusive/2026-10-09T07-52-09-746Z-snapshot.json

### XC-08

- observation: payment moved HW9 due 2027-04-27 -> 2027-04-28 (left)
- observation: XC-07 withdraw of HW10 sent Delete User 100009 to A (#69398) and B (#69397); HW10 now held by none

### XC-09

- observation: cancel push allowed false commandsSent 4; reactivate commandsSent 6

### XC-10

- finding: events-pull re-delivery is not idempotent: the 3 re-delivered scans were inserted again (11 -> 14) and with timestamps shifted by 5h30 (read as UTC instead of SLT)
- observation: count before 11, after 14
- observation: new rows stored 2026-10-09 13:25:03, reader clock 07:04:07-07:04:19, skew about -22850s; originals 12:34:07/13/19

### XC-11

- observation: B new id 95d7b6b9-2dad-4409-bf5c-e9cb84518585
- observation: reader B presence now 'No contact yet' (last contact lost with old id)
- observation: reader A skew shows -22844s after XC-10 pull re-delivery

### XC-12

- observation: A: 34 Access Grant + 34 Set Valid Time Period + 32 Update; B same; drain time about 37s
- observation: console says 204 sent, queues show 200 (2 Update User per reader fewer than 34 x 3); possibly the 100-row cap of the queue view

### XC-13

- observation: final snapshot=/home/playershyan/metric-gym-manager/backups/hw-session/exclusive/2026-10-09T08-05-36-189Z-snapshot.json
- observation: HW9 due 2027-04-28 (payment in XC-08), others 2027-04-27
- observation: HW10 consent none (withdrawn); real Titan newest change still 2026-10-03 16:30:23
- observation: reader A skew -22844s from XC-10 re-delivered events
