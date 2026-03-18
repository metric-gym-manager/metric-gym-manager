'use client';

import { useEffect, useRef } from 'react';

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
          className="text-center mb-4"
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
        <div className="testimonials-container">
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
            padding: 80px 24px;
          }

          .testimonials-headline {
            font-size: 32px !important;
            line-height: 1.15 !important;
            margin-bottom: 40px !important;
          }

          .testimonials-container {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -ms-overflow-style: none;
            margin: 0 -24px;
            padding: 0 24px;
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
        }
      `}</style>
    </section>
  );
}
