import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ABOUT_PATH,
  CONTACT,
  CONTACT_PATH,
  CallToAction,
  FEATURE_PATHS,
  HUB_PATH,
  LEGAL_NAME,
  MarketingHero,
  MarketingSection,
  POSTAL_ADDRESS,
  PRICING_PATH,
  Prose,
  SUPPORT_HOURS,
  StructuredData,
  buildPageMetadata,
} from '@/features/marketing'

const PATH = ABOUT_PATH

export const metadata: Metadata = buildPageMetadata(PATH)

/**
 * Operating principles. Each one is a rule the product enforces in code —
 * see docs/architecture (access-control-master §2, sms-logging, rule 2.13)
 * — not a value statement written for this page.
 */
const PRINCIPLES = [
  {
    title: 'Your door never depends on our servers',
    body: (
      <>
        Membership dates live on the fingerprint reader, which enforces them
        from its own clock. An outage at our end — or a lapse in your
        subscription — cannot lock a paying member out of your gym.{' '}
        <Link href={FEATURE_PATHS.access}>How access control works</Link>.
      </>
    ),
  },
  {
    title: 'Every message is accounted for',
    body: (
      <>
        Every SMS Metric sends is logged against the member and updated with the
        carrier’s delivery report, so “sent” and “delivered” are never confused.{' '}
        <Link href={FEATURE_PATHS.sms}>About SMS reminders</Link>.
      </>
    ),
  },
  {
    title: 'Each gym’s data is walled off',
    body: (
      <>
        Isolation between gyms is enforced inside the database, on every table,
        not left to application code.
      </>
    ),
  },
  {
    title: 'Billing never deletes a member',
    body: (
      <>
        A lapsed subscription suspends an account; it never removes member
        records or payment history.
      </>
    ),
  },
  {
    title: 'Privacy is designed in',
    body: (
      <>
        Fingerprint templates never pass through Metric, consent is recorded
        before enrolment, and scan records expire on a published schedule. See
        our <Link href="/privacy">privacy policy</Link>.
      </>
    ),
  },
] as const

export default function AboutPage() {
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Company"
        title="About Metric Gym OS"
        lead={
          <p>
            Metric Gym OS is gym management software built in Sri Lanka by{' '}
            {LEGAL_NAME}, for gyms that sell memberships and want their records,
            reminders and door to take care of themselves.
          </p>
        }
      />

      <MarketingSection
        eyebrow="What we build"
        title="One system for running a gym"
      >
        <Prose>
          <p>
            Metric keeps one record for every member and builds everything else
            on it:{' '}
            <Link href={FEATURE_PATHS.membership}>membership management</Link>,{' '}
            <Link href={FEATURE_PATHS.payments}>
              payment collection and renewals
            </Link>
            , <Link href={FEATURE_PATHS.sms}>SMS reminders</Link>,{' '}
            <Link href={FEATURE_PATHS.revenue}>
              revenue and member analytics
            </Link>{' '}
            and{' '}
            <Link href={FEATURE_PATHS.access}>fingerprint access control</Link>.
            It is priced in rupees, supported locally and designed around how
            Sri Lankan gyms actually take payments: at the front desk.
          </p>
          <p>
            The full picture, with pricing and setup steps, is on our{' '}
            <Link href={HUB_PATH}>gym management software</Link> page.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="How we build it"
        title="Five rules the product keeps"
        intro={
          <p>
            These are not slogans. Each is enforced in the software, and each
            exists because getting it wrong costs a gym money or a member’s
            trust.
          </p>
        }
      >
        <ul className="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 py-6">
              <h3 className="text-h2 text-ink">{p.title}</h3>
              <p className="text-body-lg text-ink-secondary [&_a]:text-brand-link [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-brand-link-hover">
                {p.body}
              </p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection eyebrow="Support" title="Talk to a person">
        <Prose>
          <p>
            Support is by phone and WhatsApp on{' '}
            <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a> and
            by email at{' '}
            <a href={`mailto:${CONTACT.supportEmail}`}>
              {CONTACT.supportEmail}
            </a>
            , every day from {SUPPORT_HOURS.opens} to {SUPPORT_HOURS.closes} Sri
            Lanka time. {SUPPORT_HOURS.responseNote} Gyms can also raise a
            ticket from inside Metric.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Company details" title="Who we are">
        <Prose>
          <p>
            Metric Gym OS is owned and operated by <strong>{LEGAL_NAME}</strong>
            , a company registered in Sri Lanka.
          </p>
          <address className="not-italic">
            {LEGAL_NAME}
            <br />
            {POSTAL_ADDRESS.lines.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </address>
          <p>
            <Link href={CONTACT_PATH}>Contact us</Link> ·{' '}
            <Link href={PRICING_PATH}>See pricing</Link>
          </p>
        </Prose>
      </MarketingSection>

      <CallToAction />
    </>
  )
}
