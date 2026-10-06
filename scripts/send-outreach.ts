/**
 * Introduce Metric Gym OS to gyms whose contact details are on public pages.
 *
 *   npx tsx scripts/send-outreach.ts --test you@example.com
 *       One copy to that address, outside the campaign: see how it arrives.
 *
 *   npx tsx scripts/send-outreach.ts --csv gyms.csv
 *       DRY RUN. Reads the CSV, reports bad and repeated rows, the addresses
 *       left out (existing gyms and demo requests), and who the next batch
 *       would reach. Records and sends nothing.
 *
 *   npx tsx scripts/send-outreach.ts --csv gyms.csv --apply
 *       Records the new addresses and sends the next batch. Run it once a day:
 *       the CSV can be the same file each time, since nobody is emailed twice.
 *
 * Options: --source "<where the list came from>" (default "public listing"),
 * --limit <n> (default OUTREACH_DAILY_LIMIT; a new domain earns trust slowly),
 * --campaign <key> (default OUTREACH_CAMPAIGN).
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

  const test = flag('--test')
  if (test) {
    const id = await outreach.sendTest(test)
    console.log(
      id
        ? `Sent a test copy to ${test} (${id}).`
        : `${test} has unsubscribed; nothing sent.`
    )
    return
  }

  const csvPath = flag('--csv')
  if (!csvPath) throw new Error('Pass --csv <file>, or --test <address>')
  const apply = process.argv.includes('--apply')
  const limit = Number(flag('--limit') ?? mailing.OUTREACH_DAILY_LIMIT)
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error('--limit must be a positive whole number')

  const { prospects, rejected } = mailing.parseProspectsCsv(
    readFileSync(csvPath, 'utf8')
  )
  console.log(
    `${csvPath}: ${prospects.length} usable address(es), ${rejected.length} row(s) set aside`
  )
  for (const r of rejected)
    console.log(`  row ${r.row}: ${r.value} (${r.reason})`)

  const report = await outreach.execute({
    campaign: flag('--campaign') ?? mailing.OUTREACH_CAMPAIGN,
    prospects,
    source: flag('--source') ?? 'public listing',
    limit,
    dryRun: !apply,
  })

  console.log(
    apply
      ? '\nAPPLIED'
      : '\nDRY RUN — nothing recorded or sent. Re-run with --apply.'
  )
  const c = report.counts
  console.log(
    `  left out (already a gym or demo request): ${c.known}\n` +
      `  new to the campaign: ${c.imported}\n` +
      (apply
        ? `  sent: ${c.sent}   skipped (unsubscribed): ${c.skipped}   failed: ${c.failed}`
        : `  the next batch would reach: ${c.would_send}`)
  )
  for (const e of report.entries.filter((x) => x.outcome !== 'known')) {
    console.log(
      `  ${e.outcome.padEnd(10)} ${e.email}${e.detail ? `  (${e.detail})` : ''}`
    )
  }
  if (c.failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
