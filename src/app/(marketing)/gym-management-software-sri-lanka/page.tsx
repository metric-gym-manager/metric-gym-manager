import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui'
import {
  ABOUT_PATH,
  ARTICLE_PATHS,
  CONTACT,
  CONTACT_PATH,
  CallToAction,
  FEATURE_PATHS,
  FaqSection,
  FeatureLinkGrid,
  HUB_PATH,
  LEGAL_NAME,
  LITE_MEMBER_LIMIT,
  MarketingHero,
  MarketingSection,
  PRICING_PATH,
  PricingPlans,
  Prose,
  SIGN_UP_PATH,
  SUPPORT_HOURS,
  StructuredData,
  TRIAL_DAYS,
  buildPageMetadata,
  formatLkr,
  lowestMonthlyPriceLkr,
  softwareApplicationJsonLd,
  type FaqItem,
  type FeatureLink,
} from '@/features/marketing'
import { MEMBER_CANCELLATION_OVERDUE_DAYS } from '@/features/members/config/StatusConfig'

const PATH = HUB_PATH

export const metadata: Metadata = buildPageMetadata(PATH)

const FEATURES: FeatureLink[] = [
  {
    href: FEATURE_PATHS.membership,
    title: 'Membership management',
    summary:
      'One record per member: plan, amount, start date, next due date and status — plus QR self-registration from the member’s own phone.',
  },
  {
    href: FEATURE_PATHS.payments,
    title: 'Payment collection and renewals',
    summary:
      'See who is expired and who expires this week, record a desk payment in a few taps and renew the membership from the right date.',
  },
  {
    href: FEATURE_PATHS.sms,
    title: 'SMS reminders',
    summary:
      'Reminders timed to each plan length, a receipt for every payment and bulk announcements — each message logged as sent, delivered or failed.',
  },
  {
    href: FEATURE_PATHS.revenue,
    title: 'Revenue and member analytics',
    summary:
      'What members owe this month against what you collected, revenue by plan, renewal and churn rates, and retention by sign-up month.',
  },
  {
    href: FEATURE_PATHS.access,
    title: 'Fingerprint access control',
    summary:
      'ZKTeco fingerprint readers that admit each member until their paid-through date — enforced by the reader itself, even offline.',
    tag: 'Enterprise',
  },
]

const FAQ: FaqItem[] = [
  {
    question: 'How much does gym management software cost in Sri Lanka?',
    answer: (
      <p>
        Metric costs LKR 2,990 a month on Lite (up to {LITE_MEMBER_LIMIT} active
        members), LKR 4,990 on Pro (unlimited active members) and LKR 6,990 on
        Enterprise, which adds fingerprint door access. Plans are billed monthly
        in rupees through PayHere. See <Link href={PRICING_PATH}>pricing</Link>{' '}
        for what each plan includes.
      </p>
    ),
  },
  {
    question: 'Do I need to install anything?',
    answer: (
      <p>
        No. Metric runs in a web browser on a computer, tablet or phone, and it
        can be added to a phone’s home screen like an app. The only hardware
        Metric ever involves is the optional fingerprint reader on the
        Enterprise plan.
      </p>
    ),
  },
  {
    question: 'Can members pay online through Metric?',
    answer: (
      <p>
        Not today. Members pay you the way they already do, and you record the
        payment in Metric, which renews the membership and texts the member a
        receipt. PayHere is used only for your own Metric subscription.
      </p>
    ),
  },
  {
    question: 'We have more than 100 members. Which plan do we need?',
    answer: (
      <p>
        Only <strong>active</strong> members count toward a limit — expired,
        suspended and cancelled members never do. If you have more than{' '}
        {LITE_MEMBER_LIMIT} active members, Pro or Enterprise has no limit at
        all.
      </p>
    ),
  },
  {
    question: 'Can we move our members over from a book or a spreadsheet?',
    answer: (
      <p>
        Yes. Members can be added one at a time or many at once in a bulk-entry
        grid, where you set the plan, start date and discount for every row in
        one step and adjust individual rows after. Members who join later can
        register themselves by scanning your gym’s QR poster.
      </p>
    ),
  },
  {
    question: 'What happens to our data if we stop paying for Metric?',
    answer: (
      <p>
        Your account is suspended, not erased: billing never deletes member
        records. If you run fingerprint readers, they keep admitting members
        until the paid-through dates already on the reader, because a lapse in
        your Metric subscription must never lock your members out of the gym.
      </p>
    ),
  },
]

