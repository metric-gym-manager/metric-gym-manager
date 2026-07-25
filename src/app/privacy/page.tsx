import {
  LegalLayout,
  LegalP,
  LegalList,
  LegalLI,
  LegalSubHead,
  LegalContactList,
  LegalContactItem,
  type LegalSection,
} from '@/components/legal'

const LAST_UPDATED = 'July 2026'

const sections: LegalSection[] = [
  {
    id: 'p1',
    title: 'Introduction',
    body: (
      <LegalP>
        Welcome to Metric Gym Manager - a gym management platform built for
        fitness businesses in Sri Lanka and beyond. We are committed to
        protecting your personal data and handling it responsibly. This Privacy
        Policy explains what information we collect, how we use it, and the
        rights you have over your data when you use our platform, including our
        web dashboard, mobile applications, and any related integrations.
      </LegalP>
    ),
  },
  {
    id: 'p2',
    title: 'Information We Collect',
    body: (
      <>
        <LegalP>
          We collect and process the following categories of personal data:
        </LegalP>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <LegalSubHead>Identity Data:</LegalSubHead>
            <LegalList>
              <LegalLI>Full name, username, and gym/business name</LegalLI>
              <LegalLI>Member ID and staff role</LegalLI>
            </LegalList>
          </div>
          <div>
            <LegalSubHead>Contact Data:</LegalSubHead>
            <LegalList>
              <LegalLI>Email address and phone number</LegalLI>
              <LegalLI>Physical address of the gym or member</LegalLI>
            </LegalList>
          </div>
          <div>
            <LegalSubHead>Financial Data:</LegalSubHead>
            <LegalList>
              <LegalLI>
                Membership subscription status and renewal dates
              </LegalLI>
              <LegalLI>
                Payment transaction records (payment card details are handled
                exclusively by our payment gateway partners and are never stored
                on our servers)
              </LegalLI>
            </LegalList>
          </div>
          <div>
            <LegalSubHead>Operational Data:</LegalSubHead>
            <LegalList>
              <LegalLI>
                Member attendance records and check-in/check-out logs
              </LegalLI>
              <LegalLI>Membership plan details and expiry information</LegalLI>
              <LegalLI>SMS reminder logs and communication history</LegalLI>
            </LegalList>
          </div>
          <div>
            <LegalSubHead>Technical Data:</LegalSubHead>
            <LegalList>
              <LegalLI>
                IP address, browser type, and device information
              </LegalLI>
              <LegalLI>Platform access logs and session data</LegalLI>
            </LegalList>
          </div>
          <div>
            <LegalSubHead>Usage Data:</LegalSubHead>
            <LegalList>
              <LegalLI>
                Feature usage patterns and dashboard interactions
              </LegalLI>
              <LegalLI>
                Revenue and retention analytics generated from operational data
              </LegalLI>
            </LegalList>
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
          We use your personal data only when the law allows us to. We use it
          to:
        </LegalP>
        <LegalList>
          <LegalLI>
            Provide and operate the Metric Gym Manager platform and its features
          </LegalLI>
          <LegalLI>
            Manage member registrations, memberships, and renewals
          </LegalLI>
          <LegalLI>
            Send automated payment reminders and renewal notifications via SMS
          </LegalLI>
          <LegalLI>
            Generate attendance reports, revenue dashboards, and retention
            analytics for gym owners
          </LegalLI>
          <LegalLI>
            Authenticate users and manage role-based access for gym staff
          </LegalLI>
          <LegalLI>Provide customer support and respond to inquiries</LegalLI>
          <LegalLI>
            Monitor platform performance, detect errors, and ensure system
            reliability
          </LegalLI>
          <LegalLI>
            Detect, prevent, and address fraudulent or unauthorized activity
          </LegalLI>
          <LegalLI>
            Comply with legal obligations applicable to our operations
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
          Metric Gym Manager sends SMS notifications to gym members on behalf of
          gym operators. These messages are limited to:
        </LegalP>
        <LegalList>
          <LegalLI>Payment due reminders</LegalLI>
          <LegalLI>Membership renewal notifications</LegalLI>
          <LegalLI>Expiry alerts</LegalLI>
        </LegalList>
        <LegalP>
          SMS messages are sent using our integrated SMS gateway. Gym operators
          are responsible for obtaining appropriate consent from their members
          before enabling SMS notifications. Members who wish to opt out of SMS
          communications should contact their gym directly.
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
          legal, accounting, or reporting obligations. When data is no longer
          required, we securely delete or anonymize it.
        </LegalP>
        <LegalP>
          Gym operators may request deletion of their account and associated
          member data at any time by contacting us at the address below.
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
          data with:
        </LegalP>
        <LegalList>
          <LegalLI>
            SMS gateway providers, strictly for the purpose of delivering
            notifications on behalf of gym operators
          </LegalLI>
          <LegalLI>
            Cloud infrastructure and hosting providers who process data on our
            behalf under data processing agreements
          </LegalLI>
          <LegalLI>
            Professional advisers such as lawyers or auditors where required by
            law
          </LegalLI>
        </LegalList>
        <LegalP>
          Any third-party service providers we engage are contractually required
          to protect your data and may only use it for the specific purposes we
          direct.
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
          Depending on your location and applicable law, you may have the
          following rights in relation to your personal data:
        </LegalP>
        <LegalList>
          <LegalLI>
            Right to access - request a copy of the personal data we hold about
            you
          </LegalLI>
          <LegalLI>
            Right to rectification - request correction of inaccurate or
            incomplete data
          </LegalLI>
          <LegalLI>
            Right to erasure - request deletion of your personal data in certain
            circumstances
          </LegalLI>
          <LegalLI>
            Right to restrict processing - request that we limit how we use your
            data
          </LegalLI>
          <LegalLI>
            Right to data portability - request transfer of your data in a
            structured format
          </LegalLI>
          <LegalLI>
            Right to object - object to our processing of your data in certain
            situations
          </LegalLI>
          <LegalLI>
            Right to withdraw consent - where processing is based on consent,
            you may withdraw it at any time
          </LegalLI>
        </LegalList>
        <LegalP>
          To exercise any of these rights, please contact us using the details
          in Section 10. We will respond to all legitimate requests within a
          reasonable timeframe.
        </LegalP>
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
          the top of this document and, where appropriate, notify you through
          the platform or via email.
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
            privacy@metricgymmanager.com
          </LegalContactItem>
          <LegalContactItem label="Phone:">+94 70 437 9967</LegalContactItem>
          <LegalContactItem label="Website:">
            www.metricgymmanager.com
          </LegalContactItem>
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
