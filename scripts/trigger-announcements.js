#!/usr/bin/env node

/**
 * Run the announcement cron on production now, and check what it answered.
 *
 * The release workflow calls this once the released commit is live. The cron
 * answers 200 even when an email failed to render, preview or send (it logs
 * the failure to cron_logs), and right after a deploy the PREVIOUS deployment
 * can still answer — announcing nothing. So the answer is read, not just its
 * status: the release entry names the version that ran (inverted check,
 * 2026-10-06).
 *
 *   EXPECTED_VERSION=1.1.1 CRON_SECRET=… node scripts/trigger-announcements.js
 *
 * Asks again every 20 s, for up to 3 minutes, while an older version answers
 * or the server errors. Exit 0 when the expected version ran and nothing
 * failed; 1 otherwise. Every call is safe to repeat: nothing is announced
 * twice.
 */

const ANNOUNCE_URL = 'https://www.metricgymos.com/api/cron/send-announcements'
const FAILED = new Set([
  'render_failed',
  'preview_failed',
  'send_failed',
  'refresh_failed',
])
const RETRY_MS = 20_000
const ATTEMPTS = 10

/**
 * What one answer from the cron means.
 *
 * @param {number} status - HTTP status
 * @param {unknown} body - Parsed JSON
 * @param {string | null} expectedVersion - The version just released, if any
 * @returns {{ state: 'ok' | 'stale' | 'failed', reason?: string }}
 */
function assess(status, body, expectedVersion) {
  if (status >= 500) return { state: 'stale', reason: `HTTP ${status}` }
  if (status !== 200) return { state: 'failed', reason: `HTTP ${status}` }
  const entries =
    body && typeof body === 'object' && body.success === true && body.data
      ? body.data.entries || []
      : null
  if (!entries)
    return { state: 'failed', reason: 'the cron did not report success' }

  const failed = entries.filter((entry) => FAILED.has(entry.outcome))
  if (failed.length > 0) {
    return {
      state: 'failed',
      reason: failed
        .map(
          (e) =>
            `${e.kind} ${e.ref}: ${e.outcome}${e.detail ? ` — ${e.detail}` : ''}`
        )
        .join('; '),
    }
  }

  const release = entries.find((entry) => entry.kind === 'release')
  if (expectedVersion && release && release.ref !== expectedVersion) {
    return {
      state: 'stale',
      reason: `production answered as ${release.ref}, not ${expectedVersion}`,
    }
  }
  return { state: 'ok' }
}

async function main() {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET is not set')
  const expectedVersion = process.env.EXPECTED_VERSION || null

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const response = await fetch(ANNOUNCE_URL, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const text = await response.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    const result = assess(response.status, body, expectedVersion)
    console.log(`Attempt ${attempt}: HTTP ${response.status} ${text}`)
    if (result.state === 'ok') return 0
    if (result.state === 'failed') {
      console.log(`::error::Announcements failed: ${result.reason}`)
      return 1
    }
    console.log(`Not yet: ${result.reason}. Asking again in 20 s.`)
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
  }
  console.log(
    '::error::Production never answered as the released version. The daily 09:30 SLT run will announce it.'
  )
  return 1
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message)
      process.exit(1)
    }
  )
}

module.exports = { assess, ANNOUNCE_URL }
