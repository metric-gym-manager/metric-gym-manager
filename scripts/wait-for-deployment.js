#!/usr/bin/env node

/**
 * Wait until Vercel has deployed a commit to production.
 *
 * Vercel reports every deployment to GitHub as a Deployment in the
 * environment "Production – gym-management-saas" (the other Vercel project,
 * `-ihsw`, never builds). The release workflow calls this before it triggers
 * the announcement cron, so the email describes the version that is live.
 *
 *   node scripts/wait-for-deployment.js <sha>
 *
 * Exit codes: 0 deployed · 1 the deployment failed · 2 timed out (the daily
 * cron still announces at 09:30 SLT, so the caller warns rather than fails).
 * Needs GITHUB_TOKEN and GITHUB_REPOSITORY (set in GitHub Actions).
 */

const ENVIRONMENT = 'Production – gym-management-saas'
const POLL_MS = 20_000
const TIMEOUT_MS = 25 * 60_000

/**
 * What a deployment's statuses say, newest first as GitHub returns them.
 * `inactive` means a later production deployment replaced this one, which
 * happens only after it went live.
 *
 * @param {{ state: string }[]} statuses
 * @returns {'ready' | 'failed' | 'waiting'}
 */
function deploymentOutcome(statuses) {
  const latest = statuses[0]
  if (!latest) return 'waiting'
  if (latest.state === 'success' || latest.state === 'inactive') return 'ready'
  if (latest.state === 'failure' || latest.state === 'error') return 'failed'
  return 'waiting'
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub ${response.status} for ${path}`)
  }
  return response.json()
}

async function main() {
  const sha = process.argv[2]
  const repo = process.env.GITHUB_REPOSITORY
  if (!sha || !repo || !process.env.GITHUB_TOKEN) {
    throw new Error(
      'Usage: wait-for-deployment.js <sha> (with GITHUB_TOKEN, GITHUB_REPOSITORY)'
    )
  }

  const deadline = Date.now() + TIMEOUT_MS
  const query = `sha=${sha}&environment=${encodeURIComponent(ENVIRONMENT)}`
  while (Date.now() < deadline) {
    const [deployment] = await github(`/repos/${repo}/deployments?${query}`)
    if (deployment) {
      const statuses = await github(
        `/repos/${repo}/deployments/${deployment.id}/statuses?per_page=5`
      )
      const outcome = deploymentOutcome(statuses)
      if (outcome === 'ready') {
        console.log(`${sha.slice(0, 7)} is live in production.`)
        return 0
      }
      if (outcome === 'failed') {
        console.log(`The production deployment of ${sha.slice(0, 7)} failed.`)
        return 1
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  console.log(
    `No live production deployment of ${sha.slice(0, 7)} after 25 minutes.`
  )
  return 2
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

module.exports = { deploymentOutcome, ENVIRONMENT }
