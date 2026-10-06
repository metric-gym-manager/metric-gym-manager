/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * .github/workflows/release.yml turns every push to master into a release
 * when the commits call for one, and triggers the release email once the
 * release is live. A workflow cannot run in a unit test, so this suite pins
 * the properties that, broken, would release twice, release nothing, or email
 * the gyms about a version that is not deployed.
 */

interface WaitForDeployment {
  deploymentOutcome(
    statuses: { state: string }[]
  ): 'ready' | 'failed' | 'waiting'
  ENVIRONMENT: string
}
const wait =
  require('../../../../scripts/wait-for-deployment.js') as WaitForDeployment

const ROOT = join(__dirname, '../../../..')
const workflow = readFileSync(
  join(ROOT, '.github/workflows/release.yml'),
  'utf8'
)

describe('deploymentOutcome', () => {
  it('reads the newest status: live, failed, or still going', () => {
    expect(wait.deploymentOutcome([{ state: 'success' }])).toBe('ready')
    expect(wait.deploymentOutcome([{ state: 'failure' }])).toBe('failed')
    expect(wait.deploymentOutcome([{ state: 'error' }])).toBe('failed')
    expect(
      wait.deploymentOutcome([{ state: 'in_progress' }, { state: 'success' }])
    ).toBe('waiting')
    expect(wait.deploymentOutcome([])).toBe('waiting')
  })

  it('counts a deployment replaced by a later one as having gone live', () => {
    expect(
      wait.deploymentOutcome([{ state: 'inactive' }, { state: 'success' }])
    ).toBe('ready')
  })

  it('watches the project that deploys, not the one that never builds', () => {
    expect(wait.ENVIRONMENT).toBe('Production – gym-management-saas')
  })
})

describe('the release workflow', () => {
  it('runs on pushes to master and nothing else', () => {
    expect(workflow).toMatch(/on:\n {2}push:\n {4}branches: \[master\]\n/)
    expect(workflow).not.toMatch(/pull_request/)
  })

  it('runs one release at a time, never cancelling one half-pushed', () => {
    expect(workflow).toMatch(
      /concurrency:\n {2}group: release\n {2}cancel-in-progress: false/
    )
  })

  it('never releases its own release commit', () => {
    expect(workflow).toContain(
      "!startsWith(github.event.head_commit.message, 'chore(release):')"
    )
  })

  it('reads the whole history and every tag, so "since the last release" is right', () => {
    expect(workflow).toMatch(/fetch-depth: 0/)
    expect(workflow).toMatch(/fetch-tags: true/)
  })

  it('cuts the release with the script, and pushes the commit and its tag together', () => {
    expect(workflow).toContain('node scripts/release.js')
    expect(workflow).toContain(
      'git push --atomic origin HEAD:master "v${{ steps.release.outputs.version }}"'
    )
  })

  it('publishes the email designs only when they changed', () => {
    expect(workflow).toContain(
      'src/features/mailing/config/announcementTemplates.ts'
    )
    expect(workflow).toContain('npx tsx scripts/publish-email-templates.ts')
    expect(workflow).toContain("if: steps.designs.outputs.changed == 'true'")
  })

  it('emails only once the released commit is live in production', () => {
    const waitAt = workflow.indexOf('node scripts/wait-for-deployment.js')
    const sendAt = workflow.indexOf('/api/cron/send-announcements')
    expect(waitAt).toBeGreaterThan(-1)
    expect(sendAt).toBeGreaterThan(waitAt)
    expect(workflow).toContain('steps.release.outputs.sha || github.sha')
    expect(workflow).toContain("if: steps.deployed.outputs.live == 'true'")
  })

  it('calls the production cron with its secret, never a value in the file', () => {
    expect(workflow).toContain(
      'https://www.metricgymos.com/api/cron/send-announcements'
    )
    expect(workflow).toContain('Authorization: Bearer $CRON_SECRET')
    expect(workflow).toContain('CRON_SECRET: ${{ secrets.CRON_SECRET }}')
    expect(workflow).toContain('RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}')
  })

  it('asks for no more than it needs: write to the repo, read deployments', () => {
    expect(workflow).toMatch(
      /permissions:\n {2}contents: write\n {2}deployments: read\n/
    )
  })
})
