'use client';

import { useEffect, useRef, useState } from 'react';

const testimonials = [
  {
    quote:
      'The automated SMS reminders have dramatically reduced missed payments. Our revenue is up 30%!',
    author: 'Kasun Perera',
    role: 'Manager at Iron Temple Colombo',
  },
  {
    quote:
      'Simple, intuitive, and powerful. Exactly what we needed to streamline our operations.',
    author: 'Sanduni Fernando',
    role: 'Owner at FitZone Galle',
  },
  {
    quote:
      'Customer support is outstanding and the platform is rock solid. Highly recommended!',
    author: 'Nuwan Silva',
    role: 'Co-Founder at Elite Fitness Kandy',
  },
  {
    quote:
      'Switching to Metric was the best decision for our gym. Member management has never been easier.',
    author: 'Chamari Wickramasinghe',
    role: 'Owner at PowerZone Negombo',
  },
];

export function NewTestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userInteractedRef = useRef(false);

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

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-scroll functionality for mobile
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const startAutoScroll = () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }

      autoScrollTimerRef.current = setInterval(() => {
        if (!userInteractedRef.current && containerRef.current) {
          const nextIndex = (activeIndex + 1) % testimonials.length;
          scrollToIndex(nextIndex);
        }
      }, 4000); // Auto-scroll every 4 seconds
    };

    startAutoScroll();

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [isMobile, activeIndex]);

  // Update active index based on scroll position
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = 320 + 16; // card width + gap
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(index);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const cardWidth = 320 + 16; // card width + gap
    const scrollPosition = index * cardWidth;
    containerRef.current.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });
    setActiveIndex(index);
  };

  const handleDotClick = (index: number) => {
    userInteractedRef.current = true;
    scrollToIndex(index);
    // Resume auto-scroll after 10 seconds of no interaction
    setTimeout(() => {
      userInteractedRef.current = false;
    }, 10000);
  };

  const handleTouchStart = () => {
    userInteractedRef.current = true;
    setTimeout(() => {
      userInteractedRef.current = false;
    }, 10000);
  };

  return (
    <section
      id="reviews"
      ref={sectionRef}
      className="testimonials-section"
      style={{
        background: '#ffffff',
      }}
    >
      <div className="max-w-[1120px] mx-auto">
        {/* Section Label */}
        <div
          className="text-center mb-4 testimonials-label"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#6e6e73',
          }}
        >
          TESTIMONIALS
        </div>

        {/* Section Headline */}
        <h2
          className="text-center mb-16 testimonials-headline"
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#1d1d1f',
            marginBottom: '64px',
          }}
        >
          Loved by gym owners
          <br />
          across Sri Lanka.
        </h2>

        {/* Testimonials Grid */}
        <div
          ref={containerRef}
          className="testimonials-container"
          onTouchStart={handleTouchStart}
        >
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="glass-card scroll-reveal testimonial-card"
                style={{
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                {/* Quote */}
                <p
                  className="mb-6"
                  style={{
                    fontSize: '17px',
                    color: 'rgba(29, 29, 31, 0.8)',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                  }}
                >
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                {/* Author */}
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1d1d1f',
                      marginBottom: '2px',
                    }}
                  >
                    {testimonial.author}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6e6e73',
                    }}
                  >
                    {testimonial.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dot Indicators - Mobile Only */}
        {isMobile && (
          <div className="dot-indicators">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`dot ${index === activeIndex ? 'active' : ''}`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .testimonials-section {
          padding: 140px 24px;
        }

        .testimonials-container {
          width: 100%;
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .testimonial-card {
          padding: 32px;
        }

        @media (max-width: 768px) {
          .testimonials-section {
            padding: 80px 0;
          }

          .testimonials-headline {
            font-size: 32px !important;
            line-height: 1.15 !important;
            margin-bottom: 40px !important;
            padding: 0 24px;
          }

          .testimonials-container {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -ms-overflow-style: none;
            padding: 0 calc((100vw - 320px) / 2);
          }

          .testimonials-container::-webkit-scrollbar {
            display: none;
          }

          .testimonials-grid {
            display: flex;
            gap: 16px;
            width: max-content;
          }

          .testimonial-card {
            width: 320px;
            flex-shrink: 0;
            scroll-snap-align: center;
            padding: 24px;
          }

          .dot-indicators {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 32px;
            padding: 0 24px;
          }

          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.2);
            border: none;
            padding: 0;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .dot.active {
            width: 24px;
            border-radius: 4px;
            background: #1d1d1f;
          }

          .dot:hover {
            background: rgba(0, 0, 0, 0.4);
          }
        }
      `}</style>
    </section>
  );
}
