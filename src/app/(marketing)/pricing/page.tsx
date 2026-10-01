import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import {
  CONTACT_PATH,
  CallToAction,
  FEATURE_PATHS,
  FaqSection,
  HUB_PATH,
  LITE_MEMBER_LIMIT,
  MarketingHero,
  MarketingSection,
  PRICING_PATH,
  PRICING_TIERS,
  PricingPlans,
  Prose,
  StructuredData,
  TRIAL_DAYS,
  buildPageMetadata,
  softwareApplicationJsonLd,
  type FaqItem,
} from '@/features/marketing'
import {
  GRACE_PERIOD_DAYS,
  RENEWAL_RETRY_INTERVAL_DAYS,
  SaasTier,
} from '@/features/subscriptions/config/SubscriptionConfig'

const PATH = PRICING_PATH

export const metadata: Metadata = buildPageMetadata(PATH)

type Availability = Partial<Record<SaasTier, boolean | string>>

const COMPARISON: { feature: string; href?: string; tiers: Availability }[] = [
  {
    feature: 'Active members',
    href: FEATURE_PATHS.membership,
    tiers: {
      [SaasTier.Lite]: `Up to ${LITE_MEMBER_LIMIT}`,
      [SaasTier.Pro]: 'Unlimited',
      [SaasTier.Enterprise]: 'Unlimited',
    },
  },
  {
    feature: 'Member records, plans and QR self-registration',
    href: FEATURE_PATHS.membership,
    tiers: { lite: true, pro: true, enterprise: true },
  },
  {
    feature: 'Payment recording with SMS receipts',
    href: FEATURE_PATHS.payments,
    tiers: { lite: true, pro: true, enterprise: true },
  },
  {
    feature: 'Automated SMS renewal reminders',
    href: FEATURE_PATHS.sms,
    tiers: { lite: true, pro: true, enterprise: true },
  },
  {
    feature: 'Bulk SMS announcements',
    href: FEATURE_PATHS.sms,
    tiers: { lite: true, pro: true, enterprise: true },
  },
  {
    feature: 'Revenue and member analytics',
    href: FEATURE_PATHS.revenue,
    tiers: { lite: true, pro: true, enterprise: true },
  },
  {
    feature: 'Fingerprint door access and activity log',
    href: FEATURE_PATHS.access,
    tiers: { enterprise: true },
  },
  {
    feature: 'Priority support',
    tiers: { enterprise: true },
  },
]

const FAQ: FaqItem[] = [
  {
    question: 'Is there a sign-up or setup fee?',
    answer: (
      <p>
        Not for Lite or Pro — you sign up and set up yourself. On Enterprise,
        the fingerprint readers and their installation are supplied by our
        hardware partner and charged separately from the subscription.
      </p>
    ),
  },
  {
    question: 'Can I pay yearly?',
    answer: (
      <p>
        Plans are billed monthly. You can cancel or change plan at any time.
      </p>
    ),
  },
  {
    question: 'What happens if a monthly payment fails?',
    answer: (
      <p>
        Your account stays fully usable for {GRACE_PERIOD_DAYS} days while the
        charge is retried every {RENEWAL_RETRY_INTERVAL_DAYS} days. If it still
        has not gone through, the account is suspended until it is paid — your
        data is kept, and members on fingerprint readers keep the access they
        have already paid for.
      </p>
    ),
  },
  {
    question: 'Do I get a refund if I cancel?',
    answer: (
      <p>
        When you cancel, you keep access until the end of the month you have
        paid for. Refunds are covered in our{' '}
        <Link href="/refund-policy">refund and cancellation policy</Link>.
      </p>
    ),
  },
]

function Cell({ value }: { value: boolean | string | undefined }) {
  if (typeof value === 'string') return <span>{value}</span>
  return value ? (
    <>
      <Check aria-hidden="true" className="h-4 w-4 text-success" />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus aria-hidden="true" className="h-4 w-4 text-ink-placeholder" />
      <span className="sr-only">Not included</span>
    </>
  )
}

export default function PricingPage() {
  return (
    <>
      <StructuredData path={PATH} nodes={[softwareApplicationJsonLd()]} />

      <MarketingHero
        path={PATH}
        eyebrow="Pricing · Sri Lankan rupees"
        title="Gym management software pricing"
        lead={
          <p>
            Three monthly plans, priced in rupees and billed through PayHere.
            Every new account starts with a {TRIAL_DAYS}-day free trial, and no
            payment details are needed to begin.
          </p>
        }
      />

      <MarketingSection
        eyebrow="Plans"
        title="Choose by the size of your gym"
        width="wide"
      >
        <PricingPlans />
      </MarketingSection>

      <MarketingSection
        eyebrow="Compare"
        title="What each plan includes"
        width="wide"
      >
        <TableContainer className="relative bg-surface-panel">
          <Table>
            <caption className="sr-only">
              Features included in each plan
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                {PRICING_TIERS.map((t) => (
                  <TableHead key={t.tier}>{t.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium">
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.feature}
                      </Link>
                    ) : (
                      row.feature
                    )}
                  </TableCell>
                  {PRICING_TIERS.map((t) => (
                    <TableCell key={t.tier}>
                      <Cell value={row.tiers[t.tier]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </MarketingSection>

      <MarketingSection
        eyebrow="Member limit"
        title="Only active members count"
      >
        <Prose>
          <p>
            Lite covers up to {LITE_MEMBER_LIMIT} <strong>active</strong>{' '}
            members at a time. Expired, suspended and cancelled members never
            count, so your history of past members costs nothing to keep.
          </p>
          <p>
            When a Lite gym reaches {LITE_MEMBER_LIMIT} active members, Metric
            asks you to move to Pro before another member can be made active.
            Members who are already active are not affected.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Trial" title="The free trial">
        <Prose>
          <p>
            Your {TRIAL_DAYS}-day trial starts when you create your account and
            runs with the Lite member limit. There is no card to enter and no
            charge during it. Subscribe to Lite or Pro whenever you are ready;
            if you do not, the account simply pauses at the end of the trial.
          </p>
          <p>
            Enterprise is not part of the self-serve trial, because it involves
            reader hardware. <Link href={CONTACT_PATH}>Talk to us</Link> to plan
            it.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Billing" title="How billing works">
        <Prose>
          <ul>
            <li>
              Plans are billed monthly in advance, in rupees, through PayHere.
            </li>
            <li>
              Your card is saved with PayHere and charged at the start of each
              month. Metric never sees or stores your card number.
            </li>
            <li>
              You can switch plans at any time. Unused days from your current
              month are carried over, so you never pay twice for the same days.
            </li>
            <li>
              Current prices are always shown on this page and inside your
              account before any payment is taken.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <FaqSection title="Pricing questions" items={FAQ} />

      <MarketingSection title="Still deciding?">
        <Prose>
          <p>
            See{' '}
            <Link href={HUB_PATH}>how Metric works for Sri Lankan gyms</Link>{' '}
            from registration to the door, or read about{' '}
            <Link href={FEATURE_PATHS.sms}>the reminder schedule</Link> that
            does most of the renewal work.
          </p>
        </Prose>
      </MarketingSection>

      <CallToAction />
    </>
  )
}
