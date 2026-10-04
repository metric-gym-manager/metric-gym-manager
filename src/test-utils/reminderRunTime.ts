import fs from 'node:fs'
import path from 'node:path'

/** Sri Lanka runs on UTC+05:30 all year. */
const SRI_LANKA_OFFSET_MINUTES = 5 * 60 + 30

/**
 * The time the reminder run starts, in Sri Lanka, as public copy writes it
 * ("9:00"), derived from the `send-reminders` cron in vercel.json.
 *
 * Four public surfaces state this time — the SMS reminders page, the
 * reminders guide, the buying guide and the sign-in panel — and the sign-in
 * panel once said "tonight" while the cron ran at 03:30 UTC. Tests compare
 * those surfaces with this value, so moving the cron fails them until the
 * copy follows.
 *
 * @returns e.g. "9:00" for the schedule "30 3 * * *"
 * @throws Error when vercel.json has no daily send-reminders cron
 */
export function reminderRunTimeSriLanka(): string {
  const config = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')
  ) as { crons: { path: string; schedule: string }[] }
  const cron = config.crons.find((c) => c.path === '/api/cron/send-reminders')
  const match = cron?.schedule.match(/^(\d+) (\d+) \* \* \*$/)
  if (!match) throw new Error('vercel.json: no daily send-reminders cron')
  const utcMinutes = Number(match[2]) * 60 + Number(match[1])
  const local = (utcMinutes + SRI_LANKA_OFFSET_MINUTES) % (24 * 60)
  return `${Math.floor(local / 60)}:${String(local % 60).padStart(2, '0')}`
}
