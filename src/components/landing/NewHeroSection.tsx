'use client';

import Link from 'next/link';

export function NewHeroSection() {
  return (
    <section
      className="relative flex items-center justify-center"
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        paddingTop: '140px',
      }}
    >
      {/* Radial gradient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center 40%, rgba(37,99,235,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-[1120px] mx-auto px-6 text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 mb-8"
          style={{
            background: 'rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '980px',
            padding: '8px 16px',
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: '#34d399',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontSize: '13px',
              color: '#6e6e73',
            }}
          >
            Built for Sri Lankan gyms
          </span>
        </div>

        {/* Headline */}
        <h1
          className="mb-6 hero-headline"
          style={{
            fontSize: 'clamp(52px, 8vw, 96px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#1d1d1f',
          }}
        >
          Turn your gym
          <br />
          into a <span className="gradient-text">smart business.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mx-auto mb-10 hero-subheadline"
          style={{
            fontSize: 'clamp(17px, 2vw, 21px)',
            color: '#6e6e73',
            maxWidth: '560px',
            lineHeight: 1.5,
          }}
        >
          The all-in-one platform that automates payments, tracks members, and grows
          your revenue. Set up in 5 minutes.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link href="/register" className="btn-primary">
            Start Free Trial
          </Link>
          <button className="btn-secondary">Watch Demo</button>
        </div>

        {/* Stats Row */}
        <div
          className="pt-12"
          style={{
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            marginTop: '80px',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Stat 1 */}
            <div>
              <div
                className="mb-2"
                style={{
                  fontSize: '40px',
                  fontWeight: 700,
                  color: '#1d1d1f',
                }}
              >
                25+
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#6e6e73',
                }}
              >
                Gyms Connected
              </div>
            </div>

            {/* Stat 2 */}
            <div>
              <div
                className="mb-2"
                style={{
                  fontSize: '40px',
                  fontWeight: 700,
                  color: '#1d1d1f',
                }}
              >
                7.9K+
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#6e6e73',
                }}
              >
                Active Members
              </div>
            </div>

            {/* Stat 3 */}
            <div>
              <div
                className="mb-2"
                style={{
                  fontSize: '40px',
                  fontWeight: 700,
                  color: '#1d1d1f',
                }}
              >
                99.99%
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#6e6e73',
                }}
              >
                Uptime
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .hero-headline {
            font-size: 40px !important;
            line-height: 1.1 !important;
            letter-spacing: -0.02em !important;
            margin-bottom: 20px !important;
          }

          .hero-subheadline {
            font-size: 17px !important;
            line-height: 1.6 !important;
            margin-bottom: 32px !important;
            padding: 0 8px;
          }
        }
      `}</style>
    </section>
  );
}
