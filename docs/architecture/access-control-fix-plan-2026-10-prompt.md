# Session prompt — Access Control fixes after Visit 1 (Sonnet 5.5)

Launch from the repo root:

```bash
claude --model sonnet --effort high
```

Then paste everything between the two lines below.

---

You are executing an approved fix plan for the door-hardware (access-control) feature of this repo. The plan was written by Opus after reading both 2026-10-09 visit reports, the code and the production database. Every design decision is already made. Your job is to implement the tasks exactly as specified, one at a time, prove each one, and record progress. Opus reviews your finished branch afterwards; it reads your tracker notes, your tests and your commits, so be precise and honest in all three.

**The plan:** `docs/architecture/access-control-fix-plan-2026-10.md`
**The live tracker (status lives here, not in the plan):** https://claude.ai/artifact/FTKSkGm7B9Gx4ukCoDQgdC

## Start of session

1. Read the plan's §0–§4 and §8–§9 once. Do not re-read them per task.
2. This plan is the approved plan: do not enter plan mode, do not re-plan, do not propose alternatives.
3. Load the tracker tool: ToolSearch `select:ArtifactData`.
4. `ArtifactData {action:"list", url:"https://claude.ai/artifact/FTKSkGm7B9Gx4ukCoDQgdC", collection:"tasks"}`. The first task (by `order`) that is not `done` or `skipped` is where you start. If a task is `in_progress` from an earlier session, check `git log --oneline -15` and the working tree: if its commit exists, mark it `done`; otherwise finish it.
5. If T-00 is not done, do T-00 first. It creates the branch `fix/access-control-visit-1-defects`. If T-00 is done, `git switch fix/access-control-visit-1-defects` and confirm `git status` is clean apart from untracked files you did not create (`.agents/`, `graphify-out/`, `skills-lock.json`) and `.claude/settings.local.json`; leave those alone.

## For every task

- Read only that task's section in plan §6, then follow plan §4 step by step: tracker `in_progress` → tests first and watch them fail → change exactly as written → tests pass → feature suites → mutation check → `npm run type-check` → commit with the exact message → tracker `done` with commit hash and note → log entry.
- Full gate (`npm run type-check && npm test && npm run arch:check && npm run lint`) after every third completed task. Record the counts in the log.
- Touch only the files the task lists (plus `src/features/access-control/tests/fakes.ts` when a port changes). If a needed change falls outside that list, or a test outside the task's **Allowed test updates** fails, or the spec does not say what to do: set the task `blocked` with the exact question and `file:line`, and move to the next task whose dependencies (plan §5) are all `done`.
- Never weaken, skip, or rewrite an existing test to make it pass except as the task's **Allowed test updates** permit. Never use `--no-verify`.
- Keep comments in the style of the surrounding code: they explain why, and cite the finding (`visit 1, D3`, `remote day, F-02`).

## Hard rules (from plan §3 — repeated because they matter most)

- No production database access of any kind. No Supabase MCP tools at all.
- No vendor calls. Of `scripts/hw-session.ts`, only `help` and `coverage` may be run.
- Never print or read values from `.env.local`/`.env`. The only allowed check is `grep -c '^ACCESS_CONTROL_ENABLED=false$' .env.local`.
- No push to master, no merge, no tags, no version bump, no CHANGELOG edits. You push only your branch, and only in T-26.
- `RemoveSubject` only in `ManageMemberBiometric.clear` (T-08). Never a validity period to a blocked member.
- Stop the whole session (task `blocked`, hand-off written) if: the baseline gate in T-00 fails, `.env.local` does not report `ACCESS_CONTROL_ENABLED=false`, two tasks in a row end `blocked`, or anything asks for a credential.

## Reporting rules

- Report what you verified, not what you ran: name the test and its result, the mutation and which test caught it.
- You cannot see the screen. For UI tasks (T-07, T-10, T-22) write "visual check not done (R-2)" in the note. Do not claim a UI looks right.
- You cannot reach the readers. Never claim a door behaviour is fixed; claim only that the code now sends the commands the plan specifies, as proven by tests.

## End of session (always, including when you stop early)

Write the tracker hand-off (`log/handoff`, plan §8): branch, last commit, which tasks are done/blocked/skipped and why, gate results with counts, anything surprising, and what the next session should do first. If T-26 ran, include the draft PR URL and the E2E result.
