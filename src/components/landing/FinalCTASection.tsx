'use client';

import Link from 'next/link';

export function FinalCTASection() {
  return (
    <section
      className="relative text-center"
      style={{
        padding: '160px 24px',
        background: '#ffffff',
      }}
    >
      {/* Radial gradient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center bottom, rgba(37,99,235,0.03) 0%, #ffffff 60%)',
        }}
      />

      <div className="relative z-10 max-w-[1120px] mx-auto">
        {/* Headline */}
        <h2
          className="mb-6"
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#1d1d1f',
          }}
        >
          Ready to transform
          <br />
          your gym?
        </h2>

        {/* Subtitle */}
        <p
          className="mx-auto mb-10"
          style={{
            fontSize: '19px',
            color: '#6e6e73',
            maxWidth: '480px',
            lineHeight: 1.5,
          }}
        >
          No credit card required. Set up in under 5 minutes. 30-day money-back
          guarantee.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/register" className="btn-primary">
            Get Started Free
          </Link>
          <Link href="/support" className="btn-secondary">
            Schedule a Demo
          </Link>
        </div>

        {/* Trust Row */}
        <div
          className="flex flex-wrap items-center justify-center gap-9"
          style={{
            marginTop: '48px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: '#6e6e73',
            }}
          >
            ✓ Free onboarding
          </div>
          <div
            style={{
              fontSize: '13px',
              color: '#6e6e73',
            }}
          >
            ✓ No credit card
          </div>
          <div
            style={{
              fontSize: '13px',
              color: '#6e6e73',
            }}
          >
            ✓ Cancel anytime
          </div>
        </div>
      </div>
    </section>
  );
}
