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

interface Trigger {
  assess(
    status: number,
    body: unknown,
    expectedVersion: string | null
  ): { state: 'ok' | 'stale' | 'failed'; reason?: string }
  ANNOUNCE_URL: string
}
const trigger =
  require('../../../../scripts/trigger-announcements.js') as Trigger

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
    // The designs are announcementTemplates.ts on the shared email frame: a
    // change to either is a change to what Resend must hold.
    expect(workflow).toContain(
      "grep -qxE 'src/features/mailing/(config/announcementTemplates|utils/emailFrame)[.]ts'"
    )
    expect(workflow).toContain('npx tsx scripts/publish-email-templates.ts')
    expect(workflow).toContain("if: steps.designs.outputs.changed == 'true'")
  })

  it('emails only once the released commit is live in production', () => {
    const waitAt = workflow.indexOf('node scripts/wait-for-deployment.js')
    const sendAt = workflow.indexOf('node scripts/trigger-announcements.js')
    expect(waitAt).toBeGreaterThan(-1)
    expect(sendAt).toBeGreaterThan(waitAt)
    expect(workflow).toContain('steps.release.outputs.sha || github.sha')
    expect(workflow).toContain("if: steps.deployed.outputs.live == 'true'")
    expect(workflow).toContain(
      'EXPECTED_VERSION: ${{ steps.release.outputs.version }}'
    )
  })

  it('calls the production cron with its secret, never a value in the file', () => {
    expect(trigger.ANNOUNCE_URL).toBe(
      'https://www.metricgymos.com/api/cron/send-announcements'
    )
    expect(workflow).toContain('CRON_SECRET: ${{ secrets.CRON_SECRET }}')
    expect(workflow).toContain('RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}')
  })

  it('releases from the newest master, and steps aside when master moves mid-release', () => {
    expect(workflow).toMatch(/ref: master\n/)
    expect(workflow).toContain('superseded=true')
    expect(workflow).toContain("steps.push.outputs.superseded != 'true'")
  })

  it('warns and skips, rather than failing, when a secret is not set yet', () => {
    expect(workflow).toContain('if [ -z "$RESEND_API_KEY" ]; then')
    expect(workflow).toContain('if [ -z "$CRON_SECRET" ]; then')
    expect(workflow.match(/::warning::[^\n]*is not set/g)).toHaveLength(2)
  })

  it('asks for no more than it needs: write to the repo, read deployments', () => {
    expect(workflow).toMatch(
      /permissions:\n {2}contents: write\n {2}deployments: read\n/
    )
  })
})

/**
 * Inverted check, 2026-10-06. The trigger used to trust a bare HTTP 200: the
 * cron answers 200 even when an email failed to render or send, and right
 * after a deploy the PREVIOUS deployment can still answer — announcing
 * nothing, with a green tick. The cron's answer names the version that ran.
 */
describe('assess — what the announcement cron answered', () => {
  const answer = (entries: object[]) => ({
    success: true,
    data: { counts: {}, entries },
  })

  it('accepts a run of the released version', () => {
    expect(
      trigger.assess(
        200,
        answer([
          { kind: 'release', ref: '1.1.1', outcome: 'scheduled' },
          {
            kind: 'policy',
            ref: 'privacy@2026-10-06',
            outcome: 'already_announced',
          },
        ]),
        '1.1.1'
      ).state
    ).toBe('ok')
  })

  it('calls an answer from the previous version stale, so it is asked again', () => {
    expect(
      trigger.assess(
        200,
        answer([{ kind: 'release', ref: '1.1.0', outcome: 'no_release' }]),
        '1.1.1'
      )
    ).toEqual({
      state: 'stale',
      reason: 'production answered as 1.1.0, not 1.1.1',
    })
  })

  it('fails on any email that could not be rendered, previewed or sent', () => {
    for (const outcome of [
      'render_failed',
      'preview_failed',
      'send_failed',
      'refresh_failed',
    ]) {
      const result = trigger.assess(
        200,
        answer([
          { kind: 'release', ref: '1.1.1', outcome, detail: 'HEADLINE' },
        ]),
        '1.1.1'
      )
      expect(result.state).toBe('failed')
      expect(result.reason).toContain(`release 1.1.1: ${outcome} — HEADLINE`)
    }
  })

  it('fails on a refused secret, and retries a server error as transient', () => {
    expect(trigger.assess(401, {}, null).state).toBe('failed')
    expect(trigger.assess(502, {}, null).state).toBe('stale')
  })

  it('needs no version when nothing was released', () => {
    expect(
      trigger.assess(
        200,
        answer([{ kind: 'release', ref: '1.1.0', outcome: 'no_release' }]),
        null
      ).state
    ).toBe('ok')
  })
})