export default function GymManagementSoftwarePage() {
  return (
    <>
      <StructuredData path={PATH} nodes={[softwareApplicationJsonLd()]} />

      <MarketingHero
        path={PATH}
        eyebrow="Gym management software · Sri Lanka"
        title="Gym management software built for Sri Lankan gyms"
        lead={
          <p>
            Metric Gym OS keeps your member records, renewals, payments, SMS
            reminders and revenue in one place. On the Enterprise plan it also
            runs your fingerprint door readers, so only members who have paid
            get in. It is built and supported in Sri Lanka, priced in rupees,
            and runs in any web browser.
          </p>
        }
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild variant="primary" size="lg">
            <Link href={SIGN_UP_PATH}>Start {TRIAL_DAYS}-day free trial</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={PRICING_PATH}>See pricing</Link>
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle tablet:grid-cols-4">
          {[
            ['Plans from', `LKR ${formatLkr(lowestMonthlyPriceLkr())} / month`],
            ['Free trial', `${TRIAL_DAYS} days`],
            ['To start', 'No payment details'],
            ['Support', 'Every day, 08:00–22:00'],
          ].map(([term, value]) => (
            <div key={term} className="flex flex-col gap-1 bg-surface-base p-4">
              <dt className="font-mono text-metadata uppercase text-ink-muted">
                {term}
              </dt>
              <dd className="text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </MarketingHero>

      <MarketingSection
        eyebrow="Definition"
        title="What a gym management system does"
        intro={
          <p>
            A gym management system replaces the register book, the spreadsheet
            and the reminder phone calls with one shared record of every member:
            what plan they are on, what they pay, when they are next due, and
            whether they have paid.
          </p>
        }
      >
        <Prose>
          <p>
            Everything else follows from that record. Because Metric knows each
            member’s next due date, it can remind them before it arrives, list
            who has lapsed this morning, renew the membership correctly when
            they pay, tell you what the month should bring in — and, if you
            connect a fingerprint reader, keep the door closed to anyone whose
            membership has run out.
          </p>
          <p>
            Metric is built for gyms and fitness centres that sell time-based
            memberships — daily, weekly, monthly, three-month, six-month, annual
            or custom — and take payment at the front desk. It does not run
            class timetables, personal-training bookings, a shop till or a
            member app, so you are not paying for screens you will not use.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="How it works"
        title="A member’s journey through Metric"
        intro={
          <p>
            The same seven steps happen for every member, whether you have forty
            or four hundred.
          </p>
        }
      >
        <ol className="flex flex-col gap-0 border-l border-line-2">
          {[
            [
              'They register',
              'At the desk, or by scanning your gym’s QR poster and filling in their name, phone number, plan and an optional selfie on their own phone. Self-registrations wait with a NEW badge until your staff confirm them.',
            ],
            [
              'Their membership starts',
              'The plan and amount set the next due date — calendar-correct, so a monthly member who joins on the 15th is due on the 15th.',
            ],
            [
              'Reminders go out on time',
              'Members on plans of a week or longer get an SMS seven and three days before they are due (monthly members: three days), and a final one on the due date. Daily members get no reminders.',
            ],
            [
              'They pay, you record it',
              'Recording the payment renews the membership from the right date, resets the reminders for the next period and texts the member a receipt.',
            ],
            [
              'If they do not pay',
              'The membership expires the day after the due date and the member appears on your Expired list. Late payers start their new period on the day they pay.',
            ],
            [
              'Long-unpaid members are tidied away',
              `After ${MEMBER_CANCELLATION_OVERDUE_DAYS} days unpaid the membership is cancelled automatically. The record stays; paying again reactivates it with a welcome-back SMS.`,
            ],
            [
              'The door follows the record',
              'On Enterprise, every payment moves the member’s paid-through date on your fingerprint reader, and the reader refuses entry once it passes.',
            ],
          ].map(([step, detail], i) => (
            <li
              key={step}
              className="relative flex flex-col gap-1 pb-8 pl-8 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-line-2 bg-surface-base font-mono text-mono-sm text-ink-muted"
              >
                {i + 1}
              </span>
              <h3 className="text-h2 text-ink">{step}</h3>
              <p className="text-body-lg text-ink-secondary">{detail}</p>
            </li>
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection
        id="features"
        eyebrow="Features"
        title="What Metric does, page by page"
        intro={
          <p>
            Each area has its own page with the details: the exact reminder
            schedule, how renewals are dated, what the revenue figures mean and
            how the door readers work.
          </p>
        }
        width="wide"
      >
        <FeatureLinkGrid items={FEATURES} />
      </MarketingSection>

      <MarketingSection
        eyebrow="Pricing"
        title="Priced in rupees, billed monthly"
        intro={
          <p>
            Three plans, no sign-up fee for Lite or Pro, and a {TRIAL_DAYS}-day
            free trial to start. Full details, including how billing and the
            member limit work, are on the{' '}
            <Link
              href={PRICING_PATH}
              className="text-brand-link underline underline-offset-4 hover:text-brand-link-hover"
            >
              pricing page
            </Link>
            .
          </p>
        }
        width="wide"
      >
        <PricingPlans />
      </MarketingSection>

      <MarketingSection
        eyebrow="Getting started"
        title="From sign-up to your first reminder"
      >
        <Prose>
          <ol>
            <li>
              <strong>Create your account.</strong> Your {TRIAL_DAYS}-day trial
              starts immediately, with no payment details.
            </li>
            <li>
              <strong>Set up your memberships.</strong> Add your plans and
              prices, any recurring discounts and, if you charge one, an
              admission fee.
            </li>
            <li>
              <strong>Add your members.</strong> One at a time, or many at once
              in the bulk-entry grid, with each member’s current due date.
            </li>
            <li>
              <strong>Put up your QR poster.</strong> Print the branded poster
              Metric generates for your gym so new members can register
              themselves.
            </li>
            <li>
              <strong>Let it run.</strong> Reminders start with the next due
              dates; your dashboard shows who is expired and who expires this
              week every morning.
            </li>
          </ol>
          <p>
            Fingerprint door access is set up with our team on the Enterprise
            plan, because the readers are supplied and installed by our hardware
            partner. <Link href={CONTACT_PATH}>Talk to us</Link> to arrange it.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Data protection"
        title="Your members’ data, kept to its purpose"
      >
        <Prose>
          <ul>
            <li>
              <strong>Each gym’s data is walled off in the database.</strong>{' '}
              Every table enforces row-level security, so one gym can never read
              another’s members.
            </li>
            <li>
              <strong>Fingerprints never pass through Metric.</strong> The
              fingerprint template is created on the reader and held by the
              hardware provider. Metric sends the reader only a member’s name, a
              numeric reference and the dates their membership allows entry.
            </li>
            <li>
              <strong>Consent comes first.</strong> A member’s consent is
              recorded before a fingerprint is enrolled, and removing the
              fingerprint removes that record too.
            </li>
            <li>
              <strong>Card details stay with PayHere.</strong> Metric never sees
              or stores your card number.
            </li>
          </ul>
          <p>
            Our <Link href="/privacy">privacy policy</Link> explains how data is
            handled under Sri Lanka’s Personal Data Protection Act, No. 9 of
            2022.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Company" title="Who builds Metric">
        <Prose>
          <p>
            Metric Gym OS is built and run by {LEGAL_NAME}, a company registered
            in Sri Lanka, from Kotte in the Colombo District. Support is by
            phone, WhatsApp and email, every day from {SUPPORT_HOURS.opens} to{' '}
            {SUPPORT_HOURS.closes} Sri Lanka time. {SUPPORT_HOURS.responseNote}
          </p>
          <p>
            Read more <Link href={ABOUT_PATH}>about Metric</Link>, call{' '}
            <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>, or
            see our guide to{' '}
            <Link href={ARTICLE_PATHS.reminders}>
              timing renewal reminders by plan length
            </Link>
            .
          </p>
        </Prose>
      </MarketingSection>

      <FaqSection items={FAQ} />

      <CallToAction />
    </>
  )
}
