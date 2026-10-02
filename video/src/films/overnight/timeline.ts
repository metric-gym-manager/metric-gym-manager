/**
 * Overnight — 30s at 30fps. See the Video Ideas Registry, film 3.
 *
 * Event times are the product's real schedule (vercel.json crons, UTC → SLT):
 *   update-expired-status 00:00 UTC = 05:30 SLT
 *   cancel-overdue-members 00:30 UTC = 06:00 SLT
 *   send-reminders        03:30 UTC = 09:00 SLT
 */
export const DURATION = 900

/** Clock keyframes: [frame, minutes since 00:00 on the first day]. 21:00 → 09:05 next day. */
export const CLOCK: ReadonlyArray<readonly [number, number]> = [
  [0, 21 * 60],
  [60, 21 * 60],
  [290, 24 * 60 + 5 * 60 + 30],
  [330, 24 * 60 + 5 * 60 + 30],
  [410, 24 * 60 + 6 * 60],
  [450, 24 * 60 + 6 * 60],
  [530, 24 * 60 + 9 * 60],
  [580, 24 * 60 + 9 * 60],
  [640, 24 * 60 + 9 * 60 + 5],
  [900, 24 * 60 + 9 * 60 + 5],
]

export function minutesAt(frame: number): number {
  for (let i = 1; i < CLOCK.length; i++) {
    const [f1, m1] = CLOCK[i]
    const [f0, m0] = CLOCK[i - 1]
    if (frame <= f1) return f1 === f0 ? m1 : m0 + ((m1 - m0) * (frame - f0)) / (f1 - f0)
  }
  return CLOCK[CLOCK.length - 1][1]
}

export const hhmm = (minutes: number) => {
  const m = Math.floor(minutes) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const LIGHTS_OFF_AT = 34

/** The night's events, each fired on the frame its clock time is reached. */
export const EVENTS = [
  { at: 290, time: '05:30', count: 4, text: 'memberships expired', detail: 'past their due date' },
  { at: 410, time: '06:00', count: 1, text: 'membership cancelled', detail: '14 days overdue' },
  { at: 530, time: '09:00', count: 23, text: 'payment reminders sent', detail: 'by SMS' },
] as const

export const OWNER_WAKES_AT = 640
export const LAPTOP_AT = 656
export const T = {
  hook: { from: 0, to: 60 },
  reveal: { from: 720, to: 840 },
  card: { from: 840, to: 900 },
} as const
