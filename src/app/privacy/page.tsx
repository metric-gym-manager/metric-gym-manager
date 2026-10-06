import type { Metadata } from 'next'
import { buildPageMetadata } from '@/features/marketing'
import { ALWAYS_SENT_EMAILS } from '@/features/mailing/config/MailingConfig'
import {
  LegalLayout,
  LegalP,
  LegalList,
  LegalLI,
  LegalSubHead,
  LegalCallout,
  LegalContactList,
  LegalContactItem,
  type LegalSection,
} from '@/components/legal'

/** Title, description and canonical come from the public page registry. */
export const metadata: Metadata = buildPageMetadata('/privacy')

const LAST_UPDATED = 'October 2026'

const sections: LegalSection[] = [
  {
    id: 'p1',
    title: 'Introduction',
    body: (
      <>
        <LegalP>
          Welcome to Metric Gym OS - a gym management platform built for fitness
          businesses in Sri Lanka and beyond. We are committed to protecting
          your personal data and handling it responsibly. This Privacy Policy
          explains what information we collect, how we use it, and the rights
          you have over your data when you use our platform, including our web
          dashboard, mobile applications, and any related integrations.
        </LegalP>
        <LegalP>This policy applies to:</LegalP>
        <LegalList>
          <LegalLI>
            Gym owners, administrators, and staff who use the platform to manage
            their fitness business
          </LegalLI>
          <LegalLI>
            Gym members whose personal information is processed through the
            platform by gym operators
          </LegalLI>
        </LegalList>
      </>
    ),
  },
  {
    id: 'p2',
    title: 'Information We Collect',
    body: (
      <>
        <LegalP>
          We collect and process the following categories of personal data in
          accordance with the Personal Data Protection Act, No. 9 of 2022:
        </LegalP>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <LegalSubHead>Information We Collect from Gym Members</LegalSubHead>
            <LegalList>
              <LegalLI>
                Identity Data: full name, gender, date of birth (age calculated
                automatically), selfie
              </LegalLI>
              <LegalLI>
                Contact Data: phone number, emergency contact details
              </LegalLI>
              <LegalLI>
                Biometric Data: fingerprint or face scan (where applicable),
                used to enable secure check-in/check-out and to open the
                gym&apos;s doors
              </LegalLI>
              <LegalLI>
                Membership Data: membership plan details, start and expiry
                dates, membership status
              </LegalLI>
              <LegalLI>
                Attendance Data: check-in/check-out logs, attendance history
              </LegalLI>
            </LegalList>
          </div>

          <div>
            <LegalSubHead>How Biometric Data Is Handled</LegalSubHead>
            <LegalP>
              Biometric data is special category personal data under the
              Personal Data Protection Act, No. 9 of 2022, and we treat it
              accordingly.
            </LegalP>
            <LegalList>
              <LegalLI>
                A fingerprint is only ever recorded with the member&apos;s
                explicit consent, given at the moment it is recorded rather than
                buried in a registration form, and we keep a record of when that
                consent was given
              </LegalLI>
              <LegalLI>
                The fingerprint template is created on the reader itself and is
                held by the gym&apos;s access-control hardware provider.{' '}
                <strong>
                  We never receive, process or store a fingerprint image or
                  template
                </strong>{' '}
                — what we hold is a numeric reference to the member&apos;s
                record on that hardware and a note of whether a fingerprint has
                been registered
              </LegalLI>
              <LegalLI>
                Members may withdraw consent at any time by asking their gym to
                remove their fingerprint. Doing so deletes the template from the
                reader and clears the consent record, and the member will be
                asked again before any new fingerprint is recorded
              </LegalLI>
              <LegalLI>
                Providing a fingerprint is never a condition of membership.
                Members who decline continue to use the gym by whatever other
                means it offers
              </LegalLI>
            </LegalList>
          </div>

          <LegalCallout>
            We do not require or recommend the collection of National Identity
            Card (NIC) numbers or home addresses for gym members. This data has
            no operational requirement on our platform, and collecting it may
            violate the data-minimization requirements of the Sri Lanka Personal
            Data Protection Act, No. 9 of 2022 — we discourage gym operators
            from collecting it and gym members from providing it.
          </LegalCallout>

          <div>
            <LegalSubHead>
              Information We Collect from Gym Operators
            </LegalSubHead>
            <LegalList>
              <LegalLI>
                Identity Data: full name of the account creator (admin),
                gym/business name
              </LegalLI>
              <LegalLI>
                Contact Data: email address, phone number, gym address, gym
                website (optional)
              </LegalLI>
              <LegalLI>
                Staff Data: staff names and roles (where assigned)
              </LegalLI>
            </LegalList>
          </div>

          <div>
            <LegalSubHead>Financial Data</LegalSubHead>
            <LegalList>
              <LegalLI>
                Membership fee amount, payment status, payment dates, renewal
                dates
              </LegalLI>
              <LegalLI>
                Platform subscription status, renewal dates, billing history,
                transaction records
              </LegalLI>
            </LegalList>
            <LegalP>
              Payment card details are handled exclusively by our payment
              gateway partners and are never stored on our servers.
            </LegalP>
          </div>

          <div>
            <LegalSubHead>Operational Data</LegalSubHead>
            <LegalList>
              <LegalLI>
                Member attendance records and check-in/check-out logs
              </LegalLI>
              <LegalLI>Membership plan details and expiry information</LegalLI>
              <LegalLI>SMS reminder logs and communication history</LegalLI>
            </LegalList>
          </div>

          <div>
            <LegalSubHead>Technical and Usage Data</LegalSubHead>
            <LegalList>
              <LegalLI>
                IP address, browser type and version, operating system, device
                type
              </LegalLI>
              <LegalLI>Login timestamps, session data, access logs</LegalLI>
              <LegalLI>
                Dashboard interactions, feature usage patterns, revenue and
                retention analytics
              </LegalLI>
            </LegalList>
          </div>

          <div>
            <LegalSubHead>Cookies and Website Analytics</LegalSubHead>
            <LegalP>
              We use Google Analytics (provided by Google LLC) on our website
              and web application to understand how visitors and operators use
              Metric Gym OS. Google Analytics sets first-party cookies on your
              device and may collect:
            </LegalP>
            <LegalList>
              <LegalLI>
                Pages and screens viewed, referring sites, and approximate
                location derived from IP address
              </LegalLI>
              <LegalLI>
                Browser, device, and operating-system information
              </LegalLI>
              <LegalLI>
                A client identifier stored in cookies so repeat visits can be
                distinguished from new ones
              </LegalLI>
            </LegalList>
            <LegalP>
              This processing is based on our legitimate interest in measuring
              and improving the service. We do not use Google Analytics to
              identify gym members or to sell advertising against your data.
              Google may process this information on servers outside Sri Lanka,
              including in the United States. Google&apos;s own privacy policy
              is at policies.google.com/privacy.
            </LegalP>
            <LegalP>
              You can refuse or delete these cookies in your browser settings,
              or use Google&apos;s opt-out add-on at
              tools.google.com/dlpage/gaoptout. Blocking analytics cookies does
              not affect your ability to use the platform.
            </LegalP>
          </div>

          <div>
            <LegalSubHead>
              Information We Collect from People Who Request a Demo
            </LegalSubHead>
            <LegalP>
              When you request a demo on our website, we collect your name,
              email address and phone number, the plan you are interested in,
              and, if you give them, your gym&apos;s name and a message. We use
              them to contact you about your request. If you tick the box asking
              for marketing emails, we also record when you ticked it, as the
              record of your consent.
            </LegalP>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'p3',
    title: 'How We Use Your Information',
    body: (
      <>
        <LegalP>
          We use your personal data only when the law allows us to, in
          compliance with the Personal Data Protection Act, No. 9 of 2022. The
          purposes of processing, and their legal basis, are:
        </LegalP>
        <LegalList>
          <LegalLI>
            Provide and operate the platform and its features, authenticate
            users, and manage role-based access for gym staff — necessary for
            the performance of our contract with you
          </LegalLI>
          <LegalLI>
            Manage member registrations, memberships, and renewals — necessary
            for the performance of our contract with the gym operator
          </LegalLI>
          <LegalLI>
            Tell a gym&apos;s door readers how long each member&apos;s
            membership entitles them to enter, and record the entries and
            refused attempts those readers report back — based on the
            member&apos;s explicit consent to biometric processing, which they
            may withdraw at any time
          </LegalLI>
          <LegalLI>
            Send automated payment reminders and renewal notifications via SMS —
            based on the consent obtained from the member at registration
          </LegalLI>
          <LegalLI>
            Generate attendance reports, revenue dashboards, and retention
            analytics for gym owners, and conduct demographic analysis using age
            and gender data where provided — our legitimate interest in helping
            gym operators run their business
          </LegalLI>
          <LegalLI>
            Provide customer support and respond to inquiries — necessary for
            the performance of our contract with you
          </LegalLI>
          <LegalLI>
            Send gym owners marketing emails about our products, and product and
            security updates — our legitimate interest in telling our customers
            about the service they use and how it is changing. You can stop
            either kind at any time (Section 5)
          </LegalLI>
          <LegalLI>
            Send marketing emails to people who asked us for a demo — based on
            the consent they gave on the demo request form, which they may
            withdraw at any time
          </LegalLI>
          <LegalLI>
            Measure visits to our website and how the platform is used, using
            Google Analytics — our legitimate interest in understanding and
            improving the service
          </LegalLI>
          <LegalLI>
            Monitor platform performance, detect errors, and ensure system
            reliability — our legitimate interest in keeping the platform secure
            and available
          </LegalLI>
          <LegalLI>
            Detect, prevent, and address fraudulent or unauthorized activity —
            our legitimate interest in preventing fraud
          </LegalLI>
          <LegalLI>
            Comply with legal obligations applicable to our operations —
            necessary for compliance with a legal obligation
          </LegalLI>
        </LegalList>
      </>
    ),
  },
  {
    id: 'p4',
    title: 'SMS Communications',
    body: (
      <>
        <LegalP>
          Metric Gym OS sends SMS notifications to gym members on behalf of gym
          operators. These messages are limited to:
        </LegalP>
        <LegalList>
          <LegalLI>
            A welcome message when a member is registered, or returns after a
            cancellation or suspension
          </LegalLI>
          <LegalLI>Payment receipts, with the next due date</LegalLI>
          <LegalLI>
            Payment due reminders and membership renewal notifications
          </LegalLI>
          <LegalLI>Expiry alerts</LegalLI>
          <LegalLI>Announcements the gym sends to its own members</LegalLI>
        </LegalList>
        <LegalP>
          By registering with a gym that uses Metric Gym OS, members consent to
          receive these essential SMS notifications as part of the
          platform&apos;s core functionality. A member may withdraw consent at
          any time by contacting their gym directly, which will action the
          request at no cost.
        </LegalP>
      </>
    ),
  },
  {
    id: 'p4-email',
    title: 'Email Communications',
    body: (
      <>
        <LegalP>
          Besides the emails your account needs, we send two kinds of email,
          from hello@updates.metricgymos.com:
        </LegalP>
        <LegalList>
          <LegalLI>
            Marketing emails — product news, offers and tips. Gym owners receive
            them, including after cancelling or being suspended, and so do
            people who requested a demo, but only if you ticked the box asking
            for them on the demo request form
          </LegalLI>
          <LegalLI>
            Product and security updates — new versions, changes to how Metric
            Gym OS works, and security notices. Gym owners with a current
            subscription (on a trial, active, or with a payment overdue) receive
            them. A cancelled or suspended gym receives marketing emails only
          </LegalLI>
        </LegalList>
        <LegalP>
          You can stop either kind, or both, at any time: follow the unsubscribe
          link at the foot of any of these emails and choose which to stop, or
          write to hello@metricgymos.com. Stopping one kind through that link
          does not stop the other. The unsubscribe button your email app shows
          next to our address works differently: it stops both kinds. To start
          receiving them again, write to the same address.
        </LegalP>
        <LegalP>
          When we make a material change to our Terms of Service, Privacy Policy
          or Refund Policy, we email a short notice of it to every gym owner
          with a current subscription, whatever email choices you have made,
          because it concerns your rights. The unsubscribe button your email app
          shows stops these notices too.
        </LegalP>
        <LegalP>
          If you change your account&apos;s email address, we move these choices
          to the new address and delete the old one from our email delivery
          provider, within a day.
        </LegalP>
        <LegalP>
          Whatever you choose, we still send the emails needed to run your
          account:
        </LegalP>
        <LegalList>
          {ALWAYS_SENT_EMAILS.map((line) => (
            <LegalLI key={line}>{line}</LegalLI>
          ))}
        </LegalList>
        <LegalP>
          The email address, name and gym name we hold for these emails are kept
          with our email delivery provider until you ask us to delete them.
        </LegalP>
      </>
    ),
  },
  {
    id: 'p5',
    title: 'Data Security',
    body: (
      <>
        <LegalP>
          We take the security of your data seriously and implement appropriate
          technical and organizational measures, including:
        </LegalP>
        <LegalList>
          <LegalLI>SSL/TLS encryption for all data in transit</LegalLI>
          <LegalLI>Encrypted storage for sensitive data at rest</LegalLI>
          <LegalLI>
            Role-based access control (RBAC) to restrict data access to
            authorized personnel only
          </LegalLI>
          <LegalLI>Secure cloud infrastructure with high availability</LegalLI>
          <LegalLI>Regular security reviews and access audits</LegalLI>
        </LegalList>
        <LegalP>
          While we take all reasonable steps to protect your data, no method of
          electronic transmission or storage is 100% secure. We cannot guarantee
          absolute security but are committed to promptly addressing any
          incidents that may occur.
        </LegalP>
      </>
    ),
  },
  {
    id: 'p6',
    title: 'Data Retention',
    body: (
      <>
        <LegalP>
          We retain your personal data only for as long as necessary to fulfil
          the purposes for which it was collected, including to satisfy any
          legal, accounting, or reporting obligations.
        </LegalP>
        <div>
          <LegalSubHead>Retention Periods</LegalSubHead>
          <LegalList>
            <LegalLI>
              Member data: retained for the duration of the membership and for a
              reasonable period afterward to maintain business records
            </LegalLI>
            <LegalLI>
              Payment records: retained for a minimum of 7 years for accounting
              and tax purposes
            </LegalLI>
            <LegalLI>
              Statistical data (payment patterns, attendance trends, demographic
              information, revenue data, member-count trends, and feature
              usage): retained indefinitely in aggregated, anonymized form that
              does not identify any individual data subject
            </LegalLI>
            <LegalLI>
              Google Analytics records: retained by Google for the period
              configured in our Google Analytics property, after which
              event-level data is deleted or aggregated
            </LegalLI>
            <LegalLI>
              Door access records: entries and refused attempts recorded by a
              gym&apos;s biometric readers are deleted automatically 12 months
              after they occur
            </LegalLI>
            <LegalLI>
              Fingerprint templates: held on the gym&apos;s reader and by its
              access-control hardware provider for as long as the member is
              enrolled, and deleted from the reader when the member withdraws
              consent, is removed by the gym, or their membership ends
            </LegalLI>
          </LegalList>
        </div>
        <div>
          <LegalSubHead>Data Deletion</LegalSubHead>
          <LegalList>
            <LegalLI>
              Member photos, fingerprints, and face scans are permanently
              removed upon account deletion or member removal
            </LegalLI>
            <LegalLI>
              Member names and contact information are securely deleted when no
              longer required for business purposes
            </LegalLI>
          </LegalList>
        </div>
        <LegalP>
          Gym operators may request deletion of their account and associated
          member data at any time by contacting us using the details in Section
          10; we will securely delete or anonymize the data in accordance with
          applicable law.
        </LegalP>
      </>
    ),
  },
  {
    id: 'p7',
    title: 'Data Sharing and Third Parties',
    body: (
      <>
        <LegalP>
          We do not sell your personal data to any third party. We may share
          data with the following categories of service providers, each
          contractually required to protect your data and to use it only for the
          purposes we direct:
        </LegalP>
        <LegalList>
          <LegalLI>
            SMS gateway providers, to deliver notifications on behalf of gym
            operators
          </LegalLI>
          <LegalLI>
            Cloud infrastructure and hosting providers, to host and process data
            on our behalf
          </LegalLI>
          <LegalLI>
            Access-control hardware providers, where a gym operates biometric
            door readers — limited to the member&apos;s name, a numeric
            reference and the dates their membership permits entry. The
            fingerprint template itself is created on the reader and held by
            that provider; it does not pass through us
          </LegalLI>
          <LegalLI>
            Payment processors, to process subscription and membership payments
            securely
          </LegalLI>
          <LegalLI>
            Email delivery providers, to send our marketing emails and product
            and security updates — limited to the email address, name and gym
            name we hold for them
          </LegalLI>
          <LegalLI>
            Google LLC (Google Analytics), to measure website and application
            usage as described in Section 2. This may include IP address, device
            and browser data, and pages viewed
          </LegalLI>
          <LegalLI>
            Professional advisers, such as lawyers or auditors, where required
            by law
          </LegalLI>
        </LegalList>
        <LegalP>
          Some of these providers may process personal data outside Sri Lanka.
          Where this occurs, we rely on contractual safeguards with the provider
          — such as data processing agreements with equivalent protection
          standards — consistent with Section 26 of the Personal Data Protection
          Act, No. 9 of 2022.
        </LegalP>
      </>
    ),
  },
  {
    id: 'p8',
    title: 'Your Legal Rights',
    body: (
      <>
        <LegalP>
          Under the Sri Lanka Personal Data Protection Act, No. 9 of 2022, you
          have the following rights in relation to your personal data:
        </LegalP>

        <div>
          <LegalSubHead>Right to Access (Section 13)</LegalSubHead>
          <LegalP>
            You have the right to request a copy of the personal data we hold
            about you and to be provided with confirmation as to whether your
            personal data has been processed.
          </LegalP>
        </div>

        <div>
          <LegalSubHead>
            Right to Withdraw Consent and Object to Processing (Section 14)
          </LegalSubHead>
          <LegalP>
            You have the right to withdraw your consent at any time where
            processing is based on consent, and to request that we refrain from
            further processing your personal data where processing is based on
            our legitimate interests. You may object to Google Analytics by
            blocking or deleting its cookies in your browser, or by using
            Google&apos;s opt-out add-on.
          </LegalP>
        </div>

        <div>
          <LegalSubHead>
            Right to Rectification or Completion (Section 15)
          </LegalSubHead>
          <LegalP>
            You have the right to request that we rectify or complete personal
            data that is inaccurate or incomplete.
          </LegalP>
        </div>

        <div>
          <LegalSubHead>Right to Erasure (Section 16)</LegalSubHead>
          <LegalP>
            You have the right to request erasure of your personal data where:
          </LegalP>
          <LegalList>
            <LegalLI>
              processing is carried out in contravention of the Act
            </LegalLI>
            <LegalLI>
              you withdraw consent upon which the processing is based
            </LegalLI>
            <LegalLI>
              erasure is required by any written law or court order
            </LegalLI>
          </LegalList>
        </div>

        <div>
          <LegalSubHead>
            Right to Request Human Intervention in Automated Decision-Making
            (Section 18)
          </LegalSubHead>
          <LegalP>
            You have the right to request a review of a decision based solely on
            automated processing that has created, or is likely to create, an
            irreversible and continuous impact on your rights and freedoms.
          </LegalP>
        </div>

        <div>
          <LegalSubHead>Important Notes on Your Rights</LegalSubHead>
          <LegalList>
            <LegalLI>
              Requests must be made in writing to us using the contact details
              in Section 11
            </LegalLI>
            <LegalLI>
              We will respond to all legitimate requests within 21 working days,
              as required by the Act
            </LegalLI>
            <LegalLI>
              We may refuse a request on grounds such as national security,
              public order, an ongoing legal investigation, the rights of
              others, technical infeasibility, an inability to verify your
              identity, or a legal requirement to process the data
            </LegalLI>
            <LegalLI>
              Where a fee applies, we will tell you the amount and the reason
              for it
            </LegalLI>
            <LegalLI>
              These rights may be exercised by a parent or legal guardian on
              behalf of a minor, or by an heir within ten years of a data
              subject&apos;s demise
            </LegalLI>
          </LegalList>
        </div>

        <div>
          <LegalSubHead>Lodging a Complaint</LegalSubHead>
          <LegalP>
            You have the right to lodge a complaint with the Data Protection
            Authority of Sri Lanka if you believe your rights under the Act have
            been violated.
          </LegalP>
        </div>
      </>
    ),
  },
  {
    id: 'p9',
    title: 'Changes to This Privacy Policy',
    body: (
      <>
        <LegalP>
          We may update this Privacy Policy from time to time to reflect changes
          in our practices, technology, or legal requirements. When we make
          material changes, we will update the &quot;Last updated&quot; date at
          the top of this document and email a summary of the changes to every
          gym owner with a current subscription.
        </LegalP>
        <LegalP>
          We encourage you to review this policy periodically to stay informed
          about how we protect your information.
        </LegalP>
      </>
    ),
  },
  {
    id: 'p10',
    title: 'Contact Us',
    body: (
      <>
        <LegalP>
          If you have any questions, concerns, or requests regarding this
          Privacy Policy or how we handle your personal data, please contact us:
        </LegalP>
        <LegalContactList>
          <LegalContactItem label="Business:">
            Capitalist One (Pvt) Ltd
          </LegalContactItem>
          <LegalContactItem label="Email:">
            privacy@metricgymos.com
          </LegalContactItem>
          <LegalContactItem label="Phone:">+94 70 437 9967</LegalContactItem>
          <LegalContactItem label="Website:">metricgymos.com</LegalContactItem>
          <LegalContactItem label="Address:">
            150/1, 3rd Baptist Rd, Beddagana North, Kotte, Sri Lanka
          </LegalContactItem>
        </LegalContactList>
      </>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      activeDoc="privacy"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      sections={sections}
      footnote={<>© 2026 Capitalist One (Pvt) Ltd. All rights reserved.</>}
    />
  )
}
