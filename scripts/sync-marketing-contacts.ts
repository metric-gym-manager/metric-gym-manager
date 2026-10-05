/**
 * Sync the Resend mailing list with the app: every registered gym into the
 * "Gym owners" audience, every demo lead who ticked the consent box into
 * "Demo leads" (docs/architecture/marketing-email.md).
 *
 * Additive only: it adds missing people and never changes an existing
 * contact's subscriptions, so an opt-out made on /unsubscribe survives every
 * re-run. Test and E2E gyms are left out: the ids in SMS_DISABLED_GYM_IDS,
 * plus anything passed with --exclude-gym or --exclude.
 *
 * Addresses at reserved TLDs (.test, .example, .invalid, .localhost, .local)
 * are never imported: they cannot receive mail, and a hard bounce costs the
 * sending domain reputation.
 *
 * An existing contact's unsubscribe token is never overwritten: a mismatch
 * means this machine's MARKETING_UNSUBSCRIBE_SECRET differs from the one that
 * signed it, and rewriting would break every link already sent. Such
 * contacts are reported as token_mismatch. Pass --rotate-tokens only when the
 * secret was rotated on purpose and the new value is already in Vercel.
 *
 * DRY RUN BY DEFAULT — prints who would be added and writes nothing.
 *
 * Usage:
 *   npx tsx scripts/sync-marketing-contacts.ts
 *   npx tsx scripts/sync-marketing-contacts.ts --exclude a@b.lk --exclude-gym <uuid>
 *   npx tsx scripts/sync-marketing-contacts.ts --apply ...
 *
 * Needs, in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * RESEND_API_KEY (full access) and MARKETING_UNSUBSCRIBE_SECRET.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

function flagValues(name: string): string[] {
  const values: string[] = []
  const args = process.argv.slice(2)
  args.forEach((arg, i) => {
    if (arg === name && args[i + 1]) values.push(args[i + 1])
  })
  return values
}

async function main() {
  // Imported after dotenv, so the factory reads the variables it just loaded.
  const { createSyncMarketingContacts } = await import('@/features/mailing')

  const apply = process.argv.includes('--apply')
  const rotateTokens = process.argv.includes('--rotate-tokens')
  if (!process.env.SMS_DISABLED_GYM_IDS) {
    console.warn(
      'WARNING: SMS_DISABLED_GYM_IDS is not set here, so the E2E gyms are not excluded by id.\n' +
        '         Pass them with --exclude-gym <id> (they are in Vercel), or check the plan below.\n'
    )
  }
  const excludeGymIds = [
    ...(process.env.SMS_DISABLED_GYM_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    ...flagValues('--exclude-gym'),
  ]
  const excludeEmails = flagValues('--exclude')

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

  const report = await createSyncMarketingContacts(supabase, {
    rotateTokens,
  }).execute({
    apply,
    excludeGymIds,
    excludeEmails,
  })

  console.log(
    apply ? 'APPLIED\n' : 'DRY RUN — nothing written. Re-run with --apply.\n'
  )
  for (const entry of report) {
    console.log(
      `${entry.outcome.padEnd(18)} ${entry.audience.padEnd(11)} ${entry.email}` +
        (entry.error ? `  (${entry.error})` : '')
    )
  }
  const counts = report.reduce<Record<string, number>>((acc, e) => {
    acc[e.outcome] = (acc[e.outcome] ?? 0) + 1
    return acc
  }, {})
  console.log(
    '\n' +
      Object.entries(counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join('  ')
  )
  if (counts.token_mismatch) {
    console.warn(
      `\nWARNING: ${counts.token_mismatch} contact(s) carry a token signed with a different\n` +
        '         MARKETING_UNSUBSCRIBE_SECRET. Their links work only if THAT secret is the one\n' +
        '         in Vercel. Compare secrets before using --rotate-tokens.'
    )
  }
  if (report.some((e) => e.outcome === 'failed')) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
