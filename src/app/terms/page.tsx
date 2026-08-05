import Link from 'next/link';
import {
  LegalLayout,
  LegalP,
  LegalList,
  LegalLI,
  LegalContactList,
  LegalContactItem,
  type LegalSection,
} from '@/components/legal';

const LAST_UPDATED = 'July 2026';

const sections: LegalSection[] = [
  {
    id: 't1',
    title: 'Agreement to Terms',
    body: (
      <LegalP>
        By accessing or using Metric Gym OS, including our web dashboard, mobile applications,
        and any related integrations, you agree to be bound by these Terms of Service. If you do not
        agree to any part of these terms, you must not access or use our platform. These terms apply
        to gym owners, administrators, and staff members who use the platform to manage their fitness
        business.
      </LegalP>
    ),
  },
  {
    id: 't2',
    title: 'Use License',
    body: (
      <>
        <LegalP>
          We grant you a limited, non-exclusive, non-transferable license to access and use Metric Gym
          Manager for legitimate gym management purposes. Under this license, you may not:
        </LegalP>
        <LegalList>
          <LegalLI>Modify, copy, decompile, or reverse engineer any part of the platform</LegalLI>
          <LegalLI>
            Use the service for any purpose outside of gym and fitness business management
          </LegalLI>
          <LegalLI>
            Attempt to bypass, disable, or interfere with any security or access control features
          </LegalLI>
          <LegalLI>Extract, scrape, or export member data for unauthorized purposes</LegalLI>
          <LegalLI>Remove or alter any copyright, trademark, or proprietary notices</LegalLI>
          <LegalLI>
            Resell, sublicense, or transfer access to the service without our written authorization
          </LegalLI>
        </LegalList>
      </>
    ),
  },
  {
    id: 't3',
    title: 'Account Registration',
    body: (
      <>
        <LegalP>
          To use Metric Gym OS, you must register for an account. By registering, you agree to:
        </LegalP>
        <LegalList>
          <LegalLI>Provide accurate, current, and complete information during sign-up</LegalLI>
          <LegalLI>Keep your account information up to date</LegalLI>
          <LegalLI>Maintain the confidentiality of your login credentials</LegalLI>
          <LegalLI>Notify us immediately of any unauthorized access to your account</LegalLI>
        </LegalList>
        <LegalP>
          Each account is for use by a single gym business. You are responsible for all activity that
          occurs under your account.
        </LegalP>
      </>
    ),
  },
  {
    id: 't4',
    title: 'Subscription and Payment',
    body: (
      <>
        <LegalP>
          Metric Gym OS is offered on a subscription basis with a flat monthly fee per gym. By
          subscribing, you agree to the following:
        </LegalP>
        <LegalList>
          <LegalLI>
            Every new account starts with a 30-day free trial; no charges are made until you subscribe
            to a paid plan
          </LegalLI>
          <LegalLI>
            Subscriptions are billed in advance on a recurring monthly cycle through PayHere, our
            authorized payment gateway
          </LegalLI>
          <LegalLI>Payments are non-refundable except where required by applicable law</LegalLI>
          <LegalLI>
            You may cancel your subscription at any time; access continues until the end of the
            current billing period
          </LegalLI>
          <LegalLI>We reserve the right to adjust pricing with at least 30 days written notice</LegalLI>
          <LegalLI>All fees are exclusive of applicable taxes unless otherwise stated</LegalLI>
        </LegalList>
        <LegalP>
          For full details on cancellations and refunds, please see our{' '}
          <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
        </LegalP>
        <LegalP>
          We are not responsible for fees charged by your bank or payment provider in connection with
          your subscription.
        </LegalP>
      </>
    ),
  },
  {
    id: 't5',
    title: 'User Responsibilities',
    body: (
      <>
        <LegalP>As a gym operator using Metric Gym OS, you are responsible for:</LegalP>
        <LegalList>
          <LegalLI>
            Maintaining the confidentiality of your account credentials and ensuring staff access is
            appropriately managed
          </LegalLI>
          <LegalLI>
            All activities carried out under your account, including actions taken by your staff
          </LegalLI>
          <LegalLI>
            Ensuring that all member data entered into the platform is accurate and lawfully obtained
          </LegalLI>
          <LegalLI>
            Obtaining the necessary consent from your gym members before collecting their personal
            information and sending SMS notifications on their behalf
          </LegalLI>
          <LegalLI>
            Ensuring your use of the platform complies with applicable Sri Lankan data protection laws
            and any other regulations relevant to your business
          </LegalLI>
          <LegalLI>Adequately training staff on proper use of the platform</LegalLI>
        </LegalList>
      </>
    ),
  },
  {
    id: 't6',
    title: 'Prohibited Activities',
    body: (
      <>
        <LegalP>You agree not to use Metric Gym OS to:</LegalP>
        <LegalList>
          <LegalLI>Engage in any unlawful activity or facilitate illegal conduct</LegalLI>
          <LegalLI>Gain unauthorized access to other accounts, systems, or networks</LegalLI>
          <LegalLI>
            Disrupt, degrade, or interfere with the platform or its underlying infrastructure
          </LegalLI>
          <LegalLI>Transmit malicious code, viruses, or harmful data</LegalLI>
          <LegalLI>Impersonate any person, entity, or gym business</LegalLI>
          <LegalLI>
            Collect or harvest data from the platform for purposes beyond your own gym&apos;s
            management
          </LegalLI>
        </LegalList>
      </>
    ),
  },
  {
    id: 't7',
    title: 'Intellectual Property',
    body: (
      <>
        <LegalP>
          Metric Gym OS and all associated content, features, design, and functionality are the
          exclusive property of Capitalist One (Pvt) Ltd and its licensors. The platform is protected
          by copyright, trademark, and other applicable laws.
        </LegalP>
        <LegalP>
          You retain ownership of all member data you input into the platform. By using the platform,
          you grant us a limited license to store and process that data solely for the purpose of
          providing our services to you.
        </LegalP>
      </>
    ),
  },
  {
    id: 't8',
    title: 'Service Availability',
    body: (
      <>
        <LegalP>
          We aim to provide a reliable and accessible platform. However, we do not guarantee
          uninterrupted access and may temporarily suspend the service for scheduled maintenance,
          security updates, or emergency repairs. We will provide advance notice where reasonably
          possible.
        </LegalP>
        <LegalP>
          We are not liable for any losses arising from planned or unplanned service interruptions.
        </LegalP>
      </>
    ),
  },
  {
    id: 't9',
    title: 'SMS Notifications',
    body: (
      <>
        <LegalP>
          Metric Gym OS enables gym operators to send automated SMS payment reminders to their
          members. By enabling this feature, you confirm that:
        </LegalP>
        <LegalList>
          <LegalLI>
            You have obtained the necessary consent from each member to receive SMS communications
          </LegalLI>
          <LegalLI>
            You will use SMS notifications only for the permitted purposes outlined in our platform
            (payment reminders, renewal alerts, and expiry notifications)
          </LegalLI>
          <LegalLI>
            You will not use our SMS integration to send spam, promotional content unrelated to
            memberships, or any communications that violate applicable telecommunications laws
          </LegalLI>
        </LegalList>
        <LegalP>
          We reserve the right to suspend SMS functionality if we have reason to believe it is being
          misused.
        </LegalP>
      </>
    ),
  },
  {
    id: 't10',
    title: 'Limitation of Liability',
    body: (
      <>
        <LegalP>
          To the fullest extent permitted by law, Capitalist One (Pvt) Ltd and its directors,
          employees, and affiliates shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages arising from your use of - or inability to use - Metric
          Gym Manager. This includes but is not limited to loss of data, loss of revenue, or loss of
          business.
        </LegalP>
        <LegalP>
          Our total liability to you for any claim arising from these terms or your use of the
          platform shall not exceed the amount you paid us in the three months preceding the claim.
        </LegalP>
      </>
    ),
  },
  {
    id: 't11',
    title: 'Indemnification',
    body: (
      <LegalP>
        You agree to indemnify and hold harmless Capitalist One (Pvt) Ltd, its affiliates, officers,
        directors, employees, and agents from and against any claims, damages, liabilities, losses, or
        expenses (including reasonable legal fees) arising out of or related to your use of the
        platform, your breach of these terms, or your violation of any third-party rights.
      </LegalP>
    ),
  },
  {
    id: 't12',
    title: 'Termination',
    body: (
      <>
        <LegalP>
          Either party may terminate the service relationship at any time. We reserve the right to
          suspend or terminate your account immediately, without prior notice, if we determine that
          you have breached these Terms of Service.
        </LegalP>
        <LegalP>
          Upon termination, your right to access the platform ceases immediately. You may request an
          export of your data prior to termination by contacting us. We will retain your data for a
          reasonable period after termination before securely deleting it, unless a longer retention
          period is required by law.
        </LegalP>
      </>
    ),
  },
  {
    id: 't13',
    title: 'Governing Law',
    body: (
      <LegalP>
        These Terms of Service are governed by and construed in accordance with the laws of Sri Lanka.
        Any disputes arising from these terms or your use of the platform shall be subject to the
        exclusive jurisdiction of the courts of Sri Lanka.
      </LegalP>
    ),
  },
  {
    id: 't14',
    title: 'Changes to These Terms',
    body: (
      <>
        <LegalP>
          We reserve the right to update or modify these Terms of Service at any time. When we make
          material changes, we will update the &quot;Last updated&quot; date at the top of this
          document and notify you through the platform or via email with at least 14 days notice
          before changes take effect.
        </LegalP>
        <LegalP>
          Your continued use of the platform after any changes constitutes your acceptance of the
          revised terms.
        </LegalP>
      </>
    ),
  },
  {
    id: 't15',
    title: 'Contact Us',
    body: (
      <>
        <LegalP>
          If you have any questions about these Terms of Service, please reach out to us:
        </LegalP>
        <LegalContactList>
          <LegalContactItem label="Business:">Capitalist One (Pvt) Ltd</LegalContactItem>
          <LegalContactItem label="Email:">privacy@metricgymos.com</LegalContactItem>
          <LegalContactItem label="Phone:">+94 70 437 9967</LegalContactItem>
          <LegalContactItem label="Website:">www.metricgymos.com</LegalContactItem>
          <LegalContactItem label="Address:">
            150/1, 3rd Baptist Rd, Beddagana North, Kotte, Sri Lanka
          </LegalContactItem>
        </LegalContactList>
      </>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      activeDoc="terms"
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      sections={sections}
      footnote={<>© 2026 Capitalist One (Pvt) Ltd. All rights reserved.</>}
    />
  );
}
