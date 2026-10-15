# Session prompt — Access Control fixes, round 2 (Sonnet 5.5)

Launch from the repo root: `claude --model sonnet --effort high`, then paste everything between the lines.

---

You are executing an approved fix plan for the door-hardware (access-control) feature of this repo: round 2, after the second visit to the readers. Opus wrote the plan from the visit report and the code; every design decision is already made. Implement the tasks exactly as specified, one at a time, prove each one, and record progress. Opus reviews your finished branch; it reads your tracker notes, tests and commits, so be precise and honest in all three.

- **The round-2 plan (task text):** `docs/architecture/access-control-fix-plan-2026-10b.md`
- **The round-1 plan (rules you must follow):** `docs/architecture/access-control-fix-plan-2026-10.md` §3 hard rules, §4 per-task protocol, §8 tracker calls, §9 environment traps. Those sections apply unchanged; only the task ids (`R2-00`…`R2-15`) and the branch (`fix/access-control-visit-2-findings`) differ.
- **The live tracker:** https://claude.ai/artifact/FTKSkGm7B9Gx4ukCoDQgdC (collection `tasks`, documents `R2-00`…`R2-15`; the round-1 documents `T-*` are done, leave them alone).

## Start of session

1. Read round-2 §0–§3 header and shared facts, and round-1 §3, §4, §8, §9, once.
2. This plan is approved: no plan mode, no re-planning, no alternatives. §0 lists what is deliberately NOT in this round (automatic power-loss detection, RB-1/RB-2/RB-3 automation): do not start it.
3. Load the tracker tool: ToolSearch `select:ArtifactData`. List collection `tasks`; start at the first `R2-*` task (by `order`) that is not `done` or `skipped`. An `R2-*` task left `in_progress` by an earlier session: check `git log --oneline -20`; if its commit exists mark it `done`, otherwise finish it.
4. If R2-00 is not done, do it first (it creates the branch). Otherwise `git switch fix/access-control-visit-2-findings`; leave untracked files you did not create alone.

## For every task

- Read only that task's section in the round-2 plan §3, then follow round-1 §4 step by step: tracker `in_progress` → tests first, watch them fail → change exactly as written → tests pass → feature suites → mutation check → `npm run type-check` (check its **exit status**, never pipe it) → commit with the exact message → tracker `done` with commit hash and note → log entry.
- Full gate (`npm run type-check && npm test && npm run arch:check && npm run lint`) after every third completed task; record the counts.
- Touch only the files the task lists, plus `src/features/access-control/tests/fakes.ts` when a port changes, plus an E2E spec line that asserts text the task changed (round-2 §3 note). Minimal edits to existing test doubles or fixtures that a task's port change breaks are allowed; name each one in the tracker note. Anything else outside the list, a failing test outside the task's **Allowed test updates**, or a spec that does not say what to do: set the task `blocked` with the exact question and `file:line`, then move on to the next task whose dependencies (round-2 §2) are `done`.
- Never weaken or skip a test to make it pass. Never `--no-verify`.
- Comments explain why and cite the finding (`visit 2, CD-1`, `RB-1`), in the style of the surrounding code.

## Hard rules (repeated)

- No production database access, no Supabase MCP tools.
- No vendor calls. Of `scripts/hw-session.ts` only `help` and `coverage` may be run (R2-12 and R2-13 change the console; you verify them with type-check, `help` and `coverage` only).
- Never read or print values from `.env.local`/`.env`; only `grep -c '^ACCESS_CONTROL_ENABLED=false$' .env.local`.
- No push to master, no merge, no tags, no version bump, no CHANGELOG edits. Push only your branch, only in R2-15.
- `removeSubject` stays confined to `ManageMemberBiometric.clear` (the console reaches it only through `withdraw`, fenced per R2-13). Never a validity period to a blocked member.
- Stop the session (task `blocked`, hand-off written) if the baseline gate fails, `.env.local` does not report `ACCESS_CONTROL_ENABLED=false`, two tasks in a row end `blocked`, or anything asks for a credential.

## Reporting

- Report what you verified: test names and results, the mutation and which test caught it.
- UI tasks (R2-04, R2-05, R2-06, R2-10): write "visual check not done (F2-02)" in the note.
- You cannot reach the readers: claim only that the code now sends or records what the plan specifies, as proven by tests.

## End of session (always)

Write the tracker hand-off (`log/handoff`): branch, last commit, R2 tasks done/blocked/skipped and why, gate results with counts, E2E result and PR URL if R2-15 ran, anything surprising, and what the next session should do first.
