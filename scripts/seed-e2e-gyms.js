/**
 * Seed (or repair) the gyms the Playwright E2E suite logs in as.
 *
 *   node scripts/seed-e2e-gyms.js
 *
 * Idempotent: safe to run repeatedly. It creates what is missing, fixes what is
 * wrong, and leaves everything else alone.
 *
 * ## Why this script exists
 *
 * The E2E gyms were originally created by hand with direct SQL, and it cost a
 * full session to recover from. Two failures came out of it, both of which
 * presented as "Invalid username or password" against credentials that were
 * perfectly correct (see access-control-master.md §8.3, causes 5 and 6):
 *
 *  1. **A direct `INSERT` into `auth.users` leaves four token columns NULL**
 *     (`confirmation_token`, `recovery_token`, `email_change`,
 *     `email_change_token_new`). GoTrue scans those into non-nullable Go
 *     strings, so *every* lookup of that user fails — sign-in and the Admin
 *     API alike. This script therefore goes through `auth.admin.createUser`,
 *     which fills them, and never writes `auth.users` directly.
 *
 *  2. **`gyms.email_verified` is an app column, not Supabase auth state.**
 *     `auth.service.ts` computes `requiresEmailVerification` from it and the
 *     login route answers 403 regardless of how confirmed the address is in
 *     Supabase. Confirming the email does not set it. This script does.
 *
 * ## Safety
 *
 * Refuses to touch anything whose address is not `@metricgym.test` — a
 * reserved TLD that cannot belong to a real person. The guard is on every
 * write path, not just the entry point.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error(
    '   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** The gyms the suite needs, and the shape each one must have. */
const GYMS = [
  {
    label: 'enterprise',
    email: process.env.E2E_ENTERPRISE_GYM_EMAIL,
    password: process.env.E2E_ENTERPRISE_GYM_PASSWORD,
    gymName: 'E2E Enterprise Gym',
    // Enterprise is the only tier `requireAccessControlGym` admits; anything
    // else 403s on every access-control route.
    tier: 'enterprise',
    status: 'active',
    required: true,
  },
  {
    label: 'lite',
    email: process.env.E2E_LITE_GYM_EMAIL,
    password: process.env.E2E_LITE_GYM_PASSWORD,
    gymName: 'E2E Lite Gym',
    // Exists purely to prove the capability gate: a gym without the hardware
    // entitlement must not see the panel at all.
    tier: 'lite',
    status: 'trialing',
    required: false,
  },
]

const TEST_DOMAIN = '@metricgym.test'

function assertTestAccount(email) {
  if (!email || !email.endsWith(TEST_DOMAIN)) {
    throw new Error(`refusing to touch a non-test account: ${email}`)
  }
}

/** Find a user by email without relying on a filter the API may not support. */
async function findUserByEmail(email) {
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw new Error(`listUsers failed: ${error.message}`)

    const match = data.users.find((u) => u.email === email)
    if (match) return match
    if (data.users.length < 200) return null
    page += 1
  }
}

async function ensureAuthUser(spec) {
  assertTestAccount(spec.email)

  const existing = await findUserByEmail(spec.email)

  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      // Confirmed at creation. The suite has no inbox to click through.
      email_confirm: true,
    })
    if (error) throw new Error(`createUser failed: ${error.message}`)
    console.log(`  auth user   created`)
    return data.user
  }

  // Re-assert the password so a drifted .env.local and the database agree, and
  // re-confirm in case the address was reset.
  const { data, error } = await supabase.auth.admin.updateUserById(
    existing.id,
    {
      password: spec.password,
      email_confirm: true,
    }
  )
  if (error) throw new Error(`updateUserById failed: ${error.message}`)
  console.log(`  auth user   already present, password re-asserted`)
  return data.user
}

