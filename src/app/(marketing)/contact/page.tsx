import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ABOUT_PATH,
  CONTACT,
  CONTACT_PATH,
  LEGAL_NAME,
  MarketingHero,
  MarketingSection,
  POSTAL_ADDRESS,
  PRICING_PATH,
  Prose,
  SOCIAL_PROFILES,
  SUPPORT_HOURS,
  StructuredData,
  buildPageMetadata,
} from '@/features/marketing'
import { DemoModal } from '@/components/landing/DemoModal'

const PATH = CONTACT_PATH

export const metadata: Metadata = buildPageMetadata(PATH)

/**
 * /contact — public by necessity: payment providers and app stores require a
 * reachable contact page (see PUBLIC_ROUTES in src/lib/auth-config.ts). Every
 * detail is read from features/marketing/config/site.ts, the same source as
 * the footer and the Organization structured data.
 */
export default function ContactPage() {
  return (
    <>
      <StructuredData path={PATH} />

      <MarketingHero
        path={PATH}
        eyebrow="Contact"
        title="Contact sales and support"
        lead={
          <p>
            Call, WhatsApp or email us about Metric Gym OS — whether you are
            choosing gym software, setting up, or already running your gym on
            it. {SUPPORT_HOURS.display}. {SUPPORT_HOURS.responseNote}
          </p>
        }
      >
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <DemoModal />
        </div>
      </MarketingHero>

      <MarketingSection eyebrow="Phone & WhatsApp" title="Talk to us">
        <Prose>
          <ul>
            <li>
              <strong>Phone:</strong>{' '}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
            </li>
            <li>
              <strong>WhatsApp:</strong>{' '}
              <a
                href={CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {CONTACT.phoneDisplay}
              </a>
            </li>
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Email" title="Write to us">
        <Prose>
          <ul>
            <li>
              <strong>General enquiries and support:</strong>{' '}
              <a href={`mailto:${CONTACT.supportEmail}`}>
                {CONTACT.supportEmail}
              </a>
            </li>
            <li>
              <strong>Privacy and legal:</strong>{' '}
              <a href={`mailto:${CONTACT.privacyEmail}`}>
                {CONTACT.privacyEmail}
              </a>
            </li>
          </ul>
          <p>
            Already a customer? You can also raise a support ticket from inside
            Metric.
          </p>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Social" title="Follow us">
        <Prose>
          <ul>
            {SOCIAL_PROFILES.map((profile) => (
              <li key={profile.url}>
                <a href={profile.url} target="_blank" rel="noopener noreferrer">
                  {profile.name}
                </a>
              </li>
            ))}
          </ul>
        </Prose>
      </MarketingSection>

      <MarketingSection eyebrow="Postal address" title="Where we are">
        <Prose>
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
            Metric Gym OS is owned and operated by {LEGAL_NAME}, a company
            registered in Sri Lanka. Read more{' '}
            <Link href={ABOUT_PATH}>about us</Link>, see{' '}
            <Link href={PRICING_PATH}>pricing</Link>, or review our{' '}
            <Link href="/terms">terms of service</Link>,{' '}
            <Link href="/privacy">privacy policy</Link> and{' '}
            <Link href="/refund-policy">refund and cancellation policy</Link>.
          </p>
        </Prose>
      </MarketingSection>
    </>
  )
}
