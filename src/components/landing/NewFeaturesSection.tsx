'use client';

import { useEffect, useRef } from 'react';

const features = [
  {
    icon: '◎',
    color: '#60a5fa',
    title: 'AI-Powered Analytics',
    description:
      'Predictive insights on retention, revenue forecasting, and automated marketing recommendations that drive growth.',
  },
  {
    icon: '◈',
    color: '#34d399',
    title: 'Automated Reminders',
    description:
      'Branded SMS, WhatsApp, and email reminders sent automatically before renewals. Reduce late payments by 80%.',
  },
  {
    icon: '◎',
    color: '#a78bfa',
    title: 'Biometric Access Control',
    description:
      'HIKVISION & ZKTeco integration for RFID, facial recognition, and fingerprint entry. Full hardware setup included.',
  },
  {
    icon: '◈',
    color: '#f472b6',
    title: 'Unlimited Members',
    description:
      'Comprehensive profiles, multi-location support, staff roles, trainer management, and a branded mobile app for your gym.',
  },
];

export function NewFeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = sectionRef.current?.querySelectorAll('.scroll-reveal');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      style={{
        padding: '140px 24px',
        background: '#ffffff',
      }}
    >
      <div className="max-w-[1120px] mx-auto">
        {/* Section Label */}
        <div
          className="mb-4"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#6e6e73',
          }}
        >
          CAPABILITIES
        </div>

        {/* Section Headline */}
        <h2
          className="mb-4"
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#1d1d1f',
          }}
        >
          Everything runs
          <br />
          on autopilot.
        </h2>

        {/* Section Description */}
        <p
          className="mb-18"
          style={{
            fontSize: '19px',
            color: '#6e6e73',
            maxWidth: '640px',
            lineHeight: 1.5,
            marginBottom: '72px',
          }}
        >
          From payment reminders to biometric access — one platform handles it all so
          you can focus on what matters: your members.
        </p>

        {/* Features Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          style={{
            marginTop: '72px',
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass-card scroll-reveal p-8 relative overflow-hidden"
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Top gradient line */}
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity duration-300"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent)',
                }}
              />

              {/* Icon Container */}
              <div
                className="mb-6 flex items-center justify-center"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.06)',
                }}
              >
                <span
                  style={{
                    fontSize: '24px',
                    color: feature.color,
                  }}
                >
                  {feature.icon}
                </span>
              </div>

              {/* Title */}
              <h3
                className="mb-3"
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#1d1d1f',
                }}
              >
                {feature.title}
              </h3>

              {/* Description */}
              <p
                style={{
                  fontSize: '15px',
                  color: '#6e6e73',
                  lineHeight: 1.6,
                }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .glass-card:hover .absolute {
          opacity: 1;
        }
      `}</style>
    </section>
  );
}
