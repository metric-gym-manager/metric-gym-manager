/**
 * The introduction series to gyms whose contact details are on public pages:
 * four emails, one a week, sent by the weekly `send-outreach` cron (Tuesdays
 * 10:00 Sri Lanka time). This script is for everything around it.
 *
 *   npx tsx scripts/send-outreach.ts --import gyms.csv [--apply]
 *       Take a list in. DRY RUN unless --apply: shows the rows set aside,
 *       the addresses left out (existing gyms and demo requests) and the new
 *       ones. --apply records them and adds them to Resend's contacts. Sends
 *       nothing — the cron does that. A `website` column is recorded as where
 *       each address was found (else --source, default "public listing").
 *
 *   npx tsx scripts/send-outreach.ts --test you@example.com [--email 1-4]
 *       One email of the four to you, outside the campaign.
 *
 *   npx tsx scripts/send-outreach.ts --run [--apply] [--limit n]
 *       The weekly run by hand (dry run unless --apply).
 *
 *   npx tsx scripts/send-outreach.ts --remove someone@gym.lk
 *       Never write to that address again.
 *
 *   npx tsx scripts/send-outreach.ts --status
 *       Where the campaign stands: how many on each email, done, out.
 *
 * Reads .env.local: RESEND_API_KEY, MARKETING_UNSUBSCRIBE_SECRET,
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Design: docs/architecture/marketing-email.md, "Outreach".
 */

import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

function flag(name: string): string | undefined {
  const args = process.argv.slice(2)
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
const has = (name: string) => process.argv.includes(name)

async function main() {
  const mailing = await import('@/features/mailing')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    )
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
  const outreach = mailing.createSendOutreach(supabase)
  const campaign = flag('--campaign') ?? mailing.OUTREACH_CAMPAIGN
  const apply = has('--apply')

  const test = flag('--test')
  if (test) {
    const step = Number(flag('--email') ?? 1)
    if (![1, 2, 3, 4].includes(step))
      throw new Error('--email must be 1, 2, 3 or 4')
    const id = await outreach.sendTest(test, step as 1 | 2 | 3 | 4)
    console.log(
      id
        ? `Sent email ${step} of 4 to ${test} (${id}).`
        : `${test} has unsubscribed; nothing sent.`
    )
    return
  }

  const remove = flag('--remove')
  if (remove) {
    const removed = await outreach.remove(campaign, remove)
    console.log(
      removed
        ? `${remove} will not be written to again.`
        : `${remove} is not in ${campaign}.`
    )
    return
  }

  if (has('--status')) {
    const { data, error } = await supabase
      .from('outreach_recipients')
      .select('status, step')
      .eq('campaign', campaign)
    if (error) throw new Error(error.message)
    const tally = new Map<string, number>()
    for (const row of (data ?? []) as { status: string; step: number }[]) {
      const key =
        row.status === 'active' ? `active, ${row.step} of 4 sent` : row.status
      tally.set(key, (tally.get(key) ?? 0) + 1)
    }
    console.log(`${campaign}: ${data?.length ?? 0} address(es)`)
    for (const [key, count] of [...tally].sort())
      console.log(`  ${key}: ${count}`)
    return
  }

  const importPath = flag('--import')
  if (importPath) {
    const { prospects, rejected } = mailing.parseProspectsCsv(
      readFileSync(importPath, 'utf8')
    )
    console.log(
      `${importPath}: ${prospects.length} usable address(es), ${rejected.length} set aside`
    )
    for (const r of rejected)
      console.log(`  row ${r.row}: ${r.value} (${r.reason})`)
    const report = await outreach.importProspects({
      campaign,
      prospects,
      defaultSource: flag('--source') ?? 'public listing',
      dryRun: !apply,
    })
    console.log(
      apply
        ? '\nIMPORTED'
        : '\nDRY RUN — nothing recorded. Re-run with --apply.'
    )
    console.log(
      `  left out (already a gym or demo request): ${report.counts.known}\n` +
        `  ${apply ? 'added' : 'would add'}: ${report.counts.imported}`
    )
    return
  }

  if (has('--run')) {
    const limit = Number(flag('--limit') ?? mailing.OUTREACH_DAILY_LIMIT)
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error('--limit must be a positive whole number')
    const report = await outreach.runWeek({
      campaign,
      now: new Date(),
      limit,
      dryRun: !apply,
    })
    console.log(apply ? 'SENT' : 'DRY RUN — nothing sent. Re-run with --apply.')
    const c = report.counts
    console.log(
      apply
        ? `  sent: ${c.sent}   skipped (unsubscribed): ${c.skipped}   failed: ${c.failed}`
        : `  would send: ${c.would_send}`
    )
    for (const e of report.entries) {
      console.log(
        `  ${e.outcome.padEnd(10)} ${e.email}${e.step ? `  (email ${e.step})` : ''}${e.detail ? `  ${e.detail}` : ''}`
      )
    }
    if (c.failed > 0) process.exitCode = 1
    return
  }

  throw new Error(
    'Pass --import <csv>, --run, --test <address>, --remove <address> or --status'
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
