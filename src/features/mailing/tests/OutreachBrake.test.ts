/**
 * @jest-environment node
 */
import { OUTREACH_BRAKE } from '../config/outreachCampaign'
import { OutreachBrake } from '../services/OutreachBrake'
import {
  FakeOwnerMailer,
  MemoryCampaigns,
  MemoryLedger,
} from './memoryOutreach'

/**
 * The safety brake (owner request, 2026-10-06): the campaign pauses itself
 * when complaints or bounces spike, before mail providers start treating the
 * domain as a spammer's, and emails the owner.
 */
const CAMPAIGN = 'intro-test'
const NOW = new Date('2026-10-20T04:30:00Z')
const DAY = 86_400_000

function setup() {
  const ledger = new MemoryLedger(CAMPAIGN)
  ledger.clock = () => NOW
  const campaigns = new MemoryCampaigns()
  const owner = new FakeOwnerMailer()
  const brake = new OutreachBrake(ledger, campaigns, owner)
  /** `n` events of a type, as if each happened at `at`. */
  const happen = (
    type: 'sent' | 'bounced' | 'complained' | 'suppressed',
    n: number,
    at = NOW
  ) => {
    for (let i = 0; i < n; i++) {
      ledger.events.push({
        campaign: CAMPAIGN,
        email: `${type}${i}@gym.lk`,
        type,
        step: 1,
        detail: null,
        at,
      })
    }
  }
  return { ledger, campaigns, owner, brake, happen }
}

describe('OutreachBrake', () => {
  it('lets a healthy campaign run', async () => {
    const { brake, happen, owner } = setup()
    happen('sent', 80)
    happen('bounced', 2)
    happen('complained', 1)
    expect(await brake.check(CAMPAIGN, NOW)).toEqual({ paused: false })
    expect(owner.sent).toHaveLength(0)
  })

  it('pauses at the second spam complaint, and tells the owner why and how to resume', async () => {
    const { brake, happen, owner, campaigns } = setup()
    happen('sent', 80)
    happen('complained', OUTREACH_BRAKE.complaints)
    const state = await brake.check(CAMPAIGN, NOW)
    expect(state).toMatchObject({ paused: true, reason: '2 spam complaints' })
    expect((await campaigns.state(CAMPAIGN)).pausedAt).toEqual(NOW)
    expect(owner.sent).toHaveLength(1)
    expect(owner.sent[0].subject).toContain('paused')
    expect(owner.sent[0].text).toContain('2 spam complaints')
    expect(owner.sent[0].text).toContain(
      'npx tsx scripts/send-outreach.ts --resume'
    )
  })

  it('pauses when more than 5% of sends bounce, once there are enough sends to judge', async () => {
    const { brake, happen } = setup()
    happen('sent', OUTREACH_BRAKE.minSendsForBounceRate)
    happen('bounced', 3)
    expect(await brake.check(CAMPAIGN, NOW)).toMatchObject({
      paused: true,
      reason: '3 of 40 emails bounced (7.5%)',
    })
  })

  it('does not pause at exactly 5%', async () => {
    const { brake, happen } = setup()
    happen('sent', 80)
    happen('bounced', 4)
    expect(await brake.check(CAMPAIGN, NOW)).toEqual({ paused: false })
  })

  it('does not judge a bounce rate on too few sends', async () => {
    const { brake, happen } = setup()
    happen('sent', OUTREACH_BRAKE.minSendsForBounceRate - 1)
    happen('bounced', 10)
    expect(await brake.check(CAMPAIGN, NOW)).toEqual({ paused: false })
  })

  it('does not count a suppressed send as a bounce: no mail provider saw it', async () => {
    const { brake, happen } = setup()
    happen('sent', 40)
    happen('suppressed', 10)
    expect(await brake.check(CAMPAIGN, NOW)).toEqual({ paused: false })
  })

  it('alerts the owner once, however often it is checked', async () => {
    const { brake, happen, owner } = setup()
    happen('complained', 2)
    await brake.check(CAMPAIGN, NOW)
    await brake.check(CAMPAIGN, NOW)
    happen('complained', 1)
    await brake.check(CAMPAIGN, NOW)
    expect(owner.sent).toHaveLength(1)
  })

  it('still owes the alert when it could not be sent, and sends it on the next check', async () => {
    const { brake, happen, owner, campaigns } = setup()
    happen('complained', 2)
    owner.failSends = true
    await expect(brake.check(CAMPAIGN, NOW)).rejects.toThrow('Resend is down')
    expect((await campaigns.state(CAMPAIGN)).pausedAt).toEqual(NOW)
    owner.failSends = false
    expect(await brake.check(CAMPAIGN, NOW)).toMatchObject({ paused: true })
    expect(owner.sent).toHaveLength(1)
    expect((await campaigns.state(CAMPAIGN)).pauseAlertedAt).toEqual(NOW)
  })

  it('counts afresh after the owner resumes, so an old spike cannot pause it again', async () => {
    const { brake, happen } = setup()
    happen('sent', 80, new Date(NOW.getTime() - 2 * DAY))
    happen('complained', 2, new Date(NOW.getTime() - 2 * DAY))
    await brake.check(CAMPAIGN, NOW)
    expect(await brake.resume(CAMPAIGN, NOW)).toBe(true)
    expect(await brake.check(CAMPAIGN, NOW)).toEqual({ paused: false })
    happen('complained', 2)
    expect(await brake.check(CAMPAIGN, NOW)).toMatchObject({ paused: true })
  })

  it('pauses nothing and alerts no one on a dry run', async () => {
    const { brake, happen, owner, campaigns } = setup()
    happen('complained', 5)
    expect(await brake.check(CAMPAIGN, NOW, { dryRun: true })).toMatchObject({
      paused: false,
      wouldPause: '5 spam complaints',
    })
    expect((await campaigns.state(CAMPAIGN)).pausedAt).toBeNull()
    expect(owner.sent).toHaveLength(0)
  })

  it('can be paused by the owner, with no alert to themselves', async () => {
    const { brake, owner } = setup()
    expect(await brake.pause(CAMPAIGN, 'checking the list', NOW)).toBe(true)
    expect(await brake.check(CAMPAIGN, NOW)).toMatchObject({
      paused: true,
      reason: 'checking the list',
    })
    expect(await brake.isPaused(CAMPAIGN)).toBe(true)
    expect(owner.sent).toHaveLength(0)
  })

  it('says when there was nothing to resume', async () => {
    const { brake } = setup()
    expect(await brake.resume(CAMPAIGN, NOW)).toBe(false)
  })
})