async function ensureGym(spec, user) {
  assertTestAccount(user.email)

  const { data: existing, error: readError } = await supabase
    .from('gyms')
    .select('id, subscription_tier, subscription_status, email_verified')
    .eq('user_id', user.id)
    .maybeSingle()

  if (readError) throw new Error(`gym lookup failed: ${readError.message}`)

  // Derived from the address, not the spec's label. `gyms.username` is UNIQUE
  // across the whole table, so a hardcoded value collides the moment this runs
  // against a project that already has a gym holding it — and the raw error
  // ("duplicate key value violates unique constraint") gives no hint that a
  // seed name is the problem. Deriving it means each seeded address gets its
  // own, and two different addresses can never fight over one.
  const username = spec.email.split('@')[0]

  const shape = {
    user_id: user.id,
    username,
    email: spec.email,
    gym_name: spec.gymName,
    subscription_tier: spec.tier,
    subscription_status: spec.status,
    // The gate that is invisible from Supabase's own auth settings.
    email_verified: true,
  }

  if (!existing) {
    const { data, error } = await supabase
      .from('gyms')
      .insert(shape)
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') {
        throw new Error(
          `gym insert failed — a gym already holds username "${username}" or email "${spec.email}". ` +
            `Point E2E_${spec.label.toUpperCase()}_GYM_EMAIL at an unused @metricgym.test address, or remove the stale gym.`
        )
      }
      throw new Error(`gym insert failed: ${error.message}`)
    }
    console.log(`  gym         created (${spec.tier}/${spec.status})`)
    return data.id
  }

  const { error } = await supabase
    .from('gyms')
    .update(shape)
    .eq('id', existing.id)
  if (error) throw new Error(`gym update failed: ${error.message}`)

  const wasWrong =
    existing.subscription_tier !== spec.tier ||
    existing.subscription_status !== spec.status ||
    existing.email_verified !== true
  console.log(
    `  gym         ${wasWrong ? 'repaired' : 'already correct'} (${spec.tier}/${spec.status})`
  )
  return existing.id
}

/**
 * One active member per gym.
 *
 * The member specs open "the first data row" on /members, so a gym with no
 * members fails in a way that looks like a broken selector. `next_due_date` is
 * pushed out well past today because access verdicts derive from it, not from
 * `members.status` — a member due yesterday reads as "cannot get in" and the
 * verdict assertions invert.
 */
async function ensureMember(gymId, gymEmail) {
  assertTestAccount(gymEmail)

  const { data: existing, error: readError } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gymId)
    .limit(1)

  if (readError) throw new Error(`member lookup failed: ${readError.message}`)
  if (existing && existing.length > 0) {
    console.log(`  member      already present`)
    return
  }

  const dueDate = new Date()
  dueDate.setMonth(dueDate.getMonth() + 2)

  const { error } = await supabase.from('members').insert({
    gym_id: gymId,
    name: 'E2E Test Member',
    phone_number: '+94770000001',
    plan_type: 'monthly',
    plan_amount: 5000,
    next_due_date: dueDate.toISOString().slice(0, 10),
    member_number: 1,
    status: 'active',
  })
  if (error) throw new Error(`member insert failed: ${error.message}`)
  console.log(`  member      created`)
}

/** Prove the seed works the way the suite will use it: an actual sign-in. */
async function verifySignIn(spec) {
  const anon = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error } = await anon.auth.signInWithPassword({
    email: spec.email,
    password: spec.password,
  })
  if (error) throw new Error(`sign-in check failed: ${error.message}`)
  await anon.auth.signOut()
  console.log(`  sign-in     OK`)
}

async function main() {
  console.log(`Seeding E2E gyms against ${supabaseUrl}\n`)
  let seeded = 0

  for (const spec of GYMS) {
    if (!spec.email || !spec.password) {
      const message = `${spec.label}: skipped — E2E_${spec.label.toUpperCase()}_GYM_EMAIL / _PASSWORD not set in .env.local`
      if (spec.required) {
        console.error(`❌ ${message}`)
        process.exit(1)
      }
      console.log(`${spec.label}:\n  skipped     optional, env not set\n`)
      continue
    }

    console.log(`${spec.label} (${spec.email}):`)
    const user = await ensureAuthUser(spec)
    const gymId = await ensureGym(spec, user)
    await ensureMember(gymId, spec.email)
    await verifySignIn(spec)
    console.log()
    seeded += 1
  }

  console.log(
    `✅ ${seeded} gym(s) ready. Run: npx playwright test access-control`
  )
}

main().catch((error) => {
  console.error(`\n❌ ${error.message}`)
  process.exit(1)
})
