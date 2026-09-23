/**
 * Read-only check of the vendor-sourced reconcile comparison (campaign F28).
 *
 * Runs the REAL `ReconcileMemberAccess` against the production database and the
 * live VFT account, with two things swapped out:
 *
 *  - `enqueue` is intercepted, so nothing is queued and no hardware is touched;
 *  - credentials come from `.env.local` rather than `getCredentials`, because
 *    the stored ciphertext is readable only by the environment whose
 *    `ACCESS_CONTROL_ENCRYPTION_KEY` wrote it (finding F12) — a laptop would
 *    otherwise fall back to the local diff and prove nothing.
 *
 * Everything else is production code: the subject read, the vendor list, the
 * access decision and the comparison.
 *
 * Usage: npx tsx scripts/manual/verify-vendor-reconcile.ts [--gym <id>]
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { SupabaseAccessControlRepository } from '../../src/features/access-control/services/SupabaseAccessControlRepository'
import { SupabaseGymSubscriptionRepository } from '../../src/features/subscriptions/services/SupabaseGymSubscriptionRepository'
import { EvictInactiveSubjects } from '../../src/features/access-control/services/EvictInactiveSubjects'
import { ReconcileMemberAccess } from '../../src/features/access-control/services/ReconcileMemberAccess'
import { VftAccessControlProvider } from '../../src/lib/access-control/VftAccessControlProvider'
import type { AccessCredentials } from '../../src/lib/access-control/IAccessControlProvider'

config({ path: '.env.local' })

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const credentials: AccessCredentials = {
    baseUrl: process.env.VFT_API_BASE_URL!,
    email: process.env.VFT_PROBE_EMAIL!.trim(),
    password: process.env.VFT_PROBE_PASSWORD!,
    areaId: 1,
  }

  const repo = new SupabaseAccessControlRepository(supabase)

  const enqueued: Array<{ memberId: string | null; intent: string }> = []

  const readOnlyRepo = new Proxy(repo, {
    get(target, prop, receiver) {
      if (prop === 'enqueue') {
        return async (
          _gymId: string,
          memberId: string | null,
          intent: string
        ) => {
          enqueued.push({ memberId, intent })
        }
      }
      if (prop === 'getCredentials') {
        return async () => credentials
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  const provider = new VftAccessControlProvider()

  const gymId = arg('gym')

  const { data: gyms } = await supabase
    .from('access_control_accounts')
    .select('gym_id, is_active, gyms(name)')
    .eq('is_active', true)

  console.log('Gyms with an active access-control account:')
  for (const row of gyms ?? []) {
    console.log(
      `  ${row.gym_id}  ${(row as { gyms?: { name?: string } }).gyms?.name ?? ''}`
    )
  }

  // What the vendor holds, printed raw beside what we are about to compare.
  const vendorSubjects = await provider.listSubjects(credentials)
  console.log('\nVendor subjects (GET /api/template):')
  for (const s of vendorSubjects) {
    console.log(
      `  ${s.subjectId}  ${s.name}  window=${s.validFrom ?? 'null'}..${s.validTo ?? 'null'}  IsSync=${s.syncedToVendor}  deleted=${s.deleted}`
    )
  }

  const useCase = new ReconcileMemberAccess(
    readOnlyRepo,
    new SupabaseGymSubscriptionRepository(supabase),
    new EvictInactiveSubjects(readOnlyRepo, provider),
    provider
  )

  const summary = await useCase.execute(gymId ? { gymId } : {})

  console.log('\nSummary (NOTHING was enqueued — enqueue is intercepted):')
  console.log(JSON.stringify(summary, null, 2))
  console.log('\nWould have enqueued:', JSON.stringify(enqueued, null, 2))
}

main().catch((error) => {
  console.error('FAILED', error)
  process.exit(1)
})
