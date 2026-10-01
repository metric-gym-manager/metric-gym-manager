import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CONTACT_PATH,
  CallToAction,
  FEATURE_PATHS,
  FaqSection,
  HUB_PATH,
  MarketingHero,
  MarketingSection,
  PRICING_PATH,
  PRICING_TIERS,
  Prose,
  RelatedPages,
  StructuredData,
  buildPageMetadata,
  formatLkr,
  type FaqItem,
} from '@/features/marketing'
import { ACCESS_EVENT_RETENTION_DAYS } from '@/features/access-control/config/AccessControlConfig'
import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig'

const PATH = FEATURE_PATHS.access

export const metadata: Metadata = buildPageMetadata(PATH)

const enterprise = PRICING_TIERS.find((t) => t.tier === SaasTier.Enterprise)

const FAQ: FaqItem[] = [
  {
    question: 'What happens if the internet goes down?',
    answer: (
      <p>
        Members keep getting in until the paid-through date already on the
        reader, and lapsed members stay out, because the reader checks dates
        against its own clock. Changes made while the connection is down — a new
        payment, a cancellation — are queued and reach the reader once it is
        back online.
      </p>
    ),
  },
  {
    question: 'How quickly does a payment open the door?',
    answer: (
      <p>
        Changes are sent to the readers every few minutes, so a member who pays
        at the desk is usually admitted within minutes, without anyone touching
        the reader.
      </p>
    ),
  },
  {
    question: 'Can members use a card or face recognition instead?',
    answer: (
      <p>
        Metric enrols fingerprints. Card and face enrolment are not part of the
        product today, and readers from other manufacturers are not supported.
      </p>
    ),
  },
  {
    question: 'Which plan includes access control?',
    answer: (
      <p>
        Enterprise
        {enterprise
          ? ` (LKR ${formatLkr(enterprise.monthlyPriceLkr)} a month)`
          : ''}
        , set up with our team. The readers and their installation are supplied
        by our hardware partner and charged separately. See{' '}
        <Link href={PRICING_PATH}>pricing</Link> or{' '}
        <Link href={CONTACT_PATH}>contact us</Link>.
      </p>
    ),
  },
]

export default function AccessControlPage() {
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Feature · Access control · Enterprise"
        title="Gym access control with fingerprint readers"
        lead={
          <p>
            On the Enterprise plan, Metric connects to ZKTeco fingerprint
            readers supplied and supported by VFT. Each member’s paid-through
            date is sent to the reader, and the reader itself refuses entry once
            it passes — so the door follows payments without anyone checking at
            the desk.
          </p>
        }
      />

      <MarketingSection
        eyebrow="How it works"
        title="From payment to door, step by step"
      >
        <Prose>
          <ol>
            <li>
              <strong>Readers are installed and linked.</strong> VFT installs
              the readers; you connect each one to your gym in Metric by its
              serial number.
            </li>
            <li>
              <strong>Members are enrolled at the reader.</strong> Their consent
              is recorded in Metric first, then they place their finger on the
              reader. The member’s first scan confirms the enrolment.
            </li>
            <li>
              <strong>Paying sets the door.</strong> Every recorded payment
              sends the member’s new paid-through date to the reader as a
              validity period.
            </li>
            <li>
              <strong>The reader decides.</strong> It admits the member until
              that date, using its own clock, and refuses them after it.
            </li>
            <li>
              <strong>Cancelling blocks, returning restores.</strong> A
              cancelled member is blocked and their fingerprint is removed from
              the reader, while the supplier keeps a central copy — so if they
              come back and pay, they walk in without enrolling again.
            </li>
            <li>
              <strong>Every scan is reported.</strong> Entries and refusals come
              back to Metric and appear in your door activity log.
            </li>
          </ol>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Design principle"
        title="The reader is the authority, not our servers"
      >
        <Prose>
          <p>
            Metric is never in the path of someone opening the door. Because
            each member’s dates live on the reader, expiry keeps working through
            an internet outage at your gym or any problem with Metric itself —
            and neither can lock a paying member out of your gym.
          </p>
          <p>
            The same rule covers billing: if your own Metric subscription
            lapses, your readers keep honouring the dates members have already
            paid for. Your members are never locked out over a bill between you
            and us.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Operations"
        title="Attendance and door control from the dashboard"
      >
        <Prose>
          <ul>
            <li>
              <strong>Door activity log.</strong> Every entry and every refusal,
              with the reason — for example, a membership that has expired or a
              fingerprint the reader did not recognise. It doubles as your
              attendance record.
            </li>
            <li>
              <strong>Reader status.</strong> Each reader’s connection and
              health at a glance.
            </li>
            <li>
              <strong>Remote actions.</strong> Open a door, restart a reader or
              temporarily disable one from Metric. Remote openings are logged by
              Metric and by the reader itself.
            </li>
            <li>
              <strong>Per-member view.</strong> On each member’s record: the
              date the readers will admit them until, their consent status, and
              a warning if a change has not reached the readers yet.
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection
        eyebrow="Privacy"
        title="Fingerprints, consent and retention"
      >
        <Prose>
          <p>
            The fingerprint template is created on the reader and held by the
            hardware supplier — it never passes through Metric. What Metric
            sends the reader is limited to the member’s name, a numeric
            reference and the dates their membership allows entry.
          </p>
          <p>
            A member’s consent is recorded at the moment their fingerprint is
            collected, and removing the fingerprint clears that consent record.
            Scan records are deleted automatically after{' '}
            {ACCESS_EVENT_RETENTION_DAYS} days, the period published in our{' '}
            <Link href="/privacy">privacy policy</Link> under Sri Lanka’s
            Personal Data Protection Act, No. 9 of 2022.
          </p>
        </Prose>
      </MarketingSection>

      <FaqSection items={FAQ} />

      <RelatedPages
        items={[
          {
            href: FEATURE_PATHS.payments,
            title: 'Payment collection and renewals',
            summary: 'Recording the payment that moves a member’s door date.',
          },
          {
            href: FEATURE_PATHS.membership,
            title: 'Membership management',
            summary:
              'The statuses the door follows: active, expired, cancelled.',
          },
          {
            href: PRICING_PATH,
            title: 'Pricing',
            summary: 'What Enterprise includes and how hardware is charged.',
          },
          {
            href: HUB_PATH,
            title: 'From registration to the door: the full system',
            summary:
              'How a member gets from sign-up to the reader, with setup steps.',
          },
        ]}
      />

      <CallToAction
        title="Let the door enforce the membership."
        text="Access control is set up with our team on the Enterprise plan. Tell us about your entrances and we will plan the readers with you."
      />
    </>
  )
}
