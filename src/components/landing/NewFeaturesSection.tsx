'use client';

import { useEffect, useRef, useState } from 'react';

const features = [
  {
    title: 'Member Directory',
    description:
      'Comprehensive profiles, multi-location support, staff roles, trainer management, and a branded mobile app.',
    metrics: 'Unlimited scale',
  },
  {
    title: 'Automated Reminders',
    description:
      'Branded SMS, WhatsApp, and email reminders sent automatically before renewals.',
    metrics: '80% fewer late payments',
  },
  {
    title: 'Revenue Analytics',
    description:
      'Predictive insights on retention, revenue forecasting, and automated marketing recommendations that drive growth.',
    metrics: '10x faster insights',
  },
  {
    title: 'Access Control',
    description:
      'HIKVISION & ZKTeco integration for RFID, facial recognition, and fingerprint entry. Full hardware setup included.',
    metrics: 'Zero-touch entry',
  },
];

export function NewFeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll functionality
  useEffect(() => {
    if (isPaused) return;

    autoScrollInterval.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const itemWidth = container.scrollWidth / features.length;
        const nextIndex = (currentIndex + 1) % features.length;

        container.scrollTo({
          left: itemWidth * nextIndex,
          behavior: 'smooth',
        });

        setCurrentIndex(nextIndex);
      }
    }, 5000); // Scroll every 5 seconds

    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
    };
  }, [currentIndex, isPaused]);

  // Handle manual scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const itemWidth = container.scrollWidth / features.length;
      const newIndex = Math.round(container.scrollLeft / itemWidth);
      setCurrentIndex(newIndex);
    }
  };

  // Handle dot navigation
  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const itemWidth = container.scrollWidth / features.length;

      container.scrollTo({
        left: itemWidth * index,
        behavior: 'smooth',
      });

      setCurrentIndex(index);
    }
  };

  // Pause on hover
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  // Scroll reveal animation
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
        padding: '100px 0',
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
          className="mb-4 text-center section-headline"
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
          className="text-center mx-auto section-description"
          style={{
            fontSize: '19px',
            color: '#6e6e73',
            maxWidth: '640px',
            lineHeight: 1.5,
            marginBottom: '48px',
          }}
        >
          From payment reminders to biometric access — one platform handles it all so
          you can focus on what matters: your members.
        </p>

        {/* Features - Horizontal Scroll on All Devices */}
        <div className="features-wrapper">
          <div
            ref={scrollContainerRef}
            className="features-container"
            onScroll={handleScroll}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="features-track">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="feature-item scroll-reveal"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  {/* Screenshot/Image Area */}
                  <div className="screenshot-wrapper">
                    <img
                      src={`/screenshots/${feature.title.toLowerCase().replace(/\s+/g, '-')}.png`}
                      alt={feature.title}
                      className="feature-screenshot"
                      onError={(e) => {
                        // Fallback to placeholder if image doesn't exist
                        e.currentTarget.style.display = 'none';
                        const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                    <div className="screenshot-placeholder" style={{ display: 'none' }}>
                      <div className="placeholder-text">
                        {feature.title}
                      </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="feature-content">
                    {/* Metrics Badge */}
                    <div className="metrics-badge">
                      {feature.metrics}
                    </div>

                    {/* Title */}
                    <h3 className="feature-title">{feature.title}</h3>

                    {/* Description */}
                    <p className="feature-description">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="navigation-dots">
            {features.map((_, index) => (
              <button
                key={index}
                className={`dot ${currentIndex === index ? 'active' : ''}`}
                onClick={() => scrollToIndex(index)}
                aria-label={`Go to feature ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .features-wrapper {
          position: relative;
          width: 100%;
        }

        .features-container {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
          cursor: grab;
          padding: 0 max(24px, calc((100vw - 1200px) / 2));
        }

        .features-container:active {
          cursor: grabbing;
        }

        .features-container::-webkit-scrollbar {
          display: none;
        }

        .features-track {
          display: flex;
          gap: 60px;
          width: max-content;
        }

        .feature-item {
          display: flex;
          flex-direction: column;
          width: min(calc(100vw - 120px), 600px);
          flex-shrink: 0;
          scroll-snap-align: center;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .screenshot-wrapper {
          width: 100%;
          max-width: 500px;
          margin: 0 auto 24px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .feature-item:hover .screenshot-wrapper {
          transform: translateY(-8px) scale(1.01);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
        }

        .feature-screenshot {
          width: 100%;
          height: auto;
          max-height: 300px;
          object-fit: cover;
          display: block;
        }

        .screenshot-placeholder {
          width: 100%;
          height: 280px;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.04) 0%, rgba(0, 0, 0, 0.02) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .placeholder-text {
          font-size: 18px;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.2);
          text-align: center;
          padding: 20px;
        }

        .feature-content {
          display: flex;
          flex-direction: column;
          max-width: 520px;
          margin: 0 auto;
        }

        .metrics-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 980px;
          font-size: 13px;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.06);
          color: #1d1d1f;
          margin-bottom: 12px;
          width: fit-content;
        }

        .feature-title {
          font-size: 28px;
          font-weight: 700;
          color: #1d1d1f;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .feature-description {
          font-size: 16px;
          color: #6e6e73;
          line-height: 1.5;
        }

        /* Navigation Dots */
        .navigation-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 48px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.15);
          border: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 0;
        }

        .dot:hover {
          background: rgba(0, 0, 0, 0.3);
          transform: scale(1.2);
        }

        .dot.active {
          background: #1d1d1f;
          width: 24px;
          border-radius: 4px;
        }

        /* Mobile: Smaller dimensions */
        @media (max-width: 768px) {
          .features-container {
            padding: 0 24px;
          }

          .features-track {
            gap: 40px;
          }

          .feature-item {
            width: calc(100vw - 48px);
          }

          .screenshot-wrapper {
            margin-bottom: 20px;
            max-width: 100%;
          }

          .feature-screenshot {
            max-height: 220px;
          }

          .screenshot-placeholder {
            height: 220px;
          }

          .feature-title {
            font-size: 24px;
          }

          .feature-description {
            font-size: 15px;
          }

          .navigation-dots {
            margin-top: 32px;
          }

          .section-headline {
            font-size: 32px !important;
            line-height: 1.15 !important;
            margin-bottom: 16px !important;
          }

          .section-description {
            font-size: 16px !important;
            line-height: 1.6 !important;
            margin-bottom: 32px !important;
            padding: 0 8px;
          }
        }

        /* Tablet */
        @media (min-width: 769px) and (max-width: 1024px) {
          .feature-item {
            width: calc(100vw - 120px);
          }

          .screenshot-wrapper {
            max-width: 450px;
          }

          .feature-screenshot {
            max-height: 260px;
          }

          .screenshot-placeholder {
            height: 240px;
          }

          .feature-title {
            font-size: 26px;
          }

          .feature-description {
            font-size: 15px;
          }
        }
      `}</style>
    </section>
  );
}
