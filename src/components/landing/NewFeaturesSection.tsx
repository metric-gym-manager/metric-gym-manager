'use client';

import { useEffect, useRef } from 'react';

const features = [
  {
    title: 'AI-Powered Analytics',
    description:
      'Predictive insights on retention, revenue forecasting, and automated marketing recommendations that drive growth.',
    metrics: '10x faster insights',
  },
  {
    title: 'Automated Reminders',
    description:
      'Branded SMS, WhatsApp, and email reminders sent automatically before renewals.',
    metrics: '80% fewer late payments',
  },
  {
    title: 'Biometric Access Control',
    description:
      'HIKVISION & ZKTeco integration for RFID, facial recognition, and fingerprint entry. Full hardware setup included.',
    metrics: 'Zero-touch entry',
  },
  {
    title: 'Unlimited Members',
    description:
      'Comprehensive profiles, multi-location support, staff roles, trainer management, and a branded mobile app.',
    metrics: 'Unlimited scale',
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
        padding: '140px 0',
        background: '#ffffff',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Label */}
        <div
          className="mb-4 text-center"
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
          className="mb-4 text-center"
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
          className="text-center mx-auto"
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

        {/* Features - Grid on Desktop, Horizontal Scroll on Mobile */}
        <div className="features-container">
          <div className="features-grid">
            {features.map((feature, index) => (
              <div
                key={index}
                className="feature-card scroll-reveal"
                style={{
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                {/* Visual Screenshot Area */}
                <div
                  className="screenshot-area"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.04) 0%, rgba(0, 0, 0, 0.02) 100%)',
                    borderBottom: '2px solid rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <div className="screenshot-placeholder">
                    {/* Placeholder for actual screenshot/mockup */}
                    <div
                      className="visual-icon"
                      style={{
                        background: 'linear-gradient(135deg, #1d1d1f 0%, #000000 100%)',
                      }}
                    >
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <path
                          d="M8 12L11 15L16 9"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="card-content">
                  {/* Metrics Badge */}
                  <div
                    className="metrics-badge"
                    style={{
                      background: 'rgba(0, 0, 0, 0.06)',
                      color: '#1d1d1f',
                    }}
                  >
                    {feature.metrics}
                  </div>

                  {/* Title */}
                  <h3 className="card-title">{feature.title}</h3>

                  {/* Description */}
                  <p className="card-description">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .features-container {
          width: 100%;
          overflow: hidden;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .feature-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
          border-color: rgba(0, 0, 0, 0.12);
        }

        .screenshot-area {
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .screenshot-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .visual-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        .card-content {
          padding: 32px;
        }

        .metrics-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 980px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 24px;
          font-weight: 700;
          color: #1d1d1f;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .card-description {
          font-size: 16px;
          color: #6e6e73;
          line-height: 1.6;
        }

        /* Mobile: Horizontal Scrolling */
        @media (max-width: 768px) {
          .features-container {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -ms-overflow-style: none;
            margin: 0 -24px;
            padding: 0 24px;
          }

          .features-container::-webkit-scrollbar {
            display: none;
          }

          .features-grid {
            display: flex;
            gap: 16px;
            width: max-content;
          }

          .feature-card {
            width: 320px;
            flex-shrink: 0;
            scroll-snap-align: center;
          }

          .screenshot-area {
            height: 200px;
          }

          .visual-icon {
            width: 64px;
            height: 64px;
          }

          .card-content {
            padding: 24px;
          }

          .card-title {
            font-size: 20px;
          }

          .card-description {
            font-size: 15px;
          }
        }

        /* Tablet */
        @media (min-width: 769px) and (max-width: 1024px) {
          .features-grid {
            gap: 20px;
          }

          .screenshot-area {
            height: 220px;
          }
        }
      `}</style>
    </section>
  );
}
