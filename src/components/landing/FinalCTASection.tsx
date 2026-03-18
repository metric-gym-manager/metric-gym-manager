'use client';

import Link from 'next/link';

export function FinalCTASection() {
  return (
    <section
      className="relative text-center final-cta-section"
      style={{
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
          className="mb-6 cta-headline"
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
          className="mx-auto mb-10 cta-subtitle"
          style={{
            fontSize: '19px',
            color: '#6e6e73',
            maxWidth: '480px',
            lineHeight: 1.5,
          }}
        >
          Start with a 14-day free trial. No credit card required. Set up in under 5 minutes.
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

        {/* Trust Pills */}
        <div
          className="flex flex-wrap items-center justify-center gap-3"
          style={{
            marginTop: '48px',
          }}
        >
          <div
            style={{
              padding: '8px 20px',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '980px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1d1d1f',
            }}
          >
            Free onboarding
          </div>
          <div
            style={{
              padding: '8px 20px',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '980px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1d1d1f',
            }}
          >
            No credit card
          </div>
          <div
            style={{
              padding: '8px 20px',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '980px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1d1d1f',
            }}
          >
            Cancel anytime
          </div>
        </div>
      </div>

      <style jsx>{`
        .final-cta-section {
          padding: 160px 24px;
        }

        @media (max-width: 768px) {
          .final-cta-section {
            padding: 80px 24px;
          }

          .cta-headline {
            font-size: 36px !important;
            line-height: 1.1 !important;
            margin-bottom: 20px !important;
            letter-spacing: -0.02em !important;
          }

          .cta-subtitle {
            font-size: 16px !important;
            line-height: 1.6 !important;
            margin-bottom: 32px !important;
            padding: 0 16px;
          }
        }
      `}</style>
    </section>
  );
}
