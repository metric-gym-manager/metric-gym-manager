/**
 * The locked 30s script, as frame ranges at 30fps. Every component reads its
 * timing from here; retiming the film means editing this file only.
 */
export const FPS = 30
export const DURATION = 900

export const T = {
  /** 0–2s: grid fills, hook line. */
  hook: { from: 0, to: 60 },
  /** 2–8s: ambers flicker and RETURN to green — the rule is learned. */
  rule: { from: 60, to: 240 },
  /** 8–15s: some ambers stop returning; the unlabelled counter rises. */
  violation: { from: 240, to: 450 },
  /** 15–20s: stalled ambers turn red and pulse out of phase. */
  escalation: { from: 450, to: 600 },
  /** 20–21s: hard freeze, silence. */
  freeze: { from: 600, to: 630 },
  /** 21–23s: "Every square is a member." then UNCOLLECTED snaps on. */
  reveal: { from: 630, to: 690 },
  /** 23–26s: reminders go out, some recover, grid becomes the members table. */
  resolve: { from: 690, to: 780 },
  /** 26–28s: UI collapses to a terminal line. */
  boot: { from: 780, to: 840 },
  /** 28–30s: end card. */
  card: { from: 840, to: 900 },
} as const

/** Frames an amber square must stay amber before it counts as uncollected. */
export const STALL_FRAMES = 30

/** Frame the UNCOLLECTED label snaps onto the counter. */
export const LABEL_AT = T.reveal.from + 30

/** Reminder rings go out at the start of resolve; recoveries follow. */
export const REMINDER_AT = T.resolve.from + 4
/** Squares start travelling into table rows. */
export const MORPH_AT = T.resolve.from + 44

/**
 * Simulation clock. Time stops during the freeze and reveal: the grid holds the
 * exact state it had at the freeze frame, so the reveal recontextualises what
 * the viewer was just looking at.
 */
export function simFrame(frame: number): number {
  if (frame < T.freeze.from) return frame
  if (frame < T.resolve.from) return T.freeze.from
  return frame - (T.resolve.from - T.freeze.from)
}
