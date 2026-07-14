import Link from 'next/link';
import Image from 'next/image';

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
            <Image
              src="/logo.svg"
              alt="Metric Logo"
              width={24}
              height={24}
            />
            <span className="font-bold text-lg text-gray-900">
              Metric Gym Manager
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Refund &amp; Cancellation Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: July 2026</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Overview</h2>
            <p className="text-gray-700 leading-relaxed">
              Metric Gym Manager, a product of Capitalist One (Pvt) Ltd, is a software-as-a-service platform for gym and fitness businesses, offered on a monthly subscription basis. Subscription payments are processed securely by PayHere, our authorized payment gateway. This policy explains how subscription cancellations and refunds work. It applies only to the subscription fees you pay to us for using Metric Gym Manager.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Free Trial</h2>
            <p className="text-gray-700 leading-relaxed">
              Every new account starts with a 14-day free trial with full access to the platform. No payment details are required to start the trial, and no charges are made during it. The trial is designed to let you fully evaluate Metric Gym Manager before committing to a paid plan. If you choose not to subscribe, your account simply pauses at the end of the trial - you will never be charged for a trial.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Subscriptions and Billing</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Subscriptions are billed monthly in advance, in Sri Lankan Rupees (LKR), through PayHere</li>
              <li>When you subscribe, your card is securely saved with PayHere and charged automatically at the start of each billing cycle</li>
              <li>You can change your plan at any time; when you switch plans, any unused days from your current billing period are carried forward, so you never lose time you have already paid for</li>
              <li>Current plan prices are always displayed on our pricing page and inside your dashboard before any payment is made</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Cancelling Your Subscription</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may cancel your subscription at any time from your dashboard, with no cancellation fees or penalties. When you cancel:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Your subscription remains fully active until the end of the billing period you have already paid for</li>
              <li>No further charges are made to your card after cancellation</li>
              <li>Your data remains safe and you may resubscribe at any time to pick up where you left off</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Refunds</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Because every subscription begins with a 14-day free trial that allows full evaluation of the platform, subscription fees already paid are generally non-refundable, and we do not provide pro-rated refunds for partially used billing periods. However, we will always make it right when something goes wrong on our side:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li><strong>Duplicate charges:</strong> if you are billed more than once for the same billing period, we will refund the duplicate charge in full</li>
              <li><strong>Erroneous charges:</strong> if you are charged after cancelling, or charged an incorrect amount, we will refund the difference in full</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              To request a refund, contact us within 7 days of the charge using the details below, including your gym name and the payment reference. Approved refunds are issued to the original payment method through PayHere and typically appear on your card statement within 7-14 business days, depending on your bank or card issuer.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Nothing in this policy limits any rights you may have under applicable Sri Lankan consumer protection law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Payments Between Gyms and Their Members</h2>
            <p className="text-gray-700 leading-relaxed">
              Metric Gym Manager is used by gym operators to record membership payments they collect from their own members. Those payments are made directly to the gym and are governed by each gym&apos;s own terms and refund practices. If you are a gym member seeking a refund for a gym membership fee, please contact your gym directly - this policy covers only the platform subscription fees paid to us by gym operators.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about this policy, or wish to request a cancellation or refund, please reach out to us:
            </p>
            <ul className="list-none text-gray-700 space-y-2">
              <li><strong>Business:</strong> Capitalist One (Pvt) Ltd</li>
              <li><strong>Email:</strong> support@metricgymmanager.com</li>
              <li><strong>Phone:</strong> +94 70 437 9967</li>
              <li><strong>Website:</strong> www.metricgymmanager.com</li>
              <li><strong>Address:</strong> 150/1, 3rd Baptist Rd, Beddagana North, Kotte, Sri Lanka</li>
            </ul>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-500 text-center">
            © 2026 Capitalist One (Pvt) Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
