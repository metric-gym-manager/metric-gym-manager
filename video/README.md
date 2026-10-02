# Metric Gym OS — short films

Standalone Remotion project. Not part of the Next.js app: own `package.json`,
`tsconfig.json` and tests; excluded from the app's ESLint.

Every idea, built or not, is logged in the **Video Ideas Registry** (Claude
Docs: https://claude.ai/code/artifact/8ea5904e-5142-493b-b5f1-d68fd908b6cd).
Check it before adding a film: a new idea may share at most one of mechanism,
hook, reveal and product claim with an existing one.

| Composition | Film | Length | Folder |
| --- | --- | --- | --- |
| `HundredSquares` / `HundredSquaresLandscape` | 100 Squares | 30s | `src/films/hundred-squares` |
| `ZoomOut` | Zoom Out (QR self-registration) | 30s | `src/films/zoom-out` |
| `Overnight` | Overnight (scheduled jobs) | 30s | `src/films/overnight` |
| `SentNotDelivered` | Sent Is Not Delivered (SMS receipts) | 25s | `src/films/sent-not-delivered` |
| `Lineup` | The Lineup (member status) | 25s | `src/films/lineup` |
| `Unplugged` | Unplugged (Enterprise door readers) | 30s | `src/films/unplugged` |

**Unplugged is on publication hold** until VFT simulator test C-1.3 ("does an
offline reader still admit valid members?") has a recorded pass. On-device
`EndDate` evaluation is confirmed (A5); offline admission is not.

Shared pieces live in `src/shared`: theme (the app's L1 tokens), end card,
caption, cue player, abstract avatar.

```bash
npx remotion render src/index.ts <CompositionId> out/<name>.mp4
scripts/stills.sh <CompositionId> <frame>...   # key frames for visual review
scripts/probe.sh out/<name>.mp4                 # streams + audio peak per second
```

## Film 1: 100 Squares (30s, 30fps, 900 frames)

A 10×10 grid the viewer spends 20 seconds reading before learning it is a
gym's membership database. Pattern → members → money → operating system.

| Frames  | Beat       | What happens                                                                   |
| ------- | ---------- | ------------------------------------------------------------------------------ |
| 0–60    | Hook       | Grid fills. "One of these is costing you money." (never "members")             |
| 60–240  | Rule       | Squares flicker amber and **return** to green — the viewer learns the norm     |
| 240–450 | Violation  | Some ambers stall; an unlabelled counter rises by exactly that member's fee     |
| 450–600 | Escalation | Stalled ambers turn red, pulse out of phase                                     |
| 600–630 | Freeze     | Simulation clock stops. Silence                                                 |
| 630–690 | Reveal     | "Every square is a member." → counter gains its label: UNCOLLECTED             |
| 690–780 | Resolve    | Reminder rings; 7 of 11 pay; counter drops but **not to zero**; grid → members table |
| 780–840 | Boot       | `$ starting metric-gym-os` → SYSTEM READY                                       |
| 840–900 | Card       | METRIC GYM OS — The operating system for serious gyms.                         |

## Invariants (enforced by `npm test`)

Everything — squares, counter, table, KPI tiles, sound cues — derives from the
one `MEMBERS` array in `src/data.ts`, so picture, number and sound cannot drift:

- the counter changes only on a stall or recovery frame, by exactly one fee;
- nothing changes during the freeze/reveal;
- returners come back before they could count as stalled;
- reminders reduce the counter but never reach zero (no overclaim);
- the table surfaces unresolved members first.

The main film shows no door hardware. Access control is Enterprise-only and
belongs in a separate cut.

## Commands

```bash
npm install
npm run studio            # preview/scrub in the browser
npm run render            # 1080×1920 master  → out/metric-100-squares-9x16.mp4
npm run render:landscape  # 1920×1080         → out/metric-100-squares-16x9.mp4
npm run render:muted      # sound-off check
npm test && npm run type-check
```

`prepare-assets` (run by every script) copies Geist fonts and `logo.svg` from
the app — the app owns the originals — and generates the procedural SFX into
`public/` (gitignored). In a container without Remotion's own browser, set
`REMOTION_BROWSER_EXECUTABLE` to a Chromium headless shell.

Retime 100 Squares in `src/films/hundred-squares/timeline.ts`; re-author its events in `data.ts`.
Colours come from the app's L1 tokens (`src/components/ui/tokens.ts`).
