# Access Control — Launching the Door-Hardware Sessions

The system prompts live in `.claude/agents/hw-*.md`; this page says how to
start each session, what to type first, and which model effort to use. The
brief every session reads is `access-control-hardware-session.md`.

All sessions run from the repository root on an up-to-date `master`, with
`.env.local` present, and load `.claude/hw-session.settings.json`: it allows
the console and `jest` without prompts (sub-agents run in the background and
cannot ask), denies reading `.env.local`, and turns hooks off — the
repository's `npm test` Stop hook would otherwise run after every reply,
minutes each, with the operator waiting at a reader.

---

## Effort levels — what to use and why

| Session                   | Model  | Effort     | Why                                                                                                                                                                                                     |
| ------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hw-physical` (the visit) | Sonnet | **medium** | Every step is scripted and the operator is waiting between steps: latency matters more than depth. The judgement calls are written into each task's PASS/FAIL lines, and it stops and asks when unsure. |
| `hw-remote-lead`          | Sonnet | **high**   | Orchestrates: phases, spawning, syncing, the owner's screens, deciding when the parallel phase is over. Mistakes here cost the whole day.                                                               |
| `hw-remote-outbox`        | Sonnet | **high**   | Reads live queue states against PRODUCTION and judges ordering and lost-reply convergence — the subtle verdicts.                                                                                        |
| `hw-remote-lifecycle`     | Sonnet | **high**   | Consent integrity and concurrent writes on production rows; a wrong "pass" hides a privacy defect.                                                                                                      |
| `hw-remote-exclusive`     | Sonnet | **high**   | Crashes, reclaims, a reader restart and unlink/re-link against production — the riskiest work of the day.                                                                                               |
| `hw-remote-api`           | Sonnet | **medium** | Mechanical: send a request, compare a status code. Touches only the E2E gyms on a local server.                                                                                                         |
| `hw-remote-evidence`      | Sonnet | **medium** | Read-only; every verdict must cite a file:line a reviewer can check, so a weaker call is caught, not shipped.                                                                                           |

**Extra high is not worth it anywhere here.** The tasks carry the reasoning
(what to run, what counts as pass); extra high would mostly spend tokens
re-deriving it. If a session repeatedly misjudges a result, raise that one
session to high rather than the whole set.

The agent files already pin these (`model: sonnet`, `effort: …`); the
command-line flags below repeat them for the two sessions you start yourself.
Sub-agents take theirs from their own files.

---

## The remote day (first)

**Before:** VFT has brought Device B online and both readers stay powered and
networked all day; this branch is merged and deployed; no Titan announcement
is scheduled for the day.

```
cd ~/metric-gym-manager && git checkout master && git pull
claude --agent hw-remote-lead --model sonnet --effort high --settings .claude/hw-session.settings.json
```

**First message:**

> Start the remote day. Run LD-01 onward. I'm at the browser signed in to
> Titan Fitness; I'll step away once the four agents are running.

What happens: LD-01 … LD-06 with you (≈ 1¼ h — deployment check, Device B's
backlog, a remote door open that proves the callback, creating HW Test 5–10,
the dev server, the screens). At LD-07 you answer two approvals (redeploy
during the soak; a 100-command load), the lead sets the phase to parallel and
spawns **four agents in one go** — outbox, lifecycle, api, evidence — plus an
hour-long soak. When all four report done it spawns the **exclusive** agent
alone. LD-11 parks the members, stops the dev server, syncs everything and
lists what the visit must still settle. You can watch progress on the Door
Hardware Runbook artifact.

---

## The physical visit (after)

**Before:** reader menu access and permission to change the clock, pull the
network and pull power; the remote day's findings read.

```
cd ~/metric-gym-manager && git checkout master && git pull
claude --agent hw-physical --model sonnet --effort medium --settings .claude/hw-session.settings.json
```

**First message:**

> Start the physical visit. I'm at VFT with both readers. Today I have:
> menu access <yes/no>, clock change <yes/no>, network pull <yes/no>, power
> pull <yes/no>. Run band 1 first.

What happens: Claude reads each operator step to you, one at a time — place a
finger, read the screen, unplug a cable — and runs its own steps between. Band
1 (≈ 2 h) settles the do-not-ship cases; bands 2 and 3 continue while you have
time, or on another visit. **Before you leave, say "close the visit"**: PH-30
parks HW Test 1–4, syncs the results and releases the phase. On the final
visit it runs PH-31 (the acceptance gates and the readiness verdict) first.

---

## If a session stops part-way

Start it again with the same command and say "continue". Every session's
first step reads `tasks`, whose **Recorded here** column shows what is done;
the phase file shows which track holds the readers. If a remote day is
abandoned mid-phase, the lead resets it with `hw phase set idle --as lead`
after confirming no agent is still running; an abandoned visit releases it
with `hw phase set idle --as physical` (only the track that holds the phase can
release it).
