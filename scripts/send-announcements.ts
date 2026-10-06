/**
 * Release and policy-change announcements, by hand: the same run the
 * `send-announcements` cron makes, plus a check of the Resend templates.
 *
 *   npx tsx scripts/send-announcements.ts
 *       DRY RUN. Renders what the cron would send today, writes each email to
 *       an HTML file you can open, and checks both Resend templates against
 *       the variable contract. Claims, previews and sends nothing.
 *
 *   npx tsx scripts/send-announcements.ts --apply
 *       The cron's run: preview to the Test segment now, the real send to
 *       the gyms 24 hours later.
 *
 * Trials (fixture data is refused without --test-only, so a trial can never
 * reach a gym):
 *   --test-only              the "real" broadcast goes to the Test segment too
 *   --changelog <file>       announce from this file instead of CHANGELOG.md
 *   --app-version <x.y.z>    treat this version as deployed
 *   --legal <file.json>      a JSON array of legal changes instead of LEGAL_CHANGES
 *
 * Re-sending after a cancel:
 *   --force <kind> <ref>     with --apply: forget one announcement first, e.g.
 *                            --force release 1.2.0  or  --force policy privacy@2026-10-06
 *
 *   --out <dir>              where dry-run HTML goes (default: the OS temp dir)
 *
 * Reads .env.local: RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY. See docs/architecture/marketing-email.md.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

function flag(name: string): string | undefined {
  const args = process.argv.slice(2)
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}

async function main() {
  // Imported after dotenv, so the factories read the variables it just loaded.
  const mailing = await import('@/features/mailing')
  const { LEGAL_CHANGES } =
    await import('@/features/marketing/config/legalChanges')
  const { APP_VERSION } = await import('@/lib/client-state/app-version')

  const apply = process.argv.includes('--apply')
  const testOnly = process.argv.includes('--test-only')
  const changelogPath = flag('--changelog')
  const appVersion = flag('--app-version')
  const legalPath = flag('--legal')
  const forceAt = process.argv.indexOf('--force')
  const force =
    forceAt >= 0
      ? { kind: process.argv[forceAt + 1], ref: process.argv[forceAt + 2] }
      : null

  const usesFixtures = Boolean(changelogPath || appVersion || legalPath)
  if (apply && usesFixtures && !testOnly) {
    throw new Error(
      '--changelog, --app-version and --legal are for trials: add --test-only, ' +
        'so the fixture can only reach the Test segment.'
    )
  }
  if (force && !apply) throw new Error('--force needs --apply')

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

  // ── The templates, against the contract ────────────────────────────────
  const broadcaster = mailing.createBroadcaster()
  if (!broadcaster) throw new Error('RESEND_API_KEY is not set')
  console.log('Templates')
  for (const kind of Object.values(mailing.AnnouncementKind)) {
    const alias = mailing.ANNOUNCEMENT_TEMPLATE_ALIAS[kind]
    const template = await broadcaster.getTemplate(alias)
    if (!template) {
      console.log(`  ${alias}: MISSING — nothing of this kind will be sent`)
      continue
    }
    const contract = new Set<string>(mailing.ANNOUNCEMENT_VARIABLES[kind])
    const withFallback = new Set(
      template.variables.filter((v) => v.fallback !== null).map((v) => v.key)
    )
    const used = mailing.placeholdersIn(
      `${template.subject ?? ''} ${template.html}`
    )
    const blocking = used.filter(
      (name) => !contract.has(name) && !withFallback.has(name)
    )
    const unused = [...contract].filter((name) => !used.includes(name))
    console.log(
      `  ${alias}: ${template.published ? 'published' : 'DRAFT — not sent until published'}`
    )
    console.log(`    uses: ${used.join(', ') || '(none)'}`)
    if (blocking.length) {
      console.log(
        `    BLOCKS SENDING — not in the contract and no fallback: ${blocking.join(', ')}`
      )
    }
    if (unused.length)
      console.log(`    available, unused: ${unused.join(', ')}`)
  }

  // ── The run ────────────────────────────────────────────────────────────
  if (force) {
    const { data, error } = await supabase
      .from('mailing_announcements')
      .delete()
      .eq('kind', force.kind)
      .eq('ref', force.ref)
      .select('id')
    if (error) throw new Error(error.message)
    console.log(
      `\nForgot ${force.kind} ${force.ref}: ${data?.length ? 'removed' : 'there was no row'}`
    )
  }

  const legalChanges = legalPath
    ? JSON.parse(readFileSync(legalPath, 'utf8'))
    : LEGAL_CHANGES
  const report = await mailing.createSendAnnouncements(supabase).execute({
    appVersion: appVersion ?? APP_VERSION,
    changelog: readFileSync(changelogPath ?? 'CHANGELOG.md', 'utf8'),
    legalChanges,
    now: new Date(),
    dryRun: !apply,
    testOnly,
  })

  console.log(
    apply
      ? `\nAPPLIED${testOnly ? ' (Test segment only)' : ''}`
      : '\nDRY RUN — nothing claimed, previewed or sent. Re-run with --apply.'
  )
  const outDir = flag('--out') ?? join(tmpdir(), 'metric-announcements')
  for (const entry of report) {
    let line = `  ${entry.outcome.padEnd(18)} ${entry.kind} ${entry.ref}`
    if (entry.scheduledFor) line += `  → ${entry.scheduledFor}`
    if (entry.detail) line += `  (${entry.detail})`
    console.log(line)
    if (entry.html) {
      mkdirSync(outDir, { recursive: true })
      const file = join(
        outDir,
        `${entry.kind}-${entry.ref.replace(/[^a-z0-9.-]/gi, '_')}.html`
      )
      writeFileSync(file, entry.html)
      console.log(`      subject: ${entry.subject}\n      html:    ${file}`)
    }
  }
  const failed = new Set([
    'render_failed',
    'preview_failed',
    'send_failed',
    'refresh_failed',
  ])
  if (report.some((e) => failed.has(e.outcome))) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
