import Link from 'next/link'
import Image from 'next/image'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface-card">
      {/* Header */}
      <header className="border-b border-line-1">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit"
          >
            <Image src="/logo.svg" alt="Metric Logo" width={24} height={24} />
            <span className="font-bold text-lg text-ink">Metric Gym OS</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-4xl font-bold text-ink mb-2">Contact Us</h1>
          <p className="text-ink-muted mb-8">
            We&apos;re here to help - reach us through any of the channels
            below.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-ink mt-8 mb-4">
              Phone &amp; WhatsApp
            </h2>
            <ul className="list-none text-ink-secondary space-y-2">
              <li>
                <strong>Phone:</strong>{' '}
                <a
                  href="tel:+94704379967"
                  className="text-brand-link hover:text-brand-link"
                >
                  +94 70 437 9967
                </a>
              </li>
              <li>
                <strong>WhatsApp:</strong>{' '}
                <a
                  href="https://wa.me/94704379967"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-link hover:text-brand-link"
                >
                  +94 70 437 9967
                </a>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-ink mt-8 mb-4">Email</h2>
            <ul className="list-none text-ink-secondary space-y-2">
              <li>
                <strong>General inquiries &amp; support:</strong>{' '}
                <a
                  href="mailto:support@metricgymos.com"
                  className="text-brand-link hover:text-brand-link"
                >
                  support@metricgymos.com
                </a>
              </li>
              <li>
                <strong>Privacy &amp; legal:</strong>{' '}
                <a
                  href="mailto:privacy@metricgymos.com"
                  className="text-brand-link hover:text-brand-link"
                >
                  privacy@metricgymos.com
                </a>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-ink mt-8 mb-4">
              Postal Address
            </h2>
            <p className="text-ink-secondary leading-relaxed">
              Capitalist One (Pvt) Ltd
              <br />
              150/1, 3rd Baptist Rd,
              <br />
              Beddagana North, Kotte,
              <br />
              Sri Lanka
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-ink mt-8 mb-4">
              About the Business
            </h2>
            <p className="text-ink-secondary leading-relaxed">
              Metric Gym OS is owned and operated by Capitalist One (Pvt) Ltd, a
              company registered in Sri Lanka. Learn more in our{' '}
              <Link
                href="/terms"
                className="text-brand-link hover:text-brand-link"
              >
                Terms of Service
              </Link>
              ,{' '}
              <Link
                href="/privacy"
                className="text-brand-link hover:text-brand-link"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                href="/refund-policy"
                className="text-brand-link hover:text-brand-link"
              >
                Refund &amp; Cancellation Policy
              </Link>
              .
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 pt-8 border-t border-line-1">
          <Link
            href="/"
            className="inline-flex items-center text-brand-link hover:text-brand-link font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line-1 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-ink-muted text-center">
            © 2026 Capitalist One (Pvt) Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
