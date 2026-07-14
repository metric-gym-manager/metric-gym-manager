import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: July 2026</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Welcome to Metric Gym Manager - a gym management platform built for fitness businesses in Sri Lanka and beyond. We are committed to protecting your personal data and handling it responsibly. This Privacy Policy explains what information we collect, how we use it, and the rights you have over your data when you use our platform, including our web dashboard, mobile applications, and any related integrations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We collect and process the following categories of personal data:
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Identity Data:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Full name, username, and gym/business name</li>
                  <li>Member ID and staff role</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Contact Data:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Email address and phone number</li>
                  <li>Physical address of the gym or member</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Financial Data:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Membership subscription status and renewal dates</li>
                  <li>Payment transaction records (payment card details are handled exclusively by our payment gateway partners and are never stored on our servers)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Operational Data:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Member attendance records and check-in/check-out logs</li>
                  <li>Membership plan details and expiry information</li>
                  <li>SMS reminder logs and communication history</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Data:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>IP address, browser type, and device information</li>
                  <li>Platform access logs and session data</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Usage Data:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Feature usage patterns and dashboard interactions</li>
                  <li>Revenue and retention analytics generated from operational data</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use your personal data only when the law allows us to. We use it to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Provide and operate the Metric Gym Manager platform and its features</li>
              <li>Manage member registrations, memberships, and renewals</li>
              <li>Send automated payment reminders and renewal notifications via SMS</li>
              <li>Generate attendance reports, revenue dashboards, and retention analytics for gym owners</li>
              <li>Authenticate users and manage role-based access for gym staff</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Monitor platform performance, detect errors, and ensure system reliability</li>
              <li>Detect, prevent, and address fraudulent or unauthorized activity</li>
              <li>Comply with legal obligations applicable to our operations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. SMS Communications</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Metric Gym Manager sends SMS notifications to gym members on behalf of gym operators. These messages are limited to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Payment due reminders</li>
              <li>Membership renewal notifications</li>
              <li>Expiry alerts</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              SMS messages are sent using our integrated SMS gateway. Gym operators are responsible for obtaining appropriate consent from their members before enabling SMS notifications. Members who wish to opt out of SMS communications should contact their gym directly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Data Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We take the security of your data seriously and implement appropriate technical and organizational measures, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>SSL/TLS encryption for all data in transit</li>
              <li>Encrypted storage for sensitive data at rest</li>
              <li>Role-based access control (RBAC) to restrict data access to authorized personnel only</li>
              <li>Secure cloud infrastructure with high availability</li>
              <li>Regular security reviews and access audits</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              While we take all reasonable steps to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but are committed to promptly addressing any incidents that may occur.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We retain your personal data only for as long as necessary to fulfil the purposes for which it was collected, including to satisfy any legal, accounting, or reporting obligations. When data is no longer required, we securely delete or anonymize it.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Gym operators may request deletion of their account and associated member data at any time by contacting us at the address below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Data Sharing and Third Parties</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We do not sell your personal data to any third party. We may share data with:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>SMS gateway providers, strictly for the purpose of delivering notifications on behalf of gym operators</li>
              <li>Cloud infrastructure and hosting providers who process data on our behalf under data processing agreements</li>
              <li>Professional advisers such as lawyers or auditors where required by law</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Any third-party service providers we engage are contractually required to protect your data and may only use it for the specific purposes we direct.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Your Legal Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Depending on your location and applicable law, you may have the following rights in relation to your personal data:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Right to access - request a copy of the personal data we hold about you</li>
              <li>Right to rectification - request correction of inaccurate or incomplete data</li>
              <li>Right to erasure - request deletion of your personal data in certain circumstances</li>
              <li>Right to restrict processing - request that we limit how we use your data</li>
              <li>Right to data portability - request transfer of your data in a structured format</li>
              <li>Right to object - object to our processing of your data in certain situations</li>
              <li>Right to withdraw consent - where processing is based on consent, you may withdraw it at any time</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              To exercise any of these rights, please contact us using the details in Section 10. We will respond to all legitimate requests within a reasonable timeframe.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make material changes, we will update the &quot;Last updated&quot; date at the top of this document and, where appropriate, notify you through the platform or via email.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We encourage you to review this policy periodically to stay informed about how we protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your personal data, please contact us:
            </p>
            <ul className="list-none text-gray-700 space-y-2">
              <li><strong>Business:</strong> Capitalist One (Pvt) Ltd</li>
              <li><strong>Email:</strong> privacy@metricgymmanager.com</li>
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
