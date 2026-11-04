/**
 * Every Vercel cron runs at most once a day.
 *
 * The Vercel team is on the Hobby plan. Hobby refuses to DEPLOY a project
 * whose vercel.json has any cron that runs more than once a day — not a
 * warning, a failed deployment: "Hobby accounts are limited to daily cron
 * jobs. This cron expression (*\/5 * * * *) would run more than once per day."
 * That is how every deploy failed on 2026-11-04 until the five-minute outbox
 * drain moved to GitHub Actions. Hobby also fires each daily cron anywhere
 * within its hour (±59 min), so a minute in vercel.json is a target, not a
 * time. See docs/architecture/access-control-master.md §4.5.
 */
import vercelConfig from '../../../../../vercel.json'

const crons: Array<{ path: string; schedule: string }> = vercelConfig.crons

describe('vercel.json crons fit the Hobby plan', () => {
  it.each(crons.map((c) => [c.path, c.schedule]))(
    '%s (%s) runs at most once a day',
    (_path, schedule) => {
      const [minute, hour] = schedule.trim().split(/\s+/)
      const once = /^\d{1,2}$/

      // A fixed minute AND a fixed hour: anything else (*, */5, 0-23, 1,13)
      // runs more than once a day and fails the deployment on Hobby. A job
      // that must run more often belongs in .github/workflows, as the drain.
      expect({
        schedule,
        minute: once.test(minute),
        hour: once.test(hour),
      }).toEqual({ schedule, minute: true, hour: true })
    }
  )
})
