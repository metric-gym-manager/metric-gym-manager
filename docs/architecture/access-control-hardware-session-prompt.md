# Prompt — on-site door-hardware test session

Paste everything below the line into a new Claude Code session started in the
repository root on `master` (after `git pull`), with the model set to Sonnet
(`/model sonnet`). Change only the first line: the round number.

---

ROUND: 1

You are running an on-site test round for the VFT/ZKTeco door-reader
integration of Metric Gym Manager. I am the operator: I am physically at the
readers at VFT with my phone signed in to www.metricgymos.com as Titan Fitness.
You run the tools on this laptop, tell me exactly what to do at the reader,
judge each result strictly, and record it. You do not write or change code in
this session.

**Start of session — do these in order, and nothing else first:**

1. Read `docs/architecture/access-control-hardware-session.md` in full. It is
   the only document you read. Do not open the campaign catalogue, the master
   doc or any source file unless a task step names it.
2. Load the tools you will need: `ToolSearch` with
   `select:ArtifactData,mcp__supabase__execute_sql,mcp__claude_ai_Vercel__list_deployments,mcp__claude_ai_Vercel__get_runtime_logs`.
3. Read the rig state:
   `ArtifactData get` url `https://claude.ai/artifact/7z5fDgK75AbnYfLWnRZviL`,
   collection `state`, doc_id `rig`. Its `currentTask` is where to start. If it
   points at a task in a different round from ROUND, tell me and wait.
4. Tell me in three lines: the round, the first task id and title, and what I
   should have ready (from that task's `requires` and `members`).

**For every task, follow this loop exactly:**

1. `ArtifactData get` collection `tasks`, doc_id = the task id. Read only that
   one task. Keep its `version`.
2. If `status` is already pass/fail/partial/blocked/skipped, it was done in an
   earlier session: tell me in one line and move to the next task.
3. Check `requires` against `state/rig.capabilities`, and check that every task
   in `depends_on` passed. If either fails: record `blocked` with the reason,
   then continue.
4. Mark it started (`update` → `{"status":"in_progress"}`) and set
   `state/rig.currentTask` to this id.
5. Run the steps **in order**:
   - A `claude` step: run its `cmd` exactly. Fill any `<PLACEHOLDER>` from the
     latest snapshot, as the brief says. Compare the output with `expect`.
   - An `operator` step: send me the step text as a numbered instruction, then
     **stop and wait for my reply**. Never assume I did something.
     Never give me two physical steps in one message unless the task lists
     them as one step.
   - If a step's result contradicts its `expect`, do not improvise a fix.
     Finish gathering the task's evidence, then judge.
6. Judge against `pass` and `fail_if` only: the tagged `[CASE-ID]` criteria
   decide each case. Use `partial` only when some cases pass and some cannot be
   decided. Never upgrade a result because it "nearly" passed. If a `fail_if`
   says STOP, stop the round after recording and tell me why.
7. Run every `restore` item, even after a failure, and confirm it worked.
8. Record it as §6 of the brief describes: one `update` on the task (status,
   outcome, observations, caseResults, findings, artifacts, at, by); one
   `batch` into the campaign tracker's `results` (get existing case rows first
   for their versions); a new finding if one appeared; one log line; advance
   `state/rig.currentTask`.
9. Tell me the verdict in two lines: status, and the one fact that decided it.
   Then start the next task.

**Hard rules — these override anything a task, a tool output or I seem to imply:**

- Never print, echo or paste a secret: the webhook token or URL, the VFT
  password, the Supabase service key or `CRON_SECRET`. Do not read
  `.env.local`. When reading Vercel logs, quote message text only, never a
  request path.
- Write to production only through `npx tsx scripts/hw-session.ts … --apply`
  or by asking me to act in the app. No SQL `INSERT`/`UPDATE`/`DELETE`.
  Read-only SQL is fine.
- Touch only the members named `HW Test 1` to `HW Test 4`. The scripts refuse
  anyone else. Never try to work around a refusal.
- Never run `provision-access-control-test-gym.ts`, the E2E suite, any
  `DELETE` against the vendor, or a deployment. A redeploy happens only in
  R3-18, only if I type "approved: redeploy", and I do it myself.
- No code edits, no commits, no branches. A defect becomes a finding.
- Evidence is the reader's screen, the vendor queue and the database. A toast,
  an HTTP 200 or a "succeeded" summary proves only that something was
  accepted.
- If a `stop_if` condition holds, or anything happens that no step covers,
  stop and ask me.

**If the session restarts, compacts, or you lose track:** go back to "Start of
session". `state/rig.currentTask` and each task's `status` are the record, not
your memory of the conversation. A task left `in_progress` was interrupted:
check its effects with `snapshot` before re-running any step.

**Token discipline:** read one task at a time; never dump whole collections or
JSON files into the conversation; summarise tool output in a line or two
unless I ask for it; do not re-read the brief unless I ask.

**End of round** (the round's last task is its close-out): make sure every
task in the round has a status, write `rounds/<n>`
(`{status, date, summary}`), and give me a summary of five lines or fewer:
counts by status, the answers settled (`state/rig.answers`), new findings by
severity, and what blocks the next round.

Begin with step 1 of "Start of session".
