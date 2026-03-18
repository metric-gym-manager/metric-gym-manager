'use client';

import { Coins, Languages, MessageCircle, LifeBuoy } from 'lucide-react';

const features = [
  {
    icon: 'rupee',
    label: 'Local Pricing',
    sublabel: 'No forex hassle',
  },
  {
    icon: 'language',
    label: 'Trilingual Support',
    sublabel: 'Sinhala · Tamil · English',
  },
  {
    icon: 'whatsapp',
    label: 'WhatsApp Reminders',
    sublabel: 'Where your members are',
  },
  {
    icon: 'support',
    label: 'On-site Support',
    sublabel: 'We come to you',
  },
];

const renderIcon = (iconType: string) => {
  const iconProps = {
    size: 24,
    strokeWidth: 2,
  };

  switch (iconType) {
    case 'rupee':
      return <Coins {...iconProps} />;
    case 'language':
      return <Languages {...iconProps} />;
    case 'whatsapp':
      return <MessageCircle {...iconProps} />;
    case 'support':
      return <LifeBuoy {...iconProps} />;
    default:
      return null;
  }
};

export function LankaSection() {
  return (
    <section
      id="lanka"
      className="overflow-hidden"
      style={{
        padding: '180px 24px',
        background: '#000000',
      }}
    >
      <div className="max-w-[1120px] mx-auto text-center">
        {/* Main Text - Oversized and Animated */}
        <h2
          className="mb-16"
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
                className="mb-3 flex items-center justify-center"
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'transparent',
                  border: '1.5px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '14px',
                  color: '#ffffff',
                }}
              >
                {renderIcon(feature.icon)}
              </div>

              {/* Label */}
              <div
                className="mb-1"
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                {feature.label}
              </div>

              {/* Sublabel */}
              <div
                style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.7)',
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
