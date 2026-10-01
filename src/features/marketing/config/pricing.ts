/**
 * Published pricing — Single Source of Truth for every public price.
 *
 * The homepage pricing section, /pricing, the commercial hub and the
 * SoftwareApplication offers all render from this list, so a price or an
 * inclusion cannot disagree between two pages of the site.
 *
 * Tier names, the Lite member cap and the trial length are imported from the
 * subscriptions feature, which owns them (R5) — the public site used to say
 * "Starter"/"Growth", tier names the product retired in July 2026 migration
 * 20260708000003, and "a free trial on every tier" although Enterprise never
 * enters the trial flow.
 *
 * The LKR amounts are the billing amounts configured as
 * PAYHERE_{LITE,PRO,ENTERPRISE}_PRICE_LKR (see .env.example). The refund
 * policy promises that "current plan prices are always displayed on our
 * pricing page", so a price change is a change here AND in those variables;
 * `pricing.test.ts` pins this file to .env.example so the two cannot drift
 * silently.
 */

import {
  LITE_TIER_MEMBER_LIMIT,
  SaasTier,
  TIER_DISPLAY_NAME,
  TRIAL_PERIOD_DAYS,
} from '@/features/subscriptions/config/SubscriptionConfig'

export interface PricingTier {
  tier: SaasTier
  name: string
  /** Monthly price in LKR, billed in advance. */
  monthlyPriceLkr: number
  summary: string
  /** Who the tier is for, in one sentence. */
  audience: string
  inclusions: readonly string[]
  /** Free trial available through self-serve sign-up. */
  selfServeTrial: boolean
  /** Shown beneath the inclusions, e.g. hardware fees. */
  note?: string
  highlighted?: boolean
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    tier: SaasTier.Lite,
    name: TIER_DISPLAY_NAME[SaasTier.Lite],
    monthlyPriceLkr: 2990,
    summary: 'Everything you need to run a gym',
    audience: `Gyms with up to ${LITE_TIER_MEMBER_LIMIT} active members.`,
    inclusions: [
      `Up to ${LITE_TIER_MEMBER_LIMIT} active members`,
      'Member records, plans and QR self-registration',
      'Payment recording with SMS receipts',
      'Automated SMS renewal reminders',
      'Bulk SMS announcements',
      'Revenue and member analytics',
    ],
    selfServeTrial: true,
  },
  {
    tier: SaasTier.Pro,
    name: TIER_DISPLAY_NAME[SaasTier.Pro],
    monthlyPriceLkr: 4990,
    summary: 'For gyms with larger member bases',
    audience: `Gyms with more than ${LITE_TIER_MEMBER_LIMIT} active members.`,
    inclusions: [
      `Everything in ${TIER_DISPLAY_NAME[SaasTier.Lite]}`,
      'Unlimited active members',
    ],
    selfServeTrial: true,
    highlighted: true,
  },
  {
    tier: SaasTier.Enterprise,
    name: TIER_DISPLAY_NAME[SaasTier.Enterprise],
    monthlyPriceLkr: 6990,
    summary: 'Membership-controlled fingerprint door access',
    audience: 'Gyms that want the door to enforce membership status.',
    inclusions: [
      `Everything in ${TIER_DISPLAY_NAME[SaasTier.Pro]}`,
      'Fingerprint door access tied to each member’s paid-through date',
      'Door activity log of every entry and refusal',
      'Priority support',
    ],
    selfServeTrial: false,
    note: 'Set up with our team. Reader hardware and installation are supplied and charged separately.',
  },
] as const

export const TRIAL_DAYS = TRIAL_PERIOD_DAYS
export const LITE_MEMBER_LIMIT = LITE_TIER_MEMBER_LIMIT
export const PRICE_CURRENCY = 'LKR'

/** "2,990" — grouped the way Sri Lankan prices are written. */
export function formatLkr(amount: number): string {
  return amount.toLocaleString('en-US')
}

/** The lowest published monthly price, for "plans from" copy. */
export function lowestMonthlyPriceLkr(): number {
  return Math.min(...PRICING_TIERS.map((t) => t.monthlyPriceLkr))
}
