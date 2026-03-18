'use client';

const features = [
  {
    code: 'LKR',
    color: '#34d399',
    label: 'Local Pricing',
    sublabel: 'No forex hassle',
  },
  {
    code: 'SI · TA · EN',
    color: '#60a5fa',
    label: 'Trilingual Support',
    sublabel: 'Sinhala · Tamil · English',
  },
  {
    code: 'WA',
    color: '#a78bfa',
    label: 'WhatsApp Reminders',
    sublabel: 'Where your members are',
  },
  {
    code: '24/7',
    color: '#f472b6',
    label: 'On-site Support',
    sublabel: 'We come to you',
  },
];

export function LankaSection() {
  return (
    <section
      id="lanka"
      className="overflow-hidden"
      style={{
        padding: '180px 24px',
        background: '#ffffff',
      }}
    >
      <div className="max-w-[1120px] mx-auto text-center">
        {/* Main Text - Oversized and Animated */}
        <h2
          className="mb-8"
          style={{
            fontSize: 'clamp(60px, 10vw, 140px)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.045em',
            textAlign: 'center',
            transform: 'scale(1.1)',
            marginLeft: '-5%',
            marginRight: '-5%',
            width: '110%',
            background: 'linear-gradient(135deg, #8B0000 0%, #B22222 12%, #FF8C00 25%, #FFB347 35%, #006400 50%, #228B22 62%, #FF6B00 75%, #8B0000 88%, #FF8C00 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'lanka-hue 8s ease-in-out infinite',
            filter: 'drop-shadow(0 0 120px rgba(255, 140, 0, 0.1))',
          }}
        >
          Tailored to
          <br />
          Lanka&apos;s
          <br />
          Fitness
          <br />
          Industry
        </h2>

        {/* Subtitle */}
        <p
          className="mx-auto mb-16"
          style={{
            fontSize: '19px',
            color: '#6e6e73',
            maxWidth: '600px',
            lineHeight: 1.5,
          }}
        >
          Built from the ground up for Sri Lankan gym owners. Local payment systems,
          multilingual support, and a team that understands your business.
        </p>

        {/* Feature Pills */}
        <div
          className="flex flex-wrap items-start justify-center gap-12"
          style={{
            marginTop: '64px',
          }}
        >
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center">
              {/* Icon Container */}
              <div
                className="mb-3 flex items-center justify-center font-bold"
                style={{
                  width: '48px',
                  height: '48px',
                  background: 'rgba(0, 0, 0, 0.04)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: feature.color,
                }}
              >
                {feature.code}
              </div>

              {/* Label */}
              <div
                className="mb-1"
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1d1d1f',
                }}
              >
                {feature.label}
              </div>

              {/* Sublabel */}
              <div
                style={{
                  fontSize: '13px',
                  color: '#6e6e73',
                }}
              >
                {feature.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
