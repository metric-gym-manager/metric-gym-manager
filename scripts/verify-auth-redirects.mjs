#!/usr/bin/env node
/**
 * Verify the Supabase auth redirect configuration from the outside.
 *
 * WHY THIS EXISTS
 * ---------------
 * Password recovery was broken end to end in production and nothing in the
 * repository could see it, because the defect lived in dashboard configuration
 * rather than in code. The emailed link carried
 * `redirect_to=http://metricgymmanager.com` — the bare Site URL of a retired
 * domain — because the URL the code asked for was not on the project's
 * "Redirect URLs" allow list. Supabase discards a `redirectTo` that is not
 * allow-listed and silently substitutes Site URL. Every reset link therefore
 * landed on the marketing root, and the user was quietly signed in with their
 * password unchanged.
 *
 * HOW IT WORKS
 * ------------
 * Supabase validates `redirect_to` against the allow list when it issues the
 * redirect, so a DELIBERATELY INVALID token is enough to read the decision back:
 *
 *   allow-listed  -> 303 to <candidate>#error=otp_expired...
 *   rejected      -> 303 to <SITE_URL>#error=otp_expired...
 *
 * That means this check needs no email, no secrets beyond the publishable URL,
 * and has no side effects. The token is invalid by construction, so nothing is
 * consumed and no account is touched.
 *
 * Run it BEFORE changing the dashboard (it must fail) and AFTER (it must pass).
 * A check that cannot fail proves nothing.
 *
 *   npm run auth:verify
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every URL an auth email may legitimately redirect to. Each must be present on
 * the project's allow list, at
 * Dashboard -> Authentication -> URL Configuration -> Redirect URLs.
 *
 * Wildcards are accepted there (`https://www.metricgymos.com/**`), so one entry
 * per host is usually enough to satisfy several rows here.
 */
const REQUIRED = [
  'https://www.metricgymos.com/reset-password',
  'https://www.metricgymos.com/auth/callback',
  'https://metricgymos.com/reset-password',
  'http://localhost:3000/reset-password',
  'http://localhost:3000/auth/callback',
]

/** Site URL the project should fall back to. */
const EXPECTED_SITE_URL = 'https://www.metricgymos.com'

function readEnv(key) {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const raw of fs
        .readFileSync(path.join(ROOT, file), 'utf8')
        .split('\n')) {
        const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '')
      }
    } catch {
      /* absent */
    }
  }
  return process.env[key]
}

/** Where does Supabase actually send a browser for this candidate? */
async function resolveRedirect(supabaseUrl, candidate) {
  const url =
    `${supabaseUrl}/auth/v1/verify` +
    `?token=deliberately-invalid-by-design` +
    `&type=recovery&redirect_to=${encodeURIComponent(candidate)}`

  const res = await fetch(url, { redirect: 'manual' })
  const location = res.headers.get('location')
  if (!location)
    throw new Error(`no redirect from ${candidate} (HTTP ${res.status})`)
  // Strip the error fragment Supabase appends; only the destination matters.
  return location.split('#')[0].replace(/\/$/, '')
}

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseUrl) {
  console.log('⚠ auth:verify SKIPPED — NEXT_PUBLIC_SUPABASE_URL is not set.')
  process.exit(0)
}

console.log(`\nProbing ${supabaseUrl}\n`)

let failures = 0
const siteUrls = new Set()

for (const candidate of REQUIRED) {
  let landed
  try {
    landed = await resolveRedirect(supabaseUrl, candidate)
  } catch (err) {
    console.error(`  ✗ ${candidate}\n      ${err.message}`)
    failures++
    continue
  }

  // An allow-listed candidate is echoed back; a rejected one is replaced.
  if (landed === candidate.replace(/\/$/, '')) {
    console.log(`  ✓ ${candidate}`)
  } else {
    console.error(`  ✗ ${candidate}`)
    console.error(`      rejected — Supabase substituted ${landed}`)
    siteUrls.add(landed)
    failures++
  }
}

if (siteUrls.size) {
  const detected = [...siteUrls]
  console.log(`\n  Site URL in effect: ${detected.join(', ')}`)
  if (!detected.every((u) => u.startsWith(EXPECTED_SITE_URL))) {
    console.log(`  Expected:           ${EXPECTED_SITE_URL}`)
  }
}

if (failures === 0) {
  console.log('\n✅ auth:verify — every redirect target is allow-listed.\n')
  process.exit(0)
}

console.error(
  `\n❌ auth:verify — ${failures} redirect target(s) not allow-listed.\n\n` +
    `  Supabase discards a redirectTo that is not on the allow list and\n` +
    `  substitutes Site URL, so these links land on the site root instead of\n` +
    `  the page they name. Fix at:\n` +
    `    Dashboard -> Authentication -> URL Configuration\n\n` +
    `  Site URL:      ${EXPECTED_SITE_URL}\n` +
    `  Redirect URLs: https://www.metricgymos.com/**\n` +
    `                 https://metricgymos.com/**\n` +
    `                 http://localhost:3000/**\n`
)
process.exit(1)
