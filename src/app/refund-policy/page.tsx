import {
  LegalLayout,
  LegalP,
  LegalList,
  LegalLI,
  LegalContactList,
  LegalContactItem,
  type LegalSection,
} from '@/components/legal'

const LAST_UPDATED = 'July 2026'

const sections: LegalSection[] = [
  {
    id: 'r1',
    title: 'Overview',
    body: (
      <LegalP>
        Metric Gym Manager, a product of Capitalist One (Pvt) Ltd, is a
        software-as-a-service platform for gym and fitness businesses, offered
        on a monthly subscription basis. Subscription payments are processed
        securely by PayHere, our authorized payment gateway. This policy
        explains how subscription cancellations and refunds work. It applies
        only to the subscription fees you pay to us for using Metric Gym
        Manager.
      </LegalP>
    ),
  },
  {
    id: 'r2',
    title: 'Free Trial',
    body: (
      <LegalP>
        Every new account starts with a 30-day free trial with full access to
        the platform. No payment details are required to start the trial, and no
        charges are made during it. The trial is designed to let you fully
        evaluate Metric Gym Manager before committing to a paid plan. If you
        choose not to subscribe, your account simply pauses at the end of the
        trial - you will never be charged for a trial.
      </LegalP>
    ),
  },
  {
    id: 'r3',
    title: 'Subscriptions and Billing',
    body: (
      <LegalList>
        <LegalLI>
          Subscriptions are billed monthly in advance, in Sri Lankan Rupees
          (LKR), through PayHere
        </LegalLI>
        <LegalLI>
          When you subscribe, your card is securely saved with PayHere and
          charged automatically at the start of each billing cycle
        </LegalLI>
        <LegalLI>
          You can change your plan at any time; when you switch plans, any
          unused days from your current billing period are carried forward, so
          you never lose time you have already paid for
        </LegalLI>
        <LegalLI>
          Current plan prices are always displayed on our pricing page and
          inside your dashboard before any payment is made
        </LegalLI>
      </LegalList>
    ),
  },
  {
    id: 'r4',
    title: 'Cancelling Your Subscription',
    body: (
      <>
        <LegalP>
          You may cancel your subscription at any time from your dashboard, with
          no cancellation fees or penalties. When you cancel:
        </LegalP>
        <LegalList>
          <LegalLI>
            Your subscription remains fully active until the end of the billing
            period you have already paid for
          </LegalLI>
          <LegalLI>
            No further charges are made to your card after cancellation
          </LegalLI>
          <LegalLI>
            Your data remains safe and you may resubscribe at any time to pick
            up where you left off
          </LegalLI>
        </LegalList>
      </>
    ),
  },
  {
    id: 'r5',
    title: 'Refunds',
    body: (
      <>
        <LegalP>
          Because every subscription begins with a 30-day free trial that allows
          full evaluation of the platform, subscription fees already paid are
          generally non-refundable, and we do not provide pro-rated refunds for
          partially used billing periods. However, we will always make it right
          when something goes wrong on our side:
        </LegalP>
        <LegalList>
          <LegalLI>
            <strong style={{ color: '#ededf0', fontWeight: 600 }}>
              Duplicate charges:
            </strong>{' '}
            if you are billed more than once for the same billing period, we
            will refund the duplicate charge in full
          </LegalLI>
          <LegalLI>
            <strong style={{ color: '#ededf0', fontWeight: 600 }}>
              Erroneous charges:
            </strong>{' '}
            if you are charged after cancelling, or charged an incorrect amount,
            we will refund the difference in full
          </LegalLI>
        </LegalList>
        <LegalP>
          To request a refund, contact us within 7 days of the charge using the
          details below, including your gym name and the payment reference.
          Approved refunds are issued to the original payment method through
          PayHere and typically appear on your card statement within 7-14
          business days, depending on your bank or card issuer.
        </LegalP>
        <LegalP>
          Nothing in this policy limits any rights you may have under applicable
          Sri Lankan consumer protection law.
        </LegalP>
      </>
    ),
  },
  {
    id: 'r6',
    title: 'Payments Between Gyms and Their Members',
    body: (
      <LegalP>
        Metric Gym Manager is used by gym operators to record membership
        payments they collect from their own members. Those payments are made
        directly to the gym and are governed by each gym&apos;s own terms and
        refund practices. If you are a gym member seeking a refund for a gym
        membership fee, please contact your gym directly - this policy covers
        only the platform subscription fees paid to us by gym operators.
      </LegalP>
    ),
  },
  {
    id: 'r7',
    title: 'Contact Us',
    body: (
      <>
        <LegalP>
          If you have any questions about this policy, or wish to request a
          cancellation or refund, please reach out to us:
        </LegalP>
        <LegalContactList>
          <LegalContactItem label="Business:">
            Capitalist One (Pvt) Ltd
          </LegalContactItem>
          <LegalContactItem label="Email:">
            support@metricgymmanager.com
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

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      activeDoc="refund"
      title="Refund & Cancellation Policy"
      lastUpdated={LAST_UPDATED}
      sections={sections}
      footnote={<>© 2026 Capitalist One (Pvt) Ltd. All rights reserved.</>}
    />
  )
}
