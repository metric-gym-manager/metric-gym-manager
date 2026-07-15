import Link from 'next/link';
import Image from 'next/image';

export default function TermsOfServicePage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last updated: March 2025</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using Metric Gym Manager, including our web dashboard, mobile applications, and any related integrations, you agree to be bound by these Terms of Service. If you do not agree to any part of these terms, you must not access or use our platform. These terms apply to gym owners, administrators, and staff members who use the platform to manage their fitness business.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Use License</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We grant you a limited, non-exclusive, non-transferable license to access and use Metric Gym Manager for legitimate gym management purposes. Under this license, you may not:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Modify, copy, decompile, or reverse engineer any part of the platform</li>
              <li>Use the service for any purpose outside of gym and fitness business management</li>
              <li>Attempt to bypass, disable, or interfere with any security or access control features</li>
              <li>Extract, scrape, or export member data for unauthorized purposes</li>
              <li>Remove or alter any copyright, trademark, or proprietary notices</li>
              <li>Resell, sublicense, or transfer access to the service without our written authorization</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Account Registration</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To use Metric Gym Manager, you must register for an account. By registering, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Provide accurate, current, and complete information during sign-up</li>
              <li>Keep your account information up to date</li>
              <li>Maintain the confidentiality of your login credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Each account is for use by a single gym business. You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Subscription and Payment</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Metric Gym Manager is offered on a subscription basis with a flat monthly fee per gym. By subscribing, you agree to the following:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Subscriptions are billed in advance on a recurring monthly or annual cycle</li>
              <li>Payments are non-refundable except where required by applicable law</li>
              <li>You may cancel your subscription at any time; access continues until the end of the current billing period</li>
              <li>We reserve the right to adjust pricing with at least 30 days written notice</li>
              <li>All fees are exclusive of applicable taxes unless otherwise stated</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              We are not responsible for fees charged by your bank or payment provider in connection with your subscription.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. User Responsibilities</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              As a gym operator using Metric Gym Manager, you are responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Maintaining the confidentiality of your account credentials and ensuring staff access is appropriately managed</li>
              <li>All activities carried out under your account, including actions taken by your staff</li>
              <li>Ensuring that all member data entered into the platform is accurate and lawfully obtained</li>
              <li>Obtaining the necessary consent from your gym members before collecting their personal information and sending SMS notifications on their behalf</li>
              <li>Ensuring your use of the platform complies with applicable Sri Lankan data protection laws and any other regulations relevant to your business</li>
              <li>Adequately training staff on proper use of the platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Prohibited Activities</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You agree not to use Metric Gym Manager to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Engage in any unlawful activity or facilitate illegal conduct</li>
              <li>Gain unauthorized access to other accounts, systems, or networks</li>
              <li>Disrupt, degrade, or interfere with the platform or its underlying infrastructure</li>
              <li>Transmit malicious code, viruses, or harmful data</li>
              <li>Impersonate any person, entity, or gym business</li>
              <li>Collect or harvest data from the platform for purposes beyond your own gym&apos;s management</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Metric Gym Manager and all associated content, features, design, and functionality are the exclusive property of Systems Engineering Pvt Ltd and its licensors. The platform is protected by copyright, trademark, and other applicable laws.
            </p>
            <p className="text-gray-700 leading-relaxed">
              You retain ownership of all member data you input into the platform. By using the platform, you grant us a limited license to store and process that data solely for the purpose of providing our services to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Service Availability</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We aim to provide a reliable and accessible platform. However, we do not guarantee uninterrupted access and may temporarily suspend the service for scheduled maintenance, security updates, or emergency repairs. We will provide advance notice where reasonably possible.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We are not liable for any losses arising from planned or unplanned service interruptions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. SMS Notifications</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Metric Gym Manager enables gym operators to send automated SMS payment reminders to their members. By enabling this feature, you confirm that:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>You have obtained the necessary consent from each member to receive SMS communications</li>
              <li>You will use SMS notifications only for the permitted purposes outlined in our platform (payment reminders, renewal alerts, and expiry notifications)</li>
              <li>You will not use our SMS integration to send spam, promotional content unrelated to memberships, or any communications that violate applicable telecommunications laws</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to suspend SMS functionality if we have reason to believe it is being misused.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To the fullest extent permitted by law, Systems Engineering Pvt Ltd and its directors, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of - or inability to use - Metric Gym Manager. This includes but is not limited to loss of data, loss of revenue, or loss of business.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Our total liability to you for any claim arising from these terms or your use of the platform shall not exceed the amount you paid us in the three months preceding the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify and hold harmless Systems Engineering Pvt Ltd, its affiliates, officers, directors, employees, and agents from and against any claims, damages, liabilities, losses, or expenses (including reasonable legal fees) arising out of or related to your use of the platform, your breach of these terms, or your violation of any third-party rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Termination</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Either party may terminate the service relationship at any time. We reserve the right to suspend or terminate your account immediately, without prior notice, if we determine that you have breached these Terms of Service.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Upon termination, your right to access the platform ceases immediately. You may request an export of your data prior to termination by contacting us. We will retain your data for a reasonable period after termination before securely deleting it, unless a longer retention period is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms of Service are governed by and construed in accordance with the laws of Sri Lanka. Any disputes arising from these terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts of Sri Lanka.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Changes to These Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We reserve the right to update or modify these Terms of Service at any time. When we make material changes, we will update the &quot;Last updated&quot; date at the top of this document and notify you through the platform or via email with at least 14 days notice before changes take effect.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Your continued use of the platform after any changes constitutes your acceptance of the revised terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please reach out to us:
            </p>
            <ul className="list-none text-gray-700 space-y-2">
              <li><strong>Email:</strong> legal@metricgym.lk</li>
              <li><strong>Website:</strong> www.metricgym.lk</li>
              <li><strong>Address:</strong> Colombo, Sri Lanka</li>
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
            © 2026 Metric Gym Manager · Proudly built in Sri Lanka
          </p>
        </div>
      </footer>
    </div>
  );
}
