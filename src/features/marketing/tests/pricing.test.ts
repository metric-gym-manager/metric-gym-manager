/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  LITE_TIER_MEMBER_LIMIT,
  SaasTier,
  TIER_DISPLAY_NAME,
} from '@/features/subscriptions/config/SubscriptionConfig'
import {
  PRICING_TIERS,
  formatLkr,
  lowestMonthlyPriceLkr,
} from '../config/pricing'

/**
 * The published prices are a promise (the refund policy says current prices
 * are "always displayed on our pricing page"). The amounts actually charged
 * are PAYHERE_*_PRICE_LKR; .env.example documents them. This pins the two
 * together so a price change cannot land in one place only.
 */
function envExamplePrice(name: string): number {
  const text = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8')
  const match = text.match(new RegExp(`^${name}=(\\d+)`, 'm'))
  if (!match) throw new Error(`${name} missing from .env.example`)
  return Number(match[1])
}

describe('published pricing', () => {
  it('offers the three product tiers, in order, under their product names', () => {
    expect(PRICING_TIERS.map((t) => t.tier)).toEqual([
      SaasTier.Lite,
      SaasTier.Pro,
      SaasTier.Enterprise,
    ])
    for (const t of PRICING_TIERS)
      expect(t.name).toBe(TIER_DISPLAY_NAME[t.tier])
  })

  it.each([
    [SaasTier.Lite, 'PAYHERE_LITE_PRICE_LKR'],
    [SaasTier.Pro, 'PAYHERE_PRO_PRICE_LKR'],
    [SaasTier.Enterprise, 'PAYHERE_ENTERPRISE_PRICE_LKR'],
  ])('%s matches %s in .env.example', (tier, envName) => {
    const published = PRICING_TIERS.find(
      (t) => t.tier === tier
    )?.monthlyPriceLkr
    expect(published).toBe(envExamplePrice(envName))
  })

  it('states the Lite cap from SubscriptionConfig, not a copy', () => {
    const lite = PRICING_TIERS.find((t) => t.tier === SaasTier.Lite)
    expect(lite?.inclusions[0]).toBe(
      `Up to ${LITE_TIER_MEMBER_LIMIT} active members`
    )
  })

  it('offers the self-serve trial on Lite and Pro only — Enterprise never enters the trial flow', () => {
    const trial = PRICING_TIERS.filter((t) => t.selfServeTrial).map(
      (t) => t.tier
    )
    expect(trial).toEqual([SaasTier.Lite, SaasTier.Pro])
  })

  it('only Enterprise includes access control', () => {
    const withDoor = PRICING_TIERS.filter((t) =>
      t.inclusions.some((i) => /door access/i.test(i))
    ).map((t) => t.tier)
    expect(withDoor).toEqual([SaasTier.Enterprise])
  })

  it('formats rupees the way the price is written on the page', () => {
    expect(formatLkr(2990)).toBe('2,990')
    expect(lowestMonthlyPriceLkr()).toBe(2990)
  })
})
